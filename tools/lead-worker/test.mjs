// Runs the Worker against a FAKE CRM on this computer. Sends nothing to the real CRM.
import http from 'node:http';
import assert from 'node:assert/strict';
import worker from './worker.js';

const crmCalls = []; let crmMode = 'created';
const crm = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => (b += d));
  req.on('end', () => {
    crmCalls.push({ headers: req.headers, body: b ? JSON.parse(b) : null });
    if (crmMode === 'down') { res.statusCode = 500; return res.end('{}'); }
    res.statusCode = 202; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: crmMode === 'duplicate' ? 'DUPLICATE' : 'CREATED', leadId: 'x' }));
  });
});
await new Promise((r) => crm.listen(0, r));
const env = { CRM_URL: `http://localhost:${crm.address().port}/api/v1/public/leads`, CRM_API_KEY: 'ocrm_FAKE_TEST_KEY', ALLOWED_ORIGINS: 'https://www.propertyflow.uk,http://localhost:8795' };
const OK = 'https://www.propertyflow.uk';
const lead = (o = {}) => Object.assign({ fullName: 'Test Person', email: 'test@example.com', phone: '07700 900199', whatsappSameAsPhone: true, postcode: 'm11ae', bedrooms: 3, serviceType: 'SELF_MANAGED', consent: { email: true, whatsapp: true, wording: 'I agree.' } }, o);
let ipn = 0;
const post = (body, { origin = OK, ip, method = 'POST', raw } = {}) =>
  worker.fetch(new Request('https://pf-lead.example/lead', { method, headers: Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': ip || `1.1.1.${++ipn}` }, origin ? { Origin: origin } : {}), body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined }), env);

let n = 0; const t = async (name, fn) => { await fn(); console.log('ok  ', name); n++; };

await t('browser preflight allowed for our site', async () => { const r = await post(null, { method: 'OPTIONS' }); assert.equal(r.status, 204); assert.equal(r.headers.get('Access-Control-Allow-Origin'), OK); });
await t('preflight refused for another site', async () => { const r = await post(null, { method: 'OPTIONS', origin: 'https://evil.example' }); assert.equal(r.status, 403); });
await t('valid lead is forwarded with the key header and the exact CRM body', async () => {
  crmCalls.length = 0; const r = await post(lead());
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
  assert.equal(crmCalls.length, 1);
  assert.equal(crmCalls[0].headers['x-api-key'], 'ocrm_FAKE_TEST_KEY');
  assert.deepEqual(crmCalls[0].body, { fullName: 'Test Person', email: 'test@example.com', phone: '+447700900199', whatsappSameAsPhone: true, postcode: 'M1 1AE', bedrooms: 3, serviceType: 'SELF_MANAGED', consent: { email: true, whatsapp: true, wording: 'I agree.' } });
});
await t('key is never in the response', async () => { const r = await post(lead()); assert.ok(!(await r.text()).includes('ocrm_')); });
await t('fully managed value passes', async () => { crmCalls.length = 0; const r = await post(lead({ serviceType: 'FULLY_MANAGED' })); assert.equal(r.status, 200); assert.equal(crmCalls[0].body.serviceType, 'FULLY_MANAGED'); });
await t('DUPLICATE from the CRM still counts as success for the visitor', async () => { crmMode = 'duplicate'; const r = await post(lead()); crmMode = 'created'; assert.equal(r.status, 200); });
await t('unknown extra fields are not passed on', async () => { crmCalls.length = 0; await post(lead({ admin: true, propertyType: 'Flat' })); assert.ok(!('admin' in crmCalls[0].body) && !('propertyType' in crmCalls[0].body)); });
await t('bad email rejected, nothing sent', async () => { crmCalls.length = 0; const r = await post(lead({ email: 'nope' })); assert.equal(r.status, 400); assert.equal(crmCalls.length, 0); });
await t('missing consent rejected', async () => { const r = await post(lead({ consent: { email: false } })); assert.equal(r.status, 400); });
await t('international phone (+91) accepted and sent as typed', async () => { crmCalls.length = 0; const r = await post(lead({ phone: '+91 95417 09271' })); assert.equal(r.status, 200); assert.equal(crmCalls[0].body.phone, '+919541709271'); });
await t('bad phone / postcode / bedrooms / service rejected', async () => { for (const o of [{ phone: '123' }, { phone: '+4412' }, { phone: '9541709271' }, { phone: '+91123' }, { postcode: 'ZZZ' }, { bedrooms: 0 }, { bedrooms: 11 }, { serviceType: 'OTHER' }]) assert.equal((await post(lead(o))).status, 400); });
await t('trap field filled: fake success, nothing sent', async () => { crmCalls.length = 0; const r = await post(lead({ website: 'http://spam' })); assert.equal(r.status, 200); assert.equal(crmCalls.length, 0); });
await t('other website refused', async () => { crmCalls.length = 0; const r = await post(lead(), { origin: 'https://evil.example' }); assert.equal(r.status, 403); assert.equal(crmCalls.length, 0); });
await t('request with no Origin (script) refused', async () => { const r = await post(lead(), { origin: '' }); assert.equal(r.status, 403); });
await t('rate limit: 6th request in a minute from one visitor is refused', async () => { const ip = '9.9.9.9'; const codes = []; for (let i = 0; i < 6; i++) codes.push((await post(lead(), { ip })).status); assert.deepEqual(codes, [200, 200, 200, 200, 200, 429]); });
await t('oversized body refused', async () => { const r = await post(null, { raw: 'x'.repeat(9000) }); assert.equal(r.status, 413); });
await t('broken JSON refused', async () => { assert.equal((await post(null, { raw: '{oops' })).status, 400); });
await t('CRM down: retried once, visitor told to try again (502)', async () => { crmMode = 'down'; crmCalls.length = 0; const r = await post(lead()); crmMode = 'created'; assert.equal(r.status, 502); assert.equal(crmCalls.length, 2); });
await t('missing key setting: safe error, no call', async () => { crmCalls.length = 0; const r = await worker.fetch(new Request('https://x/', { method: 'POST', headers: { Origin: OK, 'CF-Connecting-IP': '7.7.7.7' }, body: JSON.stringify(lead()) }), { ...env, CRM_API_KEY: '' }); assert.equal(r.status, 500); assert.equal(crmCalls.length, 0); });
await t('GET refused', async () => { const r = await worker.fetch(new Request('https://x/', { method: 'GET', headers: { Origin: OK } }), env); assert.equal(r.status, 405); });
console.log(`\n${n} checks passed`); crm.close();
