/**
 * PropertyFlow — Shared JavaScript
 * AOS scroll animations, mobile menu, typing animation, counter animation, accordion, smooth scroll
 */

(function () {
    'use strict';

    // ─── AOS Init ───────────────────────────────────────────────
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-out-quart',
            once: true,
            offset: 60
        });
    }

    // ─── Mobile Menu Toggle ─────────────────────────────────────
    var toggle = document.getElementById('mobile-menu-toggle');
    var mobileNav = document.getElementById('mobile-nav');

    if (toggle && mobileNav) {
        // Set initial ARIA attributes for accessibility
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', 'mobile-nav');
        toggle.setAttribute('aria-label', 'Toggle navigation menu');
        mobileNav.setAttribute('role', 'navigation');
        mobileNav.setAttribute('aria-label', 'Mobile navigation');

        toggle.addEventListener('click', function () {
            // Support both .hidden and .active patterns
            if (mobileNav.classList.contains('hidden')) {
                mobileNav.classList.remove('hidden');
                mobileNav.classList.add('active');
                mobileNav.style.display = 'flex';
                toggle.setAttribute('aria-expanded', 'true');
            } else if (mobileNav.classList.contains('active')) {
                mobileNav.classList.remove('active');
                mobileNav.classList.add('hidden');
                mobileNav.style.display = 'none';
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                // Fallback: toggle active
                mobileNav.classList.toggle('active');
            }
        });

        // Close mobile nav on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
                mobileNav.classList.remove('active');
                mobileNav.classList.add('hidden');
                mobileNav.style.display = 'none';
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
            'Licensed STL Operations.',
            'AI-Powered Pricing.',
            'Hands-Free Management.'
        ];
        var phraseIndex = 0;
        var charIndex = phrases[0].length; // Start fully typed
        var isDeleting = true; // Start by deleting first phrase
        var typeSpeed = 65;      // Typing speed
        var deleteSpeed = 30;    // Quick backspace
        var pauseEnd = 3000;     // 3 seconds pause after fully typed
        var pauseStart = 300;    // Quick start on next phrase

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
                // Accelerate deletion as it goes (feels more natural)
                var speed = deleteSpeed - Math.min(charIndex * 0.5, 15);
                setTimeout(typeLoop, Math.max(speed, 15));
            } else {
                charIndex++;
                typingTarget.textContent = current.substring(0, charIndex);

                if (charIndex === current.length) {
                    isDeleting = true;
                    setTimeout(typeLoop, pauseEnd);
                    return;
                }
                // Slight random variance for natural feel
                var variance = Math.random() * 30 - 10;
                setTimeout(typeLoop, typeSpeed + variance);
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

    // ─── Force Video Autoplay on Mobile ─────────────────────────
    // iOS/Android block autoplay unless muted+playsinline.
    // This aggressively retries play() on page load, DOMContentLoaded,
    // visibility change, and every 2s until all videos are playing.
    function forceVideoPlay() {
        var videos = document.querySelectorAll('video.hero-video-bg, video.hero-video');
        videos.forEach(function(video) {
            // Ensure attributes are set (belt and braces)
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');

            if (video.paused) {
                var p = video.play();
                if (p && p.catch) p.catch(function() {});
            }
        });
    }

    // Fire on every possible load event
    forceVideoPlay();
    document.addEventListener('DOMContentLoaded', forceVideoPlay);
    window.addEventListener('load', forceVideoPlay);
    setTimeout(forceVideoPlay, 500);
    setTimeout(forceVideoPlay, 1500);
    setTimeout(forceVideoPlay, 3000);

    // Retry when tab becomes visible (iOS pauses videos on tab switch)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) forceVideoPlay();
    });

    // Persistent retry every 2s for first 10s (catches slow-loading mobile)
    var retryCount = 0;
    var retryInterval = setInterval(function() {
        forceVideoPlay();
        retryCount++;
        if (retryCount >= 5) clearInterval(retryInterval);
    }, 2000);

    // ─── Disable GSAP Parallax on Mobile ──────────────────────────
    // Inline <script> blocks on each page apply gsap.to('.hero-video-bg', { yPercent })
    // On mobile, this parallax causes jank and layout issues.
    // Kill all ScrollTrigger instances targeting hero videos after a tick
    // (allows inline scripts to run first, then we clean up on mobile).
    if (window.innerWidth <= 768) {
        setTimeout(function () {
            if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.getAll) {
                ScrollTrigger.getAll().forEach(function (st) {
                    var trigger = st.vars && st.vars.trigger;
                    if (trigger === '.hero-bg-section' || trigger === '.hero-section') {
                        st.kill();
                    }
                });
                // Reset any transforms GSAP may have applied
                var heroVideos = document.querySelectorAll('.hero-video-bg, .hero-video');
                heroVideos.forEach(function (el) {
                    el.style.transform = 'none';
                    el.style.willChange = 'auto';
                });
            }
        }, 100);
    }

})();
