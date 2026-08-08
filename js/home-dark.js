(function () {
  var tabs = document.querySelectorAll('.hd-capabilities__tab');
  var panels = document.querySelectorAll('.hd-capabilities__img');
  if (!tabs.length || !panels.length) return;

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.getAttribute('data-panel');

      tabs.forEach(function (t) {
        var isActive = t === tab;
        t.classList.toggle('hd-capabilities__tab--active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      panels.forEach(function (panel) {
        panel.classList.toggle('hd-capabilities__img--active', panel.getAttribute('data-panel') === target);
      });
    });
  });
})();
