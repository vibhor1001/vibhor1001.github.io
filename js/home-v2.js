/* PropertyFlow homepage (Figma redesign) — vanilla JS, no dependencies.
   - mobile menu (header expands in place)
   - FAQ accordion (one open at a time)
   - plays the 9.2s looping animations only while their block is on screen
   - scales the fixed 1224x560 channels diagram down to narrow viewports */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- mobile menu ---------- */
  var header = document.getElementById('hv-header');
  var burger = document.getElementById('hv-burger');
  var panel = document.getElementById('hv-panel');
  function setMenu(open) {
    if (!header || !burger) return;
    header.classList.toggle('hv-menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (burger && panel) {
    burger.addEventListener('click', function () {
      setMenu(!header.classList.contains('hv-menu-open'));
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('hv-menu-open')) {
        setMenu(false);
        burger.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setMenu(false);
    });
  }

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
})();
