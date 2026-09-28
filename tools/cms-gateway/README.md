# Blog editor gateway

The blog editor at `www.propertyflow.uk/admin/` (Decap CMS) reaches GitHub
only through this Cloudflare Worker, at `www.propertyflow.uk/cms-api/*`.
Writers log in with an email code (Cloudflare Access) and never need a GitHub
account. The Worker adds the founder's GitHub key and lets through **only**
changes to `content/blog/` and `images/blog/`. The reasons are in the comment
at the top of `worker.js`, and the rules are proved in `tests/cms-gateway.test.mjs`.

It is also routed on `/content/*` and `/images/blog/*`. Those paths answer
404 for drafts and Word uploads, so GitHub Pages cannot serve them to the
public. Blog pictures pass straight through.

## One-time setup (about 10 minutes)

**1. GitHub key.** Make a fine-grained token that can only touch this one repo.
github.com → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token.

- Name: `PropertyFlow blog editor`
- Expiration: 1 year. Put a reminder in the calendar; the editor stops saving when it expires.
- Repository access: *Only select repositories* → `simu13/propertyflow-website`
- Permissions → Repository → **Contents: Read and write**. Nothing else.

Copy the token for step 2. It goes nowhere else.

**2. Deploy the Worker.** From this folder:

```sh
npx wrangler login                     # opens Cloudflare in the browser
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN   # paste the token from step 1
```

Until step 3 is done the Worker refuses everyone. That is intended: it fails closed.

**3. The email login (Cloudflare Access).** In the Cloudflare dashboard, go to Zero Trust.
The first time, pick a team name and the Free plan. Then Access → Applications → Add an application → Self-hosted:

- Application name: `Blog editor`
- Public hostnames: `www.propertyflow.uk` with path `admin`, and `www.propertyflow.uk` with path `cms-api`
- Policy: Allow → Include → Emails → `marketing@propertyflowltd.co.uk` (add anyone else who writes)
- Login method: One-time PIN

Save. Then copy the application's **Audience (AUD) tag** into `ACCESS_AUD` in
`wrangler.toml`, and the team domain (`<team>.cloudflareaccess.com`) into
`ACCESS_TEAM_DOMAIN`, and run `npx wrangler deploy` again.

**Adding a writer:** add their email to the Access policy *and* to `ALLOWED_EMAILS`
in `wrangler.toml`, then run `npx wrangler deploy`.

## If something goes wrong

- **"Please log in again"**: the Access login has expired. Reload `/admin/`.
- **"Only blog posts and blog images can be changed"**: the gateway refused a change outside the blog. That is working as intended.
- **Saving fails for everyone**: the GitHub key has probably expired. Make a new one (step 1) and run `npx wrangler secret put GITHUB_TOKEN`.
- **Turn the editor off at once**: remove the Worker's route in Cloudflare, or run `npx wrangler delete`. The website itself is unaffected.

## Known trade-off

`/admin/` and `/cms-api/` share an address with the public site. So while a
writer is logged in, any script running on a www.propertyflow.uk page could
use their session to change blog posts. That includes a compromised Google Tag
Manager or HubSpot script. It still could not touch any other page, because
the gateway's rules apply to it too. The fix would be to move the editor to its
own address, for example `cms.propertyflow.uk`, which means one more DNS record
and Access app. That was left out to keep the setup short.
