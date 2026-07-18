#!/usr/bin/env python3
"""Final resolution report: every tracker item's outcome + the short list of
owner-side inputs that no one else can supply. Also refreshes changes-log.md
and rewrites open-items.json as the resolution register for the tracker."""
import json
import os
from collections import OrderedDict

S = os.path.dirname(os.path.abspath(__file__))
DOCS = "/home/user/propertyflow-website/docs/staging-review"
os.makedirs(DOCS, exist_ok=True)

RES = [
    ("OP-01", "Partner responsibility split", "Hub, what-we-take-on and all partner pages now agree: PropertyFlow's automated backend + dedicated account manager run the day-to-day; the Partner keeps clients, sales and growth (owner brief)."),
    ("OP-02", "Privacy accuracy & consent", "GA4 and the Meta pixel are now consent-gated in code (browser-verified: zero requests before Accept). Privacy policy rewritten to describe reality: GA4 + Meta disclosed with cookies/durations, Cloudflare/Tailwind entries removed, pf_cookie_consent listed, UK Extension to the EU-US DPF cited, duplicate contact line removed."),
    ("OP-03", "FAQ schema mismatches", "FAQPage JSON-LD mirrors visible FAQs on every page that has one; invisible block removed from channel-management."),
    ("OP-04", "Audience naming ruling", "Standardised on 'For Landlords': footer link ×58, page metadata, breadcrumb + Service schemas on all 10 for-landlords pages."),
    ("OP-05", "Unverifiable market-size stats", "£127bn / 300k+ / 40M+ tiles replaced with offer-true facts (0% Airbnb commission, £0 first three properties, 8+ channels, 50/50 split); remaining figures qualified or source-labelled."),
    ("OP-06", "Conflicting statistics", "Canonical set applied: 78% Edinburgh city-average occupancy (Q1 2026 benchmarks), listing decline 'around a third since 2019', licensed premium 5–7% (AirDNA)."),
    ("OP-07", "Investor levy card", "Now names Edinburgh's scheme: 5% from 24 July 2026, 5-night cap until 25 Jan 2027 then all nights, 2% provider retention, remittance to the City of Edinburgh Council."),
    ("OP-08", "Absolute claims", "All absolutes softened to defensible wording ('designed out', 'day or night', 'expanding across the UK', 'being forced out as enforcement ramps up'), verified by an adversarial claims pass."),
    ("OP-09", "Partner apply funnel", "One destination: every Apply CTA (15 retargeted + nav ×58) → /become-a-partner/apply/, which now hosts a real embedded HubSpot application form (#apply-form)."),
    ("OP-10", "Founder & testimonials", "Founder note runs unsigned (role only) until the name is supplied; all quote bylines anonymised (no personal names), section retitled 'What early hosts tell us'."),
    ("OP-11", "Archived pricing article", "corporate-let-vs-managed-service rewritten past-tense as an archive; 'guaranteed rent' qualified '(subject to lease terms)'; metas/JSON-LD labelled archived; CTA points to current plans."),
    ("OP-12", "Stale data claims", "'Refreshed monthly'/'real-time'/'live' removed; pages state 'Benchmarks compiled from Q1 2026 booking data' beside the March 2026 date."),
    ("OP-13", "Blog Edinburgh-centric", "9 UK-wide topic cards added to the blog grid; filter pills now functional (tested: 16 cards, 9 categories, zero JS errors); card read-times match the articles."),
    ("OP-14", "Partner entry criteria", "All three personas welcomed consistently (own lets / managing for landlords / starting from zero); apply step accepts current or planned portfolios."),
    ("OP-15", "20% fee framing", "Reconciled: PropertyFlow never charges the Partner a fee — the landlord pays one 20% management fee, split 50/50; 50-50-model page now says exactly that."),
    ("OP-16", "Feature-grid contradiction", "Platform claim rewritten to 'Your entire tech stack in one platform — no bolt-on modules to buy, ever' (no per-plan contradiction)."),
    ("OP-17", "Hands-free white-label", "JSON-LD says PropertyFlow's own operations network + account manager; no third-party phrasing anywhere (repo-wide verified)."),
    ("OP-18", "Governing law", "Terms now: laws of England & Wales, non-exclusive jurisdiction of the courts of England & Wales; exclusive/carve-out contradiction removed; Section 9 de-shouted."),
    ("OP-19", "Privacy tidy-ups", "Duplicate email removed, consent cookie listed, UK DPF Extension cited."),
    ("OP-20", "Channel count", "Standardised on '8+ channels' everywhere a count appears."),
    ("OP-21", "Levy tense", "All visitor-levy copy date-anchored to 24 July 2026 — reads correctly before and after launch."),
    ("OP-22", "Typography", "Em-dash spacing fixed across posts (75+ instances), GBP→£ style (50), UK dates."),
    ("OP-23", "Old assets", "Deleted as approved: 9 legacy JPGs, old logos, og-default.jpg, img/, stale pricing spec doc (all unreferenced; recoverable from git history)."),
    ("OP-24", "Audit CTA dead-end", "'Book a Property Audit' CTAs (6) now land on /contact/#form — the anchored message form."),
    ("OP-25", "Article metadata", "datePublished/dateModified/image added to all seven guide articles; publisher logos point at a real file."),
    ("OP-26", "Dead Tailwind classes", "Replaced with design-system inline styling."),
    ("OP-27", "Licensing-guide numbers", "Fee ranges aligned to £600–£1,000; planning fee stated as ~£600+ with a check-current-rate note; dangling cross-reference fixed."),
    ("OP-28", "Gemini button", "Removed from the footer AI row on all 58 pages (no prefill support)."),
    ("OP-29", "Company registration conflict", "Aligned everywhere to: PropertyFlow Technologies Ltd, registered in England & Wales (No. 16927756), trading from Edinburgh — matching the unprefixed company-number format; governing law updated to match."),
    ("OP-30", "VAT display", "Site consistently states prices exclude VAT (pricing note + calculator disclaimer)."),
    ("OP-31", "Substantiation bundle", "Rewritten so the site no longer relies on unverifiable specifics: insurance figures removed (now 'commercial operational insurance — details at onboarding'), 24/7 promises → 'day or night' capability framing, city list reframed as UK-wide support, guest-vetting absolute softened, uplift figures qualified ('can', 'illustrative'), 6–10% yield marked illustrative, '100% licensed' scoped to local rules."),
    ("OP-32", "Third-party citation", "'BNB Management London' source label replaced with neutral 'industry management-cost benchmarks (2025)'."),
    ("OP-33", "SEO backlog", "Meta-keywords tags removed (9), long titles trimmed (4), per-post og:images verified, robots blocks /tools/, sitemap fresh; only optional polish (Organization @id consolidation) deferred."),
    ("OP-34", "Meta pixel", "Installed consent-gated on all 58 pages with PageView / InitiateCheckout / Lead / PartnerApplyIntent / CalculatorEngaged, browser-verified 7/7; dormant until the Pixel ID is pasted."),
]

FINAL_INPUTS = [
    "Meta Pixel ID — paste one value into js/meta-pixel.js (tracking activates instantly); then have the app developer add the same pixel + a CompleteRegistration event inside app.propertyflow.uk, and wire the Conversions API from the app backend.",
    "Solicitor sign-off — the legal pages are now internally consistent (England & Wales registration and law, accurate privacy disclosures) but should get a professional once-over before launch.",
    "Testimonials — quotes are anonymised; confirm they reflect genuine early-user feedback, or say the word and the two quote sections come out.",
    "VAT — the site states prices exclude VAT throughout; confirm with your accountant that this matches your registration and audience.",
    "Founder name — the homepage founder note is unsigned; supply the name to complete it.",
    "Edinburgh planning fee — stated as ~£600+ with a 'check the current council rate' note; confirm the exact current figure when convenient.",
]

# ── final-report.md ──────────────────────────────────────────────────
L = [
    "# Final resolution report — all review items closed",
    "",
    "**Branch:** `claude/website-feedback-process-4qsc5v` · **Date:** 16 July 2026",
    "",
    f"All **{len(RES)} tracker items are resolved on the branch**. Every change is logged (see `changes-log.md`; "
    "machine log `replace-log.jsonl`) and the whole site re-verified after the fixes: 0 broken links or anchors, "
    "0 invalid JSON-LD blocks, 0 console errors, live signup endpoints, working blog filters, consent-gated "
    "analytics and pixel (browser-tested), pricing facts identical on every page, no operations provider named anywhere.",
    "",
    "## Item-by-item outcomes",
    "",
]
for ref, title, txt in RES:
    L.append(f"- **{ref} · {title}** — {txt}")
L += ["", "## The only things left — owner-side inputs", "",
      "Nothing below blocks the marketing review; each is a fact only you can supply:", ""]
for i, t in enumerate(FINAL_INPUTS, 1):
    L.append(f"{i}. {t}")
L += ["", "## Review flow from here", "",
      "Coordinator proofreads the v5 pack line by line → logs anything new in the tracker (all previous items are "
      "pre-marked Resolved for her verification ticks) → developer pulls the branch into the staging Pages repo so "
      "she can browse it live → after her sign-off and the inputs above, the branch is ready to merge to `main`.", ""]
with open(os.path.join(DOCS, "final-report.md"), "w") as f:
    f.write("\n".join(L))

# ── resolution register for the tracker ──────────────────────────────
json.dump([{"ref": r, "pages": t, "finding": f"[RESOLVED] {txt}",
            "action": "Verify in the v5 pack, then tick Verified.", "priority": "Must fix" if r in
            ("OP-02", "OP-07", "OP-09", "OP-29", "OP-31", "OP-34") else "Should fix"}
           for r, t, txt in RES] +
          [{"ref": f"IN-{i:02d}", "pages": "—", "finding": f"[OWNER INPUT NEEDED] {t}",
            "action": "Supply the input; everything else is done.", "priority": "Must fix"}
           for i, t in enumerate(FINAL_INPUTS, 1)],
          open(os.path.join(S, "audit", "open-items.json"), "w"), indent=1)

# ── refresh changes-log.md from the machine log ──────────────────────
entries = [json.loads(l) for l in open(os.path.join(S, "audit", "replace-log.jsonl"))]
by_id = OrderedDict()
for e in entries:
    k = e["id"]
    if k not in by_id:
        by_id[k] = {"category": e["category"], "find": e["find"], "replace": e["replace"], "files": [], "count": 0}
    by_id[k]["files"].append(f'{e["file"]} (×{e["count"]})')
    by_id[k]["count"] += e["count"]
C = ["# Staging content changes — complete log", "",
     f"**{len(by_id)} distinct edit groups · {sum(v['count'] for v in by_id.values())} replacements** across the "
     "review programme (machine-readable: replace-log.jsonl).", ""]
cats = OrderedDict()
for k, v in by_id.items():
    cats.setdefault(v["category"], []).append((k, v))
for cat, items in cats.items():
    C.append(f"## {cat} — {len(items)} edits, {sum(v['count'] for _, v in items)} replacements")
    C.append("")
    for k, v in items:
        files = ", ".join(v["files"][:5]) + (f", … +{len(v['files'])-5} more" if len(v["files"]) > 5 else "")
        C += [f"**`{k}`** — {files}", f"- was: “{v['find']}”", f"- now: “{v['replace']}”", ""]
with open(os.path.join(DOCS, "changes-log.md"), "w") as f:
    f.write("\n".join(C))

print(f"final-report.md: {len(RES)} resolutions + {len(FINAL_INPUTS)} inputs")
print(f"changes-log.md: {len(by_id)} groups, {sum(v['count'] for v in by_id.values())} replacements")
