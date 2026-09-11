/**
 * PropertyFlow — GA4 conversion events, campaign attribution, GTM container
 * v1.0
 *
 * GA4 itself is NOT loaded here. Every page already loads gtag inline in <head>
 * (measurement ID G-59H9NW9QDS) behind the consent gate. This file adds the
 * three things that were missing: named conversion events, campaign
 * attribution attached to them, and a GTM container so tags can be added
 * without a developer.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE CAN AND CANNOT SEE
 *
 * Six conversion events were requested. Only three of them happen on this
 * website; the other three happen inside the app at app.propertyflow.uk,
 * which is a separate Angular codebase with no analytics installed at all.
 * Adding events here does not make those three appear.
 *
 *   register              → app  (NOT here)
 *   model chosen          → app  (NOT here)
 *   first property added  → app  (NOT here)
 *   partner_application   → here, wired below
 *   market_report_request → here in principle, but NO FORM EXISTS yet. The
 *                           "Request Market Report" buttons link to /contact/.
 *                           Deliberately not wired to a proxy event: counting
 *                           a click on a link as a "report request" would
 *                           report demand that produced no lead.
 *   book_a_call           → here, wired below (outbound Calendly click)
 *
 * signup_click is wired too, but it is INTENT, not the register conversion.
 * It fires when someone leaves for the app's register page. Whether they then
 * complete registration is only visible from inside the app. Do not mark
 * signup_click as a key event in GA4 — it will overstate sign-ups.
 *
 * ---------------------------------------------------------------------------
 * CONSENT (PECR / UK GDPR)
 *
 * Nothing is stored and no event is sent before the visitor accepts cookies
 * (pf_cookie_consent, set by js/cookie-consent.js). Campaign parameters are
 * held in memory on arrival — reading the URL stores nothing on the device —
 * and are only written to storage once consent arrives.
 *
 * The consequence is real and should be understood before reading the
 * numbers: a visitor who lands from an ad and leaves without accepting is
 * invisible. Reported conversions are therefore a floor, not a total. Closing
 * that gap means GA4 Consent Mode with modelled conversions, which is a
 * separate piece of work and a separate decision.
 *
 * ---------------------------------------------------------------------------
 * UTM STANDARD (what this file expects on inbound links)
 *
 *   utm_source    where the click came from, lowercase, no spaces
 *                 google | meta | linkedin | bing | newsletter | partner
 *   utm_medium    what kind of placement
 *                 cpc | paid_social | organic_social | email | referral
 *   utm_campaign  yyyy-mm-slug, e.g. 2026-09-edinburgh-hosts
 *   utm_content   the specific creative or link, e.g. carousel-a | footer-cta
 *   utm_term      paid search keyword only; leave off elsewhere
 *
 * Lowercase throughout — GA4 treats Google and google as two sources, which
 * silently splits one campaign's numbers across two rows.
 */
(function () {
  'use strict';

  /* Paste the container ID from tagmanager.google.com. Until it is set, GTM
     does not load and the rest of this file still works — GA4 events do not
     depend on the container. */
  var GTM_ID = ''; // ← e.g. 'GTM-XXXXXXX'

  var GA4_ID = 'G-59H9NW9QDS';
  var COOKIE_NAME = 'pf_cookie_consent';

  /* The one HubSpot form that exists today. The hsFormCallback postMessage
     fires for EVERY HubSpot form on the page, so matching on the message
     alone would label a future market-report submission as a partner
     application. Match on the form ID from the start. */
  var FORMS = {
    /* ⚠️ 10b60377 is the OLD SITE CONTACT FORM. Partner applications are
       currently routed through it as a stopgap (Rajat, 8 Sept: "it points at
       the old site contact form, with the extra answers folded into the
       message field"). So it reports as partner_application today and that is
       correct — but it ALSO means a plain contact enquiry through the same
       form is counted as a Partner application.

       WHEN THE REAL PARTNER FORM EXISTS, DO BOTH OF THESE TOGETHER:
         1. add its GUID below as 'partner_application'
         2. change 10b60377 to 'contact_enquiry'
       Doing only the first leaves every contact enquiry inflating the Partner
       numbers; doing only the second loses the event entirely. */
    '10b60377-1c78-4f3f-936d-c54e3de1fdb5': 'partner_application',

    /* Own-a-property report form. Paste the GUID here at the same time as
       HS_FORM_GUID in own-a-property/index.html. Until then that page tracks
       market_report_request off its email fallback, so the event works either
       way and this entry is additive rather than a fix. */
    // '<own-a-property GUID>': 'market_report_request',
  };

  /**
   * The Meta equivalent of each conversion.
   *
   * Meta can only optimise toward events it actually receives. Until now
   * js/meta-pixel.js fired its OWN, older set — a different definition of a
   * conversion from the one GA4 measures — so the two could disagree about
   * what happened, and the pixel had no sign-up event at all. Routing Meta
   * through pfTrack means one call site feeds GA4, the GTM dataLayer and Meta,
   * and none of them can drift.
   *
   * Standard event names where Meta has one (they are what its bidding
   * optimises against); trackCustom only where nothing fits. partner
   * application and report request are both Lead — Meta's optimisable
   * standard for an enquiry — separated by content_name so the reports can
   * still tell them apart.
   *
   * signup_click is InitiateCheckout, NOT CompleteRegistration: it fires when
   * someone leaves for the app, not when they register. Mapping it to
   * CompleteRegistration would teach Meta's bidding to buy click-throughs and
   * call them customers.
   */
  var META_EVENTS = {
    register:              ['track', 'CompleteRegistration'],
    model_chosen:          ['track', 'StartTrial'],
    first_property_added:  ['trackCustom', 'FirstPropertyAdded'],
    partner_application:   ['track', 'Lead'],
    market_report_request: ['track', 'Lead'],
    book_a_call:           ['track', 'Schedule'],
    signup_click:          ['track', 'InitiateCheckout'],
    partner_apply_start:   ['trackCustom', 'PartnerApplyIntent'],
  };

  var APP_HOST = 'app.propertyflow.uk';
  var ATTRIBUTION_KEY = 'pf_attribution';
  var FIRST_TOUCH_KEY = 'pf_first_touch';
  var FIRST_TOUCH_DAYS = 90;

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  /* gbraid/wbraid replace gclid on iOS where ATT blocks the usual click ID;
     without them iOS paid search is unattributable. */
  var CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'];

  var wired = false;

  function hasConsent() {
    return new RegExp('(^|;\\s*)' + COOKIE_NAME + '=accepted').test(document.cookie);
  }

  /* ---------------------------------------------------------------- capture */

  /* Read campaign parameters from the current URL. Held in memory only —
     the URL is gone after the visitor navigates, so this has to happen on
     arrival, before we know whether they will consent. */
  var arrival = (function () {
    var out = {};
    try {
      var q = new URLSearchParams(location.search);
      /* utm_* are lowercased because GA4 splits Google and google into two
         rows. Click IDs must NOT be: gclid is case-sensitive base64url and
         fbclid is mixed-case and routinely longer than 120 characters, so
         lowercasing or truncating them yields a token Google Ads and Meta
         cannot match. That breaks attribution for PAID specifically — the
         exact spend this reporting exists to judge — and it fails quietly,
         because UTM-based reporting still looks correct. */
      UTM_KEYS.forEach(function (k) {
        var v = q.get(k);
        if (v) out[k] = String(v).slice(0, 120).toLowerCase();
      });
      CLICK_IDS.forEach(function (k) {
        var v = q.get(k);
        if (v) out[k] = String(v).slice(0, 512);
      });
      if (document.referrer) {
        var host = '';
        try { host = new URL(document.referrer).hostname; } catch (e) { host = ''; }
        /* Ignore our own pages — an internal click is not a new referral. */
        if (host && host !== location.hostname && host.indexOf('propertyflow.uk') === -1) {
          out.referrer_host = host;
        }
      }
    } catch (e) { /* URLSearchParams unavailable — attribution degrades, nothing breaks */ }
    return out;
  })();

  function readStore(store, key) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* Set when storage is unavailable (Safari private browsing, storage
     disabled, quota). Silence here was the worst bug in this file: with no
     persistence, attribution() falls back to `arrival`, which only exists on
     the LANDING page. Almost every conversion fires on a later page — the
     partner form, book-a-call, signup_click from a nav CTA — so for that whole
     cohort paid campaigns recorded ZERO conversions and direct/organic
     absorbed them, with nothing logged. First-touch never worked at all.
     Flagging it makes the cohort visible in the reports as knowingly
     unattributable instead of quietly credited to the wrong source. */
  var storageDegraded = false;

  function writeStore(store, key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
    } catch (e) {
      storageDegraded = true;
    }
  }

  /* Persist what we captured. Only ever called after consent. */
  function persistAttribution() {
    var hasArrival = Object.keys(arrival).length > 0;

    /* Last touch: this visit's campaign, for the length of the session. */
    if (hasArrival) writeStore(sessionStorage, ATTRIBUTION_KEY, arrival);

    /* First touch: the campaign that originally found this person, kept for
       90 days. A host who arrives from an ad, leaves, and returns via Google
       a week later to sign up should still credit the ad — otherwise paid
       campaigns look worse than they are and organic looks better. */
    var first = readStore(localStorage, FIRST_TOUCH_KEY);
    var expired = !first || !first.t || (Date.now() - first.t) > FIRST_TOUCH_DAYS * 864e5;
    if (hasArrival && expired) {
      writeStore(localStorage, FIRST_TOUCH_KEY, { t: Date.now(), p: arrival });
    }
  }

  /* Everything we know about where this visitor came from, flattened for GA4. */
  function attribution() {
    var last = readStore(sessionStorage, ATTRIBUTION_KEY) || arrival;
    var first = readStore(localStorage, FIRST_TOUCH_KEY);
    var out = {};
    Object.keys(last).forEach(function (k) { out[k] = last[k]; });
    if (first && first.p && first.p.utm_campaign) {
      out.first_touch_campaign = first.p.utm_campaign;
      out.first_touch_source = first.p.utm_source || '';
    }
    return out;
  }

  /* ------------------------------------------------------------------ track */

  /**
   * Send a named conversion event to GA4 and to the GTM dataLayer.
   *
   * Both, deliberately: GA4 is fed directly by gtag, and GTM needs the same
   * event on the dataLayer to pass it to anything a marketer adds later. One
   * call site, both destinations, so the two can never disagree about what
   * happened.
   *
   * Exposed as window.pfTrack so a page can fire its own event without
   * duplicating the consent check or the attribution lookup.
   */
  function pfTrack(name, params) {
    if (!name || !hasConsent()) return;

    var payload = attribution();
    payload.page_path = location.pathname;
    if (storageDegraded) payload.attribution_degraded = true;
    if (params) {
      Object.keys(params).forEach(function (k) { payload[k] = params[k]; });
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
    }

    window.dataLayer = window.dataLayer || [];
    var forGtm = { event: name };
    Object.keys(payload).forEach(function (k) { forGtm[k] = payload[k]; });
    window.dataLayer.push(forGtm);

    /* Meta. Wrapped separately so a broken or extension-stubbed fbq cannot
       stop GA4 from having already recorded the event. */
    var meta = META_EVENTS[name];
    if (meta && typeof window.fbq === 'function') {
      try {
        window.fbq(meta[0], meta[1], {
          content_name: name,
          /* No campaign parameters and no form values — Meta gets the fact of
             the conversion, not the personal data behind it. */
          value: undefined,
        });
      } catch (e) { /* analytics must never break a user action */ }
    }
  }

  window.pfTrack = pfTrack;

  /* -------------------------------------------------------- cross-domain */

  /**
   * Carry campaign parameters across to the app.
   *
   * The website is propertyflow.uk and the app is app.propertyflow.uk. To GA4
   * those are separate hosts, so without this a visitor who arrives from an ad
   * and signs up is recorded as two unrelated sessions and the sign-up credits
   * nobody. That is precisely the question the tracking exists to answer.
   *
   * This appends the parameters to outbound app links so the app can attribute
   * server-side. It is NOT a substitute for GA4 cross-domain measurement,
   * which has to be configured in the GA4 admin (Admin → Data streams →
   * Configure tag settings → Configure your domains) and needs GA4 present in
   * the app. Both halves are still outstanding.
   */
  function decorateAppLinks() {
    var links = document.querySelectorAll('a[href*="' + APP_HOST + '"]');
    Array.prototype.forEach.call(links, function (a) { decorateLink(a); });
  }

  /** Add the session's campaign to one app link. Safe to call repeatedly. */
  function decorateLink(a) {
    if (!hasConsent()) return;
    var attr = attribution();
    var keys = Object.keys(attr).filter(function (k) {
      return k.indexOf('utm_') === 0 || CLICK_IDS.indexOf(k) !== -1;
    });
    if (!keys.length) return;

    var href = a.getAttribute('href');
    if (!href) return;
    var url;
    try { url = new URL(href, location.href); } catch (e) { return; }
    /* Re-parsed and hostname-checked rather than trusting the selector, so
       https://evil.com/?x=app.propertyflow.uk is matched then dropped. */
    if (url.hostname !== APP_HOST) return;
    keys.forEach(function (k) {
      /* Never overwrite a parameter already on the link — a hand-built
         campaign link is more specific than the session's attribution. */
      if (!url.searchParams.has(k)) url.searchParams.set(k, attr[k]);
    });
    a.setAttribute('href', url.toString());
  }

  /* ------------------------------------------------------------------ wire */

  /** Label the destination so a swap is visible in the reports, not invisible. */
  function bookingDestination(href) {
    if (href.indexOf('mailto:') === 0) return 'email';
    if (href.indexOf('calendly.com') !== -1) return 'calendly';
    if (/hubspot\.com|hs-sites|meetings\./.test(href)) return 'hubspot_meetings';
    if (/cal\.com|savvycal|tidycal/.test(href)) return 'other_scheduler';
    return 'unknown';
  }

  function wireEvents() {
    if (wired) return;
    wired = true;

    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';

      /* Decorate at click time as well as at load. decorateAppLinks() only
         sees links present at DOMContentLoaded, so anything injected later —
         a JS-rendered mobile menu, a HubSpot CTA — carried no campaign. Worse,
         signup_click below fires WITH the campaign regardless, so the same
         user could produce a signup_click carrying it and a register carrying
         nothing, and the two reports would disagree with no way to tell why.
         This handler is capture-phase, so it runs before navigation. */
      if (href.indexOf(APP_HOST) !== -1) decorateLink(a);

      if (href.indexOf(APP_HOST + '/register') !== -1) {
        /* Intent to sign up, not a sign-up. See the header note. */
        pfTrack('signup_click', { link_text: (a.textContent || '').trim().slice(0, 60) });
      } else if (a.closest && a.closest('#book-a-call')) {
        /* Matched on the CTA's own container, not the vendor.
           This link has already changed once — the redesign replaced the
           Calendly booking with mailto:sales@ — and it is about to change
           again when Amrit's booking link is swapped in. Matching on
           calendly.com or on a mailto would silently stop counting the
           moment that happens, and nobody would notice until the Monday
           report showed zero. #book-a-call is the section id, so whatever
           the link points at, the conversion is still recorded. */
        pfTrack('book_a_call', { destination: bookingDestination(href) });
      } else if (href.indexOf('calendly.com') !== -1
                 || (href.indexOf('mailto:') === 0 && /book\s*a\s*call/i.test(href + ' ' + (a.textContent || '')))) {
        /* A booking CTA outside that section — other pages link to /contact/
           rather than embedding their own, but this keeps them covered. */
        pfTrack('book_a_call', { destination: bookingDestination(href) });
      } else if (href.indexOf('/become-a-partner/apply') !== -1) {
        pfTrack('partner_apply_start', { from: location.pathname });
      }
    }, true);

    /* HubSpot embedded form submitted. Matched on form ID so each form gets
       its own event name rather than one shared "form submitted". */
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.type !== 'hsFormCallback' || d.eventName !== 'onFormSubmitted') return;
      var name = FORMS[d.id];
      if (name) {
        pfTrack(name, { form_id: d.id });
      } else if (d.id) {
        /* A form we have not mapped. Recorded under a generic name with the ID
           attached rather than dropped, so a new form shows up in GA4 as
           something to name instead of vanishing. */
        pfTrack('form_submit_unmapped', { form_id: String(d.id).slice(0, 60) });
      }
    });
  }

  /* ------------------------------------------------------------------- GTM */

  function loadGTM() {
    if (!GTM_ID && !window.PF_GTM_ID) return;
    var id = window.PF_GTM_ID || GTM_ID;
    if (window.__pfGTM) return;
    window.__pfGTM = true;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ start */

  var started = false;

  function start() {
    if (started) return;
    started = true;
    persistAttribution();
    loadGTM();
    decorateAppLinks();
    wireEvents();
    /* One page_view carrying attribution. The inline gtag config in <head>
       already sent a bare page_view; this adds the campaign dimensions to a
       named event so landing pages can be attributed without relying on
       GA4's own referral handling across the two hosts. */
    pfTrack('page_view_attributed', {
      page_title: document.title.slice(0, 120),
      ga4_id: GA4_ID
    });
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  if (hasConsent()) {
    onReady(start);
  } else {
    /* once: true, and start() is guarded below. cookie-consent.js exposes
       window.pfCookieSettings via a "Cookie settings" link in every footer,
       and accepting from there dispatches this event again — which fired a
       second page_view_attributed for the same page and inflated attributed
       landing-page views. loadGTM and wireEvents were already guarded; the
       event was not. */
    document.addEventListener('pf:consent-granted', function () { onReady(start); }, { once: true });
  }
})();
