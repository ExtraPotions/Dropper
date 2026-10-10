'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const installPath = path.join(__dirname, '..', 'dropper.user.js');

test('shipped Dropper bundle publishes suite state and focuses its menu through the bundled Core', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => (route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><main>Suite fixture</main></body></html>' })
    : route.abort()));
  await page.addInitScript(() => { window.GM_xmlhttpRequest = () => {}; });
  await page.goto('https://www.twitch.tv/suite-fixture');
  await page.addScriptTag({ content: fs.readFileSync(installPath, 'utf8') });
  await page.locator('#tdh-root').waitFor({ state: 'attached' });

  await page.waitForFunction(() => document.querySelector('meta[data-exp-suite-state-product="dropper"]'), null, { timeout: 15000 });
  const state = await page.evaluate(() => JSON.parse(document.querySelector('meta[data-exp-suite-state-product="dropper"]').dataset.expSuiteStatePayload));
  assert.equal(typeof state.activeReward, 'boolean');
  assert.match(state.routingState, /^[a-z0-9][a-z0-9._:-]*$/u);

  await page.keyboard.press('Alt+g');
  await page.waitForFunction(() => document.querySelector('#tdh-root')?.shadowRoot?.activeElement?.id === 'tdh-tools-dock');
  // Core's focusMenuSurface suppresses the outline; Dropper's own fallback leaves it alone.
  assert.equal(await page.locator('#tdh-root').evaluate((node) => node.shadowRoot.querySelector('#tdh-tools-dock').style.outline), 'none');

  assert.equal(await page.evaluate(() => typeof globalThis.ExtraPotionsCore), 'undefined');
  assert.deepEqual(errors, []);
});
