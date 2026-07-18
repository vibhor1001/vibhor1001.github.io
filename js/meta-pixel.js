/**
 * PropertyFlow — Meta (Facebook) Pixel, consent-gated
 * v1.0
 *
 * SETUP: paste your Pixel/Dataset ID from Meta Events Manager below.
 * Until an ID is set, this file is a safe no-op (nothing loads, nothing fires).
 *
 * PECR/consent: the pixel loads ONLY after the visitor has accepted cookies
 * (pf_cookie_consent, set by js/cookie-consent.js). If the banner is accepted
 * during the visit, the pixel initialises at that moment and fires PageView.
 *
 * Events wired here (browser side):
 *   PageView            — every page, after consent
 *   InitiateCheckout    — click on any link to app.propertyflow.uk/register
 *   Lead                — HubSpot embedded form submitted (contact page)
 *   PartnerApplyIntent  — custom: click on a partner "apply" link/CTA
 *   CalculatorEngaged   — custom: first interaction with the earnings calculator
 *
 * Still needed OUTSIDE this static site (see docs/staging-review tracker OP-34):
 *   - Same pixel + CompleteRegistration event inside app.propertyflow.uk
 *   - Conversions API needs a server (the app backend or a CAPI gateway)
 */
(function () {
  'use strict';

  var PIXEL_ID = ''; // ← PASTE META PIXEL ID HERE (e.g. '1234567890123456')

  var id = window.PF_META_PIXEL_ID || PIXEL_ID;
  if (!id) {
    if (window.console && console.info) {
      console.info('[meta-pixel] no Pixel ID configured — tracking disabled');
    }
    return;
  }

  var COOKIE_NAME = 'pf_cookie_consent';
  var initialised = false;

  function hasConsent() {
    return new RegExp('(^|;\\s*)' + COOKIE_NAME + '=accepted').test(document.cookie);
  }

  function loadPixel() {
    if (initialised) return;
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
    wireEvents();
  }

  function wireEvents() {
    /* outbound sign-up clicks → InitiateCheckout */
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.indexOf('app.propertyflow.uk/register') !== -1) {
        window.fbq('track', 'InitiateCheckout', { content_name: 'signup_click' });
      } else if (href.indexOf('/become-a-partner/apply') === 0 ||
                 (a.textContent || '').toLowerCase().indexOf('apply to') !== -1) {
        window.fbq('trackCustom', 'PartnerApplyIntent', { from: location.pathname });
      }
    }, true);

    /* HubSpot embedded form submission → Lead */
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (d && d.type === 'hsFormCallback' && d.eventName === 'onFormSubmitted') {
        window.fbq('track', 'Lead', { content_name: 'hubspot_form' });
      }
    });

    /* partner earnings calculator engagement (once per page view) */
    var calc = document.getElementById('calculator');
    if (calc) {
      var fired = false;
      calc.addEventListener('input', function () {
        if (fired) return;
        fired = true;
        window.fbq('trackCustom', 'CalculatorEngaged', { page: location.pathname });
      }, true);
    }
  }

  if (hasConsent()) {
    loadPixel();
  } else {
    document.addEventListener('pf:consent-granted', loadPixel);
  }
})();
