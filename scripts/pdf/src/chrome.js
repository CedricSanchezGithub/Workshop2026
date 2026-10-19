// Impression HTML → PDF avec le Chrome (ou Edge) déjà installé sur la machine
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findBrowser() {
  const found = [process.env.CHROME_PATH, ...CANDIDATES].find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('Chrome ou Edge introuvable : indiquer son chemin dans la variable CHROME_PATH.');
  return found;
}

const footer = `<div style="width:100%;font-size:8px;text-align:center;color:#4A4470;font-family:Arial,sans-serif">
  Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

// Ouvre un seul navigateur pour toutes les impressions
async function openPrinter() {
  const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true });
  return {
    async print(html, file) {
      const tab = await browser.newPage();
      await tab.setContent(html, { waitUntil: 'load' });
      await tab.pdf({
        path: file,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footer,
        margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
      });
      await tab.close();
    },
    close: () => browser.close(),
  };
}

module.exports = { openPrinter };
