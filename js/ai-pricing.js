/* AI Pricing page: scale the 1440px design to the viewport between 1101 and 1439px wide. Below that a separate stacked layout is shown (CSS). */
(function () {
  'use strict';
  var wrap = document.querySelector('.ap-wrap');
  if (!wrap) return;
  function fit() {
    var w = document.documentElement.clientWidth;
    wrap.style.zoom = (w > 1100 && w < 1440) ? (w / 1440) : '';
  }
  fit(); window.addEventListener('resize', fit);
})();
