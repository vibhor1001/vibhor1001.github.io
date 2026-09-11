/**
 * Prove js/analytics.js actually fires, rather than assuming it.
 *
 * Runs against a local static server. Blocks every outbound Google/Meta/HubSpot
 * request so nothing reaches real analytics, and reads what the page TRIED to
 * send by capturing gtag calls and the dataLayer.
 */
/*
 * HOW TO RUN
 *   1. serve the site:  python3 -m http.server 8791
 *   2. node tests/analytics.mjs
 *
 * This repo has no build step and no node_modules, so Playwright is borrowed
 * from the main PropertyFlow repo. Override with PLAYWRIGHT_PATH if it moves.
 *
 * Every outbound Google/Meta/HubSpot request is aborted, so running this never
 * writes to real analytics.
 *
 * All four mutations below were verified to FAIL this suite before being
 * reverted — dropping pfTrack's consent check, matching any HubSpot form as a
 * partner application, skipping first-touch persistence, and skipping app-link
 * decoration. A suite that cannot fail is not protecting anything.
 */
const PW = process.env.PLAYWRIGHT_PATH
  || '/Users/simransingh/projects/propertyflow/e2e/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8791';
const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch();

async function newPage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Nothing leaves the machine.
  await ctx.route('**://*.googletagmanager.com/**', r => r.abort());
  await ctx.route('**://*.google-analytics.com/**', r => r.abort());
  await ctx.route('**://connect.facebook.net/**', r => r.abort());
  await ctx.route('**://*.hs-scripts.com/**', r => r.abort());
  await page.addInitScript(INIT);
  return { ctx, page };
}

/**
 * The page's own inline snippet defines `gtag` as a dataLayer.push wrapper, so
 * BOTH destinations arrive on the dataLayer in two different shapes:
 *
 *   GA4  →  an arguments object: ['event', name, params]
 *   GTM  →  a plain object:      { event: name, ...params }
 *
 * Capturing only one of them was the bug in the first run of this script: it
 * read zero events and looked like the code was dead. Normalise arguments
 * objects to arrays at capture time so the two shapes stay distinguishable.
 */
function INIT() {
  window.__events = [];
  window.dataLayer = [];
  const realPush = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = function () {
    for (const arg of arguments) {
      const norm = (arg && typeof arg === 'object' && typeof arg.length === 'number' && !Array.isArray(arg))
        ? Array.from(arg) : arg;
      window.__events.push(norm);
    }
    return realPush.apply(null, arguments);
  };
}

/** Events GA4 received, via the gtag('event', …) path. */
const ga4Events = evs => evs
  .filter(e => Array.isArray(e) && e[0] === 'event')
  .map(e => ({ name: e[1], p: e[2] || {} }));

/** Events GTM received, via the dataLayer object path. */
const gtmEvents = evs => evs
  .filter(e => e && !Array.isArray(e) && typeof e === 'object' && e.event && e.event !== 'gtm.js')
  .map(e => ({ name: e.event, p: e }));

/** pfTrack's contract is that both get every event. Pin it. */
function bothGot(evs, name) {
  return ga4Events(evs).some(e => e.name === name) && gtmEvents(evs).some(e => e.name === name);
}

const gtagEvents = ga4Events;

// ---------------------------------------------------------------- 1. no consent
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/?utm_source=google&utm_medium=cpc&utm_campaign=2026-09-test`);
  await page.waitForTimeout(600);
  const evs = await page.evaluate(() => window.__events);
  check('no event fires before consent', gtagEvents(evs).length === 0,
    `${gtagEvents(evs).length} events`);
  const stored = await page.evaluate(() => ({
    s: sessionStorage.getItem('pf_attribution'), l: localStorage.getItem('pf_first_touch'),
  }));
  check('nothing stored before consent', !stored.s && !stored.l,
    `session=${stored.s ? 'set' : 'empty'} local=${stored.l ? 'set' : 'empty'}`);

  /* pfTrack is exposed on window so a page can fire its own event. That makes
     its internal consent check load-bearing, not redundant: start() gating on
     consent protects the events wired in this file, but nothing stops a page
     from calling pfTrack directly on load. Removing the check inside pfTrack
     was invisible to every other test here — this is the one that sees it. */
  const sentDirect = await page.evaluate(() => {
    const before = window.__events.length;
    if (typeof window.pfTrack !== 'function') return 'pfTrack not exposed';
    window.pfTrack('manual_page_event', { probe: 1 });
    return window.__events.length - before;
  });
  check('pfTrack called directly before consent sends nothing', sentDirect === 0,
    `pushed ${sentDirect}`);
  await ctx.close();
}

// ------------------------------------------------- 2. consent → attributed view
let attributedPayload = null;
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/?utm_source=Google&utm_medium=cpc&utm_campaign=2026-09-TEST&gclid=Cj0KCQiAtest_XyZ`);
  await page.waitForTimeout(300);
  const accept = page.locator('button:has-text("Accept")').first();
  await accept.click({ timeout: 5000 });
  await page.waitForTimeout(700);
  const evs = gtagEvents(await page.evaluate(() => window.__events));
  const pv = evs.find(e => e.name === 'page_view_attributed');
  check('page_view_attributed fires after consent', !!pv, evs.map(e => e.name).join(', ') || 'none');
  check('the event reaches BOTH GA4 and the GTM dataLayer',
    bothGot(await page.evaluate(() => window.__events), 'page_view_attributed'));
  if (pv) {
    attributedPayload = pv.p;
    check('utm values are lowercased (GA4 splits Google from google)',
      pv.p.utm_source === 'google' && pv.p.utm_campaign === '2026-09-test',
      `source=${pv.p.utm_source} campaign=${pv.p.utm_campaign}`);
    // The old fixture was gclid=abc123 — already lowercase, 6 characters — so
    // it passed identically whether the code preserved case or destroyed it,
    // while every real gclid was being lowercased into a token Google Ads
    // cannot match.
    check('click id survives VERBATIM (case-sensitive)',
      pv.p.gclid === 'Cj0KCQiAtest_XyZ', `gclid=${pv.p.gclid}`);
  }
  const stored = await page.evaluate(() => ({
    s: JSON.parse(sessionStorage.getItem('pf_attribution') || 'null'),
    l: JSON.parse(localStorage.getItem('pf_first_touch') || 'null'),
  }));
  check('attribution persisted only after consent',
    !!stored.s && stored.s.utm_campaign === '2026-09-test' && !!stored.l,
    `first_touch=${stored.l ? stored.l.p.utm_campaign : 'none'}`);

  // app links carry the campaign across the domain boundary
  const href = await page.locator('a[href*="app.propertyflow.uk/register"]').first().getAttribute('href');
  check('app register link decorated with campaign',
    !!href && href.includes('utm_campaign=2026-09-test') && href.includes('gclid=Cj0KCQiAtest_XyZ'),
    href ? href.slice(href.indexOf('?')) : 'no link');

  // signup_click is intent
  await page.evaluate(() => {
    const a = document.querySelector('a[href*="app.propertyflow.uk/register"]');
    a.setAttribute('target', '_blank'); a.click();
  });
  await page.waitForTimeout(300);
  const after = gtagEvents(await page.evaluate(() => window.__events));
  const sc = after.find(e => e.name === 'signup_click');
  check('signup_click fires on outbound register click', !!sc);
  check('no event named "register" is faked here',
    !after.some(e => e.name === 'register'),
    'register belongs to the app');
  await ctx.close();
}

// ------------------------------------------------------------- 3. book_a_call
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/contact/`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
    const dest = await page.evaluate(() => {
      /* Click the CTA by SECTION, not by vendor. This link has already changed
         once — the redesign replaced Calendly with mailto:sales@ — and changes
         again when Amrit's booking link is swapped in. A vendor-coupled
         selector made this test fail the moment the link changed, which reads
         as "the tracking broke" when only the test had. */
      const a = document.querySelector('#book-a-call a[href]');
      if (!a) return null;
      a.setAttribute('target', '_blank');
      a.click();
      return a.getAttribute('href');
    });
    await page.waitForTimeout(300);
    const evs = gtagEvents(await page.evaluate(() => window.__events));
    check('book_a_call fires on whatever the CTA points at',
      evs.some(e => e.name === 'book_a_call'),
      `dest=${dest} events=${evs.map(e => e.name).join(', ')}`);
  await ctx.close();
}

// -------------------------------------------- 4. HubSpot form → named by ID
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/become-a-partner/apply/`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  // Simulate HubSpot's own postMessage for the known partner form.
  await page.evaluate(() => window.postMessage(
    { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: '10b60377-1c78-4f3f-936d-c54e3de1fdb5' }, '*'));
  await page.waitForTimeout(300);
  let evs = gtagEvents(await page.evaluate(() => window.__events));
  check('known form ID → partner_application',
    evs.some(e => e.name === 'partner_application'), evs.map(e => e.name).join(', '));

  // A DIFFERENT form must not be labelled a partner application. This is the
  // one that matters: an undiscriminated handler would count a future
  // market-report submission as a partner lead.
  const before = evs.filter(e => e.name === 'partner_application').length;
  await page.evaluate(() => window.postMessage(
    { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: 'some-other-form-id' }, '*'));
  await page.waitForTimeout(300);
  evs = gtagEvents(await page.evaluate(() => window.__events));
  const after = evs.filter(e => e.name === 'partner_application').length;
  check('an unmapped form is NOT counted as a partner application', after === before,
    `partner_application count ${before} → ${after}`);
  check('unmapped form still surfaces (not silently dropped)',
    evs.some(e => e.name === 'form_submit_unmapped'), evs.map(e => e.name).join(', '));
  await ctx.close();
}

// --------------------------------------------------- 5. GTM off until ID set
{
  const { ctx, page } = await newPage();
  const gtmReqs = [];
  page.on('request', r => { if (r.url().includes('gtm.js')) gtmReqs.push(r.url()); });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 });
  await page.waitForTimeout(700);
  check('GTM does not load while the container ID is empty', gtmReqs.length === 0,
    `${gtmReqs.length} gtm.js requests`);
  await ctx.close();
}

// ------------------------------------------ 6. first-touch survives a new visit
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ctx.route('**://*.googletagmanager.com/**', r => r.abort());
  await ctx.route('**://*.google-analytics.com/**', r => r.abort());
  await ctx.route('**://connect.facebook.net/**', r => r.abort());
  await ctx.route('**://*.hs-scripts.com/**', r => r.abort());
  await page.addInitScript(INIT);

  // Visit 1: paid ad.
  await page.goto(`${BASE}/?utm_source=meta&utm_medium=paid_social&utm_campaign=2026-09-first`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  // Visit 2: arrives from a DIFFERENT campaign and converts. The previous
  // version arrived with no query string at all, so hasArrival was false and
  // the write was skipped for that reason — the `expired` guard the test
  // claims to pin was never reached, and relaxing it kept the test green
  // while first-touch silently degraded into last-touch.
  await page.goto(`${BASE}/for-hosts/?utm_source=google&utm_campaign=2026-09-second`);
  await page.waitForTimeout(700);
  const evs = gtagEvents(await page.evaluate(() => window.__events));
  const pv = evs.reverse().find(e => e.name === 'page_view_attributed');
  check('the original paid campaign still gets credit on a later visit',
    !!pv && pv.p.first_touch_campaign === '2026-09-first',
    `first_touch_campaign=${pv ? pv.p.first_touch_campaign : 'none'}`);
  // And the new campaign is what last-touch reports, so the two are distinct.
  check('the later campaign is recorded as last touch',
    !!pv && pv.p.utm_campaign === '2026-09-second',
    `utm_campaign=${pv ? pv.p.utm_campaign : 'none'}`);
  await ctx.close();
}

// ------------------ 6a. storage failure is FLAGGED, not silently misattributed
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const p of ['**://*.googletagmanager.com/**', '**://*.google-analytics.com/**',
                   '**://connect.facebook.net/**', '**://*.hs-scripts.com/**']) {
    await ctx.route(p, r => r.abort());
  }
  await page.addInitScript(INIT);
  /* Safari private browsing, storage disabled, quota exceeded. Without a flag
     this is the worst failure in the file: persistAttribution() becomes a
     no-op, attribution() falls back to `arrival` which only exists on the
     LANDING page, and every conversion on a later page — the partner form,
     book-a-call, signup_click from a nav CTA — records no campaign and gets
     credited to direct/organic instead of the ad that paid for it. */
  await page.addInitScript(() => {
    const boom = () => { throw new Error('storage disabled'); };
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: boom, removeItem: () => {}, clear: () => {} },
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: boom, removeItem: () => {}, clear: () => {} },
    });
  });

  await page.goto(`${BASE}/?utm_campaign=2026-09-nostorage`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  const evs = gtagEvents(await page.evaluate(() => window.__events));
  const pv = evs.find((e) => e.name === 'page_view_attributed');
  check('storage failure is flagged on the event, not swallowed',
    !!pv && pv.p.attribution_degraded === true,
    pv ? `degraded=${pv.p.attribution_degraded}` : 'no event');
  await ctx.close();
}

// ------------------------- 6b. re-accepting must not double-count the view
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/?utm_campaign=2026-09-dbl`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 });
  await page.waitForTimeout(500);

  // The real reachable journey: cookie-consent.js exposes pfCookieSettings via
  // a "Cookie settings" link in every footer, and accepting from there
  // dispatches pf:consent-granted a second time.
  await page.evaluate(() => window.pfCookieSettings && window.pfCookieSettings());
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 });
  await page.waitForTimeout(500);

  const views = gtagEvents(await page.evaluate(() => window.__events))
    .filter((e) => e.name === 'page_view_attributed');
  check('accepting twice does not double-count the page view', views.length === 1,
    `${views.length} page_view_attributed`);
  await ctx.close();
}

// ------------------- 6c. links injected after load still carry the campaign
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/?utm_campaign=2026-09-late&gclid=Cj0KLate_XyZ`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  /* decorateAppLinks() only sees links present at DOMContentLoaded. Anything
     rendered later — a JS mobile menu, a HubSpot CTA — carried no campaign,
     while signup_click fired WITH it, so the two reports disagreed with no
     way to tell why. */
  const href = await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = 'https://app.propertyflow.uk/register';
    a.textContent = 'late link';
    a.setAttribute('target', '_blank');
    document.body.appendChild(a);
    a.click();
    return a.getAttribute('href');
  });
  await page.waitForTimeout(200);

  check('a link added after load is decorated on click',
    !!href && href.includes('utm_campaign=2026-09-late') && href.includes('gclid=Cj0KLate_XyZ'),
    href || 'no href');
  await ctx.close();
}

// ---------------- 6d. a redirect stub must not strip the campaign
{
  const { ctx, page } = await newPage();
  /* The operators→hosts rename left 9 client-side redirect stubs on URLs that
     were deliberately KEPT for SEO — so they still carry inbound links, and an
     ad can point at one. They redirected with location.hash only, dropping
     location.search, so a paid click arrived at the destination with its
     campaign gone and was credited to direct. */
  await page.goto(`${BASE}/for-landlords/?utm_source=google&utm_campaign=2026-09-redir&gclid=Cj0KRedir_AbC`);
  await page.waitForTimeout(700);

  check('a redirect stub lands on the new URL', page.url().includes('/for-hosts/'), page.url());
  check('and carries the campaign through the redirect',
    page.url().includes('utm_campaign=2026-09-redir') && page.url().includes('gclid=Cj0KRedir_AbC'),
    page.url());

  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const pv = gtagEvents(await page.evaluate(() => window.__events))
    .find((e) => e.name === 'page_view_attributed');
  check('so the destination page can attribute it',
    !!pv && pv.p.utm_campaign === '2026-09-redir' && pv.p.gclid === 'Cj0KRedir_AbC',
    pv ? `campaign=${pv.p.utm_campaign} gclid=${pv.p.gclid}` : 'no event');
  await ctx.close();
}

// ------------- 6e. the sixth event: report request via the email fallback
{
  const { ctx, page } = await newPage();
  /* This is the event that could not be measured at all: Rajat asked for
     "report request" but no HubSpot form exists, so the page falls back to a
     pre-filled email. Tracking the fallback makes it measurable NOW, and the
     same event fires from the HubSpot branch once a GUID is pasted — so the
     wiring does not need revisiting. */
  await page.goto(`${BASE}/own-a-property/?utm_source=google&utm_campaign=2026-09-report`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);

  // The mailto redirect would navigate away; block it so the assertion can run.
  await page.route('mailto:**', (r) => r.abort()).catch(() => {});

  const filled = await page.evaluate(() => {
    const f = document.getElementById('pf-report-form');
    if (!f) return 'no form';
    const set = (n, v) => { const el = f.elements[n]; if (el) el.value = v; };
    set('address', '12 Test Street\nEdinburgh EH1 1AA');
    set('bedrooms', '2');
    set('sleeps', '4');
    set('property_standard', 'Average');
    set('name', 'Test Person');
    set('email', 'test@example.com');
    set('phone', '07700900123');
    f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true }));
    return 'submitted';
  });
  await page.waitForTimeout(500);

  const evs = gtagEvents(await page.evaluate(() => window.__events));
  const ev = evs.find((e) => e.name === 'market_report_request');
  check('report request fires on the email fallback', !!ev,
    `${filled} — events: ${evs.map((e) => e.name).join(', ')}`);
  if (ev) {
    check('it records WHICH route, so email and HubSpot can be told apart',
      ev.p.route === 'email_fallback', `route=${ev.p.route}`);
    check('it carries the campaign that produced the enquiry',
      ev.p.utm_campaign === '2026-09-report', `campaign=${ev.p.utm_campaign}`);
    /* GA4 must never carry personal data. The form collects an address, a
       name, an email and a phone number, and none of them may leave. */
    const leaked = Object.entries(ev.p).filter(([, v]) =>
      typeof v === 'string' && /test@example|Test Person|07700900123|Test Street/i.test(v));
    check('and NO personal data reaches GA4', leaked.length === 0,
      leaked.length ? JSON.stringify(leaked) : 'address/name/email/phone all absent');
  }
  await ctx.close();
}

// ------------- 6f. Meta receives the SAME conversions as GA4, from one call
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const r of ['**://*.googletagmanager.com/**', '**://*.google-analytics.com/**',
                   '**://connect.facebook.net/**', '**://*.hs-scripts.com/**',
                   '**://*.facebook.com/**']) {
    await ctx.route(r, (route) => route.abort());
  }
  await page.addInitScript(INIT);
  /* The pixel has no ID in the repo, so supply one and stub fbq — this test is
     about whether the events REACH Meta, which is what decides whether the
     £500/month has anything to optimise toward. */
  await page.addInitScript(() => {
    window.PF_META_PIXEL_ID = '1234567890123456';
    window.__meta = [];
    Object.defineProperty(window, 'fbq', {
      configurable: true, writable: true,
      value: (...a) => { window.__meta.push(a); },
    });
  });

  await page.goto(`${BASE}/contact/`);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Accept")').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const a = document.querySelector('#book-a-call a[href]');
    if (a) { a.setAttribute('target', '_blank'); a.click(); }
  });
  await page.waitForTimeout(300);

  const meta = await page.evaluate(() => window.__meta);
  const names = meta.map((m) => m[1]);
  check('Meta gets the book-a-call conversion', names.includes('Schedule'),
    names.join(', ') || 'nothing');

  /* The old meta-pixel.js fired its own conversion events too. If both fire,
     every conversion is counted twice and Meta's cost-per-acquisition reads
     half what it really is. */
  const schedules = names.filter((n) => n === 'Schedule').length;
  check('and exactly once — no double-count from two systems', schedules === 1,
    `Schedule x${schedules}`);

  /* signup_click must NOT look like a registration to Meta's bidding. */
  await page.evaluate(() => {
    const a = document.querySelector('a[href*="app.propertyflow.uk/register"]');
    if (a) { a.setAttribute('target', '_blank'); a.click(); }
  });
  await page.waitForTimeout(300);
  const after = (await page.evaluate(() => window.__meta)).map((m) => m[1]);
  check('a click-through is InitiateCheckout, never CompleteRegistration',
    after.includes('InitiateCheckout') && !after.includes('CompleteRegistration'),
    after.join(', '));
  await ctx.close();
}

// ------------------------------- 7. every page actually loads the script
// This repo has no templating — head scripts are copy-pasted per file — so a
// new page shipping without analytics is its most likely silent regression.
{
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  const pages = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'partials') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.html')) pages.push(full);
    }
  })('.');

  /* Two kinds of file are not content pages and must not be required to load
     analytics:
       - search-console / domain verification stubs
       - client-side redirect stubs from the operators→hosts rename (a
         <meta http-equiv="refresh"> and nothing else). Those load no scripts
         at all, including the consent banner, so putting analytics on them
         would track with no way to consent. */
  const VERIFICATION = /^(google[a-z0-9]+|[0-9a-f-]{36})\.html$/;
  const isRedirectStub = (body) => /http-equiv=["']refresh["']/i.test(body)
    && !body.includes('cookie-consent');

  const real = pages.filter((f) => {
    if (VERIFICATION.test(f.split('/').pop())) return false;
    return !isRedirectStub(readFileSync(f, 'utf8'));
  });
  const missing = real.filter((f) => !readFileSync(f, 'utf8').includes('js/analytics.js'));

  check('every content page loads js/analytics.js', missing.length === 0,
    missing.length ? missing.join(', ') : `${real.length} pages`);
}

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name)); process.exit(1); }
