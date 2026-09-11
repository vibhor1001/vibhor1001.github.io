/**
 * PropertyFlow — Meta (Facebook) Pixel loader, consent-gated
 * v2.0
 *
 * SETUP: paste the Pixel/Dataset ID from Meta Events Manager below.
 * Until an ID is set this file is a safe no-op — nothing loads, nothing fires.
 *
 * ID SET 8 SEPT 2026. Before that it was empty, so the pixel had never fired
 * once since it was installed — and a pixel's audience and conversion history
 * cannot be backfilled, so the £500/month Meta line starting 21 September now
 * has roughly two weeks of learning behind it rather than none.
 *
 * The dataset is company-owned: created inside the Propertyflow Technologies
 * LTD business portfolio, connected to the PropertyFlow — UK ad account. Two
 * older pixels exist under a personal ad account (613045346702847 and
 * 1448632136839651) and are deliberately NOT used — both had zero events, so
 * nothing was lost, and Rajat's rule is that the company owns every asset.
 *
 * privacy-policy.html names the Meta Pixel nine times. Until today that was
 * inaccurate in our favour; it is now accurate.
 *
 * WHAT CHANGED IN v2, AND WHY THIS FILE GOT SMALLER
 * It used to fire its own conversion events — PageView, InitiateCheckout,
 * Lead, PartnerApplyIntent, CalculatorEngaged. That was a second, older
 * definition of "a conversion", maintained separately from the one GA4
 * measures, and the two had already drifted:
 *   - it had NO sign-up event at all, so Meta's bidding could only ever
 *     optimise toward click-throughs to the app rather than registrations;
 *   - `Lead` fired on ANY HubSpot form submission, so a plain contact enquiry
 *     counted the same as a Partner application;
 *   - `CalculatorEngaged` targeted #calculator, which the September redesign
 *     removed — it could no longer fire under any circumstances.
 *
 * So conversion events now go through pfTrack in js/analytics.js, which feeds
 * GA4, the GTM dataLayer and Meta from ONE call site (see META_EVENTS there).
 * GA4 and Meta can no longer disagree about what a conversion is, and adding
 * an event means touching one place instead of two.
 *
 * This file's remaining job: load the pixel after consent, and send the one
 * PageView. Everything else is analytics.js.
 *
 * PECR/consent: loads ONLY after the visitor accepts (pf_cookie_consent, set
 * by js/cookie-consent.js). If they accept mid-visit it initialises then.
 * Withdrawal is handled by cookie-consent.js, which clears _fbp and _fbc.
 *
 * STILL NEEDED OUTSIDE THIS FILE:
 *   - The pixel inside app.propertyflow.uk. register, model_chosen and
 *     first_property_added all happen there, and they are the events worth
 *     optimising toward. Without them Meta's best available signal is
 *     InitiateCheckout — someone clicking through — which for a £9.99 product
 *     is the difference between the budget working and not.
 *   - Conversions API for server-side deduplication and iOS attribution.
 *     Needs a server endpoint; not built.
 */
(function () {
  'use strict';

  /* Dataset "Propertyflow Web", created 8 Sept 2026 inside the
     Propertyflow Technologies LTD business portfolio and connected to the
     PropertyFlow — UK ad account (1095564742806634). Company-owned, not
     personal — the two older pixels (613045346702847, 1448632136839651)
     sat under a personal ad account and are deliberately not used. */
  var PIXEL_ID = '1512399537594254';

  var id = window.PF_META_PIXEL_ID || PIXEL_ID;
  if (!id) {
    if (window.console && console.info) {
      console.info('[meta-pixel] no Pixel ID configured — Meta tracking disabled');
    }
    return;
  }

  var COOKIE_NAME = 'pf_cookie_consent';
  var initialised = false;

  function hasConsent() {
    return new RegExp('(^|;\\s*)' + COOKIE_NAME + '=accepted').test(document.cookie);
  }

  function loadPixel() {
    if (initialised || !hasConsent()) return;
    initialised = true;

    /* Meta base code (official snippet) */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  /* Not { once: true } — consent can be withdrawn and given again, and
     loadPixel is idempotent. */
  document.addEventListener('pf:consent-granted', loadPixel);
  if (hasConsent()) loadPixel();
})();
