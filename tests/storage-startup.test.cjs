'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('the installed script retains its control surface when page storage is denied', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><main>Offline Twitch fixture</main></body></html>' }) : route.abort());
  await page.goto('https://www.twitch.tv/example');
  await page.evaluate(() => {
    const saved = new Map();
    window.GM_getValue = (key, fallback) => saved.has(key) ? saved.get(key) : fallback;
    window.GM_setValue = (key, value) => saved.set(key, value);
    window.GM_xmlhttpRequest = () => {};
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Page storage denied', 'SecurityError'); } });
  });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  await page.waitForTimeout(100);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('#tdh-root').count(), 1);
});
