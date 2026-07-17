#!/usr/bin/env python3
"""Build the staging change log + audit report docs, and open-items.json for the tracker."""
import json
import os
from collections import OrderedDict

S = os.path.dirname(os.path.abspath(__file__))
DOCS = "/home/user/propertyflow-website/docs/staging-review"
os.makedirs(DOCS, exist_ok=True)

CATEGORY_TITLES = {
    "pricing": "Pricing-model corrections (per the approved plan screenshot)",
    "uk-wide": "UK-wide positioning (Edinburgh-only framing removed)",
    "bugfix": "Bug fixes, factual accuracy, brand & terminology",
}

# ── aggregate the machine log ────────────────────────────────────────
entries = [json.loads(l) for l in open(os.path.join(S, "audit", "replace-log.jsonl"))]
by_id = OrderedDict()
for e in entries:
    k = e["id"]
    if k not in by_id:
        by_id[k] = {"category": e["category"], "find": e["find"], "replace": e["replace"],
                    "files": [], "count": 0}
    by_id[k]["files"].append(f'{e["file"]} (×{e["count"]})')
    by_id[k]["count"] += e["count"]

# ── changes-log.md ───────────────────────────────────────────────────
lines = [
    "# Staging content changes — log of every deviation",
    "",
    "**Branch:** `claude/website-feedback-process-4qsc5v` · **Date:** 16 July 2026",
    "",
    "This branch deviates from the original staging site (`https://vibhor1001.github.io/`) as logged below.",
    "Every entry lists the exact text replaced, the replacement, and the affected files.",
    "Nothing here is on `main` or the live site — publishing requires marketing sign-off.",
    "",
    "## Asset changes",
    "",
    "- **Deleted** (explicitly approved): `videos/` — 5 hero videos, 119 MB; `css/style.css`; `css/tailwind.css` (all unreferenced by the redesign; recoverable from git history).",
    "- **Removed code:** orphaned Leaflet `yield-map` script + CDN tag on `for-landlords/` — it referenced a non-existent container and threw a JavaScript error on every page load.",
    "- **Still present, awaiting approval to delete:** 9 old `images/showcase/*.jpg`, `images/logo.png`, `images/og-default.jpg`, `img/logo-footer*.png`, `docs/specs/2026-05-21-pricing-rewrite-design.md` (superseded by the redesign; not referenced by any page).",
    "",
    "## Text replacements",
    "",
]
for cat, title in CATEGORY_TITLES.items():
    ids = {k: v for k, v in by_id.items() if v["category"] == cat}
    total = sum(v["count"] for v in ids.values())
    lines.append(f"### {title} — {len(ids)} distinct edits, {total} replacements")
    lines.append("")
    for k, v in ids.items():
        files = ", ".join(v["files"][:6]) + (f", … +{len(v['files'])-6} more files" if len(v["files"]) > 6 else "")
        lines.append(f"**`{k}`** — {files}")
        lines.append(f"- was: “{v['find']}”")
        lines.append(f"- now: “{v['replace']}”")
        lines.append("")
with open(os.path.join(DOCS, "changes-log.md"), "w") as f:
    f.write("\n".join(lines))

# ── open items (feed the audit report + tracker) ─────────────────────
OPEN = [
    # ref, page(s), finding, why it needs a human, priority
    ("OP-01", "become-a-partner/what-we-take-on/", "[RESOLVED 16 Jul — owner brief] PropertyFlow's automated backend + a dedicated account manager run the day-to-day (channels, pricing, financials, ground ops); the Partner keeps clients, sales and growth. Hub copy realigned to match what-we-take-on.", "Verify the reworked partner copy in the v3 pack, then mark Verified.", "Must fix"),
    ("OP-02", "privacy-policy.html", "Privacy policy omits Google Analytics entirely (GA4 tag loads on every page), still discloses Cloudflare/Tailwind CDN that no longer exists, and analytics run before consent despite the banner wording.", "Legal/PECR review — policy text and consent gating need a legal-approved rewrite.", "Must fix"),
    ("OP-03", "index.html, for-landlords/, for-investors/, platform/channel-management/", "FAQPage JSON-LD does not mirror the visible FAQs (extra/missing questions; channel-management has schema FAQs with no visible FAQ at all) — Google rich-result policy risk.", "Dev change: mirror on-page FAQs exactly or remove the blocks.", "Should fix"),
    ("OP-04", "site-wide", "Audience naming is inconsistent: nav “Solutions”, footer “For Users”, pages “For Landlords”, body copy “hosts”/“operators”/“users” (e.g. “Edinburgh Visitor Levy: What Users Need to Know”).", "Terminology ruling (record on Terminology sheet), then one sweep.", "Should fix"),
    ("OP-05", "index.html, about/, for-investors/, blog/uk-stl-landscape/", "Unverified headline stats: “£127bn UK tourism economy”, “300k+ active UK STL listings”, “40M+ international visitors”, “2–3× yield” (with a dangling asterisk on for-investors).", "Verify with sources (VisitBritain/AirDNA), cite or soften; remove orphan asterisk.", "Should fix"),
    ("OP-06", "blog posts + edinburgh-market/pricing-data/", "Occupancy figures contradict across pages: 78% is “city average” on pricing-data but “multi-channel/professional” elsewhere vs “65–70% citywide”; listing-decline “halved” vs “30–40%”; price premium “5–7%” vs “5–10%”.", "Pick canonical figures with source, update all pages together.", "Should fix"),
    ("OP-07", "for-investors/", "Visitor-levy card mixes Edinburgh rules (5%, 5-night cap, 2% retention) with a 25 Jan 2027 date (cap removal) without naming either scheme; “Early data from other UK cities” premise is false (Edinburgh is the first).", "Rewrite the card naming the schemes with verified rules.", "Must fix"),
    ("OP-08", "platform/index, channel-management, become-a-partner/", "Absolute claims: “Zero double bookings, ever”, “Zero cash-flow risk”, “24/7 response”, “Unlimited properties, handled at any size”, “illicit operators will be gone in 12 months”.", "Verify contractual reality or soften wording.", "Should fix"),
    ("OP-09", "multiple", "Partner funnel: “Apply…” CTAs point at /contact/ (no application form there — the contact page Partner card loops back to the hub); nav button “Apply to partner” lands on the hub, not /become-a-partner/apply/; CTA labels vary five ways. (Apply-page copy now welcomes planned portfolios, but the destination/form question is still open.)", "Decide the application journey + one CTA label; then point all apply CTAs consistently.", "Should fix"),
    ("OP-10", "index.html", "Eight named testimonials with cities (company founded Dec 2025) — authenticity unverified; founder note now has no name (placeholder “[Founder name]” removed).", "Confirm quotes are real (or mark illustrative); supply the founder's name.", "Must fix"),
    ("OP-11", "blog/corporate-let-vs-managed-service/", "Deprecation banner says the models are retired, but the body still sells them in the present tense; meta description presents them as current.", "Editorial rewrite as an archived/historical piece.", "Should fix"),
    ("OP-12", "edinburgh-market/pricing-data/", "“Last updated: March 2026” with “data refreshed monthly” and “live benchmarks” claims — 4 months stale.", "Refresh the dataset or reword the freshness claims.", "Should fix"),
    ("OP-13", "blog/index.html", "All seven featured cards are Edinburgh topics (UK-wide repositioning); filter pills are inert spans; card read-times disagree with the posts.", "Feature UK-wide posts, wire up or remove filters, align read-times.", "Should fix"),
    ("OP-14", "become-a-partner/what-we-look-for/ + apply/", "[RESOLVED 16 Jul — owner brief] Partner personas confirmed: (a) hosts running their own lets who switch to PropertyFlow, (b) agents managing for landlords, (c) newcomers we train. what-we-look-for and the apply step now welcome all three.", "Verify the persona copy in the v3 pack, then mark Verified.", "Should fix"),
    ("OP-15", "become-a-partner/the-50-50-model/", "“Not a management fee. A real split” vs hub explanation “You charge landlords a management fee of 20% … shared 50/50”.", "Clarify the fee/split explanation so both pages agree.", "Should fix"),
    ("OP-16", "platform/index.html", "“Your entire tech stack included on every plan. No add-ons, no upgrade tiers for the essentials” contradicts the tier cards (Xero sync, team management listed as Premium-only).", "Decide which features are truly on Free, align grid and cards.", "Should fix"),
    ("OP-17", "platform/hands-free/", "[RESOLVED 16 Jul — owner brief] Ops are presented white-label: “PropertyFlow's own operations network … coordinated by your dedicated account manager”. No third-party provider is named anywhere on the site (verified).", "Verify the hands-free JSON-LD copy in v3, then mark Verified.", "Nice to have"),
    ("OP-18", "terms.html", "Governing law names Scotland “and, where applicable, England and Wales”, and “exclusive jurisdiction” is contradicted by a carve-out.", "Legal review of the jurisdiction clause.", "Nice to have"),
    ("OP-19", "privacy-policy.html", "Duplicate contact email line; pf_cookie_consent cookie missing from the cookie table; EU-US DPF cited without the UK Extension.", "Legal/content tidy-up alongside OP-02.", "Nice to have"),
    ("OP-20", "platform/index.html", "“8+ channels live from day one” (was “8”) vs nine channels named elsewhere.", "Confirm canonical channel count and use it everywhere.", "Nice to have"),
    ("OP-21", "blog/edinburgh-visitor-levy/ + cross-links", "Future-tense phrasing (“is coming”, “about to become”) goes stale on 24 July 2026; consider date-anchored wording after launch.", "Editorial pass timed to the levy start.", "Nice to have"),
    ("OP-22", "blog/airbnb-fee-change-edinburgh-hosts/", "Em dashes without spacing (“—up from”, “—but”) ×10; card read-times vs post times.", "Copy tidy-up.", "Nice to have"),
    ("OP-23", "repo", "Old unused images still in repo awaiting approval to delete: images/showcase/*.jpg ×9, images/logo.png, images/og-default.jpg, img/logo-footer*.png, docs/specs/2026-05-21-pricing-rewrite-design.md. Placeholder imagery to be finalised later per owner note.", "Owner approval, then delete (all in git history).", "Nice to have"),
    ("OP-24", "contact/index.html", "“Book a property audit” card has no link/button; “We run the operation and front the costs” claim should match partner-page wording.", "Add the booking link; align the claim.", "Should fix"),
    ("OP-25", "7 blog topic pages", "Article JSON-LD missing datePublished/dateModified (and image on 6); “Updated 2026” byline vague; licensing post says “6 min read” for a ~2-minute article.", "Dev/editorial metadata pass.", "Nice to have"),
    ("OP-26", "edinburgh-market/pricing-data/", "Three dead Tailwind utility classes (text-[#E65A38]) — Tailwind no longer ships; links render unstyled.", "Dev: replace with design-system link class.", "Nice to have"),
    ("OP-27", "edinburgh-market/stl-licensing-guide/", "Internal fee ranges disagree (£600–£1,000 vs £650–£1,000 vs £800–£1,000); dangling “Zero-Gap Strategy” cross-reference; planning fee updated to ~£600+ but needs verification against the current council schedule.", "Verify current Edinburgh fees; align the three ranges; fix the cross-reference.", "Should fix"),
    ("OP-28", "site-wide", "Footer “Ask AI” row: Gemini opens with no pre-filled query unlike ChatGPT/Claude/Perplexity.", "Add query param if supported, else drop the button.", "Nice to have"),
]
json.dump([dict(zip(["ref", "pages", "finding", "action", "priority"], o)) for o in OPEN],
          open(os.path.join(S, "audit", "open-items.json"), "w"), indent=1)

# ── audit-report.md ──────────────────────────────────────────────────
fixed_hi = [
    "Wrong pricing model everywhere (Free “1 property” / “Full Management 5% of booking revenue”) → corrected to Free 1–3 properties £0/month (Airbnb 0%, other OTAs 5%) and Premium £9.99 per extra property/month from the 4th (Airbnb 0%, other OTAs 3%) across ~20 pages incl. all metas, tier cards, tables, FAQs and JSON-LD; 50/50 Partner untouched.",
    "Broken Newsreader Google-Fonts URL (HTTP 400 on all 58 pages — the serif accent font never loaded) → fixed URL on all pages.",
    "“[Founder name]” placeholder live on the homepage → removed (real name needed — OP-10).",
    "False investor claim that Scottish STL licences transfer to a new owner → corrected (licences are not transferable; planning consent runs with the property).",
    "Orphaned Leaflet map script on for-landlords threw a JS error on every page load and shipped Edinburgh-only yield data → removed.",
    "Stale statutory figure “~£401 planning application fee” → updated to ~£600+ with a verify note (OP-27).",
    "Edinburgh-only compliance framing on for-landlords → reframed UK-wide (Scotland licensing / England registration), Edinburgh kept as example.",
    "Ghost product name “Cognito Pricing” in metas/JSON-LD (never visible on pages) → standardised to “Smart Pricing” (10 files).",
    "Brand split “Property Flow” in 45+ title tags (incl. both legal pages) → “PropertyFlow”.",
    "Broken JSON-LD publisher logo (/images/logo.webp does not exist) on homepage + 7 blog pages → pointed at an existing asset.",
    "Wrong “Highlands & coast” nav link on 5 pages → /for-landlords/highlands-and-coast/.",
    "Scottish rules framed as UK-wide (interlinked alarms, EPC Band E) on 3 pages → scoped per nation; “4 nations” card counting London as a nation → “4 regimes”.",
    "Bruntsfield example row was internally impossible (£180 × 285 nights ≠ £41,325) → rate corrected to £145 in line with the page's own benchmarks.",
    "landlord→“user” find/replace damage (“Standard user insurance”, “user income”, “the visitor — not the user — pays the levy”, privacy form options, etc.) → restored to landlord/operator in 8 places (nav-level “For Users” naming left for OP-04 ruling).",
]
rl = [
    "# Website audit report — staging redesign (58 pages)",
    "",
    "**For:** Marketing Coordinator · **Date:** 16 July 2026 · **Scope:** every page at https://vibhor1001.github.io/ (all 58), audited page-by-page for pricing/offer accuracy, Edinburgh-only positioning, terminology, claims, links, metadata and structured data.",
    "",
    "Roughly 250 findings were raised; ~120 objective errors are **already fixed on the branch** (see `changes-log.md` for every exact edit) and the rest need a human decision — they are pre-loaded in the feedback tracker as OP-01…OP-28.",
    "",
    "## Highlights of what was found and fixed",
    "",
]
rl += [f"{i+1}. {t}" for i, t in enumerate(fixed_hi)]
rl += ["", "Plus: UK spellings (optimise/maximise/enquiry), typography (53 double-hyphens → dashes), levy dates anchored to 24 July 2026, US-style Ms./Mr. corrected, comma-splice repairs, misleading careers/about/hands-free meta descriptions rewritten, timezone “(UTC)” → “(UK time)”, demo widgets varied across Glasgow/Manchester/York, and more.", "",
       "## Partner-messaging round (16 Jul, after the audit)", "",
    "Following the owner's brief (benchmarked against houst.com's messaging): the Partner offer now speaks to two personas — hosts who switch their own lets to PropertyFlow and agents who sell while we operate — with a **dedicated account manager**, a **fully automated back office**, ops presented **white-label as PropertyFlow's own operations network** (no provider named anywhere, verified), and **UK-wide today, Europe on the roadmap** positioning. 14 copy edits across the partner hub, subpages, nav (×58), homepage, pricing and hands-free — all in the change log under `partner-messaging`. This resolves OP-01, OP-14 and OP-17 below (marked RESOLVED — please verify).", "",
    "## Decisions needed (pre-loaded in the tracker)", ""]
for o in OPEN:
    rl.append(f"- **{o[0]} ({o[4]})** · _{o[1]}_ — {o[2]} → {o[3]}")
rl += ["", "## What was deliberately NOT changed", "",
       "- The 50/50 Partner offer and all partner-economics copy (per owner instruction).",
       "- The Edinburgh Market section and Edinburgh-topic blog posts — legitimate local-SEO content; only company-wide positioning was broadened.",
       "- Nav/footer audience labels (“For Users” vs “For Landlords”) — needs the OP-04 terminology ruling first.",
       "- Legal pages beyond objective fixes (title brand name, one artefact) — privacy/terms rewrites need legal review (OP-02, OP-18, OP-19).",
       ""]
with open(os.path.join(DOCS, "audit-report.md"), "w") as f:
    f.write("\n".join(rl))

print("wrote", DOCS + "/changes-log.md", f"({len(by_id)} edit groups, {sum(v['count'] for v in by_id.values())} replacements)")
print("wrote", DOCS + "/audit-report.md", f"({len(OPEN)} open items)")
EOF_MARKER = None
