/**
 * PropertyFlow lead Worker.
 *
 *   visitor's browser  ->  THIS Worker (adds the CRM key)  ->  Operator CRM
 *
 * The homepage form posts its details here. The Worker re-checks them, turns away
 * spam and other websites, then sends them to the CRM's public leads API with the
 * X-Api-Key header. The key lives only in Cloudflare (a secret), never in the page
 * or in this repo.
 *
 * Settings (Cloudflare -> Worker -> Settings -> Variables and Secrets):
 *   CRM_API_KEY      SECRET. The CRM key (TEST now, LIVE at launch).
 *   CRM_URL          The CRM leads address, e.g. https://.../api/v1/public/leads
 *   ALLOWED_ORIGINS  Comma-separated websites allowed to call this Worker.
 *   RATE_LIMITER     Optional Cloudflare rate-limit binding (see wrangler.toml).
 */

const MAX_BODY = 8 * 1024;
const SERVICE_TYPES = ['SELF_MANAGED', 'FULLY_MANAGED'];
const RATE_PER_MIN = 5;           // fallback limit per visitor (per Worker instance)
const hits = new Map();           // fallback rate-limit memory

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cors || {}),
  });
}

function corsFor(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function normPhone(v) {
  let d = String(v || '').replace(/[\s().-]/g, '');
  if (/^00/.test(d)) d = '+' + d.slice(2);
  if (/^0\d/.test(d)) d = '+44' + d.slice(1);
  else if (/^44\d/.test(d)) d = '+' + d;
  return d;
}

/** UK numbers must be +44 followed by 9-10 digits; any other country needs its + code (E.164: 8-15 digits). */
function validPhone(p) {
  if (/^\+44/.test(p)) return /^\+44\d{9,10}$/.test(p);
  return /^\+[1-9]\d{7,14}$/.test(p);
}

function normPostcode(v) {
  const s = String(v || '').replace(/\s+/g, '').toUpperCase();
  return s.length > 3 ? s.slice(0, -3) + ' ' + s.slice(-3) : s;
}

/** Re-check everything the page checked: the browser can be bypassed. Returns {errors} or {body}. */
function validate(b) {
  const errors = {};
  const str = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  const fullName = str(b.fullName, 100);
  const email = str(b.email, 254);
  const phone = normPhone(str(b.phone, 30));
  const postcode = normPostcode(str(b.postcode, 12));
  const bedrooms = Number(b.bedrooms);
  const serviceType = str(b.serviceType, 20);
  const c = b.consent && typeof b.consent === 'object' ? b.consent : {};

  if (fullName.length < 2) errors.fullName = 'required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'invalid';
  if (!validPhone(phone)) errors.phone = 'invalid';
  if (!/^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/.test(postcode)) errors.postcode = 'invalid';
  if (!Number.isInteger(bedrooms) || bedrooms < 1 || bedrooms > 10) errors.bedrooms = 'invalid';
  if (!SERVICE_TYPES.includes(serviceType)) errors.serviceType = 'invalid';
  if (c.email !== true) errors.consent = 'required';
  if (Object.keys(errors).length) return { errors };

  const whatsapp = c.whatsapp === true;
  return {
    body: {
      fullName, email, phone,
      whatsappSameAsPhone: b.whatsappSameAsPhone === true && whatsapp,
      postcode, bedrooms, serviceType,
      consent: { email: true, whatsapp, wording: str(c.wording, 600) },
    },
  };
}

async function limited(env, ip) {
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    const r = await env.RATE_LIMITER.limit({ key: ip });
    return !r.success;
  }
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_PER_MIN;
}

async function sendToCrm(env, body) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {           // one retry for a blip
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(env.CRM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': env.CRM_API_KEY },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (res.status < 500) return res;                      // success, duplicate or a CRM refusal: don't retry
      last = res;
    } catch (e) { last = null; }
  }
  return last;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const originOk = allowed.includes(origin);

    if (request.method === 'OPTIONS') {                      // the browser's "may I?" check
      return originOk ? new Response(null, { status: 204, headers: corsFor(origin) }) : new Response(null, { status: 403 });
    }
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    if (!originOk) return json({ ok: false, error: 'origin' }, 403);   // another website, or no Origin at all
    const cors = corsFor(origin);

    if (!env.CRM_API_KEY || !env.CRM_URL) return json({ ok: false, error: 'not_configured' }, 500, cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await limited(env, ip)) return json({ ok: false, error: 'rate_limited' }, 429, cors);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'too_large' }, 413, cors);
    let data;
    try { data = JSON.parse(raw); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, cors); }
    if (!data || typeof data !== 'object') return json({ ok: false, error: 'bad_json' }, 400, cors);

    if (typeof data.website === 'string' && data.website.trim()) return json({ ok: true }, 200, cors);  // trap field: pretend success

    const v = validate(data);
    if (v.errors) return json({ ok: false, error: 'validation', fields: v.errors }, 400, cors);

    const res = await sendToCrm(env, v.body);
    if (!res) return json({ ok: false, error: 'crm_unreachable' }, 502, cors);
    if (res.status === 202 || res.status === 200 || res.status === 201) {                                       // CREATED or DUPLICATE: both are fine for the visitor
      let crm = String(res.status);
      try { const j = await res.json(); if (j && typeof j.status === 'string') crm = j.status.slice(0, 20); } catch (e) { /* keep the HTTP code */ }
      console.log('CRM replied', res.status, crm);          // code and word only: never the key or the person's details
      return json({ ok: true, crm }, 200, cors);            // lets us see CREATED vs DUPLICATE without a CRM login
    }
    if (res.status === 429) return json({ ok: false, error: 'rate_limited' }, 429, cors);
    console.log('CRM refused the lead, status', res.status);   // status only: never log the key or the person's details
    return json({ ok: false, error: 'crm_rejected' }, 502, cors);
  },
};
