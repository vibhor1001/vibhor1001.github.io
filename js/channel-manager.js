/* Channel Manager page: header solid-on-scroll, accordions, fit-to-width for the fixed-size desktop layout. Vanilla JS. */
(function () {
  'use strict';
  var hn = document.getElementById('ds-nav');
  function onScroll() { if (hn) hn.classList.toggle('cm-solid', window.scrollY > 40); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  function acc(root, itemSel, headSel) {
    var items = [].slice.call(document.querySelectorAll(itemSel));
    items.forEach(function (it) {
      var h = it.querySelector(headSel);
      h.addEventListener('click', function () {
        var open = !it.classList.contains('is-open');
        items.forEach(function (o) { o.classList.remove('is-open'); o.querySelector(headSel).setAttribute('aria-expanded', 'false'); });
        if (open) { it.classList.add('is-open'); h.setAttribute('aria-expanded', 'true'); }
      });
    });
  }
  acc(null, '.cm-ai', '.cm-ai__h');
  acc(null, '.cm-fq', '.cm-fq__h');

  /* The desktop layout is drawn on a 1240px container. Between 1101 and 1279px viewport widths, scale it to fit. */
  var cs = [].slice.call(document.querySelectorAll('.cm-c'));
  function fit() {
    var w = document.documentElement.clientWidth, z = (w < 1280 && w > 1100) ? (w - 32) / 1240 : 1;
    cs.forEach(function (c) { c.style.zoom = z === 1 ? '' : z; c.style.margin = z === 1 ? '' : '0 0 0 ' + ((w / z - 1240) / 2) + 'px'; });
  }
  /* fixed-size mock-ups (hero diagram, booking card) shrink to the screen width below their design width */
  var fx = [].slice.call(document.querySelectorAll('[data-fit], .cm-card'));
  function fitMocks() {
    var small = document.documentElement.clientWidth <= 1100;
    fx.forEach(function (el) {
      var dw = +el.getAttribute('data-fit') || 602, host = el.parentNode, z = 1;
      if (small) { var aw = (el.classList.contains('cm-card') ? host.clientWidth : host.clientWidth); z = Math.min(1, aw / dw); }
      el.style.zoom = z === 1 ? '' : z;
      if (el.classList.contains('cm-card')) { el.style.width = small ? dw + 'px' : ''; }
    });
  }
  fit(); fitMocks(); window.addEventListener('resize', function () { fit(); fitMocks(); });
})();
