/**
 * PropertyFlow — Shared JavaScript
 * AOS scroll animations, mobile menu, typing animation, counter animation, accordion, smooth scroll
 */

(function () {
    'use strict';

    // ─── AOS Init ───────────────────────────────────────────────
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 700,
            easing: 'ease-out-cubic',
            once: true,
            offset: 80
        });
    }

    // ─── Mobile Menu Toggle ─────────────────────────────────────
    var toggle = document.getElementById('mobile-menu-toggle');
    var mobileNav = document.getElementById('mobile-nav');

    if (toggle && mobileNav) {
        toggle.addEventListener('click', function () {
            // Support both .hidden and .active patterns
            if (mobileNav.classList.contains('hidden')) {
                mobileNav.classList.remove('hidden');
                mobileNav.classList.add('active');
                mobileNav.style.display = 'flex';
            } else if (mobileNav.classList.contains('active')) {
                mobileNav.classList.remove('active');
                mobileNav.classList.add('hidden');
                mobileNav.style.display = 'none';
            } else {
                // Fallback: toggle active
                mobileNav.classList.toggle('active');
            }
        });
    }

    // ─── Accordion ──────────────────────────────────────────────
    var accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(function (header) {
        header.addEventListener('click', function () {
            var content = header.nextElementSibling;
            var isActive = content.classList.contains('active');

            // Close all
            document.querySelectorAll('.accordion-content').forEach(function (el) {
                el.classList.remove('active');
            });
            document.querySelectorAll('.accordion-header').forEach(function (el) {
                el.classList.remove('active');
            });

            // Toggle current
            if (!isActive) {
                content.classList.add('active');
                header.classList.add('active');
            }
        });
    });

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
                    // Close mobile nav if open
                    if (mobileNav) {
                        mobileNav.classList.remove('active');
                        mobileNav.classList.add('hidden');
                        mobileNav.style.display = 'none';
                    }
                }
            }
        });
    });

    // ─── Typing Animation (homepage only) ───────────────────────
    var typingTarget = document.getElementById('typing-target');

    if (typingTarget) {
        var phrases = [
            'Compliant Short-Term Lets.',
            'Smarter Property Revenue.',
            'Licensed STL Operations.'
        ];
        var phraseIndex = 0;
        var charIndex = phrases[0].length; // Start fully typed
        var isDeleting = false;
        var typeSpeed = 80;
        var deleteSpeed = 40;
        var pauseEnd = 2000; // Pause after fully typed
        var pauseStart = 500; // Pause before typing next

        function typeLoop() {
            var current = phrases[phraseIndex];

            if (isDeleting) {
                charIndex--;
                typingTarget.textContent = current.substring(0, charIndex);

                if (charIndex === 0) {
                    isDeleting = false;
                    phraseIndex = (phraseIndex + 1) % phrases.length;
                    setTimeout(typeLoop, pauseStart);
                    return;
                }
                setTimeout(typeLoop, deleteSpeed);
            } else {
                charIndex++;
                typingTarget.textContent = current.substring(0, charIndex);

                if (charIndex === current.length) {
                    isDeleting = true;
                    setTimeout(typeLoop, pauseEnd);
                    return;
                }
                setTimeout(typeLoop, typeSpeed);
            }
        }

        // Start after initial pause
        setTimeout(typeLoop, pauseEnd);
    }

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
        // Add commas for numbers >= 1000
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
            // Ease out cubic
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

    // ─── Early Adopter Counter (homepage only) ──────────────────
    var eaCounter = document.getElementById('ea-counter');
    if (eaCounter) {
        window.updateEarlyAdopterCounter = function (count) {
            eaCounter.textContent = count;
        };

        var WORKER_URL = ''; // Paste Cloudflare Worker URL here
        if (WORKER_URL) {
            fetch(WORKER_URL)
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.spotsRemaining !== undefined) {
                        window.updateEarlyAdopterCounter(data.spotsRemaining);
                    }
                })
                .catch(function () {}); // Fail silently
        }
    }

})();
