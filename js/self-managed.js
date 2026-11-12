/* Self Managed Hosting page: accordions (one open at a time per list). Vanilla JS. */
(function () {
  'use strict';
  function acc(itemSel, headSel) {
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
  /* fixed-size illustrations (step cards, pricing calendar) shrink to the screen width on small screens */
  var fx = [['.sm-step', 400], ['.sm-cal', 616]].map(function (a) { return { els: [].slice.call(document.querySelectorAll(a[0])), w: a[1] }; });
  function fit() {
    var small = document.documentElement.clientWidth <= 1100;
    fx.forEach(function (g) {
      g.els.forEach(function (el) {
        var host = el.parentNode, hw = host.clientWidth - (parseFloat(getComputedStyle(host).paddingLeft) || 0) - (parseFloat(getComputedStyle(host).paddingRight) || 0);
        var z = small ? Math.min(1, hw / g.w) : 1;
        el.style.zoom = z === 1 ? '' : z;
        el.style.height = (small && g.w === 616) ? (640 * 1) + 'px' : '';
      });
    });
  }
  fit(); window.addEventListener('resize', fit);
  acc('.sm-pa', '.sm-pa__h');
  acc('.sm-pp', '.sm-pp__h');
})();
