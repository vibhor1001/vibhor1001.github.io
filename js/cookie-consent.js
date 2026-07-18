/**
 * PropertyFlow Cookie Consent Banner
 * PECR-compliant, lightweight, no dependencies
 * v1.0
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'pf_cookie_consent';
  var COOKIE_VALUE = 'accepted';
  var COOKIE_DAYS = 365;
  var PRIVACY_URL = '/privacy-policy.html#cookies';

  /* ── helpers ─────────────────────────────────────────────── */

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie =
      name + '=' + encodeURIComponent(value) +
      ';expires=' + d.toUTCString() +
      ';path=/;SameSite=Lax';
  }

  /* ── guard: don't show if already accepted ──────────────── */

  if (getCookie(COOKIE_NAME) === COOKIE_VALUE) return;

  /* ── build banner ───────────────────────────────────────── */

  var banner = document.createElement('div');
  banner.id = 'pf-cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie consent');

  banner.style.cssText =
    'position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
    'background:#191919;color:#ffffff;font-family:inherit;' +
    'padding:1rem 1.5rem;box-sizing:border-box;' +
    'box-shadow:0 -2px 12px rgba(17,17,17,0.35);';

  var inner = document.createElement('div');
  inner.style.cssText =
    'max-width:1200px;margin:0 auto;display:flex;' +
    'align-items:center;justify-content:space-between;' +
    'gap:1rem;flex-wrap:wrap;';

  /* text */
  var text = document.createElement('p');
  text.style.cssText =
    'margin:0;font-size:0.9rem;line-height:1.5;flex:1 1 0%;min-width:240px;';
  text.innerHTML =
    'We use cookies to improve your experience and analyse site traffic. ' +
    'By clicking <strong>Accept</strong> you consent to our use of cookies. ' +
    '<a href="' + PRIVACY_URL + '" style="color:#FF8A94;text-decoration:underline;">Privacy&nbsp;Policy</a>';

  /* button wrapper — keeps button right-aligned */
  var btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'flex-shrink:0;';

  /* accept button */
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Accept';
  btn.style.cssText =
    'background:#FF385C;color:#ffffff;border:none;' +
    'padding:0.55rem 1.6rem;font-size:0.9rem;font-weight:600;' +
    'border-radius:0.625rem;cursor:pointer;font-family:inherit;' +
    'transition:background 0.2s cubic-bezier(0.16,1,0.3,1);';

  btn.addEventListener('mouseenter', function () {
    btn.style.background = '#E61E4D';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.background = '#FF385C';
  });
  btn.addEventListener('focus', function () {
    btn.style.boxShadow = '0 0 0 3px rgba(255,56,92,0.45)';
  });
  btn.addEventListener('blur', function () {
    btn.style.boxShadow = 'none';
  });

  btn.addEventListener('click', function () {
    setCookie(COOKIE_NAME, COOKIE_VALUE, COOKIE_DAYS);
    /* consent-gated integrations (e.g. js/meta-pixel.js) listen for this */
    try {
      document.dispatchEvent(new CustomEvent('pf:consent-granted'));
    } catch (e) { /* very old browsers: pixel then starts on next page load */ }
    banner.style.transition = 'transform 0.35s cubic-bezier(0.16,1,0.3,1)';
    banner.style.transform = 'translateY(100%)';
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 400);
  });

  /* assemble */
  btnWrap.appendChild(btn);
  inner.appendChild(text);
  inner.appendChild(btnWrap);
  banner.appendChild(inner);

  /* ── inject ─────────────────────────────────────────────── */

  function inject() {
    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
