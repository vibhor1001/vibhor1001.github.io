/* Homepage interactions (vanilla JS): scroll reveals, estimate form, FAQ, carousels. */
(function () {
  'use strict';
  var root = document.querySelector('.pfv');
  if (!root) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- scroll reveals: data-m holds the hidden start state ---- */
  var els = [].slice.call(root.querySelectorAll('[data-m]'));
  var EASE = 'cubic-bezier(.22,1,.36,1)';
  function reveal(el, i) {
    var start = el.getAttribute('data-m'), props = [], dur = /rotateX/.test(start) ? 0.9 : 0.7, delay = i * 0.07;
    if (/clip-path/.test(start)) {            /* hero estimate card: opens from a centre line */
      var line = el.previousElementSibling;
      if (line && line.hasAttribute('data-m')) {
        line.style.transition = 'transform .5s ' + EASE; line.style.opacity = '1'; line.style.transform = 'scaleX(1)';
        setTimeout(function () { line.style.transition = 'opacity .4s ease'; line.style.opacity = '0'; }, 650);
      }
      el.style.transition = 'clip-path .7s ' + EASE + ' .45s,opacity .7s ease .45s';
      el.style.clipPath = 'inset(0% 0% 0% 0% round 24px)'; el.style.opacity = '1';
      setTimeout(function () { el.style.transition = ''; el.style.clipPath = ''; }, 1300);
      return;
    }
    if (el.style.transform === 'scaleX(0)') return;
    if (el.tagName.toLowerCase() === 'path') {  /* process arrows draw themselves */
      el.style.transition = 'opacity .3s ease ' + (0.5 + delay) + 's,stroke-dasharray 1.1s ' + EASE + ' ' + (0.5 + delay) + 's';
      el.style.opacity = '1'; el.setAttribute('stroke-dasharray', '1 0'); el.style.strokeDasharray = '1 0';
      return;
    }
    el.style.transition = ['opacity', 'filter', 'transform'].map(function (k) { return k + ' ' + dur + 's ' + EASE + ' ' + delay + 's'; }).join(',');
    el.style.opacity = '1'; el.style.filter = 'blur(0px)'; el.style.transform = 'none';
    setTimeout(function () { el.style.transition = ''; el.style.filter = ''; }, (dur + delay) * 1000 + 100);
  }
  if (!reduce && 'IntersectionObserver' in window) {
    els.forEach(function (el) { el.style.cssText = el.getAttribute('data-m'); });
    var seen = new Map(), targets = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var list = targets.get(e.target) || []; io.unobserve(e.target);
        list.forEach(function (el) { var p = el.parentNode, i = seen.get(p) || 0; seen.set(p, i + 1); reveal(el, i); });
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) {
      /* text lines sit inside an overflow-hidden mask: watch the mask, not the shifted line */
      var host = (el.parentNode.classList.contains('overflow-hidden') || /clip-path/.test(el.getAttribute('data-m'))) ? el.parentNode : el;
      if (!targets.has(host)) { targets.set(host, []); io.observe(host); }
      targets.get(host).push(el);
    });
  }

  /* ---- hero estimate: self / fully toggle, bedrooms, submit ---- */
  var form = root.querySelector('form');
  if (form) {
    var tog = [].slice.call(form.querySelector('.rounded-full').children), pill = tog[0].firstElementChild, mode = 0;
    function setMode(i) {
      mode = i;
      tog.forEach(function (b, n) {
        var txt = b.lastElementChild, old = b.querySelector('.bg-black');
        if (old) old.remove();
        if (n === i) { var sp = document.createElement('span'); sp.className = 'absolute inset-0 rounded-full bg-black'; b.insertBefore(sp, b.firstChild); }
        txt.className = 'relative z-10 ' + (n === i ? 'text-white' : 'text-[#29262a]');
        b.setAttribute('aria-pressed', n === i ? 'true' : 'false');
      });
    }
    tog.forEach(function (b, i) { b.addEventListener('click', function () { setMode(i); }); });
    setMode(0);
    var bed = form.querySelector('#bedrooms'), dec = form.querySelector('[aria-label="Decrease bedrooms"]'), inc = form.querySelector('[aria-label="Increase bedrooms"]');
    function beds(n) { n = Math.max(1, Math.min(10, n)); bed.textContent = n; dec.disabled = n <= 1; inc.disabled = n >= 10; }
    dec.addEventListener('click', function () { beds(+bed.textContent - 1); });
    inc.addEventListener('click', function () { beds(+bed.textContent + 1); });
    /* ---- enquiry form: validate, build the CRM payload, send (or dummy-send) ---- */
    /* DUMMY MODE: while data-endpoint on the <form> is empty nothing leaves the browser;
       the payload is printed to the console and the thank-you message is shown.
       To go live, set data-endpoint to our Cloudflare Worker URL (the Worker holds the CRM key). */
    var CFG = {
      endpoint: form.getAttribute('data-endpoint') || '',
      serviceTypes: ['SELF_MANAGED', 'FULLY_MANAGED'],   // SELF_MANAGED is a guess: confirm with the CRM team
      wording: 'I agree to PropertyFlow contacting me about my enquiry by email and phone.',
      whatsappWording: 'You can also contact me on WhatsApp, on the number above.'
    };
    var statusEl = form.querySelector('.pfv-status'), submitBtn = form.querySelector('button[type="submit"]'), sending = false;
    function $(id) { return form.querySelector('#' + id); }
    function setErr(input, msg) {
      var holder = input.type === 'checkbox' ? input.closest('label') : input.parentElement;
      var box = holder.nextElementSibling;
      if (!(box && box.classList.contains('pfv-err'))) {
        box = document.createElement('p'); box.className = 'pfv-err'; box.setAttribute('role', 'alert');
        holder.parentNode.insertBefore(box, holder.nextSibling);
      }
      if (input.type !== 'checkbox') holder.classList.toggle('pfv-bad', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      box.textContent = msg || ''; box.hidden = !msg;
      return !msg;
    }
    function normPostcode(v) { v = v.replace(/\s+/g, '').toUpperCase(); return v.length > 3 ? v.slice(0, -3) + ' ' + v.slice(-3) : v; }
    function normPhone(v) {
      var d = v.replace(/[\s().-]/g, '');
      if (/^00/.test(d)) d = '+' + d.slice(2);
      if (/^0\d/.test(d)) d = '+44' + d.slice(1);
      else if (/^44\d/.test(d)) d = '+' + d;
      return d;
    }
    function validPhone(p) { return /^\+44/.test(p) ? /^\+44\d{9,10}$/.test(p) : /^\+[1-9]\d{7,14}$/.test(p); }
    function validate() {
      var ok = true, first = null;
      function chk(input, msg) { var good = setErr(input, msg); if (!good && !first) first = input; ok = ok && good; }
      var pc = $('postcode'), name = $('fullName'), em = $('email'), ph = $('phone'), cons = $('consentEmail');
      var pcv = pc.value.trim(), phv = normPhone(ph.value.trim());
      chk(pc, !pcv ? 'Please enter your property postcode.' : (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pcv.replace(/\s+/g, '').toUpperCase()) ? '' : 'Please enter a valid UK postcode.'));
      chk(name, name.value.trim().length < 2 ? 'Please enter your full name.' : '');
      chk(em, !em.value.trim() ? 'Please enter your email address.' : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim()) ? '' : 'Please enter a valid email address.'));
      chk(ph, !ph.value.trim() ? 'Please enter your phone number.' : (validPhone(phv) ? '' : 'Please enter a valid phone number. For a non-UK number start with the country code, e.g. +91.'));
      chk(cons, cons.checked ? '' : 'Please tick the box so we can contact you.');
      if (first) first.focus();
      return ok;
    }
    function payload() {
      var wa = $('consentWhatsapp').checked;
      return {
        fullName: $('fullName').value.trim(),
        email: $('email').value.trim(),
        phone: normPhone($('phone').value.trim()),
        whatsappSameAsPhone: wa,
        postcode: normPostcode($('postcode').value.trim()),
        bedrooms: +bed.textContent,
        serviceType: CFG.serviceTypes[mode],
        consent: { email: true, whatsapp: wa, wording: CFG.wording + (wa ? ' ' + CFG.whatsappWording : '') }
      };
    }
    function done() { form.classList.add('pfv-done'); var s = form.querySelector('.pfv-success'); if (s) s.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }
    function fail(msg) {
      sending = false; submitBtn.disabled = false; submitBtn.firstChild.nodeValue = 'Get my free estimate';
      statusEl.textContent = msg || 'Sorry, something went wrong. Please try again, or email info@propertyflow.uk.'; statusEl.hidden = false;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      statusEl.hidden = true;
      if (!validate()) return;
      if (form.querySelector('[name="website"]').value) { done(); return; }   // honeypot: bots fill it, people never see it
      sending = true; submitBtn.disabled = true; submitBtn.firstChild.nodeValue = 'Sending…';
      var data = payload();
      if (!CFG.endpoint) {                                                      // dummy mode
        if (window.console) console.info('[PropertyFlow form: DUMMY MODE, nothing was sent]', data);
        setTimeout(done, 600);
        return;
      }
      fetch(CFG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (r.ok) done(); else fail(r.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : null); })
        .catch(function () { fail(); });
    });
  }

  /* ---- FAQ accordion ---- */
  var faq = root.querySelector('#faqs');
  if (faq) {
    var fb = [].slice.call(faq.querySelectorAll('button[aria-controls^="faq-answer"]'));
    var ico = {};
    fb.forEach(function (b) { var s = b.lastElementChild.firstElementChild; ico[b.getAttribute('aria-expanded') === 'true' ? 'minus' : 'plus'] = s.innerHTML; });
    function setFaq(b, open) {
      var box = b.parentNode, ans = document.getElementById(b.getAttribute('aria-controls'));
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.lastElementChild.firstElementChild.innerHTML = open ? ico.minus : ico.plus;
      box.classList.toggle('border-[#f0d9ff]', open);
      box.classList.toggle('border-[#f2e4fa]', !open); box.classList.toggle('hover:border-[#ffb5d1]', !open);
      ans.style.transition = 'height .35s ease,opacity .3s ease';
      if (open) { ans.style.height = ans.scrollHeight + 'px'; ans.style.opacity = '1'; setTimeout(function () { if (b.getAttribute('aria-expanded') === 'true') ans.style.height = 'auto'; }, 360); }
      else { ans.style.height = ans.scrollHeight + 'px'; void ans.offsetHeight; ans.style.height = '0px'; ans.style.opacity = '0'; }
    }
    fb.forEach(function (b) {
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') !== 'true';
        fb.forEach(function (o) { if (o !== b && o.getAttribute('aria-expanded') === 'true') setFaq(o, false); });
        setFaq(b, open);
      });
    });
  }

  /* ---- testimonials ---- */
  var T = [
    { q: 'PropertyFlow\u2019s service is personal. They know my property as well as I do', n: 'Agata', r: 'Property owner \u00b7 Trafalgar Lane, Edinburgh', i: 1 },
    { q: 'I got my summer back', n: 'Gary', r: 'Property owner \u00b7 Edinburgh', i: 2 },
    { q: 'Having everything coordinated in one place has made hosting so much easier.', n: 'Sarah', r: 'Property owner \u00b7 Glasgow', i: 3 },
    { q: 'The regular updates give me confidence that my property is in good hands.', n: 'James', r: 'Property owner \u00b7 Edinburgh', i: 4 }
  ];
  var tsec = root.querySelector('#testimonials');
  if (tsec) {
    var cur = 0, big = tsec.querySelector('.lg\\:block article'), small = tsec.querySelector('[aria-label="Show next testimonial"]'), mob = tsec.querySelector('.lg\\:hidden article');
    var dots = [].slice.call(tsec.querySelectorAll('[aria-label^="Show testimonial"]'));
    function fill(a, d) {
      var ps = a.querySelectorAll('p'), im = a.querySelector('img');
      ps[0].textContent = d.q; ps[1].textContent = d.n; ps[2].textContent = d.r;
      im.src = '/images/home-vc/owner' + d.i + '.jpg'; im.alt = d.n;
    }
    function render(dir) {
      [big, small, mob].forEach(function (a) { a.style.transition = 'opacity .18s ease'; a.style.opacity = '0'; });
      setTimeout(function () {
        fill(big, T[cur]); fill(small, T[(cur + 1) % T.length]); fill(mob, T[cur]);
        dots.forEach(function (d, i) {
          var on = i === cur;
          d.className = 'h-2 rounded-full transition-all duration-300 ' + (on ? 'w-8 bg-[#ff0055]' : 'w-2 bg-[#ff0055]/25');
          if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });
        [big, small, mob].forEach(function (a) { a.style.opacity = '1'; });
      }, 180);
    }
    function go(n) { cur = (n + T.length) % T.length; render(); }
    tsec.querySelector('[aria-label="Next testimonial"]').addEventListener('click', function () { go(cur + 1); });
    tsec.querySelector('[aria-label="Previous testimonial"]').addEventListener('click', function () { go(cur - 1); });
    small.addEventListener('click', function () { go(cur + 1); });
    small.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(cur + 1); } });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
  }

  /* ---- journal carousel ---- */
  var jr = root.querySelector('#propertyflow-journal');
  if (jr) {
    var track = jr.querySelector('.overflow-x-auto');
    function jump(dir) { var c = track.querySelector('article'); track.scrollBy({ left: dir * (c.offsetWidth + 24), behavior: reduce ? 'auto' : 'smooth' }); }
    jr.querySelector('[aria-label="Next blog articles"]').addEventListener('click', function () { jump(1); });
    jr.querySelector('[aria-label="Previous blog articles"]').addEventListener('click', function () { jump(-1); });
  }
})();
