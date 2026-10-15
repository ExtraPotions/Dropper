'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const installPath = path.join(root, 'dropper.user.js');
const { loadDropperSource } = require('./load-source.cjs');

const source = loadDropperSource(root);

function accordionFixtureHtml(games) {
  const rows = games.map((game, index) => `
    <div class="campaign-row">
      <div class="accordion-header" role="heading" aria-level="3">
        <button type="button" aria-expanded="false">
          <img class="tw-image" alt="${game}" src="https://static-cdn.jtvnw.net/ttv-boxart/example-${index}-52x72.jpg">
          <div>${game}</div>
          <div>Example Publisher ${index + 1}</div>
          <div>Tue, Sep 22, 12:00 AM - Wed, Oct 6, 11:59 PM</div>
        </button>
      </div>
    </div>
  `).join('\n');
  return `<!doctype html>
<html>
<head><title>Twitch</title></head>
<body>
  <main class="twilight-main">
    <div class="drops-root__content">
      <h4>Open Drop Campaigns</h4>
      ${rows}
      <h4>Closed Drop Campaigns</h4>
      <div class="campaign-row">
        <div class="accordion-header" role="heading" aria-level="3">
          <button type="button" aria-expanded="false">
            <img class="tw-image" alt="Finished Sample Game" src="https://static-cdn.jtvnw.net/ttv-boxart/closed-52x72.jpg">
            <div>Finished Sample Game</div>
            <div>Mon, Jan 5, 12:00 AM - Tue, Jan 6, 11:59 PM</div>
          </button>
        </div>
      </div>
    </div>
  </main>
</body>
</html>`;
}

function emptyFixtureHtml() {
  return `<!doctype html>
<html>
<head><title>Twitch</title></head>
<body>
  <main class="twilight-main">
    <div class="drops-root__content">
      <h4>Open Drop Campaigns</h4>
      <p>There are no Drops campaigns available currently.</p>
      <h4>Closed Drop Campaigns</h4>
    </div>
  </main>
</body>
</html>`;
}

function textBlockFixtureHtml(games) {
  const blocks = games.map((game, index) => `${game}\nExample Studio ${index + 1}\nTue, Sep 22, 12:00 AM - Wed, Oct 6, 11:59 PM`).join('\n');
  return `<!doctype html>
<html>
<head><title>Twitch</title></head>
<body>
  <main class="twilight-main">
    <div class="drops-root__content">
      <h4>Open Drop Campaigns</h4>
      <div style="white-space:pre-line">${blocks}</div>
      <h4>Closed Drop Campaigns</h4>
    </div>
  </main>
</body>
</html>`;
}

async function withCampaignsFixture(html, run) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://www.twitch.tv/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/drops/campaigns')) {
        await route.fulfill({ status: 200, contentType: 'text/html', body: html });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><main></main></body></html>',
      });
    });
    await page.addInitScript(() => {
      window.GM_xmlhttpRequest = ({ onload }) => {
        queueMicrotask(() => onload?.({ status: 204, responseText: '', finalUrl: '' }));
      };
    });
    await page.goto('https://www.twitch.tv/drops/campaigns', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: fs.readFileSync(installPath, 'utf8') });
    await page.waitForFunction(() => typeof window.dropperScrapeCampaignsPage === 'function', null, { timeout: 15000 });
    return await run(page);
  } finally {
    await browser.close();
  }
}

test('source detects All Campaigns display modes instead of hardcoding games', () => {
  assert.match(source, /function detectCampaignsPageDisplay/);
  assert.match(source, /CAMPAIGN_PAGE_DISPLAY\.ACCORDION/);
  assert.match(source, /CAMPAIGN_PAGE_DISPLAY\.TEXT_BLOCK/);
  assert.match(source, /CAMPAIGN_PAGE_DISPLAY\.EMPTY/);
  assert.match(source, /window\.dropperScrapeCampaignsPage/);
  assert.doesNotMatch(source, /NBA 2K27/);
});

test('accordion All Campaigns display scrapes whatever games Twitch renders', async () => {
  const games = [
    'Alpha Arena Sample',
    'Beta Harbor Sample',
    'Gamma Ridge Sample',
    'Delta Spire Sample',
  ];
  const result = await withCampaignsFixture(accordionFixtureHtml(games), (page) => (
    page.evaluate(() => window.dropperScrapeCampaignsPage())
  ));
  assert.equal(result.display.mode, 'accordion');
  assert.equal(result.count, games.length);
  assert.deepEqual(result.games.sort(), games.slice().sort());
  assert.ok(!result.games.includes('Finished Sample Game'), 'closed-section campaigns stay out of the open scrape');
});

test('text-block All Campaigns display scrapes game/publisher/date rows', async () => {
  const games = ['Northwind Sample', 'Southbrook Sample', 'Eastmere Sample'];
  const result = await withCampaignsFixture(textBlockFixtureHtml(games), (page) => (
    page.evaluate(() => window.dropperScrapeCampaignsPage())
  ));
  assert.equal(result.display.mode, 'text-block');
  assert.equal(result.count, games.length);
  assert.deepEqual(result.games.sort(), games.slice().sort());
});

test('empty All Campaigns display is detected without inventing campaigns', async () => {
  const result = await withCampaignsFixture(emptyFixtureHtml(), (page) => (
    page.evaluate(() => window.dropperScrapeCampaignsPage())
  ));
  assert.equal(result.display.mode, 'empty');
  assert.equal(result.count, 0);
  assert.equal(result.display.hasEmptyMessage, true);
});
