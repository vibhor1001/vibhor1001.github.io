# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Static marketing website for PropertyFlow (`www.propertyflow.uk`), hosted on GitHub Pages. No build step, no bundler, no framework — plain HTML, CSS, and vanilla JS. Deployed automatically on push to `main`.

**GitHub repo:** `simu13/propertyflow-website`
**Custom domain:** `www.propertyflow.uk` (configured via `CNAME` file)
**Staging source:** `https://vibhor1001.github.io/` — the working tree on branch `claude/website-feedback-process-4qsc5v` mirrors this staging redesign (synced 2026-07-16, byte-verified). It is pending marketing content review and must NOT be pushed until sign-off.

## Architecture

### Pages

Every page is a standalone HTML file with the full nav, footer, and script tags copy-pasted. There is no templating system or shared partial — edits to nav, footer, or head tags must be applied to **all 39 pages** manually (40 `.html` files counting the Google verification stub).

Page structure: `index.html` at root, subpages at `{section}/index.html`. Sections:

- `/pricing/`
- `/for-landlords/` — hub + 9 persona/situation sub-pages (just-starting-out, building-a-portfolio, managing-for-owners, new-to-property-software, coming-from-spreadsheets, city-apartments, highlands-and-coast, serviced-accommodation, longer-and-mid-lets)
- `/for-investors/`
- `/become-a-partner/` — hub + 9 sub-pages on the 50/50 partner model
- `/platform/` — hub + 10 feature sub-pages (ai-pricing, channel-management, direct-booking-site, unified-inbox, multi-calendar, compliance, turnovers-team, revenue-reporting, financials-xero, hands-free)
- `/about/`, `/careers/`, `/contact/`
- Legal at root: `privacy-policy.html`, `terms.html`

### Styling

Hand-written design-system CSS (the previous Tailwind build was retired in the staging redesign):

- `css/site-ds.css` (`?v=12`) — shared design system, loaded by every page
- `css/home-ds.css` (`?v=11`) — additional layer, also loaded by every page
- Class prefix `ds-` (`.ds-nav`, `.ds-hero`, `.ds-mega-panel`, `.ds-grain` …)
- Fixed nav `#ds-nav` with overlay→scrolled state (logo swaps white/dark after 30px scroll)
- Fluid typography via `clamp()`; film-grain overlay `.ds-grain::before` (position: fixed)
- Fonts: Google Fonts — Hanken Grotesk (sans) + Newsreader (serif italic accents)

### Homepage redesign (branch `redesigning2`)

`/index.html` is rebuilt from the Figma "PropertyFlow Marketing Website" homepage (desktop 1280 + mobile 390). It is **self-contained** and does not use `site-ds.css`, `home-ds.css`, `pf-nav.css` or `home-dark.css`:

- `css/home-v2.css` (`?v=1`) — all styles, prefix `hv-`; mobile layout is the `@media (max-width: 900px)` block. The nav and footer on the homepage are its own markup, **not** the shared nav/footer of the other pages.
- `js/home-v2.js` (`?v=1`) — mobile menu (overlay), FAQ accordion, scroll-triggered looping animations, scaling of the channels diagram. No dependencies.
- `images/home-v2/` — photos/logos as WebP, `icons/` as SVG.
- Animations (booking mockups, channels pulses, "One stay" timeline) share one 9.2s loop and only run while on screen; `prefers-reduced-motion` shows the static state. Keyframes come from Figma's motion data.
- The FAQ answers in `index.html` and the `FAQPage` JSON-LD in `<head>` must be kept in step.

Legacy `css/style.css` and `css/tailwind.css` are still in the tree but are **no longer referenced by any page** (cleanup candidates, along with `/videos/` and the old `.jpg` showcase images — awaiting owner approval to delete).

### JavaScript

Two vanilla JS files (no dependencies, no modules):

- `js/propertyflow.js` (`?v=10`) — mobile menu, smooth scroll, `[data-counter]` count-up, homepage nav scroll state + hero/intro parallax (`#ds-hero-media`, `#ds-intro-image`, `#ds-operate-image`), mega-menu hover
- `js/cookie-consent.js` — PECR cookie banner (`#pf-cookie-banner`, cookie `pf_cookie_consent`); dispatches `pf:consent-granted` on Accept
- `js/meta-pixel.js` — Meta (Facebook) pixel, **consent-gated** (loads only after `pf_cookie_consent=accepted`). No-op until a Pixel ID is pasted into `PIXEL_ID` at the top of the file. Events: PageView, InitiateCheckout (register clicks), Lead (HubSpot form submit), PartnerApplyIntent + CalculatorEngaged (custom). The app at `app.propertyflow.uk` still needs the same pixel + CompleteRegistration; Conversions API needs a backend.

External via CDN: none (the Leaflet map was removed with its orphaned script). AOS/GSAP and the hero-video autoplay system were removed in the redesign — heroes are static `.webp` images under `/images/design/` and `/images/showcase/`.

### Integrations

- **Google Analytics:** GA4 tag `G-59H9NW9QDS` in every page's `<head>`
- **HubSpot (portal 147879634, EU1):** tracking script `js-eu1.hs-scripts.com/147879634.js` on all pages; contact form embed `js-eu1.hsforms.net/forms/embed/147879634.js` with `.hs-form-frame` (`data-form-id="10b60377-1c78-4f3f-936d-c54e3de1fdb5"`)
- **Google Search Console:** verification file `googled34803605d6d7a43.html` — do not edit
- **Structured data:** JSON-LD `Organization` / `BreadcrumbList` (and FAQ on some pages) in page heads

## Critical Rules

- **No shared partials.** Nav, footer, and head changes must be replicated across all 39 pages. The edinburgh-market section was removed at owner instruction (16 Jul 2026) — the nav has no Resources menu. The blog came back on 28 Sep 2026 (see **Blog** below); it is linked from the footer's Company column only.
- **Update `sitemap.xml`** when adding or removing pages. `<loc>` URLs use `https://www.propertyflow.uk/...` (the production domain), include `<lastmod>`.
- **Don't break the CNAME file** — it must contain exactly `www.propertyflow.uk`.
- **Style/JS versioning:** bump the `?v=N` cache-buster on `site-ds.css` / `home-ds.css` / `propertyflow.js` in **all** pages when editing those files.
- **Do not push while the staging review is in progress** — content feedback from marketing is being applied locally on the feedback branch first; pushing to `main` deploys to the live domain.

## Blog (`/blog/`, added 28 Sep 2026)

Marketing writes posts at **`/admin/`** (Decap CMS). Press Publish and the post is live in a minute or two. There is no approval step: posts are approved before anyone types them in. Writers never touch GitHub.

- **Login**: Cloudflare Access, with an email code, sits in front of `/admin/` and `/cms-api/`. The allowed email is `marketing@propertyflowltd.co.uk`.
- **GitHub**: Decap reaches GitHub only through the Worker in `tools/cms-gateway/` (route `www.propertyflow.uk/cms-api*`).
  - The Worker holds the founder's fine-grained key for this one repo.
  - It lets `main` move only by one commit that touches `content/blog/` or `images/blog/`. Setup steps are in its `README.md`.
- **Word documents**: in the editor, Media → Upload a `.docx`. It lands in `images/blog/`, and the Action runs `tools/docx-to-post.py`.
  - The script turns it into `content/blog/<url>.md` with `draft: true`, plus WebP pictures, and deletes the upload.
  - The label lines at the top of marketing's docs (Meta Title / Recommended URL / Meta Description) fill the fields, and the Heading 1 is the title.
  - Re-uploading replaces a draft but never a live post; a clash with a live post gets `-2`.
  - Pictures go in `images/blog/word/<url>/`, which only the script writes to.
  - **The repo is public.** An uploaded `.docx`, with its Word comments and author names, is public on the site for about 2 minutes and stays in git history for good, so the editor tells writers to delete comments first. Drafts are public on GitHub too.
- **Source**: `content/blog/<url>.md`, Markdown with YAML front matter. The fields are defined in `admin/config.yml` and read by `tools/build-blog.py`; keep the two in step.
- **Build**: `.github/workflows/blog.yml` runs `tools/build-blog.py` and `tools/build-sitemap.py` on every post save, and daily at 06:15 UK so future-dated posts go out on their day.
  - It commits `blog/**` and `sitemap.xml`, then requests a Pages build.
  - A post that fails to build is skipped: the rest still go live, and the run fails so GitHub emails the owner.
- **Generated, never edit by hand**: `blog/**/index.html`. The nav, footer and head are lifted from `careers/index.html` at build time.
- **By hand**: `pip install -r tools/requirements.txt`, then `python3 tools/build-blog.py` (add `--all` to preview future posts).
- **Tests**:
  - `node --test tests/cms-gateway.test.mjs` proves the gateway lets only blog changes through.
  - `python3 -m unittest tests/test_build_blog.py` runs the builder tests.
  - `python3 -m unittest tests/test_docx_to_post.py` runs the Word import tests (they also need `pip install python-docx`).

## Deployment

Push to `main` → GitHub Pages deploys automatically. The `.nojekyll` file disables Jekyll processing. There is no build command for the site itself. The one workflow is the blog build above, which only runs when blog sources change, plus its daily run.
