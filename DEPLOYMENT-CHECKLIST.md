# PropertyFlow Website — Deployment Checklist

**Date:** 25 March 2026
**Prepared by:** Rajat Gupta
**Deploy to:** https://github.com/simu13/propertyflow-website (branch: main)
**Live URL:** www.propertyflow.uk

---

## What's in this package

14 HTML pages + supporting files, ready to replace the current single-page site:

```
website/
├── index.html                                     (Homepage)
├── for-landlords/index.html                       (For Landlords)
├── for-investors/index.html                       (For Investors)
├── about/index.html                               (About)
├── contact/index.html                             (Contact — HubSpot form)
├── blog/index.html                                (Blog)
├── platform/index.html                            (Platform Overview)
├── platform/ai-pricing/index.html                 (AI Pricing)
├── platform/compliance/index.html                 (Compliance)
├── platform/channel-management/index.html         (Channel Management)
├── platform/hands-free/index.html                 (Hands-Free)
├── edinburgh-market/index.html                    (Edinburgh Market)
├── edinburgh-market/pricing-data/index.html       (Pricing Data)
├── edinburgh-market/stl-licensing-guide/index.html (STL Licensing Guide)
├── css/style.css                                  (Shared stylesheet)
├── sitemap.xml                                    (SEO sitemap)
├── robots.txt                                     (Crawler directives)
├── CNAME                                          (www.propertyflow.uk)
├── .nojekyll                                      (Bypass Jekyll processing)
└── api/early-adopter-worker.js                    (Cloudflare Worker — NOT deployed to GitHub)
```

---

## Step-by-step deployment

### 1. Prepare the repo

- [ ] Clone or pull latest from https://github.com/simu13/propertyflow-website
- [ ] Back up the current `privacy-policy.html` and `terms.html` from the existing repo (these are NOT in the new package and must be preserved)
- [ ] The old `landing-page.html` and `careers.html` can be removed or kept — they won't be linked from the new site

### 2. Copy new files

- [ ] Copy the entire contents of the `website/` folder into the repo root
- [ ] Do NOT copy `api/early-adopter-worker.js` to GitHub — this goes to Cloudflare Workers separately
- [ ] Do NOT copy `.DS_Store` files
- [ ] Ensure `CNAME` file contains exactly: `www.propertyflow.uk`
- [ ] Ensure `.nojekyll` file exists (empty file)

### 3. Preserve existing files

- [ ] Keep `privacy-policy.html` from the old repo (or replace with updated version)
- [ ] Keep `terms.html` from the old repo (or replace with updated version)

### 4. Push to GitHub

- [ ] Commit all changes to `main` branch
- [ ] Push to origin
- [ ] GitHub Pages will auto-deploy within 1-2 minutes

### 5. Verify deployment

- [ ] Visit https://www.propertyflow.uk — homepage loads with all sections
- [ ] Check all 14 pages load (see file list above)
- [ ] Test navigation: header links, footer links, mobile menu
- [ ] Test on mobile device
- [ ] Check footer shows: Company No. 16927756, ICO ZC088419, phone +44 204 577 2084

---

## Post-deployment tasks (Rajat)

### HubSpot form (required)

The contact page has a HubSpot form placeholder. To activate it:

1. Go to HubSpot → Marketing → Forms → Create Form
2. Add fields: First Name, Last Name, Email, Phone, Message, "What describes you?" (dropdown), "Number of properties" (dropdown)
3. After creating the form, copy the Form GUID from the embed code
4. In `contact/index.html`, replace `YOUR_FORM_GUID` (appears twice) with the actual GUID
5. Commit and push the update

**Portal ID:** 147879634
**Region:** EU1 (app-eu1.hubspot.com)

### Early adopter counter auto-update (optional)

The homepage counter currently shows a static "841". To make it auto-update from HubSpot:

1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
2. Paste the code from `api/early-adopter-worker.js`
3. Add environment variable: `HUBSPOT_API_KEY` = your HubSpot private app token
4. Deploy the worker
5. Copy the worker URL (e.g., `https://early-adopter.propertyflow.workers.dev`)
6. In `index.html`, find `const WORKER_URL = '';` and paste your worker URL between the quotes
7. Commit and push

**HubSpot Private App setup:**
- Go to HubSpot → Settings → Integrations → Private Apps → Create
- Name: "Website Counter"
- Scopes needed: `crm.objects.deals.read`
- Copy the access token → use as `HUBSPOT_API_KEY` in Cloudflare

### Google Analytics (recommended)

- [ ] Add GA4 tracking snippet to `<head>` of all pages (or use Google Tag Manager)

### Blog posts

- [ ] Blog template is ready — add posts as new HTML files in `/blog/`

---

## Tech stack

- **HTML + Tailwind CSS (CDN)** — no build step required
- **Google Fonts:** Inter (body) + Space Grotesk (headings)
- **No dependencies** — everything loads from CDN
- **Static hosting** — GitHub Pages compatible, no server-side code needed

---

## Important notes

- The `api/` folder contains a Cloudflare Worker script — do NOT push this to GitHub Pages (it won't execute there). Deploy it separately to Cloudflare Workers.
- All pages use relative paths for internal links, so the subdirectory structure must be preserved exactly.
- The CNAME file is critical for the custom domain — do not delete it.
- The .nojekyll file prevents GitHub Pages from processing files through Jekyll — do not delete it.
