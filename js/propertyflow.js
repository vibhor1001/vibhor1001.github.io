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

    // ─── Video Autoplay + Pre-buffering System ──────────────────
    // Goal: videos start playing seamlessly with no user interaction,
    // buffering begins before the page finishes loading.

    // 1. Inject <link rel="preload"> into <head> for earliest possible download
    (function preloadHeroVideo() {
        var videos = document.querySelectorAll('video.hero-video-bg, video.hero-video');
        videos.forEach(function(video) {
            var source = video.querySelector('source');
            var videoSrc = video.src || (source && source.src);
            if (videoSrc && !document.querySelector('link[rel="preload"][href="' + videoSrc + '"]')) {
                var link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'video';
                link.href = videoSrc;
                link.type = 'video/mp4';
                link.setAttribute('fetchpriority', 'high');
                document.head.appendChild(link);
            }
        });
    })();

    // 2. Core play function — forces every required attribute and attempts play
    function forceVideoPlay() {
        var videos = document.querySelectorAll('video.hero-video-bg, video.hero-video');
        videos.forEach(function(video) {
            // Force all required attributes (covers iOS Safari, Chrome, Firefox)
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.autoplay = true;
            video.disableRemotePlayback = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('x5-playsinline', '');
            video.setAttribute('muted', '');
            video.setAttribute('autoplay', '');
            video.setAttribute('preload', 'auto');

            // Set src directly on video element (some mobile browsers need this)
            if (!video.src && video.querySelector('source')) {
                video.src = video.querySelector('source').src;
            }

            // Force load + play
            if (video.paused) {
                video.load();
                var p = video.play();
                if (p && p.catch) p.catch(function() {});
            }
        });
    }

    // 3. Smooth fade-in when video is ready (no hard cut from poster)
    (function setupVideoFadeIn() {
        var videos = document.querySelectorAll('video.hero-video-bg, video.hero-video');
        videos.forEach(function(video) {
            if (!video.dataset.fadeReady) {
                video.style.opacity = '0';
                video.style.transition = 'opacity 0.6s ease';
                video.dataset.fadeReady = '1';

                function showVideo() {
                    if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
                        video.style.opacity = '';
                    }
                }
                video.addEventListener('canplay', showVideo);
                video.addEventListener('playing', showVideo);
                // Fallback — if already loaded (cached)
                if (video.readyState >= 2) {
                    video.style.opacity = '';
                }
            }
        });
    })();

    // 4. Pre-buffer via Fetch API for instant playback on next paint
    (function prefetchVideo() {
        if (!window.fetch || !window.Request) return;
        var videos = document.querySelectorAll('video.hero-video-bg, video.hero-video');
        videos.forEach(function(video) {
            var source = video.querySelector('source');
            var videoSrc = video.src || (source && source.src);
            if (videoSrc) {
                // Low-priority fetch warms the browser cache
                fetch(new Request(videoSrc), { mode: 'no-cors', credentials: 'same-origin' })
                    .catch(function() {}); // Fail silently
            }
        });
    })();

    // 5. Immediate call
    forceVideoPlay();

    // 6. On DOM/window load events
    document.addEventListener('DOMContentLoaded', forceVideoPlay);
    window.addEventListener('load', forceVideoPlay);

    // 7. Staggered retries — covers slow mobile connections and deferred parsing
    [100, 250, 500, 1000, 2000, 4000].forEach(function(ms) {
        setTimeout(forceVideoPlay, ms);
    });

    // 8. Tab visibility — iOS pauses video on tab switch, resume on return
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) forceVideoPlay();
    });

    // 9. Touch/scroll kickstart — some mobile browsers block autoplay until first interaction
    var interactionKick = function() {
        forceVideoPlay();
        document.removeEventListener('touchstart', interactionKick);
        document.removeEventListener('scroll', interactionKick);
    };
    document.addEventListener('touchstart', interactionKick, { passive: true });
    document.addEventListener('scroll', interactionKick, { passive: true });

    // 10. Per-video event listeners for canplay/loadeddata
    document.querySelectorAll('video.hero-video-bg, video.hero-video').forEach(function(video) {
        video.addEventListener('canplay', function() {
            if (video.paused) {
                var p = video.play();
                if (p && p.catch) p.catch(function() {});
            }
        });
        video.addEventListener('loadeddata', function() {
            if (video.paused) {
                var p = video.play();
                if (p && p.catch) p.catch(function() {});
            }
        });
        // Stalled recovery — if network stalls, reload
        video.addEventListener('stalled', function() {
            setTimeout(function() {
                if (video.paused || video.readyState < 2) {
                    video.load();
                    var p = video.play();
                    if (p && p.catch) p.catch(function() {});
                }
            }, 1000);
        });
    });

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

    var dsHeroVideo = document.querySelector('.ds-hero__video');
    if (dsHeroVideo) {
        var markHeroPlaying = function () {
            dsHeroVideo.classList.add('is-playing');
        };
        dsHeroVideo.addEventListener('playing', markHeroPlaying);
        if (!dsHeroVideo.paused) markHeroPlaying();
    }

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
