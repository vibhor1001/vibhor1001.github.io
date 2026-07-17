/**
 * Render every page of the staging site to an individual PDF part (P01..P58).
 * A4 landscape, scale 0.78 -> ~1439px CSS layout width (desktop breakpoints).
 * Output: <scratchpad>/pdf/parts/PNN.pdf + manifest.json (+ QA screenshots).
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://vibhor1001.github.io';   // review-reference URL (shown in banners/footers)
const SERVE = 'http://127.0.0.1:8124';          // byte-identical local mirror (webp->jpeg transcoding server)
const SCRATCH = __dirname;
const EXTDIR = path_join_safe();
function path_join_safe() { return require('path').join(__dirname, 'extdeps'); }
const EXT = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'extdeps', 'manifest.json'), 'utf8'));
const extCache = new Map();
function extBody(file) {
  if (!extCache.has(file)) extCache.set(file, require('fs').readFileSync(require('path').join(EXTDIR, file)));
  return extCache.get(file);
}
const PARTS_DIR = path.join(SCRATCH, 'pdf', 'parts');
const QA_DIR = path.join(SCRATCH, 'qa');
fs.mkdirSync(PARTS_DIR, { recursive: true });
fs.mkdirSync(QA_DIR, { recursive: true });

const GROUPS = [
  { group: 'Home', pages: [['/', 'Home']] },
  { group: 'Pricing', pages: [['/pricing/', 'Pricing']] },
  { group: 'For Landlords', pages: [
    ['/for-landlords/', 'For Landlords — Overview'],
    ['/for-landlords/just-starting-out/', 'Just Starting Out'],
    ['/for-landlords/building-a-portfolio/', 'Building a Portfolio'],
    ['/for-landlords/managing-for-owners/', 'Managing for Owners'],
    ['/for-landlords/new-to-property-software/', 'New to Property Software'],
    ['/for-landlords/coming-from-spreadsheets/', 'Coming from Spreadsheets'],
    ['/for-landlords/city-apartments/', 'City Apartments'],
    ['/for-landlords/highlands-and-coast/', 'Highlands & Coast'],
    ['/for-landlords/serviced-accommodation/', 'Serviced Accommodation'],
    ['/for-landlords/longer-and-mid-lets/', 'Longer & Mid Lets'],
  ]},
  { group: 'For Investors', pages: [['/for-investors/', 'For Investors']] },
  { group: 'Become a Partner', pages: [
    ['/become-a-partner/', 'Become a Partner — Overview'],
    ['/become-a-partner/the-50-50-model/', 'The 50/50 Model'],
    ['/become-a-partner/what-we-take-on/', 'What We Take On'],
    ['/become-a-partner/what-stays-yours/', 'What Stays Yours'],
    ['/become-a-partner/what-we-look-for/', 'What We Look For'],
    ['/become-a-partner/your-time-back/', 'Your Time Back'],
    ['/become-a-partner/room-to-scale/', 'Room to Scale'],
    ['/become-a-partner/one-platform-underneath/', 'One Platform Underneath'],
    ['/become-a-partner/onboarding/', 'Onboarding'],
    ['/become-a-partner/apply/', 'Apply'],
  ]},
  { group: 'Platform', pages: [
    ['/platform/', 'Platform — Overview'],
    ['/platform/ai-pricing/', 'AI Pricing'],
    ['/platform/channel-management/', 'Channel Management'],
    ['/platform/direct-booking-site/', 'Direct Booking Site'],
    ['/platform/unified-inbox/', 'Unified Inbox'],
    ['/platform/multi-calendar/', 'Multi-Calendar'],
    ['/platform/compliance/', 'Compliance'],
    ['/platform/turnovers-team/', 'Turnovers & Team'],
    ['/platform/revenue-reporting/', 'Revenue Reporting'],
    ['/platform/financials-xero/', 'Financials & Xero'],
    ['/platform/hands-free/', 'Hands-Free'],
  ]},
  { group: 'Edinburgh Market', pages: [
    ['/edinburgh-market/', 'Edinburgh Market — Overview'],
    ['/edinburgh-market/pricing-data/', 'Pricing Data'],
    ['/edinburgh-market/stl-licensing-guide/', 'STL Licensing Guide'],
  ]},
  { group: 'Company', pages: [
    ['/about/', 'About'],
    ['/careers/', 'Careers'],
    ['/contact/', 'Contact'],
  ]},
  { group: 'Blog', pages: [
    ['/blog/', 'Blog — Index'],
    ['/blog/edinburgh-visitor-levy/', 'Edinburgh Visitor Levy'],
    ['/blog/airbnb-fee-change-edinburgh-hosts/', 'Airbnb Fee Change'],
    ['/blog/multi-channel-ota-strategy-edinburgh-hosts/', 'Multi-Channel OTA Strategy'],
    ['/blog/ai-automation-short-term-rentals-edinburgh/', 'AI & Automation for STLs'],
    ['/blog/corporate-let-vs-managed-service/', 'Corporate Let vs Managed Service'],
    ['/blog/compliant-operators-winning/', 'Compliant Operators Winning'],
    ['/blog/licensing-and-compliance/', 'Licensing & Compliance'],
    ['/blog/safety-and-certificates/', 'Safety & Certificates'],
    ['/blog/planning-permission/', 'Planning Permission'],
    ['/blog/uk-stl-landscape/', 'UK STL Landscape'],
    ['/blog/tourism-done-well/', 'Tourism Done Well'],
    ['/blog/rates-and-revenue/', 'Rates & Revenue'],
    ['/blog/guides-and-playbooks/', 'Guides & Playbooks'],
    ['/blog/short-let-vs-mid-let/', 'Short Let vs Mid Let'],
    ['/blog/whats-new/', "What's New"],
  ]},
  { group: 'Legal', pages: [
    ['/privacy-policy.html', 'Privacy Policy'],
    ['/terms.html', 'Terms of Service'],
  ]},
];

const PAGES = [];
GROUPS.forEach(g => g.pages.forEach(([p, label]) => PAGES.push({ path: p, label, group: g.group })));
PAGES.forEach((p, i) => {
  p.idx = i + 1;
  p.part = 'P' + String(i + 1).padStart(2, '0');
  p.url = SERVE + p.path;
  p.urlShown = 'vibhor1001.github.io' + p.path;
  p.file = path.join(PARTS_DIR, p.part + '.pdf');
});
const TOTAL = PAGES.length;

const QA_PATHS = new Set(['/', '/pricing/', '/contact/', '/for-landlords/']);

const BLOCK_HOSTS = [
  'googletagmanager.com', 'google-analytics.com', 'doubleclick.net',
  'hs-scripts.com', 'hs-analytics.net', 'hs-banner.com', 'track.hubspot.com',
  'usemessages.com',
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function preparePage(page, meta) {
  const failures = [];
  page.on('response', r => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', r => {
    const f = r.failure();
    if (f && f.errorText !== 'net::ERR_ABORTED' && f.errorText !== 'net::ERR_BLOCKED_BY_CLIENT') {
      failures.push(`FAIL ${r.url()} (${f.errorText})`);
    }
  });

  try {
    await page.goto(meta.url, { waitUntil: 'load', timeout: 90000 });
  } catch (e) {
    await page.goto(meta.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForTimeout(600);

  // scroll through the page (lazy loads, counters), then back to top
  await page.evaluate(async () => {
    await new Promise(res => {
      let y = 0;
      const t = setInterval(() => {
        y += 720;
        window.scrollTo(0, y);
        if (y >= document.documentElement.scrollHeight - innerHeight) { clearInterval(t); res(); }
      }, 60);
    });
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);

  // wait for fonts + images (bounded)
  await Promise.race([
    page.evaluate(() => Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      ...Array.from(document.images).filter(i => !i.complete)
        .map(i => new Promise(r => { i.onload = i.onerror = r; })),
    ])),
    page.waitForTimeout(9000),
  ]);
  if (meta.path === '/for-landlords/') await page.waitForTimeout(2500); // leaflet tiles

  const title = await page.evaluate((m) => {
    // cookie banner (belt & braces — cookie already suppresses it)
    const cb = document.getElementById('pf-cookie-banner'); if (cb) cb.remove();

    // counters -> final values (replicates propertyflow.js formatting)
    document.querySelectorAll('[data-counter]').forEach(el => {
      const target = parseFloat(el.getAttribute('data-counter'));
      if (isNaN(target)) return;
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';
      const decimals = (target % 1 !== 0) ? 1 : 0;
      const num = decimals > 0 ? target.toFixed(decimals)
        : Math.round(target).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      el.textContent = prefix + num + suffix;
    });

    // any <video> -> poster image (insurance; staging currently has none)
    document.querySelectorAll('video').forEach(v => {
      const poster = v.getAttribute('poster');
      if (poster) {
        const img = document.createElement('img');
        img.src = poster; img.className = v.className;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:1';
        v.replaceWith(img);
      } else { v.classList.add('is-playing'); v.style.opacity = '1'; }
    });

    // HubSpot form cannot load offline -> honest placeholder
    document.querySelectorAll('.hs-form-frame').forEach(fr => {
      if (!fr.querySelector('iframe, form')) {
        const ph = document.createElement('div');
        ph.style.cssText = 'border:2px dashed #E65A38;border-radius:10px;padding:26px;text-align:center;font:600 14px/1.6 Arial,sans-serif;color:#141A23;background:#fff7f4';
        ph.textContent = 'HubSpot enquiry form appears here on the live site — review the form itself at vibhor1001.github.io/contact/';
        fr.appendChild(ph);
      }
    });

    // reset scroll-driven parallax transforms
    ['ds-hero-media', 'ds-intro-image', 'ds-operate-image'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.transform = 'none';
    });

    // print-friendly overrides
    const st = document.createElement('style');
    st.textContent = [
      '.ds-grain::before{display:none!important}',
      '#pf-cookie-banner{display:none!important}',
      '#hubspot-messages-iframe-container,.hs-web-interactives{display:none!important}',
      'html,body{scroll-behavior:auto!important}',
      '[data-aos]{opacity:1!important;transform:none!important}',
    ].join('\n');
    document.head.appendChild(st);

    // part banner at very top
    const b = document.createElement('div');
    b.id = 'pf-review-banner';
    b.style.cssText = 'background:#141A23;padding:13px 26px;border-bottom:3px solid #E65A38;position:relative;z-index:99999';
    const l1 = document.createElement('div');
    l1.style.cssText = 'font:700 15px/1.2 Arial,sans-serif;color:#eea946;letter-spacing:.05em';
    l1.textContent = m.part + ' of ' + m.total + '  ·  ' + m.label.toUpperCase() + '  ·  section: ' + m.group.toUpperCase();
    const l2 = document.createElement('div');
    l2.style.cssText = 'font:400 11.5px/1.5 Arial,sans-serif;color:#faf8f5;opacity:.85;margin-top:3px';
    l2.textContent = m.urlShown + '   —   feedback ref: ' + m.part + ' + sheet number (bottom of page) + section heading';
    b.appendChild(l1); b.appendChild(l2);
    document.body.insertBefore(b, document.body.firstChild);

    // fixed nav -> absolute (else it repeats on every printed sheet)
    document.querySelectorAll('nav, header').forEach(n => {
      if (getComputedStyle(n).position === 'fixed') {
        n.style.position = 'absolute';
        n.style.top = b.offsetHeight + 'px';
      }
    });
    window.scrollTo(0, 0);
    return document.title;
  }, { part: meta.part, total: TOTAL, label: meta.label, group: meta.group, urlShown: meta.urlShown });

  return { title, failures };
}

async function renderOne(context, meta) {
  const page = await context.newPage();
  try {
    const { title, failures } = await preparePage(page, meta);
    if (QA_PATHS.has(meta.path)) {
      await page.screenshot({ path: path.join(QA_DIR, meta.part + '-top.png') });
    }
    await page.emulateMedia({ media: 'screen' });
    await page.pdf({
      path: meta.file,
      format: 'A4',
      landscape: true,
      printBackground: true,
      scale: 0.78,
      margin: { top: '0px', right: '0px', bottom: '34px', left: '0px' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        `<div style="width:100%;font-size:8.5px;font-family:Arial,Helvetica,sans-serif;color:#555;padding:0 26px;display:flex;justify-content:space-between;align-items:center;">` +
        `<span>${esc(meta.part)} · ${esc(meta.label)} · ${esc(meta.urlShown)}</span>` +
        `<span>sheet <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    return { title, failures };
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent: undefined,
  });
  await context.addCookies([{
    name: 'pf_cookie_consent', value: 'accepted', url: SERVE,
  }]);
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(SERVE)) return route.continue();
    if (EXT[url]) return route.fulfill({ body: extBody(EXT[url].file), contentType: EXT[url].type });
    if (url.includes('basemaps.cartocdn.com')) {
      return route.fulfill({ body: extBody(EXT.__TILE__.file), contentType: EXT.__TILE__.type });
    }
    return route.abort('aborted'); // external trackers/embeds: intentionally offline (filtered from failure log)
  });

  const queue = PAGES.filter(p => !process.env.ONLY || p.path === process.env.ONLY);
  const results = [];
  let done = 0;

  async function worker(wid) {
    while (queue.length) {
      const meta = queue.shift();
      let attempt = 0, ok = false, last = null;
      while (attempt < 2 && !ok) {
        attempt++;
        try {
          const r = await renderOne(context, meta);
          results.push({ ...meta, file: path.basename(meta.file), title: r.title, failures: r.failures });
          ok = true;
        } catch (e) {
          last = e;
          console.log(`[w${wid}] retrying ${meta.part} ${meta.path}: ${e.message.split('\n')[0]}`);
        }
      }
      if (!ok) {
        results.push({ ...meta, file: null, error: String(last && last.message) });
        console.log(`[w${wid}] FAILED ${meta.part} ${meta.path}`);
      }
      done++;
      console.log(`[w${wid}] ${done}/${TOTAL} ${meta.part} ${meta.label} ${ok ? 'ok' : 'ERROR'}`);
    }
  }

  await Promise.all([1, 2, 3, 4, 5].map(worker));
  await browser.close();

  results.sort((a, b) => a.idx - b.idx);
  fs.writeFileSync(path.join(SCRATCH, 'pdf', 'manifest.json'), JSON.stringify({
    base: BASE, generated: '2026-07-16', total: TOTAL,
    groups: GROUPS.map(g => g.group), pages: results,
  }, null, 2));

  const failed = results.filter(r => !r.file);
  console.log(`\nRENDER COMPLETE: ${results.length - failed.length}/${TOTAL} ok, ${failed.length} failed`);
  const withNet = results.filter(r => r.failures && r.failures.length);
  console.log(`pages with 4xx/5xx or failed subresources: ${withNet.length}`);
  withNet.slice(0, 15).forEach(r => console.log(`  ${r.part} ${r.path}: ${r.failures.slice(0, 4).join(' | ')}`));
})();
