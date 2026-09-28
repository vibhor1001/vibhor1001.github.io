/**
 * The blog gateway (tools/cms-gateway/worker.js) holds the founder's GitHub
 * key. These prove the two things it exists for:
 *   1. nobody gets through without a valid Cloudflare Access login;
 *   2. a writer can publish blog posts and images — and nothing else.
 *
 * HOW TO RUN   node --test tests/cms-gateway.test.mjs
 * No dependencies: GitHub and Cloudflare are faked with an in-memory fetch.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle, isBlogPath, resetKeyCache, PLACEHOLDER_TOKEN } from '../tools/cms-gateway/worker.js';

const TEAM = 'propertyflow.cloudflareaccess.com';
const AUD = 'aud-123';
const REPO = 'simu13/propertyflow-website';
const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);
const ENV = {
  ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, GITHUB_TOKEN: 'ghp_real_key', REPO, BRANCH: 'main',
  SITE_ORIGIN: 'https://www.propertyflow.uk', ALLOWED_EMAILS: 'marketing@propertyflowltd.co.uk',
};

// ─── A real RS256 key pair, so the signature check is exercised for real ────
const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' };
const other = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify']);

const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
async function jwt(claims = {}, { key = privateKey, kid = 'k1', alg = 'RS256' } = {}) {
  const head = b64u(JSON.stringify({ alg, kid }));
  const body = b64u(JSON.stringify({
    aud: [AUD], iss: `https://${TEAM}`, email: 'marketing@propertyflowltd.co.uk',
    exp: Math.floor(NOW / 1000) + 3600, iat: Math.floor(NOW / 1000), ...claims,
  }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(new Uint8Array(sig))}`;
}

// ─── Fake GitHub + Cloudflare ───────────────────────────────────────────────
const NEW = 'ab12'.repeat(10); // the commit Decap wants main to move to
let calls;        // every request that reached "GitHub"
let head;         // main's current commit
let compare;      // what GitHub's compare API says about the new commit
let commitObj;    // GET git/commits/NEW
let treeEntries;  // GET git/trees/<NEW's tree>?recursive=1
let githubStatus; // force every GitHub answer to this status (e.g. 401: key expired)
function fakeFetch(url, init = {}) {
  const u = new URL(url);
  if (u.host === TEAM) return Promise.resolve(Response.json({ keys: [jwk] }));
  assert.equal(u.host, 'api.github.com', `unexpected host ${u.host}`);
  const call = { method: init.method || 'GET', path: u.pathname + u.search, headers: init.headers, body: init.body };
  calls.push(call);
  if (githubStatus) return Promise.resolve(Response.json({ message: 'Bad credentials' }, { status: githubStatus }));
  if (u.pathname === `/repos/${REPO}/git/commits/${NEW}`) return Promise.resolve(Response.json(commitObj));
  if (u.pathname === `/repos/${REPO}/git/trees/t-new` && u.search === '?recursive=1') return Promise.resolve(Response.json({ truncated: false, tree: treeEntries }));
  if (u.pathname === '/user') return Promise.resolve(Response.json({ login: 'simu13', name: 'Simran', email: 'private@x', avatar_url: 'a.png', plan: {} }));
  if (u.pathname === `/repos/${REPO}/git/ref/heads/main`) return Promise.resolve(Response.json({ object: { sha: head } }));
  // Only the range the gateway must ask about (main's head ... the new commit)
  // gets an answer; any other range is "not found", which blocks publishing.
  if (u.pathname === `/repos/${REPO}/compare/${head}...${NEW}`) return Promise.resolve(Response.json(compare));
  if (u.pathname.startsWith(`/repos/${REPO}/compare/`)) return Promise.resolve(Response.json({ message: 'Not Found' }, { status: 404 }));
  return Promise.resolve(Response.json({ ok: true, sha: 'new' }, { status: call.method === 'POST' ? 201 : 200 }));
}

async function send(method, path, { body, token, headers = {} } = {}) {
  const h = new Headers(headers);
  const t = token === undefined ? await jwt() : token;
  if (t) h.set('Cf-Access-Jwt-Assertion', t);
  const req = new Request(`https://www.propertyflow.uk/cms-api${path}`, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle(req, ENV, { fetch: fakeFetch, now: () => NOW });
}
const writes = () => calls.filter((c) => c.method !== 'GET');

beforeEach(() => {
  calls = [];
  head = 'aaa';
  compare = { status: 'ahead', ahead_by: 1, behind_by: 0, files: [{ filename: 'content/blog/new-post.md', status: 'added' }] };
  commitObj = { sha: NEW, parents: [{ sha: 'aaa' }], tree: { sha: 't-new' } };
  treeEntries = [
    { path: 'index.html', mode: '100644', type: 'blob' },
    { path: 'content', mode: '040000', type: 'tree' },
    { path: 'content/blog', mode: '040000', type: 'tree' },
    { path: 'content/blog/new-post.md', mode: '100644', type: 'blob' },
    { path: 'images/blog/cover.webp', mode: '100644', type: 'blob' },
  ];
  githubStatus = 0;
  resetKeyCache();
});

// ─── 1. Login ───────────────────────────────────────────────────────────────
test('no Access token: refused, and GitHub is never called', async () => {
  const res = await send('GET', `/repos/${REPO}`, { token: null });
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

test('a token signed by some other key is refused', async () => {
  const res = await send('GET', `/repos/${REPO}`, { token: await jwt({}, { key: other.privateKey }) });
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

test('a token with a tampered email is refused (signature no longer matches)', async () => {
  const [h, , s] = (await jwt()).split('.');
  const forged = b64u(JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, email: 'marketing@propertyflowltd.co.uk', exp: 9e9, extra: 1 }));
  const res = await send('GET', `/repos/${REPO}`, { token: `${h}.${forged}.${s}` });
  assert.equal(res.status, 401);
});

test('expired, wrong audience, wrong issuer, "none" algorithm: all refused', async () => {
  for (const token of [
    await jwt({ exp: Math.floor(NOW / 1000) - 1 }),
    await jwt({ aud: ['someone-else'] }),
    await jwt({ iss: 'https://evil.cloudflareaccess.com' }),
    (await jwt({}, { alg: 'none' })).split('.').slice(0, 2).join('.') + '.',
    await jwt({ exp: undefined }),
  ]) {
    const res = await send('GET', `/repos/${REPO}`, { token });
    assert.equal(res.status, 401);
  }
  assert.equal(calls.length, 0);
});

test('a valid login for an email not on ALLOWED_EMAILS is refused', async () => {
  const res = await send('GET', `/repos/${REPO}`, { token: await jwt({ email: 'stranger@gmail.com' }) });
  assert.equal(res.status, 401);
});

test('a missing or placeholder setting refuses everyone, and says "not set up" — not "log in again"', async () => {
  for (const [name, value] of [['ACCESS_TEAM_DOMAIN', ''], ['ACCESS_AUD', ''], ['GITHUB_TOKEN', ''], ['REPO', ''], ['BRANCH', ''],
    ['ACCESS_AUD', 'FILL-ME'], ['ACCESS_TEAM_DOMAIN', 'FILL-ME.cloudflareaccess.com']]) {
    calls = [];
    resetKeyCache();
    const req = new Request(`https://www.propertyflow.uk/cms-api/repos/${REPO}`, { headers: { 'Cf-Access-Jwt-Assertion': await jwt() } });
    const res = await handle(req, { ...ENV, [name]: value }, { fetch: fakeFetch, now: () => NOW });
    assert.equal(res.status, 500, `${name}=${value}`);
    assert.match((await res.json()).message, /not set up/);
    assert.equal(calls.length, 0, name);
  }
});

test('Access keys unreachable: "try again", not "log in again", and GitHub is not called', async () => {
  const down = (url, init) => (new URL(url).host === TEAM ? Promise.reject(new Error('network')) : fakeFetch(url, init));
  const req = new Request(`https://www.propertyflow.uk/cms-api/repos/${REPO}`, { headers: { 'Cf-Access-Jwt-Assertion': await jwt() } });
  const res = await handle(req, ENV, { fetch: down, now: () => NOW });
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
});

test('an expired GitHub key is named as the problem, on reads, /user and publishing', async () => {
  githubStatus = 401;
  for (const [method, path, body] of [['GET', `/repos/${REPO}/branches/main`], ['GET', '/user'],
    ['PATCH', `/repos/${REPO}/git/refs/heads/main`, { sha: NEW }]]) {
    const res = await send(method, path, { body });
    assert.ok(res.status === 502 || res.status === 403, `${method} ${path} → ${res.status}`);
    assert.match((await res.json()).message, /GitHub key has expired/);
  }
});

test('a valid login reads the repo, with the real key added here — never from the browser', async () => {
  const res = await send('GET', `/repos/${REPO}/git/trees/main:content/blog`, { headers: { Authorization: `token ${PLACEHOLDER_TOKEN}` } });
  assert.equal(res.status, 200);
  assert.equal(calls[0].path, `/repos/${REPO}/git/trees/main:content/blog`);
  assert.equal(calls[0].headers.Authorization, 'Bearer ghp_real_key');
});

test("Decap's query strings and raw-format requests reach GitHub unchanged", async () => {
  await send('GET', `/repos/${REPO}/commits?path=content%2Fblog%2Fa.md&sha=main`, { headers: { Accept: 'application/vnd.github.v3.raw' } });
  assert.equal(calls[0].path, `/repos/${REPO}/commits?path=content%2Fblog%2Fa.md&sha=main`);
  assert.equal(calls[0].headers.Accept, 'application/vnd.github.v3.raw');
});

test('/user shows Decap a name and picture only, not the owner\'s private profile', async () => {
  const body = await (await send('GET', '/user')).json();
  assert.deepEqual(Object.keys(body).sort(), ['avatar_url', 'login', 'name']);
});

test('the login popup page answers only the site itself', async () => {
  const html = await (await send('GET', '/auth?provider=github')).text();
  assert.match(html, /authorizing:github/);
  assert.match(html, /"https:\/\/www\.propertyflow\.uk"/);
  assert.doesNotMatch(html, /ghp_real_key/);
});

// ─── 2. Blog only ───────────────────────────────────────────────────────────
test('publishing a blog post: the full Decap sequence goes through', async () => {
  assert.equal((await send('POST', `/repos/${REPO}/git/blobs`, { body: { content: 'eA==', encoding: 'base64' } })).status, 201);
  assert.equal((await send('POST', `/repos/${REPO}/git/trees`, { body: { base_tree: 'aaa', tree: [
    { path: 'content/blog/new-post.md', mode: '100644', type: 'blob', sha: 'b1' },
    { path: 'images/blog/cover.webp', mode: '100644', type: 'blob', sha: 'b2' },
  ] } })).status, 201);
  assert.equal((await send('POST', `/repos/${REPO}/git/commits`, { body: { message: 'Blog: add', tree: 't', parents: ['aaa'] } })).status, 201);
  const res = await send('PATCH', `/repos/${REPO}/git/refs/heads/main`, { body: { sha: NEW, force: false } });
  assert.equal(res.status, 200);
  assert.ok(calls.some((c) => c.path === `/repos/${REPO}/compare/aaa...${NEW}`), 'checked main...new');
  const patch = writes().find((c) => c.method === 'PATCH');
  assert.equal(patch.path, `/repos/${REPO}/git/refs/heads/main`);
  assert.deepEqual(JSON.parse(patch.body), { sha: NEW, force: false });
});

test('the commit records which writer made it', async () => {
  await send('POST', `/repos/${REPO}/git/commits`, { body: { message: 'Blog: add', tree: 't', parents: ['aaa'],
    author: { name: 'Founder', email: 'founder@propertyflowltd.co.uk' }, committer: { name: 'x', email: 'x@x' } } });
  const sent = JSON.parse(writes()[0].body);
  assert.equal(sent.author.email, 'marketing@propertyflowltd.co.uk');
  assert.equal(sent.committer, undefined);
});

test('deleting a post is allowed (a tree entry with no content)', async () => {
  const res = await send('POST', `/repos/${REPO}/git/trees`, { body: { base_tree: 'aaa', tree: [
    { path: 'content/blog/old.md', mode: '100644', type: 'blob', sha: null },
  ] } });
  assert.equal(res.status, 201);
});

test('main cannot move if the commit changes anything outside the blog', async () => {
  for (const files of [
    [{ filename: 'index.html' }],
    [{ filename: 'content/blog/ok.md' }, { filename: 'CNAME' }],
    [{ filename: '.github/workflows/blog.yml' }],
    [{ filename: 'content/blog/x.md', previous_filename: 'pricing/index.html' }],
    [],
    // GitHub's compare lists at most 300 files: a full list could hide more.
    Array.from({ length: 300 }, (_, i) => ({ filename: `content/blog/p${i}.md` })),
  ]) {
    calls = [];
    compare = { status: 'ahead', ahead_by: 1, behind_by: 0, files };
    const res = await send('PATCH', `/repos/${REPO}/git/refs/heads/main`, { body: { sha: NEW } });
    assert.equal(res.status, 403, JSON.stringify(files));
    assert.equal(writes().length, 0, 'main was not touched');
  }
});

test('a link or submodule in the blog folders is refused even though its name is fine', async () => {
  for (const bad of [
    { path: 'images/blog/x', mode: '120000', type: 'blob' },       // symlink
    { path: 'content/blog/sub', mode: '160000', type: 'commit' },  // submodule
    { path: 'content/blog/run.sh', mode: '100755', type: 'blob' }, // executable
  ]) {
    calls = [];
    treeEntries = [...treeEntries, bad];
    compare = { status: 'ahead', ahead_by: 1, behind_by: 0, files: [{ filename: bad.path }] };
    const res = await send('PATCH', `/repos/${REPO}/git/refs/heads/main`, { body: { sha: NEW } });
    assert.equal(res.status, 403, bad.mode);
    assert.equal(writes().length, 0);
    treeEntries = treeEntries.filter((e) => e !== bad);
  }
});

test('a commit whose parent is not main (e.g. planted from a fork) is refused', async () => {
  commitObj = { sha: NEW, parents: [{ sha: 'elsewhere' }], tree: { sha: 't-new' } };
  assert.equal((await send('PATCH', `/repos/${REPO}/git/refs/heads/main`, { body: { sha: NEW } })).status, 403);
  commitObj = { sha: NEW, parents: [{ sha: 'aaa' }, { sha: 'bbb' }], tree: { sha: 't-new' } };
  assert.equal((await send('PATCH', `/repos/${REPO}/git/refs/heads/main`, { body: { sha: NEW } })).status, 403);
  assert.equal(writes().length, 0);
});

test('main can only move to a full commit id, not a ref name', async () => {
  for (const sha of ['refs/pull/7/head', 'main', NEW.slice(0, 7), NEW.toUpperCase()]) {
    assert.equal((await send('PATCH', `/repos/${REPO}/git/refs/heads/main`, { body: { sha } })).status, 403, sha);
  }
  assert.equal(calls.length, 0);
});

test('main cannot be rewound, forced, or jumped several commits', async () => {
  for (const c of [
    { status: 'behind', ahead_by: 0, behind_by: 3 },
    { status: 'diverged', ahead_by: 1, behind_by: 1 },   // main moved on since the editor loaded
    { status: 'ahead', ahead_by: 2, behind_by: 0 },
  ]) {
    calls = [];
    compare = { ...c, files: [{ filename: 'content/blog/a.md' }] };
    assert.equal((await send('PATCH', `/repos/${REPO}/git/refs/heads/main`, { body: { sha: NEW } })).status, 403);
    assert.equal(writes().length, 0);
  }
  calls = [];
  assert.equal((await send('PATCH', `/repos/${REPO}/git/refs/heads/main`, { body: { sha: NEW, force: true } })).status, 403);
  assert.equal(calls.length, 0);
});

test('trees outside the blog, with other file types, or without a base are refused', async () => {
  for (const body of [
    { base_tree: 'aaa', tree: [{ path: 'index.html', mode: '100644', type: 'blob', sha: 'b' }] },
    { base_tree: 'aaa', tree: [{ path: 'content/blog/../index.html', mode: '100644', type: 'blob', sha: 'b' }] },
    { base_tree: 'aaa', tree: [{ path: 'content/blog/link', mode: '120000', type: 'blob', sha: 'b' }] },
    { base_tree: 'aaa', tree: [{ path: 'content/blog/dir', mode: '040000', type: 'tree', sha: 'b' }] },
    { base_tree: 'aaa', tree: [{ path: 'content/blog/dir', mode: '100644', type: 'tree', sha: 'b' }] },
    { base_tree: 'aaa', tree: [{ path: 'content/blog/a.md', mode: '100644', type: 'blob', content: '<script>' }] },
    { tree: [{ path: 'content/blog/a.md', mode: '100644', type: 'blob', sha: 'b' }] },
    { base_tree: 'aaa', tree: [] },
    { base_tree: 'aaa' },
  ]) {
    assert.equal((await send('POST', `/repos/${REPO}/git/trees`, { body })).status, 403, JSON.stringify(body));
  }
  assert.equal(writes().length, 0);
});

test('a commit that is not exactly one step on top is refused', async () => {
  for (const parents of [[], ['a', 'b'], undefined]) {
    assert.equal((await send('POST', `/repos/${REPO}/git/commits`, { body: { message: 'm', tree: 't', parents } })).status, 403);
  }
  assert.equal(writes().length, 0);
});

test('everything else is refused: other branches, other repos, settings, deletes', async () => {
  for (const [method, path] of [
    ['PATCH', `/repos/${REPO}/git/refs/heads/other`],
    ['POST', `/repos/${REPO}/git/refs`],
    ['DELETE', `/repos/${REPO}/git/refs/heads/main`],
    ['PUT', `/repos/${REPO}/contents/index.html`],
    ['PATCH', `/repos/${REPO}`],
    ['POST', `/repos/${REPO}/pulls`],
    ['GET', '/repos/simu13/propertyflow'],
    ['GET', `/repos/${REPO}-private`],
    ['GET', `/repos/${REPO}/collaborators`],
    ['GET', `/repos/${REPO}/actions/secrets`],
    ['GET', `/repos/${REPO}-private/contents/secrets.md`],
    ['GET', '/user/repos'],
    ['POST', '/graphql'],
  ]) {
    const res = await send(method, path, { body: method === 'GET' ? undefined : { sha: NEW } });
    assert.equal(res.status, 403, `${method} ${path}`);
  }
  assert.equal(calls.length, 0);
});

test('isBlogPath', () => {
  assert.ok(isBlogPath('content/blog/a.md'));
  assert.ok(isBlogPath('images/blog/a.webp'));
  for (const p of ['content/blog/', 'content/blogx/a.md', 'js/content/blog/x.js', 'admin/images/blog/x.html', 'Content/blog/a.md',
    'content/blog/a\n::error::x.md', 'content/blog/my post.md', 'content/blog/a\u0000.md', 'content/blog//a.md', 'content/blog/../a', '/content/blog/a.md', 'images/a.webp', null]) {
    assert.ok(!isBlogPath(p), String(p));
  }
});
