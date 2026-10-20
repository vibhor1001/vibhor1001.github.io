/* PropertyFlow homepage (Figma redesign) — vanilla JS, no dependencies.
   - FAQ accordion (one open at a time)
   - plays the 9.2s looping animations only while their block is on screen
   - scales the fixed 1224x560 channels diagram down to narrow viewports */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- FAQ accordion ---------- */
  var items = Array.prototype.slice.call(document.querySelectorAll('.hv-faq__item'));
  items.forEach(function (item) {
    var q = item.querySelector('.hv-faq__q');
    if (!q) return;
    q.addEventListener('click', function () {
      var willOpen = !item.classList.contains('is-open');
      items.forEach(function (other) {
        other.classList.remove('is-open');
        var oq = other.querySelector('.hv-faq__q');
        if (oq) oq.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('is-open');
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });
  // open the matching question when the page is loaded with #faq-<n>
  var m = /^#faq-(\d+)$/.exec(location.hash || '');
  if (m && items[+m[1]]) items[+m[1]].querySelector('.hv-faq__q').click();

  /* ---------- arriving at /#section (menu: Success Stories, FAQs) ---------- */
  /* The browser scrolls to the section at once, but the lazy images it passes on
     the way then load and push the page down, so the visitor stops short, inside
     the section before. Put the section back under the menu bar once the page has
     settled, unless the visitor has already started scrolling themselves. */
  var touched = false;
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () { touched = true; }, { passive: true });
  });
  function realign() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    if (!id || touched || /^faq-\d+$/.test(id)) return;
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function settle() { setTimeout(realign, 900); setTimeout(realign, 2000); }
  if (location.hash) {
    if (document.readyState === 'complete') settle(); else window.addEventListener('load', settle);
  }
  window.addEventListener('hashchange', function () { touched = false; settle(); });

  /* ---------- play animations only while visible ---------- */
  var live = Array.prototype.slice.call(document.querySelectorAll('[data-live]'));
  if (live.length && !reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.classList.toggle('hv-live', en.isIntersecting);
      });
    }, { threshold: 0.2 });
    live.forEach(function (el) { io.observe(el); });
  }

  /* ---------- channels diagram: scale 1224x560 to the available width ---------- */
  var diag = document.getElementById('hv-diag');
  var scaler = document.getElementById('hv-diag-scale');
  function fitDiagram() {
    if (!diag || !scaler) return;
    var w = diag.parentNode.clientWidth;
    var s = Math.min(1, w / 1224);
    scaler.style.transform = s < 1 ? 'scale(' + s + ')' : '';
    scaler.style.left = s < 1 ? '0' : '';
    scaler.style.marginLeft = s < 1 ? '0' : '';
    diag.style.height = Math.round(560 * s) + 'px';
  }
  fitDiagram();
  window.addEventListener('resize', fitDiagram);
  window.addEventListener('load', fitDiagram);
  /* ---------- testimonials: slow auto-scroll ---------- */
  /* Wraps the cards in a track and repeats them so the strip always fills the screen
     and the loop is seamless (the track moves by exactly one set, --hv-shift).
     Skipped when the visitor asks for reduced motion: they keep the static cards.
     A Pause / Play button is added because moving content needs a way to stop it. */
  var quotes = document.querySelector('[data-marquee]');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (quotes && !reduceMotion) {
    var cards = Array.prototype.slice.call(quotes.children);
    var track = document.createElement('div');
    track.className = 'hv-quotes__track';
    cards.forEach(function (c) { track.appendChild(c); });
    quotes.appendChild(track);
    quotes.classList.add('hv-quotes--marquee');

    var buildMarquee = function () {
      while (track.children.length > cards.length) track.removeChild(track.lastChild);
      var period = 0;
      var extra = cards.length;
      /* add one set so we can measure the distance from a card to its copy */
      cards.forEach(function (c) { var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); track.appendChild(k); });
      period = track.children[cards.length].offsetLeft - track.children[0].offsetLeft;
      if (period <= 0) return;
      var sets = Math.max(2, Math.ceil(quotes.clientWidth / period) + 1);
      for (var i = 2; i < sets; i++) {
        cards.forEach(function (c) { var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); track.appendChild(k); });
      }
      track.style.setProperty('--hv-shift', period + 'px');
    };
    buildMarquee();
    var marqueeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(marqueeTimer);
      marqueeTimer = setTimeout(buildMarquee, 200);
    });

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'hv-quotes__toggle';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.textContent = 'Pause';
    toggle.addEventListener('click', function () {
      var paused = quotes.classList.toggle('hv-quotes--paused');
      toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
      toggle.textContent = paused ? 'Play' : 'Pause';
    });
    quotes.parentNode.insertBefore(toggle, quotes.nextSibling);
  }
})();
