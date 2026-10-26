/* PropertyFlow shared header: mega menus (hover + click + keyboard) and the mobile burger menu. Vanilla JS. */
(function () {
  'use strict';
  var hn = document.getElementById('ds-nav');
  if (!hn) return;
  var mq = window.matchMedia('(max-width: 1100px)');
  var items = [].slice.call(hn.querySelectorAll('.hn__item--dd'));
  var burger = hn.querySelector('.hn__burger');
  var timer;

  function setOpen(item, open) {
    item.classList.toggle('is-open', open);
    var b = item.querySelector('.hn__link'); if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeAll(except) { items.forEach(function (it) { if (it !== except) setOpen(it, false); }); }

  items.forEach(function (it) {
    var b = it.querySelector('.hn__link');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !it.classList.contains('is-open');
      // mouse click on a hover-capable desktop: the hover already opened it, keep it open (keyboard / touch toggle)
      if (!open && e.detail > 0 && !mq.matches && window.matchMedia('(hover: hover)').matches) open = true;
      closeAll(it); setOpen(it, open);
    });
    it.addEventListener('mouseenter', function () {
      if (mq.matches || !window.matchMedia('(hover: hover)').matches) return;
      clearTimeout(timer); closeAll(it); setOpen(it, true);
    });
    it.addEventListener('mouseleave', function () {
      if (mq.matches || !window.matchMedia('(hover: hover)').matches) return;
      timer = setTimeout(function () { setOpen(it, false); }, 160);
    });
  });
  document.addEventListener('click', function (e) { if (!hn.contains(e.target)) closeAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openItem = items.filter(function (i) { return i.classList.contains('is-open'); })[0];
    closeAll();
    if (hn.classList.contains('is-open')) { setMenu(false); if (burger) burger.focus(); }
    else if (openItem) { var b = openItem.querySelector('.hn__link'); if (b) b.focus(); }
  });
  hn.addEventListener('focusout', function (e) {
    if (!e.relatedTarget || mq.matches) return;
    items.forEach(function (it) { if (it.classList.contains('is-open') && !it.contains(e.relatedTarget)) setOpen(it, false); });
  });

  function setMenu(open) {
    hn.classList.toggle('is-open', open);
    if (burger) { burger.setAttribute('aria-expanded', open ? 'true' : 'false'); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); }
    if (!open) closeAll();
  }
  if (burger) burger.addEventListener('click', function () { setMenu(!hn.classList.contains('is-open')); });
  hn.addEventListener('click', function (e) { if (mq.matches && e.target.closest('a')) setMenu(false); });
  function onChange() { setMenu(false); closeAll(); }
  if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);
})();
