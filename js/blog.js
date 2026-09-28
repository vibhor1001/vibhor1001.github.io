/* PropertyFlow blog post pages: copy-link button, contents highlight, and the
   contents box closed by default on small screens. No dependencies. */
(function () {
    'use strict';

    // Copy link
    document.querySelectorAll('.pf-share__copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var url = btn.getAttribute('data-url') || window.location.href;
            var note = btn.querySelector('.pf-share__copied');
            var done = function (msg) {
                if (!note) return;
                note.textContent = msg;
                setTimeout(function () { note.textContent = ''; }, 2000);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(function () { done('Link copied'); }, function () { done(url); });
            } else {
                done(url);
            }
        });
    });

    // Contents: closed on phones, where it sits above the post.
    var box = document.querySelector('.pf-toc__box');
    if (box && window.matchMedia('(max-width: 900px)').matches) box.removeAttribute('open');

    // Contents: mark the section being read.
    var links = Array.prototype.slice.call(document.querySelectorAll('.pf-toc a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    links.forEach(function (a) { byId[decodeURIComponent(a.getAttribute('href').slice(1))] = a; });
    var current = null;
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var link = byId[entry.target.id];
            if (!link || link === current) return;
            if (current) current.removeAttribute('aria-current');
            link.setAttribute('aria-current', 'true');
            current = link;
        });
    }, { rootMargin: '-100px 0px -70% 0px' });
    Object.keys(byId).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) observer.observe(el);
    });
})();
