# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Static marketing website for PropertyFlow (`www.propertyflow.uk`), hosted on GitHub Pages. No build step, no bundler, no framework — plain HTML, CSS, and vanilla JS. Deployed automatically on push to `main`.

**GitHub repo:** `simu13/propertyflow-website`
**Custom domain:** `www.propertyflow.uk` (configured via `CNAME` file)
**Staging source:** `https://vibhor1001.github.io/` — the working tree on branch `claude/website-feedback-process-4qsc5v` mirrors this staging redesign (synced 2026-07-16, byte-verified). It is pending marketing content review and must NOT be pushed until sign-off.

## Architecture

### Pages

Every page is a standalone HTML file with the full nav, footer, and script tags copy-pasted. There is no templating system or shared partial — edits to nav, footer, or head tags must be applied to **all 58 pages** manually (59 `.html` files counting the Google verification stub).

Page structure: `index.html` at root, subpages at `{section}/index.html`. Sections:

- `/pricing/`
- `/for-landlords/` — hub + 9 persona/situation sub-pages (just-starting-out, building-a-portfolio, managing-for-owners, new-to-property-software, coming-from-spreadsheets, city-apartments, highlands-and-coast, serviced-accommodation, longer-and-mid-lets)
- `/for-investors/`
- `/become-a-partner/` — hub + 9 sub-pages on the 50/50 partner model
- `/platform/` — hub + 10 feature sub-pages (ai-pricing, channel-management, direct-booking-site, unified-inbox, multi-calendar, compliance, turnovers-team, revenue-reporting, financials-xero, hands-free)
- `/edinburgh-market/` — hub + pricing-data + stl-licensing-guide
- `/about/`, `/careers/`, `/contact/`
- `/blog/` — index + 15 posts/category pages
- Legal at root: `privacy-policy.html`, `terms.html`

### Styling

Hand-written design-system CSS (the previous Tailwind build was retired in the staging redesign):

- `css/site-ds.css` (`?v=12`) — shared design system, loaded by every page
- `css/home-ds.css` (`?v=11`) — additional layer, also loaded by every page
- Class prefix `ds-` (`.ds-nav`, `.ds-hero`, `.ds-mega-panel`, `.ds-grain` …)
- Fixed nav `#ds-nav` with overlay→scrolled state (logo swaps white/dark after 30px scroll)
- Fluid typography via `clamp()`; film-grain overlay `.ds-grain::before` (position: fixed)
- Fonts: Google Fonts — Hanken Grotesk (sans) + Newsreader (serif italic accents)

Legacy `css/style.css` and `css/tailwind.css` are still in the tree but are **no longer referenced by any page** (cleanup candidates, along with `/videos/` and the old `.jpg` showcase images — awaiting owner approval to delete).

### JavaScript

Two vanilla JS files (no dependencies, no modules):

- `js/propertyflow.js` (`?v=10`) — mobile menu, smooth scroll, `[data-counter]` count-up, homepage nav scroll state + hero/intro parallax (`#ds-hero-media`, `#ds-intro-image`, `#ds-operate-image`), mega-menu hover
- `js/cookie-consent.js` — PECR cookie banner (`#pf-cookie-banner`, cookie `pf_cookie_consent`); dispatches `pf:consent-granted` on Accept
- `js/meta-pixel.js` — Meta (Facebook) pixel, **consent-gated** (loads only after `pf_cookie_consent=accepted`). No-op until a Pixel ID is pasted into `PIXEL_ID` at the top of the file. Events: PageView, InitiateCheckout (register clicks), Lead (HubSpot form submit), PartnerApplyIntent + CalculatorEngaged (custom). The app at `app.propertyflow.uk` still needs the same pixel + CompleteRegistration; Conversions API needs a backend.

External via CDN: Leaflet 1.9.4 (unpkg) on `/for-landlords/` only (UK cities map, Carto basemap tiles). AOS/GSAP and the hero-video autoplay system were removed in the redesign — heroes are static `.webp` images under `/images/design/` and `/images/showcase/`.

### Integrations

- **Google Analytics:** GA4 tag `G-59H9NW9QDS` in every page's `<head>`
- **HubSpot (portal 147879634, EU1):** tracking script `js-eu1.hs-scripts.com/147879634.js` on all pages; contact form embed `js-eu1.hsforms.net/forms/embed/147879634.js` with `.hs-form-frame` (`data-form-id="10b60377-1c78-4f3f-936d-c54e3de1fdb5"`)
- **Google Search Console:** verification file `googled34803605d6d7a43.html` — do not edit
- **Structured data:** JSON-LD `Organization` / `BreadcrumbList` (and FAQ on some pages) in page heads

## Critical Rules

- **No shared partials.** Nav, footer, and head changes must be replicated across all 58 pages.
- **Update `sitemap.xml`** when adding or removing pages. `<loc>` URLs use `https://www.propertyflow.uk/...` (the production domain), include `<lastmod>`.
- **Don't break the CNAME file** — it must contain exactly `www.propertyflow.uk`.
- **Style/JS versioning:** bump the `?v=N` cache-buster on `site-ds.css` / `home-ds.css` / `propertyflow.js` in **all** pages when editing those files.
- **Do not push while the staging review is in progress** — content feedback from marketing is being applied locally on the feedback branch first; pushing to `main` deploys to the live domain.

## Deployment

Push to `main` → GitHub Pages deploys automatically. No CI pipeline, no build command. The `.nojekyll` file disables Jekyll processing.
