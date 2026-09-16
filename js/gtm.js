/**
 * PropertyFlow — Google Tag Manager loader, consent-gated (PECR), with
 * Google Consent Mode v2.
 *
 * Container GTM-56J2JD85 lives in the COMPANY Tag Manager account
 * ("PropertyFlow Technologies Ltd"), created 2026-09-16 so marketing can add
 * and change tags (Google Ads, LinkedIn, HubSpot, …) from the GTM dashboard
 * without a code change here. Our own GA4 (inline head loader) and Meta pixel
 * (js/meta-pixel.js) keep loading exactly as before; GTM is an ADDITIONAL
 * channel, not a replacement. pfTrack (js/analytics.js) already pushes every
 * conversion event to window.dataLayer, so GTM sees them the moment it loads —
 * entries pushed before gtm.js arrives are queued in the array, not lost.
 *
 * CONSENT, two layers:
 *  1. Nothing is fetched from Google until pf_cookie_consent=accepted (set by
 *     js/cookie-consent.js), same rule as GA4 and the pixel. This file is
 *     included BEFORE the GA4 inline loader on purpose: listener order equals
 *     registration order, so on consent the Consent Mode "granted" update
 *     below lands in the dataLayer before gtag.js is asked to load.
 *  2. Consent Mode v2 defaults to everything DENIED at page load and flips to
 *     granted only on consent (and back to denied on pf:consent-withdrawn).
 *     Google-built tags added later in GTM (Ads, Floodlight, GA4) honour
 *     these flags automatically. NON-Google tags added in GTM do not — anyone
 *     adding one must gate it on a consent trigger in GTM, and add its cookie
 *     names to clearAnalyticsData() in js/cookie-consent.js so withdrawal
 *     still removes what was set.
 *
 * The <noscript> iframe from Google's install snippet is deliberately NOT
 * used: it cannot check consent, so it would be the one path that fires
 * before the banner is answered.
 */
(function () {
  if (!/(^|\.)propertyflow\.uk$/.test(location.hostname)) return; /* production tag: our domain only */
  var CONTAINER_ID = 'GTM-56J2JD85';
  var id = window.PF_GTM_ID || CONTAINER_ID;
  var COOKIE_NAME = 'pf_cookie_consent';

  window.dataLayer = window.dataLayer || [];
  /* gtag() must push the `arguments` object itself — an array is not
     recognised as a command by gtag.js / GTM. */
  function gtag() { window.dataLayer.push(arguments); }

  var DENIED = {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'denied', personalization_storage: 'denied',
    security_storage: 'granted'
  };
  var GRANTED = {
    ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted',
    analytics_storage: 'granted', functionality_storage: 'granted', personalization_storage: 'granted',
    security_storage: 'granted'
  };
  /* Default before anything else touches the dataLayer. wait_for_update gives
     an already-consented visitor's "granted" update 500 ms to arrive before
     any tag decides. */
  gtag('consent', 'default', Object.assign({ wait_for_update: 500 }, DENIED));

  if (!id) {
    if (window.console && console.info) console.info('[gtm] no container ID configured — Tag Manager disabled');
    return;
  }

  function hasConsent() {
    return new RegExp('(^|;\\s*)' + COOKIE_NAME + '=accepted').test(document.cookie);
  }

  var loaded = false;
  function loadGtm() {
    if (!hasConsent()) return;
    gtag('consent', 'update', GRANTED);
    if (loaded || window.__pfGTM) return;
    loaded = true; window.__pfGTM = true;
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  /* Not { once: true } — consent can be withdrawn and given again; loadGtm is idempotent. */
  document.addEventListener('pf:consent-granted', loadGtm);
  document.addEventListener('pf:consent-withdrawn', function () { gtag('consent', 'update', DENIED); });
  if (hasConsent()) loadGtm();
})();
