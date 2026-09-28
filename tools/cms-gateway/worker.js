/**
 * PropertyFlow blog gateway — a Cloudflare Worker at www.propertyflow.uk/cms-api/*
 *
 * Founder, 28 Sep: marketing "login in admin tab … in backend we use my github
 * than they post our script fix and live". So the blog editor (Decap CMS at
 * /admin/) talks to GitHub through this Worker instead of directly:
 *
 *   writer ── Cloudflare Access (email code) ──> /admin/  (Decap)
 *                                                  │  GitHub API calls
 *                                                  ▼
 *                                   /cms-api/*  (this Worker)
 *                                                  │  + the founder's GitHub key
 *                                                  ▼
 *                                          api.github.com
 *
 * WHY A GATEWAY AND NOT "HAND DECAP THE KEY". Decap's GitHub backend keeps its
 * token in the browser. Given the real key, every writer's browser would hold
 * a key that can rewrite the whole website. Here the browser holds a
 * placeholder; the key lives only in this Worker (a secret, GITHUB_TOKEN), and
 * the Worker lets through only what the blog needs.
 *
 * WHAT IT LETS THROUGH
 *   - reads of this one repo (it is public anyway) and GET /user (trimmed);
 *   - creating git blobs, trees and commits — on their own these change
 *     nothing anyone can see;
 *   - moving main forward, the only write that publishes. That is allowed only
 *     when the new commit sits directly on top of main and every file it
 *     changes is under content/blog/ or images/blog/ (checked with GitHub's
 *     compare API). So a writer can add, edit and delete posts and their
 *     images, and nothing else on the site.
 *   Everything else is refused with 403.
 *
 * WHO IT LETS IN. Cloudflare Access sits in front of /admin/ and /cms-api/ and
 * asks for an email code. This Worker checks Access's signed token itself as
 * well (ACCESS_TEAM_DOMAIN + ACCESS_AUD), so a mistake in the Access setup
 * fails closed rather than opening the key to the internet. ALLOWED_EMAILS,
 * when set, is a second list the email must be on.
 *
 * Commits record the writer: the author is the Access email, the committer is
 * the key's owner.
 *
 * Setup and settings: tools/cms-gateway/README.md.
 */

const GITHUB = 'https://api.github.com';
const PREFIX = '/cms-api';
const BLOG_PATHS = ['content/blog/', 'images/blog/'];
const SETTINGS = ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'GITHUB_TOKEN', 'REPO', 'BRANCH'];
// Decap's simple-publish reads, and nothing else under the repo (see Decap's
// backend-github API.ts: getDefaultBranch, listFiles, fetchBlobContent,
// readFileMetadata, hasWriteAccess).
const READABLE = ['/branches/', '/git/trees/', '/git/blobs/', '/commits', '/contents/'];
const KEY_PROBLEM = "The editor's GitHub key has expired or been removed. Tell Simran: tools/cms-gateway/README.md, step 1.";
/** Decap needs a token to start; this placeholder is what the browser holds. */
export const PLACEHOLDER_TOKEN = 'cloudflare-access';

export default {
  async fetch(request, env) {
    return handle(request, env);
  },
};

/**
 * @param {Request} request
 * @param {Record<string, string>} env
 * @param {{ fetch?: typeof fetch, now?: () => number }} deps  injected by the tests
 */
export async function handle(request, env, deps = {}) {
  const doFetch = deps.fetch || fetch;
  const now = deps.now || Date.now;
  try {
    const url = new URL(request.url);
    if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) return refuse(404, 'Not found');
    const path = url.pathname.slice(PREFIX.length) || '/';

    // A setup mistake must not look like an expired login.
    const unset = SETTINGS.filter((k) => !env[k] || String(env[k]).includes('FILL-ME'));
    if (unset.length) {
      console.error('cms-gateway: settings missing — refusing everyone:', unset.join(', '));
      return refuse(500, 'The blog editor is not set up yet (tools/cms-gateway/README.md).');
    }

    const who = await verifyAccess(request, env, doFetch, now);
    if (who === KEYS_UNAVAILABLE) return refuse(503, 'Could not check your login just now. Try again in a minute.');
    if (!who) return refuse(401, 'Please log in again at www.propertyflow.uk/admin/');

    if (path === '/auth') return authPage(env);

    const repo = `/repos/${env.REPO}`;
    const method = request.method.toUpperCase();
    const gh = (m, p, body, original) => github(doFetch, env, m, p, body, original);

    if (method === 'GET' || method === 'HEAD') {
      if (path === '/user') return trimmedUser(await gh('GET', '/user'));
      if (path === repo || READABLE.some((r) => path.startsWith(repo + r))) {
        return relay(await gh(method, path + url.search, undefined, request));
      }
      return refuse(403, 'Only the website repository can be read here');
    }

    if (method === 'POST' && path === `${repo}/git/blobs`) {
      return relay(await gh('POST', path, await request.text()));
    }

    if (method === 'POST' && path === `${repo}/git/trees`) {
      const body = await readJson(request);
      const entries = Array.isArray(body?.tree) ? body.tree : [];
      if (!body?.base_tree || entries.length === 0 || !entries.every(blogTreeEntry)) {
        return refuse(403, 'Only blog posts and blog images can be changed');
      }
      return relay(await gh('POST', path, JSON.stringify(body)));
    }

    if (method === 'POST' && path === `${repo}/git/commits`) {
      const body = await readJson(request);
      if (!body || !Array.isArray(body.parents) || body.parents.length !== 1) {
        return refuse(403, 'A blog change must be one commit on top of the site');
      }
      // Record who wrote it; the key's owner stays the committer.
      const at = new Date(now()).toISOString();
      body.author = { name: who.email.split('@')[0], email: who.email, date: at };
      delete body.committer;
      return relay(await gh('POST', path, JSON.stringify(body)));
    }

    if (method === 'PATCH' && path === `${repo}/git/refs/heads/${env.BRANCH}`) {
      const body = await readJson(request);
      if (!body || typeof body.sha !== 'string' || !/^[0-9a-f]{40}$/.test(body.sha) || body.force) {
        return refuse(403, 'The site history cannot be rewritten');
      }
      const why = await publishRefusal(gh, repo, env.BRANCH, body.sha);
      if (why) return refuse(403, why);
      return relay(await gh('PATCH', path, JSON.stringify({ sha: body.sha, force: false })));
    }

    return refuse(403, 'Not part of the blog editor');
  } catch (err) {
    console.error('cms-gateway error', err && err.stack ? err.stack : err);
    return refuse(502, 'The blog editor could not reach GitHub. Try again in a minute.');
  }
}

/**
 * The only write that publishes. Allowed when the new commit is exactly one
 * commit on top of the branch and touches blog files only. Returns why not,
 * or null.
 */
async function publishRefusal(gh, repo, branch, sha) {
  const ref = await gh('GET', `${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  if (ref.status === 401) return KEY_PROBLEM;
  if (!ref.ok) return 'Could not read the site';
  const head = (await ref.json())?.object?.sha;
  if (!head) return 'Could not read the site';
  const cmp = await gh('GET', `${repo}/compare/${head}...${encodeURIComponent(sha)}`);
  if (!cmp.ok) return 'That change is not on top of the site — reload the editor and try again';
  const diff = await cmp.json();
  if (diff.status !== 'ahead' || diff.ahead_by !== 1 || diff.behind_by !== 0) {
    return 'That change is not on top of the site — reload the editor and try again';
  }
  const files = Array.isArray(diff.files) ? diff.files : null;
  // The compare API lists at most 300 files; a blog save touches a handful.
  if (!files || files.length === 0 || files.length >= 300) return 'Only blog posts and blog images can be changed';
  for (const f of files) {
    if (!isBlogPath(f.filename) || (f.previous_filename && !isBlogPath(f.previous_filename))) {
      return 'Only blog posts and blog images can be changed';
    }
  }
  // The compare API reports names, not file types. A commit need not have come
  // through this gateway (anyone can push one into the repo's object store
  // with a pull request from a fork), so check what the blog folders would
  // hold: plain files only. A link or submodule there would stop GitHub Pages
  // deploying the whole site. Read the commit's whole tree, not "sha:folder":
  // a 404 there could mean "no folder" or "not understood", and must not pass.
  const commit = await gh('GET', `${repo}/git/commits/${sha}`);
  if (!commit.ok) return 'Could not check the change — try again';
  const c = await commit.json();
  if (!Array.isArray(c.parents) || c.parents.length !== 1 || c.parents[0]?.sha !== head || !c.tree?.sha) {
    return 'That change is not on top of the site — reload the editor and try again';
  }
  const treeRes = await gh('GET', `${repo}/git/trees/${c.tree.sha}?recursive=1`);
  if (!treeRes.ok) return 'Could not check the change — try again';
  const tree = await treeRes.json();
  if (tree.truncated || !Array.isArray(tree.tree)) return 'Could not check the change — try again';
  const odd = tree.tree.find((e) => BLOG_PATHS.some((prefix) => String(e.path).startsWith(prefix))
    && !((e.type === 'blob' && e.mode === '100644') || (e.type === 'tree' && e.mode === '040000')));
  if (odd) return 'Only plain files can be added to the blog';
  return null;
}

export function isBlogPath(p) {
  if (typeof p !== 'string' || p.length > 300) return false;
  // Decap writes lower-case letters, digits, "-", "_", ".", "~" (its ascii slug
  // setting); nothing else — no spaces, newlines or control characters.
  if (p.split('/').some((seg) => seg === '.' || seg === '..' || !/^[A-Za-z0-9._~-]+$/.test(seg))) return false;
  return BLOG_PATHS.some((prefix) => p.startsWith(prefix) && p.length > prefix.length);
}

function blogTreeEntry(entry) {
  return !!entry && typeof entry === 'object'
    && entry.type === 'blob' && entry.mode === '100644'
    && isBlogPath(entry.path)
    && (entry.sha === null || typeof entry.sha === 'string')
    && entry.content === undefined;
}

// ─── Cloudflare Access ───────────────────────────────────────────────────────

let jwksCache = { at: 0, keys: [] };
export function resetKeyCache() { jwksCache = { at: 0, keys: [] }; }
/** Access's signing keys could not be fetched: not the writer's fault. */
const KEYS_UNAVAILABLE = Symbol('keys unavailable');

/** The writer's email if Access's signed token checks out, else null. */
export async function verifyAccess(request, env, doFetch, now) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, claims;
  try {
    header = JSON.parse(b64urlText(parts[0]));
    claims = JSON.parse(b64urlText(parts[1]));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  const key = await accessKey(env, header.kid, doFetch, now);
  if (key === KEYS_UNAVAILABLE) return KEYS_UNAVAILABLE;
  if (!key) return null;
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) return null;

  const t = Math.floor(now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
  if (typeof claims.exp !== 'number' || claims.exp < t) return null;
  if (typeof claims.nbf === 'number' && claims.nbf > t + 60) return null;
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
  if (!email) return null;
  if (env.ALLOWED_EMAILS) {
    const allowed = env.ALLOWED_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(email)) return null;
  }
  return { email };
}

async function accessKey(env, kid, doFetch, now) {
  const fresh = now() - jwksCache.at < 60 * 60 * 1000;
  let jwk = fresh ? jwksCache.keys.find((k) => k.kid === kid) : undefined;
  if (!jwk) {
    // Unknown kid: Access rotates keys, so refetch once.
    let body;
    try {
      const res = await doFetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = await res.json();
    } catch (err) {
      console.error('cms-gateway: could not fetch the Access signing keys — is ACCESS_TEAM_DOMAIN right?', String(err));
      return KEYS_UNAVAILABLE;
    }
    jwksCache = { at: now(), keys: Array.isArray(body.keys) ? body.keys : [] };
    jwk = jwksCache.keys.find((k) => k.kid === kid);
  }
  if (!jwk) return null;
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

function b64urlBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlText(s) {
  return new TextDecoder().decode(b64urlBytes(s));
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

function github(doFetch, env, method, path, body, original) {
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'propertyflow-cms-gateway',
  };
  // Decap asks for some reads in a particular format (raw file contents).
  const accept = original && original.headers.get('Accept');
  if (accept && /^application\/vnd\.github/.test(accept)) headers.Accept = accept;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return doFetch(GITHUB + path, { method, headers, body });
}

/** Pass GitHub's answer back, minus anything that should not reach the browser. */
function relay(res) {
  if (res.status === 401) {
    console.error('cms-gateway: GitHub refused the key (401)');
    return refuse(502, KEY_PROBLEM);
  }
  const headers = new Headers();
  const type = res.headers.get('Content-Type');
  if (type) headers.set('Content-Type', type);
  headers.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, headers });
}

/** Decap shows the name and picture; the rest of the owner's profile stays here. */
async function trimmedUser(res) {
  if (!res.ok) return relay(res);
  const u = await res.json();
  return json(200, { login: u.login, name: 'PropertyFlow', avatar_url: u.avatar_url });
}

async function readJson(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return null;
  }
}

function refuse(status, message) {
  return json(status, { message });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Decap's "Login with GitHub" button opens this in a popup. Access has already
 * checked the email, so it hands Decap the placeholder straight back (Decap's
 * popup handshake: "authorizing:github", then "authorization:github:success:…").
 * /admin/ normally skips the button entirely; this is for after "Log out".
 */
function authPage(env) {
  const origin = JSON.stringify(env.SITE_ORIGIN || 'https://www.propertyflow.uk');
  const msg = JSON.stringify(`authorization:github:success:${JSON.stringify({ token: PLACEHOLDER_TOKEN, provider: 'github' })}`);
  const html = `<!doctype html><meta charset="utf-8"><title>Signing in…</title><p>Signing in…</p>
<script>
(function () {
  var origin = ${origin};
  function send(e) {
    if (e.origin !== origin || e.data !== 'authorizing:github') return;
    window.removeEventListener('message', send);
    e.source.postMessage(${msg}, origin);
  }
  window.addEventListener('message', send);
  if (window.opener) window.opener.postMessage('authorizing:github', origin);
})();
</script>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
