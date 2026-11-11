# Lead Worker (website form -> Operator CRM)

Browser -> **this Worker** (adds `X-Api-Key`) -> CRM `POST /api/v1/public/leads`.
The key is a Cloudflare **secret**. It must never be put in this repo, the page, or chat.

Test it (fake CRM, nothing real is sent): `node tools/lead-worker/test.mjs`

## Put it live (Cloudflare dashboard, no command line)
1. Cloudflare -> **Workers & Pages** -> **Create** -> **Create Worker** -> name `pf-lead` -> **Deploy**.
2. **Edit code**, delete the sample, paste all of `worker.js`, **Deploy**.
3. Worker -> **Settings -> Variables and Secrets** -> add:
   - `CRM_URL` (Text) = the CRM leads address
   - `ALLOWED_ORIGINS` (Text) = `https://www.propertyflow.uk,https://vibhor1001.github.io` (add `http://localhost:8795` only while testing)
   - `CRM_API_KEY` (**Secret**) = the key
4. Copy the Worker address (`https://pf-lead.<account>.workers.dev`).
5. Put that address in the homepage form: `<form ... data-endpoint="THE ADDRESS">` in `index.html`.

## Going from TEST to LIVE
Change `CRM_URL` and the `CRM_API_KEY` secret in Cloudflare. No website change.

## Dummy mode
While `data-endpoint=""` the form sends nothing (see `js/home-vc.js`).
