'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');

async function openMenu(t) {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 960, height: 1200 } });
  await context.addCookies([{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }]);
  const page = await context.newPage();
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: '<main>Fixture</main>' }) : r.abort());
  await page.goto('https://www.twitch.tv/sample_streamer');
  await page.evaluate(() => { window.GM_xmlhttpRequest = () => ({ abort() {} }); });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  const host = page.locator('#tdh-root'); await host.waitFor({ state: 'attached' });
  await host.locator('#tdh-settings-launcher').click();
  return { page, host };
}

test('with Badge Only on the in-menu progress panel shows the channel and game on one line above the bar', async t => {
  const { host } = await openMenu(t);
  await host.evaluate(n => n.shadowRoot.getElementById('tdh-badge-only').click());
  const facts = await host.evaluate(n => {
    const s = n.shadowRoot, set = (id, text) => { s.getElementById(id).textContent = text; };
    set('tdh-stream-channel', 'sample_streamer'); set('tdh-stream-game', 'Sample Game'); set('tdh-drop-meta', '28 / 60 min'); set('tdh-drop-name', 'Sample Reward');
    const top = id => Math.round(s.getElementById(id).getBoundingClientRect().top), card = s.getElementById('tdh-drop-card').getBoundingClientRect();
    return { channel: top('tdh-stream-channel'), game: top('tdh-stream-game'), bar: Math.round(s.querySelector('#tdh-drop-card .drop-bar').getBoundingClientRect().top), overflow: s.getElementById('tdh-drop-card').scrollWidth - s.getElementById('tdh-drop-card').clientWidth, height: Math.round(card.height) };
  });
  assert.ok(Math.abs(facts.channel - facts.game) <= 3, JSON.stringify(facts));
  assert.ok(facts.bar > facts.game, JSON.stringify(facts));
  assert.ok(facts.overflow <= 1, JSON.stringify(facts));
});

test('Streams keeps muting and the auto-switch pause on its home view', async t => {
  const { host } = await openMenu(t);
  await host.locator('[data-exp-section-tab="tdh-streams-body"]').click();
  assert.equal(await host.getByRole('switch', { name: 'Mute Opened Streams' }).isVisible(), true);
  assert.equal(await host.locator('#tdh-pause-switch').isVisible(), true);
  assert.equal(await host.locator('#tdh-remember-content-warnings').isVisible(), false);
  await host.locator('#tdh-streams-body .exp-submenu-row').filter({ hasText: /^Playback$/ }).click();
  assert.equal(await host.locator('#tdh-remember-content-warnings').isVisible(), true);
});

test('the menu footer carries the full Dropper tagline', async t => {
  const { host } = await openMenu(t);
  const footer = host.locator('[data-exp-part="tagline"]');
  await footer.waitFor();
  assert.equal(await footer.textContent(), 'Twitch Drops: Track and Redeem');
});

// Badge Only decides where progress lives: off keeps the card beside the launcher even while the menu is open,
// on keeps it only at the top of the menu.
const cardFacts = host => host.evaluate(n => {
  const s = n.shadowRoot, card = s.getElementById('tdh-drop-card'), dock = s.querySelector('[data-exp-part="dock"],#tdh-tools-dock');
  const r = card.getBoundingClientRect(), d = dock.getBoundingClientRect(), dockShown = d.width > 0 && getComputedStyle(dock).display !== 'none';
  return { presentation: card.dataset.presentation, parent: card.parentElement.id || card.parentElement.className, visible: r.width > 0 && r.height > 0 && card.checkVisibility(),
    overlapsMenu: dockShown && r.left < d.right && r.right > d.left && r.top < d.bottom && r.bottom > d.top };
});

test('with Badge Only off the progress card stays beside the launcher while the menu is open', async t => {
  const { page, host } = await openMenu(t);
  await page.waitForTimeout(150);
  const open = await cardFacts(host);
  assert.equal(open.presentation, 'page-card', JSON.stringify(open));
  assert.equal(open.parent, 'badge-row', JSON.stringify(open));
  assert.equal(open.visible, true, JSON.stringify(open));
  assert.equal(open.overlapsMenu, false, JSON.stringify(open));
  await host.locator('#tdh-settings-launcher').click();
  assert.equal((await cardFacts(host)).presentation, 'page-card');
});

test('with Badge Only on the progress card shows only at the top of the menu', async t => {
  const { page, host } = await openMenu(t);
  await host.locator('[data-exp-section-tab="tdh-appearance-body"],[data-exp-section-tab="tdh-diagnostics-body"]').first().waitFor({ state: 'attached' });
  await host.evaluate(n => n.shadowRoot.getElementById('tdh-badge-only').click());
  await page.waitForTimeout(150);
  const open = await cardFacts(host);
  assert.equal(open.presentation, 'menu-card', JSON.stringify(open));
  assert.equal(open.parent, 'tdh-badge-only-progress-slot', JSON.stringify(open));
  assert.equal(open.visible, true, JSON.stringify(open));
  await host.locator('#tdh-settings-launcher').click();
  await page.waitForTimeout(150);
  const closed = await cardFacts(host);
  assert.equal(closed.presentation, 'menu-card', JSON.stringify(closed));
  assert.equal(closed.visible, false, JSON.stringify(closed));
});
