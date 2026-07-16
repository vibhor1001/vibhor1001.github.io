/**
 * PropertyFlow — Shared JavaScript
 * Mobile menu, counter animation, design-system nav, mega menu
 */

(function () {
    'use strict';

    // ─── Mobile Menu Toggle ─────────────────────────────────────
    var toggle = document.getElementById('mobile-menu-toggle');
    var mobileNav = document.getElementById('mobile-nav');

    if (toggle && mobileNav) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', 'mobile-nav');
        toggle.setAttribute('aria-label', 'Toggle navigation menu');
        mobileNav.setAttribute('role', 'navigation');
        mobileNav.setAttribute('aria-label', 'Mobile navigation');

        toggle.addEventListener('click', function () {
            var open = mobileNav.classList.toggle('active');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
                mobileNav.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            }
        });
    }

    // ─── Smooth Scroll for Anchor Links ─────────────────────────
    var navEl = document.querySelector('nav');
    var navHeight = navEl ? navEl.offsetHeight : 80;

    document.querySelectorAll('a[href^="#"]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            var href = el.getAttribute('href');
            if (href && href.length > 1) {
                var target = document.getElementById(href.substring(1));
                if (target) {
                    e.preventDefault();
                    window.scrollTo({
                        top: target.offsetTop - navHeight,
                        behavior: 'smooth'
                    });
                    if (mobileNav) {
                        mobileNav.classList.remove('active');
                        if (toggle) toggle.setAttribute('aria-expanded', 'false');
                    }
                }
            }
        });
    });

    // ─── Counter Animation ──────────────────────────────────────
    var counters = document.querySelectorAll('[data-counter]');

    if (counters.length > 0 && 'IntersectionObserver' in window) {
        var counterObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(function (el) {
            counterObserver.observe(el);
        });
    }

    function formatNumber(num, decimals) {
        if (decimals > 0) return num.toFixed(decimals);
        var n = Math.round(num);
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function animateCounter(el) {
        var target = parseFloat(el.getAttribute('data-counter'));
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var decimals = (target % 1 !== 0) ? 1 : 0;
        var duration = 1500;
        var startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = eased * target;

            el.textContent = prefix + formatNumber(current, decimals) + suffix;

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = prefix + formatNumber(target, decimals) + suffix;
            }
        }

        requestAnimationFrame(step);
    }

    // ─── Homepage design system: nav scroll + parallax ───────────
    var dsNav = document.getElementById('ds-nav');
    if (dsNav) {
        var dsLogo = document.getElementById('ds-nav-logo');
        var logoWhite = '/images/design/pf-logo-white.svg';
        var logoDark = '/images/design/pf-logo-dark.svg';

        var onDsScroll = function () {
            var y = window.scrollY || document.documentElement.scrollTop || 0;
            var scrolled = y > 30;
            if (scrolled) {
                dsNav.classList.add('ds-nav--scrolled');
            } else {
                dsNav.classList.remove('ds-nav--scrolled');
            }

            if (dsLogo && dsNav.classList.contains('ds-nav--overlay')) {
                dsLogo.src = scrolled ? logoDark : logoWhite;
            }

            var heroMedia = document.getElementById('ds-hero-media');
            if (heroMedia) {
                heroMedia.style.transform = 'translate3d(0,' + (y * 0.24).toFixed(1) + 'px,0)';
            }

            ['ds-intro-image', 'ds-operate-image'].forEach(function (id) {
                var img = document.getElementById(id);
                if (!img || !img.parentElement) return;
                var r = img.parentElement.getBoundingClientRect();
                var prog = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
                var cl = Math.max(-1, Math.min(1, prog));
                img.style.transform = 'translate3d(0,' + (cl * -52).toFixed(1) + 'px,0)';
            });
        };
        window.addEventListener('scroll', onDsScroll, { passive: true });
        onDsScroll();
    }

    // ─── Mega menu hover (desktop) ───────────────────────────────
    var megaNavItems = document.querySelectorAll('.ds-mega-navitem');
    megaNavItems.forEach(function (item) {
        var closeTimer = null;
        item.addEventListener('mouseenter', function () {
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
            item.classList.add('ds-mega-navitem--open');
        });
        item.addEventListener('mouseleave', function () {
            closeTimer = setTimeout(function () {
                closeTimer = null;
                item.classList.remove('ds-mega-navitem--open');
            }, 90);
        });
    });

    var dsHeroVideo = document.querySelector('.ds-hero__video');
    if (dsHeroVideo) {
        var markHeroPlaying = function () {
            dsHeroVideo.classList.add('is-playing');
        };
        dsHeroVideo.addEventListener('playing', markHeroPlaying);
        if (!dsHeroVideo.paused) markHeroPlaying();
    }

})();
