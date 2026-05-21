# Pricing rewrite — Free + Premium tiers

**Date:** 2026-05-21
**Author:** Simran (via Claude)
**Repo:** `simu13/propertyflow-website` (marketing site, GitHub Pages)
**Status:** Approved — ready for implementation

---

## Why we're doing this

PropertyFlow's pricing model changed on 2026-05-21. The previous "5% on every booking, no monthly fee, no per-property charge, no tiers" story is no longer accurate. The whole marketing site still tells that story.

**The new model**

| Plan | Subscription | Property limit | Airbnb | Other OTAs |
|---|---|---|---|---|
| **Free** | £0/month | 3 properties max | 0% commission | 5% per booking |
| **Premium** | £9.99 per property/month | Unlimited | 0% commission | 3% per booking |

Both plans give the full feature set — same AI pricing, compliance tracking, guest messaging, Xero bank feed, team management. The tier difference is **property cap + OTA channel access + commission rate on non-Airbnb bookings**, nothing else.

Free is a true free product, not a trial. Premium scales linearly per property — no other base fee or hidden minimums.

---

## Positioning decisions (locked)

### 1. Lead angle: "Replace the stack, retiered"

We keep the existing "your entire STL tech stack in one platform" SEO/marketing story and bolt the new tier structure onto it. We don't pivot to a "Free!" hero or a competitor jab. This is the lowest-risk move for ranking and brand consistency.

Rejected: lead with "Free as the entire story" (too thin), lead with "Built in the UK" (true differentiator but loses the platform-replacement story), lead with competitor jabs at Hospitable/Smoobu (legal risk, off-brand).

### 2. Card hierarchy: equal weight, side-by-side

Free on the left, Premium on the right. Both cards visually equal — no "Recommended" badge, no size hierarchy. Reads as "two genuine options" rather than "we want you on the paid plan". Builds trust; matches the "no lock-in / no hidden fees" tone of the rest of the site.

Rejected: Premium-as-hero with Free as wedge (too pushy), Free-as-hero with Premium subordinate (loses the upgrade story), stacked vertically (loses side-by-side comparison clarity on desktop).

### 3. The 5% non-Airbnb commission on Free: hidden from card, honest in FAQ

The Free card does **not** display "5% on non-Airbnb bookings" anywhere on its surface. Instead the card pushes upgrade with "Want Booking.com, VRBO, or any other channel? → Upgrade to Premium". The actual 5% rate is honestly disclosed in the FAQ ("Yes you can connect Booking.com on Free — 5% per booking. Premium drops to 3%.").

This is the deliberate balance between two failure modes: hiding the 5% entirely (trust collapse when discovered) vs displaying it on the card (kills the clean "Free!" pitch and conversion drops). Mid-path: aspirational on the surface, honest in detail. Hospitable does the same thing.

### 4. CTAs: "Start Free" + "Go Premium"

Two-word CTAs. Active verb, no "Sign up" boilerplate. "No card required" microcopy under the Free CTA. "Cancel anytime" under Premium.

### 5. Premium's 3% framed as a feature, not a number

"Just 3% on non-Airbnb bookings" presented as a tier benefit, not framed as "save 40% on commission" (too quantitative-spammy). The Airbnb-0% on Premium is repeated explicitly so the comparison is unambiguous.

---

## The copy (final, paste-ready)

### Section: pricing block (homepage `index.html` lines 279-365 — full rebuild)

**Eyebrow:** `PRICING`
**Headline:** `Free for Airbnb hosts. Premium when you scale.`

#### Free card (left)

```
FREE

£0 / month
forever

Run your Airbnb business from one dashboard.

✓  Up to 3 properties
✓  Airbnb — 0% commission
✓  AI dynamic pricing
✓  Unified calendar
✓  Guest messaging inbox
✓  Compliance tracking
✓  Financial reporting
✓  Xero bank feed
✓  Team management

—

Want Booking.com, VRBO, or any other channel?
→ Upgrade to Premium

[ Start Free ]
No card required
```

#### Premium card (right)

```
PREMIUM

£9.99
per property / month

Multi-channel hosts. Growing portfolios.

✓  Unlimited properties
✓  Airbnb — 0% commission
✓  Every OTA channel
   (Booking.com, VRBO, Agoda, Trip.com,
    Hopper, Google VR, Direct, + more)
✓  Just 3% on non-Airbnb OTA bookings
✓  Everything in Free

[ Go Premium ]
Cancel anytime
```

**Footer line under both cards:** `Both plans: no lock-in · no setup fees · no hidden charges`

---

### Section: hero subhead + stat (homepage lines 245, 267)

**Subhead (replaces L245):**
> One unified dashboard for your entire STL business. Multi-channel distribution, AI pricing, guest messaging, compliance tracking, and financials — **free for Airbnb hosts**.

**Stat (replaces L267):**
- Big number: `£0` — hard-coded, not animated. Remove the `data-counter="5"` and `data-suffix="%"` attributes from this stat block; keep them on the other two stats.
- Label: `Start Free, Airbnb Included`

The other two hero stats ("AI Pricing", "8+ OTA channels") stay untouched.

---

### Section: "Why PropertyFlow" H2 (homepage L372)

**Replace:** "Your Entire STL Tech Stack.<br>One Platform. From 5%."
**With:** "Your Entire STL Tech Stack.<br>One Platform. **Free to start.**"

---

### Section: feature copy (homepage L416)

**Replace:** "Guest messaging, compliance tracking, financial reporting, team management — no add-ons, no hidden fees. From 5% per booking."
**With:** "Guest messaging, compliance tracking, financial reporting, team management — no add-ons, no hidden fees. Free for Airbnb hosts, £9.99 per property to add every other channel."

---

### Section: CTA section (homepage L579)

**Replace:** "Join UK operators who manage their entire property portfolio from one dashboard. No monthly fees — just 5% per booking, everything included."
**With:** "Join UK operators who manage their entire property portfolio from one dashboard. **Free for up to 3 properties on Airbnb. £9.99 per property to unlock every other channel.**"

---

### Section: FAQ — "How does PropertyFlow pricing work?" (homepage L603 + JSON-LD L143)

```
PropertyFlow has two plans.

Free is £0/month for up to 3 properties with the Airbnb channel —
full AI pricing, compliance tracking, guest messaging and financials
included, no card required. You can connect other OTAs on Free at
5% per booking.

Premium is £9.99 per property per month and unlocks every OTA channel
(Booking.com, VRBO, Expedia, Agoda, Trip.com, Hopper, Google Vacation
Rentals, Direct) with the non-Airbnb commission dropped to 3%.

Airbnb bookings are 0% commission on both plans. No setup fees,
no lock-in, cancel anytime.
```

---

### Section: footer description (homepage L669)

**Replace:** "...AI pricing, distribution, messaging, compliance, and financials — from 5%."
**With:** "...AI pricing, distribution, messaging, compliance and financials — **free to start, £9.99 per property to scale.**"

---

### Section: meta description (homepage L15, L19, L25 + matching JSON-LD)

**Single canonical line** — use everywhere a meta description is needed:

> PropertyFlow — the all-in-one property management platform for UK short-term let operators. Free for Airbnb hosts with up to 3 properties. £9.99 per property to unlock every OTA. AI pricing, compliance, messaging and financials in one dashboard.

**JSON-LD Organization description (L99):**
> "The all-in-one property management platform for short-term let operators. Replaces your entire STL tech stack. Free for Airbnb hosts; £9.99 per property to scale."

**JSON-LD priceRange (L114):**
> `"priceRange": "Free, then £9.99 per property per month"`

**JSON-LD FAQ answer (L143)** — single-paragraph form (no line breaks since it's a JSON string):

> PropertyFlow has two plans. Free is £0/month for up to 3 properties on the Airbnb channel — full AI pricing, compliance tracking, guest messaging and financials included, no card required. You can connect other OTAs on Free at 5% per booking. Premium is £9.99 per property per month and unlocks every OTA channel (Booking.com, VRBO, Expedia, Agoda, Trip.com, Hopper, Google Vacation Rentals, Direct) with the non-Airbnb commission dropped to 3%. Airbnb bookings are 0% commission on both plans. No setup fees, no lock-in.

---

### Other pages — short replacements

| File | Lines | Current | New |
|---|---|---|---|
| `contact/index.html` | 181-182 | "From 5% Per Booking" / "No monthly fees. No per-property charges. Everything included." | "Free to Start" / "£0 for Airbnb hosts up to 3 properties. £9.99/property to unlock every OTA." |
| `about/index.html` | 340-341 | "From 5% Per Booking" / "Everything included, no monthly fees" | "Free to Start" / "£0 for Airbnb hosts. £9.99/property for multi-channel." |
| `for-landlords/index.html` | 15, 17, 18, 28, 29, 35 (meta+title) | "...from 5%" | **Title (L35):** "PropertyFlow For Landlords — Your Properties, One Platform \| Free to Start, £9.99/property to Scale". **Meta description (L15, og:description L18, twitter:description L29):** "PropertyFlow For Landlords — One platform to manage your entire STL business. Free for Airbnb hosts with up to 3 properties. £9.99 per property to unlock every OTA. AI pricing, compliance and financials included." **og:title L17, twitter:title L28:** "PropertyFlow For Landlords — Your Properties, One Platform, Free to Start" |
| `for-landlords/index.html` | 73 (JSON-LD) | "...from 5% platform fee" | "Free for Airbnb hosts. £9.99 per property per month for multi-channel." |
| `for-landlords/index.html` | 103 (FAQ) | "5% per booking — no monthly fees..." | Use the canonical FAQ answer above |
| `for-landlords/index.html` | 181 (hero subhead) | "...all in one dashboard. From 5%." | "...all in one dashboard. **Free to start, £9.99 per property to scale.**" |
| `for-landlords/index.html` | 235, 327, 403, 459 (comparison card + FAQ) | "From 5% Per Booking — No Monthly Fees" comparison card right-hand side (lines 380-420) | Full rebuild of the right-hand comparison card to mirror the homepage Free card shape, but visually inverted (it sits inside a "vs traditional stack" comparison) |
| `for-investors/index.html` | 73 | "...from 5% platform fee" | "...free-to-start STL platform with £9.99/property Premium tier" |
| `platform/index.html` | 16, 18 | "...everything included from 5%" | Use canonical meta |
| `platform/index.html` | 121 | "...all included from 5%." | "...all included. **Free to start, £9.99 per property to scale.**" |
| `platform/index.html` | 235 | "...from 5% per booking." | "...**free to start, £9.99 per property to scale.**" |
| `platform/hands-free/index.html` | 268 | "From 5% platform fee. No lock-in." | "**Free to start. £9.99 per property to scale. No lock-in.**" |
| `edinburgh-market/pricing-data/index.html` | 342 | "Platform fee: from 5%..." | "Platform fee: **Free for Airbnb hosts up to 3 properties. £9.99 per property per month for multi-channel hosts.**" |
| `blog/corporate-let-vs-managed-service/index.html` | 292-293 | Comparison-table cells "From 5% per booking" / "From 5% per booking" | "Free / £9.99 per property" — both cells (these are PropertyFlow's price in a comparison vs traditional letting) |

---

## Implementation notes

1. **No CSS file changes are required.** The new two-card layout reuses existing Tailwind utility classes plus the same inline-style approach the current pricing card uses. If we end up touching `css/style.css` for any reason (we shouldn't need to), bump the `?v=N` cache-buster across all 24 HTML files per the marketing repo's CLAUDE.md.

2. **`sitemap.xml` update:** bump `<lastmod>` to `2026-05-21` on every URL whose page is edited (likely 8-9 of the 21).

3. **No new pages, no removed pages.** Same nav, same footer, same head scripts. The shared-nav-via-copy-paste rule from the marketing CLAUDE.md doesn't trigger.

4. **`for-landlords/index.html` comparison card** (lines 380-420) is the second-biggest edit after the homepage. The left side stays (it's the "old stack" pain — itemising £20/month dynamic pricing tools, etc.). The right side rebuilds as a **single combined "Free or £9.99/property" panel** (NOT two cards) so the comparison reads cleanly: "their stack vs ours". The panel shows both tiers as price points inside one dark card, like:

   ```
   The PropertyFlow way

   Free
   £0/month — up to 3 properties on Airbnb

   Premium
   £9.99 per property — unlimited properties, every OTA

   ✓ AI pricing engine
   ✓ Unified calendar
   ✓ Guest messaging
   ✓ Compliance tracking
   ✓ Financial management + Xero
   ✓ Team management

   [ Get Started Free ]
   ```

5. **Existing Stripe button on the homepage CTA** (line 581: `<a href="https://app.propertyflow.uk/register"` "Sign Up Free") — no change needed; the destination already routes new users to the registration flow. They'll choose Free or Premium inside the app, not on the marketing site.

---

## Out of scope (deliberately)

- **Stripe pricing changes.** The marketing site rewrite leaves the live £36/month Stripe price (`price_1TY5TkCCpi8uXYcwoEXM2HsP`) untouched. Stripe + admin-app changes happen as a separate workstream. The marketing site will go live BEFORE the backend supports the new tier structure.

  **Resolution while backend is mismatched:** Both `[ Start Free ]` and `[ Go Premium ]` CTAs link to the same destination (`https://app.propertyflow.uk/register`). New users land in the registration flow and (today) all start on what is effectively a Free-equivalent account. Premium pricing/billing inside the app gets reconfigured in the separate Stripe-side workstream; until then, anyone reading the marketing site sees the new prices but cannot actually subscribe to Premium yet. The CTA going to `/register` is a soft landing — the visitor signs up, uses what's effectively Free, and we backfill Premium billing once it ships. **Risk acknowledged:** there is a window (estimated days, not weeks) where the marketing site promises a price the app cannot bill. This is a deliberate choice to ship marketing first; if the gap grows beyond ~2 weeks we should put a "Premium launching soon — sign up for early access" microcopy under the Go Premium button.

- **Blog post pricing references** (industry comparison posts) — only the one post that compares PropertyFlow's own price (`corporate-let-vs-managed-service`) needs updating. Other blog posts about Airbnb fees, visitor levies, OTA strategy don't reference our pricing.

- **No new design tokens.** Same colour palette (`--color-orange #E65A38`, `--color-yellow #eea946`, `--color-charcoal #141A23`, `--color-cream #faf8f5`).

- **No new components or sections.** Just rewriting text and the one pricing-card block on three pages (homepage, for-landlords, edinburgh-market/pricing-data).

- **Grandfathered orgs in the product** (9 existing customers on `channexCompAccess=true`) — completely outside this rewrite. They're on legacy terms and the marketing site doesn't address them.

---

## Success criteria

After the rewrite is deployed:

1. No occurrence of "from 5%" or "5% per booking" referring to PropertyFlow's own price anywhere on the site (excluding the FAQ disclosure of the Free-tier non-Airbnb rate).
2. Both pricing tiers visible and explained on the homepage `#two-ways` section.
3. `sitemap.xml` updated.
4. New meta descriptions deployed (Google Search Console will re-crawl within a few days).
5. JSON-LD `priceRange` reflects new model (helps with rich-result eligibility).
6. Build/deploy clean — no broken links, no Tailwind class typos, no anchor mismatches.
