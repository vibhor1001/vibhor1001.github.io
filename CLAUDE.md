# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Static marketing website for PropertyFlow (`www.propertyflow.uk`), hosted on GitHub Pages. No build step, no bundler, no framework — plain HTML, CSS, and vanilla JS. Deployed automatically on push to `main`.

**GitHub repo:** `simu13/propertyflow-website`
**Custom domain:** `www.propertyflow.uk` (configured via `CNAME` file)

## Architecture

### Pages

Every page is a standalone HTML file with the full nav, footer, and script tags copy-pasted. There is no templating system or shared partial — edits to nav, footer, or head tags must be applied to **all 24 HTML files** manually.

Page structure: `index.html` at root, subpages at `{section}/index.html` (e.g. `contact/index.html`, `blog/edinburgh-visitor-levy/index.html`).

### Styling

- **Tailwind CSS** via a pre-built `css/tailwind.css` (utility classes used inline in HTML)
- **Custom styles** in `css/style.css` — design system variables, component classes, responsive breakpoints
- Design palette: `--color-charcoal: #141A23`, `--color-orange: #E65A38`, `--color-yellow: #eea946`, `--color-cream: #faf8f5`
- Background: `var(--color-cream)` (#faf8f5), not white
- Primary button: `btn-primary` (orange gradient with hover lift)
- Fluid typography via `clamp()` — don't use fixed `font-size` on headings
- Footer: 4-column `.footer-grid` — Brand, Navigation, Services, Legal

### JavaScript

Two JS files, both vanilla (no dependencies, no modules):

- `js/propertyflow.js` — AOS scroll animations, mobile menu, typing animation (homepage), counter animation, video autoplay system, GSAP parallax cleanup on mobile
- `js/cookie-consent.js` — PECR-compliant cookie banner, self-contained

External libraries loaded via CDN (not npm):
- AOS 2.3.4 (scroll animations)
- GSAP 3.12.5 + ScrollTrigger (hero video parallax)

### Hero Videos

Each page has a hero section with a background video (`<video class="hero-video-bg">`). The JS has an aggressive autoplay system (preload, retry, touch-kickstart, visibility-change resume). Poster images in `/images/showcase/` serve as fallback.

### Integrations

- **Google Analytics:** GA4 tag `G-59H9NW9QDS` in every page's `<head>`
- **HubSpot:** Forms embed on contact page (`data-form-id="10b60377-..."`), tracking script on all pages
- **Google Search Console:** Verification file `googled34803605d6d7a43.html`
- **Structured data:** JSON-LD `Organization` and `BreadcrumbList` schemas in page heads

## Critical Rules

- **No footer is shared.** Every HTML file has its own copy. When changing nav links, footer content, or head scripts, you must update all 24 files.
- **Update `sitemap.xml`** when adding or removing pages. Include `<lastmod>` with the current date.
- **Don't break the CNAME file** — it must contain exactly `www.propertyflow.uk`.
- **Videos are large files** in `/videos/`. Don't re-encode or replace without reason.
- **`css/tailwind.css` is pre-built** — don't edit it directly. Custom styles go in `css/style.css`.
- **Style versioning:** `style.css` is loaded with `?v=N` cache-buster query param. Bump the version number when making CSS changes (check current value across pages — it may vary).

## Deployment

Push to `main` → GitHub Pages deploys automatically. No CI pipeline, no build command. The `.nojekyll` file disables Jekyll processing.
