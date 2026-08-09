(function () {
  var faqToggles = document.querySelectorAll('.cm-faq__q');
  faqToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.classList.toggle('is-open');
    });
  });
})();
