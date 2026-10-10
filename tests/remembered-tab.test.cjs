'use strict';
// Core remembers the last section tab under exp:suite:menu-tab:dropper. Dropper opens a section itself
// every time its menu opens, so it must open the remembered one rather than always Drops.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const installPath = path.join(path.resolve(__dirname, '..'), 'dropper.user.js');

async function openPage(t, remembered) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript((remembered) => {
    window.GM_xmlhttpRequest = () => {};
    if (remembered !== undefined) localStorage.setItem('exp:suite:menu-tab:dropper', remembered);
  }, remembered);
  await page.route('https://www.twitch.tv/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><title>Twitch</title></head><body></body></html>' }));
  await page.goto('https://www.twitch.tv/dropper-remembered-tab');
  await page.addScriptTag({ content: fs.readFileSync(installPath, 'utf8') });
  await page.waitForFunction(() => Boolean(document.getElementById('tdh-root')?.shadowRoot?.querySelector('[data-exp-section-tabs][role=tablist]')));
  return page;
}

const host = (page) => page.locator('#tdh-root');
const toggleMenu = async (page) => { await host(page).locator('[data-exp-part="launcher"]').click(); await page.waitForTimeout(150); };
const selected = (page) => host(page).evaluate((n) => n.shadowRoot.querySelector('[data-exp-section-tabs][role=tablist] [aria-selected="true"]')?.dataset.expSectionTab || null);
const openBodies = (page) => host(page).evaluate((n) => [...n.shadowRoot.querySelectorAll('.fl-tool-body')].filter((b) => !b.classList.contains('fl-tool-hidden') && !b.hidden).map((b) => b.id));

test('Dropper reopens on the tab the user chose last', async (t) => {
  const page = await openPage(t);
  await toggleMenu(page);
  assert.equal(await selected(page), 'tdh-drops-body');
  await host(page).locator('[data-exp-section-tab="tdh-diagnostics-body"]').click();
  assert.equal(await selected(page), 'tdh-diagnostics-body');
  await toggleMenu(page);
  await toggleMenu(page);
  assert.equal(await selected(page), 'tdh-diagnostics-body');
  assert.deepEqual(await openBodies(page), ['tdh-diagnostics-body']);
});

test('Dropper opens Drops when no tab is remembered or the remembered value is not a section', async (t) => {
  for (const remembered of [undefined, 'not-a-section']) {
    const page = await openPage(t, remembered);
    await toggleMenu(page);
    assert.equal(await selected(page), 'tdh-drops-body', String(remembered));
    assert.deepEqual(await openBodies(page), ['tdh-drops-body']);
  }
});
