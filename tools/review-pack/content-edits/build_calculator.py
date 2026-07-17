#!/usr/bin/env python3
"""Insert the white-label Partner earnings calculator into become-a-partner/index.html.
Economics mirror the published worked example: net = gross - 28.6% running costs,
management fee = 20% of net, Partner share = 50% of the fee."""
import json
import os

P = "/home/user/propertyflow-website/become-a-partner/index.html"
LOG = "/tmp/claude-0/-home-user-propertyflow-website/8b03987a-dd25-59d6-8655-9d04554081d6/scratchpad/audit/replace-log.jsonl"

ANCHOR = "Actual performance varies by location, season and property.</div></div></div></section>"

CALC = """
    <!-- Partner earnings calculator -->
    <section class="ds-section" id="calculator"><div class="ds-split"><div>
        <p class="ds-feat-hero__tag">Partner earnings calculator</p>
        <h2 class="ds-section__h2">What would 50/50 earn you?</h2>
        <p class="ds-section__lead">Pick a city, set your numbers, and see how the split works on a typical portfolio. Our operations network is live across the UK — and if your city isn't listed, apply anyway: we're expanding.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.875rem;margin-top:1.75rem;">
            <label style="display:block;">
                <span style="display:block;font-size:0.8125rem;font-weight:600;color:var(--ds-ink);margin-bottom:0.375rem;">City</span>
                <select id="pf-calc-city" style="width:100%;padding:0.7rem 0.875rem;border:1px solid var(--ds-border);border-radius:10px;background:#fff;font:inherit;font-size:0.9375rem;color:var(--ds-ink);"></select>
            </label>
            <label style="display:block;">
                <span style="display:block;font-size:0.8125rem;font-weight:600;color:var(--ds-ink);margin-bottom:0.375rem;">Property size</span>
                <select id="pf-calc-beds" style="width:100%;padding:0.7rem 0.875rem;border:1px solid var(--ds-border);border-radius:10px;background:#fff;font:inherit;font-size:0.9375rem;color:var(--ds-ink);">
                    <option value="0.72">1 bedroom</option>
                    <option value="1" selected>2 bedrooms</option>
                    <option value="1.32">3 bedrooms</option>
                    <option value="1.6">4+ bedrooms</option>
                </select>
            </label>
            <label style="display:block;">
                <span style="display:block;font-size:0.8125rem;font-weight:600;color:var(--ds-ink);margin-bottom:0.375rem;">Properties under management</span>
                <input id="pf-calc-props" type="number" min="1" max="100" value="5" style="width:100%;padding:0.7rem 0.875rem;border:1px solid var(--ds-border);border-radius:10px;background:#fff;font:inherit;font-size:0.9375rem;color:var(--ds-ink);">
            </label>
            <label style="display:block;">
                <span style="display:block;font-size:0.8125rem;font-weight:600;color:var(--ds-ink);margin-bottom:0.375rem;">Occupancy: <span id="pf-calc-occ-label">70%</span></span>
                <input id="pf-calc-occ" type="range" min="55" max="90" value="70" step="1" style="width:100%;accent-color:var(--ds-orange);margin-top:0.9rem;">
            </label>
        </div>
        <p style="margin-top:1.25rem;font-size:0.75rem;color:#a3a099;line-height:1.55;">Illustrative estimates from typical market rates for a well-run property — not a guarantee of earnings or a quote. Actual results vary by property, location, season and demand. Figures exclude VAT.</p>
    </div>
    <div class="ds-pricing-widget" aria-live="polite">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:0.9375rem;font-weight:600;color:var(--ds-ink);" id="pf-calc-title">5 properties · Edinburgh</span><span style="font-size:0.75rem;font-weight:600;color:var(--ds-orange);background:var(--ds-orange-soft);border-radius:9999px;padding:4px 12px;">per month</span></div>
        <div style="margin-top:1.375rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.875rem 0;border-bottom:1px solid var(--ds-border);"><span style="font-size:0.9375rem;color:var(--ds-ink);">Gross booking revenue</span><span style="font-size:0.9375rem;font-weight:600;color:var(--ds-ink);" id="pf-calc-gross">—</span></div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.875rem 0;border-bottom:1px solid var(--ds-border);"><span style="font-size:0.9375rem;color:#6a6a6a;">Direct running costs</span><span style="font-size:0.9375rem;font-weight:600;color:#6a6a6a;" id="pf-calc-costs">—</span></div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.875rem 0;"><span style="font-size:0.9375rem;color:var(--ds-ink);">Net revenue</span><span style="font-size:0.9375rem;font-weight:600;color:var(--ds-ink);" id="pf-calc-net">—</span></div>
        </div>
        <div style="margin-top:0.5rem;background:var(--ds-orange-soft);border-radius:14px;padding:1.125rem 1.25rem;display:flex;align-items:center;justify-content:space-between;"><span style="font-size:0.875rem;font-weight:600;color:var(--ds-orange);">Management fee · 20% of net</span><span style="font-size:1.375rem;font-weight:700;color:var(--ds-orange);" id="pf-calc-fee">—</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;">
            <div style="background:var(--ds-ink);color:#fff;border-radius:14px;padding:1.125rem 1.25rem;"><div style="font-size:0.8125rem;color:rgba(255,255,255,0.6);">Your share (50%)</div><div style="font-size:1.5rem;font-weight:700;margin-top:0.25rem;" id="pf-calc-share">—</div></div>
            <div style="background:var(--ds-cream);color:var(--ds-ink);border-radius:14px;padding:1.125rem 1.25rem;"><div style="font-size:0.8125rem;color:#6a6a6a;">PropertyFlow (50%)</div><div style="font-size:1.5rem;font-weight:700;margin-top:0.25rem;" id="pf-calc-pf">—</div></div>
        </div>
        <div style="margin-top:0.75rem;background:var(--ds-cream);border-radius:14px;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;"><span style="font-size:0.875rem;color:var(--ds-ink);">Your share, per year</span><span style="font-size:1.125rem;font-weight:700;color:var(--ds-ink);" id="pf-calc-annual">—</span></div>
        <a href="/become-a-partner/apply/" style="display:block;text-align:center;margin-top:1rem;background:var(--ds-ink);color:#fff;border-radius:9999px;padding:0.875rem 1.5rem;font-size:0.9375rem;font-weight:600;text-decoration:none;">Apply to become a Partner</a>
    </div></div>
    <script>
    (function () {
        var RATES = {
            "London": 195, "Edinburgh": 160, "Bath": 150, "Brighton": 145, "Highlands & coast": 140,
            "York": 135, "Bristol": 130, "Manchester": 125, "Birmingham": 115, "Glasgow": 110,
            "Liverpool": 110, "Leeds": 105, "Cardiff": 105, "Newcastle": 100, "Aberdeen": 95,
            "Elsewhere in the UK": 110
        };
        var COST_RATIO = 0.286, FEE = 0.20, SPLIT = 0.5, DAYS = 30.4;
        var citySel = document.getElementById('pf-calc-city');
        if (!citySel) return;
        Object.keys(RATES).forEach(function (c) {
            var o = document.createElement('option');
            o.value = c; o.textContent = c;
            if (c === 'Edinburgh') o.selected = true;
            citySel.appendChild(o);
        });
        var beds = document.getElementById('pf-calc-beds'),
            props = document.getElementById('pf-calc-props'),
            occ = document.getElementById('pf-calc-occ'),
            occLabel = document.getElementById('pf-calc-occ-label');
        function gbp(n) { return '£' + Math.round(n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }
        function calc() {
            var n = Math.max(1, Math.min(100, parseInt(props.value, 10) || 1));
            var gross = RATES[citySel.value] * parseFloat(beds.value) * DAYS * (parseInt(occ.value, 10) / 100) * n;
            var costs = gross * COST_RATIO, net = gross - costs, fee = net * FEE, share = fee * SPLIT;
            occLabel.textContent = occ.value + '%';
            document.getElementById('pf-calc-title').textContent = n + (n === 1 ? ' property · ' : ' properties · ') + citySel.value;
            document.getElementById('pf-calc-gross').textContent = gbp(gross);
            document.getElementById('pf-calc-costs').textContent = '− ' + gbp(costs);
            document.getElementById('pf-calc-net').textContent = gbp(net);
            document.getElementById('pf-calc-fee').textContent = gbp(fee);
            document.getElementById('pf-calc-share').textContent = gbp(share);
            document.getElementById('pf-calc-pf').textContent = gbp(share);
            document.getElementById('pf-calc-annual').textContent = gbp(share * 12);
        }
        [citySel, beds, props, occ].forEach(function (el) {
            el.addEventListener('input', calc); el.addEventListener('change', calc);
        });
        calc();
    })();
    </script>
    </section>"""

src = open(P, encoding="utf-8").read()
assert src.count(ANCHOR) == 1, "anchor not unique"
assert 'id="calculator"' not in src, "calculator already present"
src = src.replace(ANCHOR, ANCHOR + CALC)
open(P, "w", encoding="utf-8").write(src)
with open(LOG, "a") as f:
    f.write(json.dumps({"id": "partner-earnings-calculator", "category": "feature-calculator",
        "file": "become-a-partner/index.html", "count": 1,
        "find": "(new section inserted after the worked example)",
        "replace": "Interactive 50/50 earnings calculator: 16 UK city options, bedrooms, portfolio size, occupancy slider; mirrors published economics (net = gross - 28.6% costs, 20% fee, 50/50 split); illustrative-figures + excl-VAT disclaimer; white-label (no provider named)."}) + "\n")
print("calculator inserted:", len(CALC), "bytes")
