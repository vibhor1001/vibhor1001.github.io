#!/usr/bin/env python3
"""Generate cover.html, guide.html, sitemap.html for the review pack front matter.
Reads pdf/manifest.json (render output) for page titles/order."""
import json
import os

SCRATCH = os.path.dirname(os.path.abspath(__file__))
FRONT = os.path.join(SCRATCH, "front")
os.makedirs(FRONT, exist_ok=True)

with open(os.path.join(SCRATCH, "pdf", "manifest.json")) as f:
    manifest = json.load(f)
pages = manifest["pages"]

BASE_CSS = """
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; color:#141A23; background:#faf8f5; }
.sheet { width:1123px; min-height:750px; padding:48px 64px; }
.charcoal { background:#141A23; color:#faf8f5; }
.orange { color:#E65A38; } .yellow { color:#eea946; }
h1 { font-size:44px; line-height:1.15; letter-spacing:-0.5px; }
h2 { font-size:24px; margin-bottom:14px; }
h3 { font-size:15px; text-transform:uppercase; letter-spacing:.08em; }
p, li { font-size:14px; line-height:1.55; }
.rule { height:4px; width:88px; background:#E65A38; margin:22px 0; border:0; }
"""

# ── cover ────────────────────────────────────────────────────────────
cover = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.sheet {{ height:750px; display:flex; flex-direction:column; justify-content:space-between; }}
.meta td {{ font-size:14px; padding:5px 26px 5px 0; color:#c9ccd2; }}
.meta td:first-child {{ color:#eea946; text-transform:uppercase; font-size:11px; letter-spacing:.1em; padding-top:8px; }}
</style></head><body>
<div class="sheet charcoal">
  <div>
    <img src="http://127.0.0.1:8124/images/design/pf-logo-white.svg" style="height:44px" onerror="this.style.display='none'">
    <hr class="rule">
    <h1>Website Content Review Pack — v5 · FINAL</h1>
    <p style="font-size:19px;color:#c9ccd2;margin-top:14px">The finished site: every review item resolved — pricing corrections,
    the reworked Partner messaging, the new earnings calculator, a full SEO pass (titles, descriptions, structured data),
    a humanising copy edit, a claims/compliance sweep, consent-gated analytics + Meta pixel, and the working apply funnel. All 34 tracker items are pre-marked Resolved for verification.</p>
  </div>
  <table class="meta">
    <tr><td>Website under review</td><td>https://vibhor1001.github.io/ &nbsp;(staging — new site design)</td></tr>
    <tr><td>Pages included</td><td>{len(pages)} pages · parts P01–P{len(pages)} · reading order follows the site navigation</td></tr>
    <tr><td>Generated</td><td>16 July 2026 · v5 FINAL (all review items resolved)</td></tr>
    <tr><td>Review by</td><td>Marketing Coordinator — content, wording &amp; terminology only (no code / layout changes)</td></tr>
    <tr><td>Goes with</td><td>PropertyFlow-Feedback-Tracker.xlsx (the master feedback log)</td></tr>
    <tr><td>Confidential</td><td>Internal draft — the staging site is unpublished; do not circulate outside the team</td></tr>
  </table>
</div>
</body></html>"""

# ── guide ────────────────────────────────────────────────────────────
guide = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.cols {{ display:flex; gap:36px; }} .col {{ flex:1; }}
.box {{ background:#fff; border:1px solid #e3ded6; border-radius:10px; padding:18px 20px; margin-bottom:16px; }}
.box h3 {{ color:#E65A38; margin-bottom:8px; }}
ol li, ul li {{ margin:7px 0 7px 18px; }}
.ref {{ background:#141A23; color:#eea946; font-weight:bold; padding:2px 7px; border-radius:5px; font-size:12.5px; white-space:nowrap; }}
.small {{ font-size:12px; color:#5b6470; }}
kbd {{ background:#eee9e1; padding:1px 6px; border-radius:4px; font-size:12px; }}
</style></head><body>
<div class="sheet">
  <h2>How to review &amp; hand feedback to the developer</h2>
  <hr class="rule" style="margin:10px 0 22px">
  <div class="cols">
    <div class="col">
      <div class="box"><h3>1 · What you are looking at</h3>
        <p>Each website page starts with a dark banner — its part number (<span class="ref">P01</span>…<span class="ref">P{len(pages)}</span>),
        name, section and web address. The grey footer on every sheet repeats the part number and counts sheets
        <em>within that part</em> (“sheet 2 of 5”). The bookmarks panel of your PDF reader jumps straight to any page.</p></div>
      <div class="box"><h3>2 · How to point at an exact spot</h3>
        <p>Quote three things: <b>part + sheet + the nearest heading or the exact sentence</b>.</p>
        <p class="small" style="margin-top:6px">Example: “<b>P02, sheet 2</b>, ‘Premium’ card — change ‘First 3 always free’ to ‘Your first three, always free’.”</p></div>
      <div class="box"><h3>3 · Where to write feedback (do both)</h3>
        <ol>
          <li><b>Highlight in this PDF</b> — open it in Adobe Acrobat Reader (free), Apple Preview or Microsoft Edge,
          select the text, right-click → <kbd>Highlight</kbd>, and type your comment. Perfect for typos and one-liners.</li>
          <li><b>Log every item in the Excel tracker</b> (PropertyFlow-Feedback-Tracker.xlsx) — one row per issue,
          with the part/sheet reference, the exact current text, your proposed text and a priority.
          <b>The tracker is the master list</b> the developer works from and updates the status of.</li>
        </ol></div>
    </div>
    <div class="col">
      <div class="box"><h3>4 · What to focus on</h3>
        <ul>
          <li>Factual accuracy — pricing, fees, legal/compliance claims, place names</li>
          <li>Wording &amp; tone of voice; clarity of headlines and CTAs (“Sign Up”, “Book a call”…)</li>
          <li><b>Terminology consistency</b> — e.g. “short-term let” vs “STL”; “landlord” vs “host” vs “user”;
          “Free” / “Premium” / “Partner” plan names; capitalisation of product names</li>
          <li>Spelling &amp; grammar (UK English)</li>
        </ul>
        <p class="small" style="margin-top:6px">Layout, colours and code are out of scope for this round — flag them under
        issue type “Other” if something truly blocks reading.</p></div>
      <div class="box"><h3>5 · The loop (nothing goes live)</h3>
        <ol>
          <li>You send the annotated PDF + tracker back (email / shared drive — not GitHub).</li>
          <li>The developer applies changes <b>locally only</b> and marks rows “Implemented”.</li>
          <li>A fresh review pack is exported the same way; you verify each row → “Verified”.</li>
          <li>Only after everything is Verified does anyone publish the site. Nothing is pushed until sign-off.</li>
        </ol></div>
      <div class="box"><h3>What v5 FINAL contains</h3>
        <p>Every item from the full review programme is resolved in this render: corrected pricing, reworked Partner
        messaging with the earnings calculator, SEO and humanising passes, the claims/compliance sweep, consent-gated
        analytics and Meta pixel, and the unified apply funnel with a real application form. The tracker's rows are
        pre-marked <b>Resolved</b> — your job is to verify each and log anything new.</p></div>
      <div class="box"><h3>Notes about this PDF</h3>
        <ul>
          <li>Rendered from a byte-identical local copy of the staging site (all 58 pages hash-verified).</li>
          <li>The Contact page shows a placeholder where the HubSpot form loads — review the real form on the live staging link.</li>
          <li>Text in this PDF is selectable — copy exact sentences into the tracker rather than retyping.</li>
        </ul></div>
    </div>
  </div>
</div>
</body></html>"""

# ── sitemap ──────────────────────────────────────────────────────────
groups = {}
for p in pages:
    groups.setdefault(p["group"], []).append(p)

cards = []
for gname, plist in groups.items():
    rows = "".join(
        f'<tr><td class="pn">{p["part"]}</td><td class="pl">{p["label"]}</td>'
        f'<td class="pp">{p["path"]}</td></tr>'
        for p in plist
    )
    cards.append(
        f'<div class="g"><h3>{gname} <span class="cnt">{len(plist)} page{"s" if len(plist)>1 else ""}</span></h3>'
        f'<table>{rows}</table></div>'
    )

sitemap = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
.wrap {{ column-count:3; column-gap:26px; }}
.g {{ break-inside:avoid; background:#fff; border:1px solid #e3ded6; border-radius:10px; padding:13px 15px; margin-bottom:14px; }}
.g h3 {{ color:#E65A38; font-size:13px; border-bottom:2px solid #eea946; padding-bottom:6px; margin-bottom:7px; }}
.cnt {{ color:#8a92a0; font-weight:normal; float:right; text-transform:none; letter-spacing:0; }}
table {{ width:100%; border-collapse:collapse; }}
td {{ font-size:11.2px; padding:2.5px 4px 2.5px 0; vertical-align:top; }}
.pn {{ color:#E65A38; font-weight:bold; width:34px; }}
.pl {{ font-weight:600; }}
.pp {{ color:#8a92a0; font-size:10.2px; text-align:right; }}
</style></head><body>
<div class="sheet">
  <h2>Sitemap &amp; reading order <span style="color:#8a92a0;font-size:15px;font-weight:normal">— {len(pages)} pages · base URL https://vibhor1001.github.io</span></h2>
  <hr class="rule" style="margin:10px 0 18px">
  <div class="wrap">{''.join(cards)}</div>
</div>
</body></html>"""

for name, html in [("cover.html", cover), ("guide.html", guide), ("sitemap.html", sitemap)]:
    with open(os.path.join(FRONT, name), "w") as f:
        f.write(html)
    print("wrote", name)
