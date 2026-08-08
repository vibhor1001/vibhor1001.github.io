(function () {
  var tabs = document.querySelectorAll('.hd-capabilities__tab');
  var contentPanels = document.querySelectorAll('.hd-cap-content__img, .hd-cap-content__crop');
  var sidebar = document.querySelector('.hd-cap-sidebar');

  if (tabs.length && contentPanels.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-panel');

        tabs.forEach(function (t) {
          var isActive = t === tab;
          t.classList.toggle('hd-capabilities__tab--active', isActive);
          t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        contentPanels.forEach(function (panel) {
          var isActive = panel.getAttribute('data-panel') === target;
          panel.classList.toggle('hd-cap-content__img--active', isActive && panel.classList.contains('hd-cap-content__img'));
          panel.classList.toggle('hd-cap-content__crop--active', isActive && panel.classList.contains('hd-cap-content__crop'));
        });

        if (sidebar) {
          var showSidebar = (sidebar.getAttribute('data-panel') || '').split(' ').indexOf(target) !== -1;
          sidebar.classList.toggle('hd-cap-sidebar--hidden', !showSidebar);
        }
      });
    });
  }

  var sidebarToggles = document.querySelectorAll('.hd-cap-sidebar__toggle');
  sidebarToggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      toggle.classList.toggle('is-expanded');
    });
  });
})();
