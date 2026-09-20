#!/usr/bin/env node

// Renders scripts/og-card.html to docs/og.png (1200x630) with a local Chrome.
// Run after editing the card; the PNG is committed because Pages serves it
// statically and link previews fetch it directly.
//
//   npm run og            # uses google-chrome / chromium on PATH
//   CHROME=/path/to/chrome npm run og

const { execFileSync } = require('child_process');
const path = require('path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const source = path.join(__dirname, 'og-card.html');
const output = path.join(root, 'docs', 'og.png');

function findChrome() {
  const candidates = [
    process.env.CHROME,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return path.isAbsolute(candidate)
        ? candidate
        : execFileSync('which', [candidate], { encoding: 'utf8' }).trim();
    } catch {
      // try the next one
    }
  }
  throw new Error('No Chrome/Chromium found. Set CHROME=/path/to/chrome.');
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.goto(`file://${source}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: output, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  } finally {
    await browser.close();
  }
  console.log(`Wrote ${path.relative(root, output)}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
