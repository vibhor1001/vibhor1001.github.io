/** Render front-matter HTML files (cover/guide/sitemap) to PDF, same paper as parts. */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCRATCH = __dirname;
const FRONT = path.join(SCRATCH, 'front');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1123, height: 794 } });
  for (const name of ['cover', 'guide', 'sitemap']) {
    await page.goto('file://' + path.join(FRONT, name + '.html'), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.emulateMedia({ media: 'screen' });
    await page.pdf({
      path: path.join(FRONT, name + '.pdf'),
      format: 'A4', landscape: true, printBackground: true, scale: 1,
      margin: { top: '0px', right: '0px', bottom: name === 'cover' ? '0px' : '34px', left: '0px' },
      displayHeaderFooter: name !== 'cover',
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:8.5px;font-family:Arial;color:#555;padding:0 26px;display:flex;justify-content:space-between;">` +
        `<span>PropertyFlow website content review pack — ${name === 'guide' ? 'how to review' : 'sitemap'}</span>` +
        `<span>sheet <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    const kb = Math.round(fs.statSync(path.join(FRONT, name + '.pdf')).size / 1024);
    console.log(`front ${name}.pdf ok (${kb} KB)`);
  }
  await browser.close();
})();
