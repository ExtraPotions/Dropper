'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
// Mirrors Twitch: colour variables on :root, light/dark from the html class, and a dark overlay container with its own values.
const page = `<!doctype html><html class="tw-root--theme-dark"><style>:root{--color-background-body:#0e0e10;--color-background-base:#18181b;--color-text-base:#efeff1;--color-text-link:#bf94ff;--color-background-button-primary-default:#9147ff}
body{background:var(--color-background-body);color:var(--color-text-base)}.card{background:var(--color-background-base)}.overlay{--color-background-base:rgba(0,0,0,.85)}</style>
<body><main class="card">Directory</main><div class="overlay"><span class="card">Overlay</span></div></body></html>`;
test('Site colors recolour Twitch surfaces, follow its light/dark class, persist and clear fully', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const tab = await browser.newPage({ viewport: { width: 834, height: 900 } });
  await tab.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: page }) : r.abort());
  await tab.goto('https://www.twitch.tv/directory');
  await tab.evaluate(() => { window.GM_xmlhttpRequest = () => {}; window.stored = new Map(); window.GM_getValue = (k, d) => window.stored.has(k) ? window.stored.get(k) : d; window.GM_setValue = (k, v) => window.stored.set(k, v); });
  await tab.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  const host = tab.locator('#tdh-root'); await host.waitFor({ state: 'attached' });
  await host.locator('#tdh-settings-launcher').click();
  await host.locator('[data-exp-section-tab=tdh-progress-body]').click();
  const row = host.locator('#tdh-progress-body [data-dropper-site-colors]');
  assert.equal(await row.count(), 1, 'Appearance has one Site colors row');
  assert.equal(await row.evaluate(n => n.previousElementSibling?.dataset.dropperMenuPreferences), '1', 'it follows Menu Size');
  const select = row.locator('select[aria-label="Site colors"]');
  assert.deepEqual(await select.locator('option').allTextContents(), ['Twitch', 'Default', 'Indigo', 'Blue', 'Green', 'Red', 'Gray']);
  assert.equal(await select.inputValue(), 'off');
  const state = () => tab.evaluate(() => {
    const html = document.documentElement, root = getComputedStyle(html);
    return { attr: html.getAttribute('data-exp-site-colors'), palette: html.dataset.expSitePalette || null, styles: document.querySelectorAll('#exp-site-colors-dropper').length,
      body: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector('main')).backgroundColor,
      overlay: getComputedStyle(document.querySelector('.overlay .card')).backgroundColor, button: root.getPropertyValue('--color-background-button-primary-default').trim() };
  });
  await select.selectOption('blue');
  assert.deepEqual(await state(), { attr: 'dropper', palette: 'blue-dark', styles: 1, body: 'rgb(11, 20, 32)', card: 'rgb(19, 35, 55)', overlay: 'rgba(0, 0, 0, 0.85)', button: '#9147ff' });
  assert.equal(await tab.evaluate(() => window.stored.get('exp:v3:dropper:settings')?.siteColors), 'blue', 'the choice is saved');
  await tab.evaluate(() => document.documentElement.className = 'tw-root--theme-light');
  await tab.waitForFunction(() => document.documentElement.dataset.expSitePalette === 'blue-light');
  assert.equal((await state()).body, 'rgb(231, 240, 251)');
  await select.selectOption('off');
  assert.deepEqual(await state(), { attr: null, palette: null, styles: 0, body: 'rgb(14, 14, 16)', card: 'rgb(24, 24, 27)', overlay: 'rgba(0, 0, 0, 0.85)', button: '#9147ff' });
});
