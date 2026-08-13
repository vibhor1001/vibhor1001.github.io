(function () {
  document.querySelectorAll('.hd-nav__dropdown').forEach(function (dd) {
    var btn = dd.querySelector('.hd-nav__link--dropdown');
    if (!btn) return;
    var nav = dd.closest('.hd-nav');
    var backdrop = nav ? nav.querySelector('.hd-nav__backdrop') : null;

    function close() {
      dd.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      if (backdrop) { backdrop.classList.remove('is-open'); }
    }
    function open() {
      document.querySelectorAll('.hd-nav__dropdown.is-open').forEach(function (o) {
        if (o !== dd) { o.classList.remove('is-open'); }
      });
      dd.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      if (backdrop) { backdrop.classList.add('is-open'); }
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dd.classList.contains('is-open')) { close(); } else { open(); }
    });
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) { close(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); }
    });
  });
})();
