/* PropertyFlow Self/Fully-managed pages — interactive sections.
   Contract: <section data-acc data-acc-default="1">
               <div data-acc-item="1"> <button class="pfx-acc__btn" aria-expanded="false">…</button> <div class="pfx-acc__a">…</div> </div> … (items 1..4)
               <div data-acc-state="1">…mockup…</div> … (states 1..4)
   Clicking an item opens it (and closes the others) and shows its mockup; clicking the open item does nothing
   (same as the Figma prototype). Nothing open = default mockup (data-acc-default). */
(function () {
  'use strict';
  function init(root) {
    var items = [].slice.call(root.querySelectorAll('[data-acc-item]'));
    var states = [].slice.call(root.querySelectorAll('[data-acc-state]'));
    var dflt = root.getAttribute('data-acc-default') || '1';
    function show(n) {
      root.setAttribute('data-state', n);
      var active = n === '0' ? dflt : n;
      items.forEach(function (it) {
        var on = it.getAttribute('data-acc-item') === n;
        it.classList.toggle('is-open', on);
        var b = it.querySelector('.pfx-acc__btn'); if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
      states.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-acc-state') === active); });
    }
    items.forEach(function (it) {
      var b = it.querySelector('.pfx-acc__btn');
      if (b) b.addEventListener('click', function () { show(it.getAttribute('data-acc-item')); });
    });
    show('0');
  }
  [].forEach.call(document.querySelectorAll('[data-acc]'), init);

  /* one-shot entrance animations: [data-live] gets .is-live the first time it is >=25% visible
     (no observer / reduced motion -> .is-live straight away, i.e. the final static state) */
  var live = [].slice.call(document.querySelectorAll('[data-live]'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (live.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      live.forEach(function (el) { el.classList.add('is-live', 'is-static'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-live'); io.unobserve(en.target); } });
      }, { threshold: 0.25 });
      live.forEach(function (el) { io.observe(el); });
    }
  }

  /* "Great guest experiences" 01/02/03 row (Fully managed): the Figma prototype replays the build-up
     every 4.4s, snapping back to the empty state. Desktop restarts the whole section, mobile each block. */
  var LOOP_MS = 4400;
  var desktop = window.matchMedia ? window.matchMedia('(min-width: 901px)') : { matches: true };
  function restart(el) {
    el.classList.add('is-reset');
    void el.offsetWidth;
    el.classList.remove('is-reset');
  }
  if (!reduce && 'IntersectionObserver' in window) {
    [].forEach.call(document.querySelectorAll('.pfx-stepsfull'), function (sec) {
      var targets = [{ el: sec, on: true }].concat([].map.call(sec.querySelectorAll('.pfx-stepsfull-blk'), function (b) { return { el: b, on: false }; }));
      targets.forEach(function (t) {
        var vis = false, timer = null;
        function tick() {
          if (!vis || !t.el.classList.contains('is-live')) return;
          if (t.on === desktop.matches) restart(t.el);
        }
        new IntersectionObserver(function (entries) {
          vis = entries[entries.length - 1].isIntersecting;
          if (vis && !timer) timer = setInterval(tick, LOOP_MS);
          if (!vis && timer) { clearInterval(timer); timer = null; }
        }, { threshold: 0.25 }).observe(t.el);
      });
    });
  }
})();

/* "Who does what?" comparison: Self Managed / Fully Managed tabs */
(function () {
  'use strict';
  [].forEach.call(document.querySelectorAll('.pfp-plan'), function (root) {
    var tabs = [].slice.call(root.querySelectorAll('.pfp-tab'));
    function pick(tab, focus) {
      root.setAttribute('data-tab', tab.getAttribute('data-tab'));
      tabs.forEach(function (t) { var on = t === tab; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(t, false); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true); }
      });
    });
  });
})();
