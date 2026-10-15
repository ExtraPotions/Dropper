'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { openProduct, openFlyout, hubBox } = require('./helpers/flyout.cjs');

// A Twitch channel page: the top bar (search and the right-hand icons) and the chat column's Stream Chat title bar.
const TWITCH = `<nav data-a-target="top-nav-container" style="position:fixed;top:0;left:0;right:0;height:50px;background:#18181b"><div class="top-nav__menu" style="display:flex;align-items:center;height:50px"><div style="width:371px;flex:none"></div><div style="flex:1;display:flex;justify-content:center"><input type="search" data-a-target="tw-input" style="width:356px;height:36px"><button style="width:36px;height:36px">S</button></div><div style="display:flex;gap:8px;padding:0 8px;flex:none"><button style="width:56px;height:30px">Log In</button><button style="width:68px;height:30px">Sign Up</button></div></div></nav>
<div class="stream-chat-header" style="position:fixed;left:1260px;top:50px;width:340px;height:40px;background:#18181b">Stream Chat</div>`;
const OTHER = fs.readFileSync(path.join(__dirname, '../vendor/exp-core/exp-core.js'), 'utf8');
const otherProduct = id => `(()=>{\n${OTHER}\nExtraPotionsCore.createProduct({id:'${id}',name:'${id}',version:'1.0.0',artwork:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="%2380d7d2"/></svg>',theme:{id:'${id}',name:'${id}',swatch:'#80d7d2',bg:'#101014',panel:'#18181d',line:'#34343b',text:'#efeff1',muted:'#adadb8',accent:'#80d7d2',accent2:'#80d7d2',skin:'#80d7d2',skinVertical:'#80d7d2'},sections:[]});\n})();`;

async function open(t, { others = ['shift'], body = TWITCH, drop = null, viewport = { width: 1600, height: 900 } } = {}) {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }]);
  const page = await context.newPage();
  if (drop) await page.addInitScript(value => sessionStorage.setItem('tdh-drop:account:signed-out', value), JSON.stringify(drop));
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: `<body style="margin:0;background:#0e0e10;color:#ccc">${body}</body>` }) : r.abort());
  await page.goto('https://www.twitch.tv/sample_streamer');
  await page.evaluate(() => { window.GM_xmlhttpRequest = () => ({ abort() {} }); });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  for (const id of others) await page.addScriptTag({ content: otherProduct(id) });
  const host = page.locator('#tdh-root'); await host.waitFor({ state: 'attached' });
  await page.waitForTimeout(600);
  return { page, host };
}
const strip = host => host.evaluate(n => {
  const s = n.shadowRoot, card = s.getElementById('tdh-drop-card'), r = card.getBoundingClientRect();
  const shown = id => { const e = s.getElementById(id); return Boolean(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); };
  return { presentation: card.dataset.presentation, anchor: card.dataset.stripAnchor || '', box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    channel: shown('tdh-stream-channel'), percent: shown('tdh-drop-percent'), meta: shown('tdh-drop-meta'), name: shown('tdh-drop-name'), status: shown('tdh-drop-state'),
    art: shown('tdh-strip-art'), stripMeta: shown('tdh-strip-meta'), skip: shown('tdh-skip-streamer'),
    radius: getComputedStyle(card).borderRadius, bg: getComputedStyle(card).backgroundColor };
});

test('with another product on Twitch, Dropper leads the top-bar launcher and progress becomes a strip over the chat title', async t => {
  const { page, host } = await open(t);
  const hub = await hubBox(page);
  assert.ok(hub, 'a shared launcher');
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('#tdh-root').shadowRoot.querySelector('[data-exp-part="flyout-hub"]'))), true, 'Dropper leads on Twitch');
  assert.ok(hub.y < 50, 'in the top bar');
  const s = await strip(host);
  assert.equal(s.presentation, 'strip'); assert.equal(s.anchor, 'chat');
  assert.deepEqual(s.box, [1268, 50, 324, 52], 'covers the Stream Chat title bar from its top edge, 52px tall');
  assert.deepEqual({ art: s.art, name: s.name, percent: s.percent, stripMeta: s.stripMeta, skip: s.skip, channel: s.channel, meta: s.meta, status: s.status },
    { art: true, name: true, percent: true, stripMeta: true, skip: true, channel: false, meta: false, status: false }, 'artwork, reward, percent, channel line, bar and Skip');
  assert.equal(s.radius, '8px'); assert.equal(s.bg, 'rgb(9, 9, 11)');
  assert.equal(await host.evaluate(n => getComputedStyle(n.shadowRoot.getElementById('tdh-settings-launcher')).visibility), 'hidden', 'Dropper\'s own launcher waits in the flyout');
});

test('clicking the strip opens the full progress card in place', async t => {
  const { page, host } = await open(t);
  const before = await strip(host);
  await page.mouse.click(before.box[0] + 100, before.box[1] + 16);
  await page.waitForTimeout(150);
  const after = await strip(host);
  assert.ok(after.box[3] > 52, JSON.stringify(after.box)); assert.equal(after.name, true); assert.equal(after.box[1], 50);
  await page.mouse.click(400, 500); await page.waitForTimeout(150);
  assert.equal((await strip(host)).box[3], 52, 'an outside click folds it back');
});

test('Dropper opens from its flyout tile below the top bar', async t => {
  const { page, host } = await open(t);
  await openProduct(page, 'dropper');
  const facts = await host.evaluate(n => { const d = n.shadowRoot.getElementById('tdh-tools-dock').getBoundingClientRect(), l = n.shadowRoot.getElementById('tdh-settings-launcher').getBoundingClientRect(); return { dock: [Math.round(d.top), Math.round(1600 - d.right)], launcher: [Math.round(l.width), Math.round(l.height)], open: !n.shadowRoot.getElementById('tdh-tools-dock').hidden && d.width > 0 }; });
  assert.equal(facts.open, true); assert.deepEqual(facts.launcher, [40, 40]);
  assert.equal(facts.dock[1], 8, 'right-aligned 8px from the window edge');
  assert.ok(facts.dock[0] >= 50 + 56 + 8, 'below the top-bar launcher and its flyout');
});

test('with Badge Only on there is no strip; progress stays at the top of the menu', async t => {
  const { page, host } = await open(t);
  await openProduct(page, 'dropper');
  await host.evaluate(n => n.shadowRoot.getElementById('tdh-badge-only').click());
  await page.waitForTimeout(150);
  assert.equal((await strip(host)).presentation, 'menu-card');
});

test('Dropper alone on Twitch puts its own launcher in the top bar and keeps the strip', async t => {
  const { host } = await open(t, { others: [] });
  const launcher = await host.evaluate(n => { const r = n.shadowRoot.getElementById('tdh-settings-launcher').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.top)]; });
  assert.deepEqual(launcher, [40, 5]);
  assert.equal((await strip(host)).presentation, 'strip');
});

test('away from a chat title the strip lines up with the launcher', async t => {
  const { host } = await open(t, { body: TWITCH.replace(/<div class="stream-chat-header"[^]*?<\/div>/, '') });
  const s = await strip(host);
  assert.equal(s.anchor, 'launcher'); assert.equal(1600 - (s.box[0] + s.box[2]), 8);
  assert.ok(s.box[1] >= 45 + 8, 'below the top-bar launcher');
});

test('the open flyout steps the strip aside so every tile is reachable', async t => {
  const { page, host } = await open(t);
  await openFlyout(page);
  const tiles = await page.evaluate(() => [...document.querySelectorAll('[data-exp-product-launcher="1"]')].map(h => {
    const l = h.shadowRoot.querySelector('#tdh-settings-launcher,[data-exp-part="launcher"]'), r = l.getBoundingClientRect();
    return { id: h.dataset.productId, hit: h.shadowRoot.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === l };
  }));
  assert.deepEqual(tiles, [{ id: 'dropper', hit: true }, { id: 'shift', hit: true }]);
  assert.equal(await host.evaluate(n => getComputedStyle(n.shadowRoot.getElementById('tdh-drop-card')).visibility), 'hidden');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  assert.equal(await host.evaluate(n => getComputedStyle(n.shadowRoot.getElementById('tdh-drop-card')).visibility), 'visible', 'back once the flyout closes');
});

test('with Dropper\'s menu open, the other tiles stay reachable and open their own menu', async t => {
  const { page, host } = await open(t, { body: '<main>Directory</main>' });
  await page.setViewportSize({ width: 1280, height: 1000 }); await page.waitForTimeout(300);
  await openProduct(page, 'dropper');
  const state = await page.evaluate(() => {
    const shift = document.querySelector('[data-product-id="shift"]'), tile = shift.shadowRoot.querySelector('[data-exp-part="launcher"]').getBoundingClientRect();
    const dock = document.querySelector('#tdh-root').shadowRoot.getElementById('tdh-tools-dock').getBoundingClientRect();
    const box = r => [r.left, r.top, r.right, r.bottom].map(Math.round);
    return { hit: document.elementFromPoint(tile.left + tile.width / 2, tile.top + tile.height / 2)?.dataset?.productId || '', tile: box(tile), dock: box(dock) };
  });
  assert.equal(state.hit, 'shift', JSON.stringify(state));
  await openProduct(page, 'shift');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.expOpenMenu), 'shift');
  assert.equal(await host.evaluate(n => n.shadowRoot.getElementById('tdh-tools-dock').hidden || getComputedStyle(n.shadowRoot.getElementById('tdh-tools-dock')).display === 'none'), true, 'Dropper\'s menu closes');
});

test('Dropper\'s update card waits its turn behind another product\'s card', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addCookies([{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    const release = { tag_name: 'v99.0.0', name: 'v99.0.0', body: '## 99.0.0 — 2026-10-12\n\n- First.', assets: [] };
    window.GM_xmlhttpRequest = o => { if (String(o.url).includes('api.github.com')) setTimeout(() => o.onload?.({ status: 200, responseText: JSON.stringify(release) }), 300); return { abort() {} }; };
  });
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: `<body style="margin:0">${TWITCH}</body>` }) : r.abort());
  await page.goto('https://www.twitch.tv/sample_streamer');
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  await page.addScriptTag({ content: otherProduct('shift') });
  // SHIFT's card is showing: it holds the turn.
  await page.evaluate(() => { document.documentElement.dataset.expNoticeOwner = 'shift:1'; });
  await page.waitForTimeout(1500);
  const card = () => page.evaluate(() => { const n = document.querySelector('#tdh-root').shadowRoot.getElementById('tdh-update-notice'); return { shown: !n.hidden, owner: document.documentElement.dataset.expNoticeOwner || '' }; });
  assert.deepEqual(await card(), { shown: false, owner: 'shift:1' }, 'Dropper waits');
  await page.evaluate(() => { delete document.documentElement.dataset.expNoticeOwner; document.dispatchEvent(new Event('exp-core:notice-released')); });
  await page.waitForTimeout(200);
  assert.deepEqual(await card(), { shown: true, owner: 'dropper:update' }, 'then shows and holds the turn');
  await page.evaluate(() => document.querySelector('#tdh-root').shadowRoot.querySelector('#tdh-update-notice .update-dismiss, #tdh-update-notice [aria-label*="Dismiss"]').click());
  await page.waitForTimeout(100);
  assert.deepEqual(await card(), { shown: false, owner: '' }, 'and gives it back when dismissed');
});

test('Dropper\'s update card opens below the strip, not over it', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addCookies([{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    const release = { tag_name: 'v99.0.0', name: 'v99.0.0', body: '## 99.0.0 — 2026-10-12\n\n- First.', assets: [] };
    window.GM_xmlhttpRequest = o => { if (String(o.url).includes('api.github.com')) setTimeout(() => o.onload?.({ status: 200, responseText: JSON.stringify(release) }), 300); return { abort() {} }; };
  });
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: `<body style="margin:0">${TWITCH}</body>` }) : r.abort());
  await page.goto('https://www.twitch.tv/sample_streamer');
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  await page.addScriptTag({ content: otherProduct('shift') });
  await page.waitForTimeout(1500);
  const facts = await page.evaluate(() => { const s = document.querySelector('#tdh-root').shadowRoot, n = s.getElementById('tdh-update-notice'), c = s.getElementById('tdh-drop-card'); return { shown: !n.hidden, presentation: c.dataset.presentation, card: n.getBoundingClientRect().top, strip: c.getBoundingClientRect().bottom }; });
  assert.equal(facts.shown, true); assert.equal(facts.presentation, 'strip');
  assert.equal(Math.round(facts.card - facts.strip), 8, 'the card starts 8px below the strip');
});

test('away from a chat title, Dropper\'s update card still opens below the strip', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addCookies([{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    const release = { tag_name: 'v99.0.0', name: 'v99.0.0', body: '## 99.0.0 — 2026-10-12\n\n- First.', assets: [] };
    window.GM_xmlhttpRequest = o => { if (String(o.url).includes('api.github.com')) setTimeout(() => o.onload?.({ status: 200, responseText: JSON.stringify(release) }), 300); return { abort() {} }; };
  });
  const body = TWITCH.replace(/<div class="stream-chat-header"[^]*?<\/div>/, '');
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: `<body style="margin:0">${body}</body>` }) : r.abort());
  await page.goto('https://www.twitch.tv/sample_streamer');
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  await page.addScriptTag({ content: otherProduct('shift') });
  await page.waitForTimeout(1500);
  const facts = await page.evaluate(() => { const s = document.querySelector('#tdh-root').shadowRoot, n = s.getElementById('tdh-update-notice'), c = s.getElementById('tdh-drop-card'); const a = n.getBoundingClientRect(), b = c.getBoundingClientRect(); return { shown: !n.hidden, presentation: c.dataset.presentation, anchor: c.dataset.stripAnchor || '', card: [a.left, a.top, a.right, a.bottom].map(Math.round), strip: [b.left, b.top, b.right, b.bottom].map(Math.round) }; });
  assert.equal(facts.shown, true); assert.equal(facts.presentation, 'strip'); assert.equal(facts.anchor, 'launcher');
  assert.equal(facts.card[1] - facts.strip[3], 8, `the card starts 8px below the strip: ${JSON.stringify(facts)}`);
});

test('the strip opens from its own button, so Skip is not nested inside another control', async t => {
  const { page, host } = await open(t);
  const facts = () => host.evaluate(n => { const s = n.shadowRoot, c = s.getElementById('tdh-drop-card'), b = s.getElementById('tdh-strip-toggle'); return { cardRole: c.getAttribute('role'), tag: b?.tagName || '', shown: Boolean(b && b.getClientRects().length), expanded: b?.getAttribute('aria-expanded') ?? null, open: c.classList.contains('is-expanded'), skipInside: Boolean(b?.contains(s.getElementById('tdh-skip-streamer'))) }; });
  assert.deepEqual(await facts(), { cardRole: null, tag: 'BUTTON', shown: true, expanded: 'false', open: false, skipInside: false });
  await host.evaluate(n => n.shadowRoot.getElementById('tdh-strip-toggle').focus());
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  assert.deepEqual(await facts(), { cardRole: null, tag: 'BUTTON', shown: true, expanded: 'true', open: true, skipInside: false });
  assert.equal(await host.evaluate(n => { const s = getComputedStyle(n.shadowRoot.getElementById('tdh-strip-toggle')); return s.outlineStyle + ' ' + s.outlineColor + ' ' + s.outlineOffset; }), 'solid rgb(188, 148, 245) -2px', 'a visible focus ring inside the strip');
  await page.keyboard.press(' '); await page.waitForTimeout(100);
  assert.equal((await facts()).open, false, 'Space folds it again');
  await openProduct(page, 'dropper');
  await host.evaluate(n => n.shadowRoot.getElementById('tdh-badge-only').click()); await page.waitForTimeout(150);
  const menu = await facts();
  assert.deepEqual([menu.cardRole, menu.shown, menu.open], [null, false, false], 'in the menu it is a plain card again');
});

const ART = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#e0b040"/></svg>');
const DROP = { id: 'drop-1', name: 'Golden Pickaxe', campaignId: 'camp-1', game: 'Sample Game', currentMinutes: 22, requiredMinutes: 60, percent: 37, rewardImage: ART };

test('the strip shows the reward artwork, the reward, and the minutes still to watch', async t => {
  const { host } = await open(t, { drop: DROP });
  const facts = await host.evaluate(n => { const s = n.shadowRoot, img = s.querySelector('#tdh-strip-art img'), icon = s.querySelector('#tdh-strip-art svg');
    const r = s.getElementById('tdh-strip-art').getBoundingClientRect(), k = s.getElementById('tdh-skip-streamer').getBoundingClientRect();
    return { src: img?.getAttribute('src') || '', alt: img?.getAttribute('alt'), img: Boolean(img && img.getClientRects().length && !img.hidden), icon: Boolean(icon && icon.getClientRects().length), name: s.getElementById('tdh-drop-name').textContent, percent: s.getElementById('tdh-drop-percent').textContent, meta: s.getElementById('tdh-strip-meta').textContent, art: [Math.round(r.width), Math.round(r.height)], skip: Math.round(k.height) }; });
  assert.equal(facts.src.startsWith('data:image/svg+xml'), true, JSON.stringify(facts)); assert.equal(facts.alt, ''); assert.equal(facts.img, true); assert.equal(facts.icon, false);
  assert.equal(facts.name, 'Golden Pickaxe'); assert.equal(facts.percent, '37%');
  assert.match(facts.meta, /^sample_streamer· 38m$/, 'channel, then minutes still to watch (spaced by layout)');
  assert.deepEqual(facts.art, [36, 36]); assert.equal(facts.skip, 36, 'Skip matches the artwork height');
});

test('without reward artwork the strip shows the gift icon and no minutes', async t => {
  const { host } = await open(t, { drop: { ...DROP, rewardImage: '', currentMinutes: null, percent: null } });
  const facts = await host.evaluate(n => { const s = n.shadowRoot, img = s.querySelector('#tdh-strip-art img'), icon = s.querySelector('#tdh-strip-art svg');
    return { img: Boolean(img && !img.hidden && img.getClientRects().length), icon: Boolean(icon && icon.getClientRects().length), meta: s.getElementById('tdh-strip-meta').textContent }; });
  assert.deepEqual([facts.img, facts.icon], [false, true]);
  assert.doesNotMatch(facts.meta, /·/, 'just the channel');
});

for (const [label, viewport, body] of [['', undefined, TWITCH], [' at a 360px window', { width: 360, height: 640 }, TWITCH.replace('left:1260px', 'left:10px')]])
test('long names and an armed Skip still fit the strip' + label, async t => {
  const { host } = await open(t, { viewport, body, drop: { ...DROP, name: 'Legendary Golden Pickaxe Of The Endless Mountain Expedition' } });
  const facts = await host.evaluate(n => { const s = n.shadowRoot, c = s.getElementById('tdh-drop-card'), b = s.getElementById('tdh-skip-streamer'), cd = b.querySelector('.skip-countdown');
    b.classList.add('is-armed'); cd.hidden = false; cd.textContent = '3';
    s.querySelector('#tdh-strip-meta .strip-channel').textContent = 'an_extremely_long_channel_name_for_testing';
    const box = c.getBoundingClientRect(), k = b.getBoundingClientRect(), bar = s.querySelector('#tdh-drop-card .drop-bar').getBoundingClientRect();
    const hit = s.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2), meta = s.getElementById('tdh-strip-meta').getBoundingClientRect(), left = s.querySelector('#tdh-strip-meta .strip-left').getBoundingClientRect();
    return { overflow: c.scrollWidth - c.clientWidth, inside: k.left >= box.left && k.right <= box.right && k.top >= box.top && k.bottom <= box.bottom, bar: Math.round(bar.width), height: Math.round(box.height), hit: Boolean(hit && b.contains(hit)), minutes: left.width > 0 && left.right <= meta.right + 0.5 && (bar.width === 0 || left.right <= bar.left - 4), text: s.querySelector('#tdh-strip-meta .strip-left').textContent }; });
  assert.ok(facts.overflow <= 0, JSON.stringify(facts)); assert.equal(facts.inside, true, JSON.stringify(facts));
  if (viewport) assert.equal(facts.bar, 0, 'at 280px the bar steps aside while Skip counts down');
  else assert.ok(facts.bar >= 40, JSON.stringify(facts));
  assert.equal(facts.height, 52);
  assert.equal(facts.hit, true, 'Skip takes its own clicks, above the strip button');
  assert.equal(facts.minutes, true, 'the channel shortens first; the minutes stay whole: ' + JSON.stringify(facts));
  assert.equal(facts.text, '· 38m', 'the separator is spaced by layout, not a collapsible leading space');
});

test('a live stream in another category puts that reason on the strip by itself', async t => {
  const live = '<div id="live-channel-stream-information"><h1 class="tw-title">sample_streamer</h1><span class="tw-channel-status-text-indicator">LIVE</span><a data-a-target="stream-game-link" href="/directory/category/just-chatting">Just Chatting</a></div>';
  const { page, host } = await open(t, { drop: DROP, body: TWITCH + live });
  await page.waitForFunction(() => document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card')?.hasAttribute('data-strip-pause'), null, { timeout: 15000 });
  const facts = await host.evaluate(n => { const s = n.shadowRoot; return { tone: s.getElementById('tdh-drop-card').dataset.stripPause, text: s.querySelector('#tdh-strip-meta .strip-channel').textContent, left: s.querySelector('#tdh-strip-meta .strip-left').textContent }; });
  assert.deepEqual(facts, { tone: 'warn', text: 'Wrong category · Just Chatting', left: '' });
});

test('a paused strip shows the reason where the bar was, in its warning colour', async t => {
  const { host } = await open(t, { drop: DROP });
  const facts = await host.evaluate(n => { const s = n.shadowRoot, c = s.getElementById('tdh-drop-card');
    c.setAttribute('data-strip-pause', 'bad'); s.querySelector('#tdh-strip-meta .strip-channel').textContent = 'Stalled · no credit for 14m'; s.querySelector('#tdh-strip-meta .strip-left').textContent = '';
    const meta = s.getElementById('tdh-strip-meta'), bar = s.querySelector('#tdh-drop-card .drop-bar'), skip = s.getElementById('tdh-skip-streamer').getBoundingClientRect(), name = s.getElementById('tdh-drop-name').getBoundingClientRect(), pct = s.getElementById('tdh-drop-percent');
    const m = meta.getBoundingClientRect();
    return { bar: bar.getClientRects().length, color: getComputedStyle(meta).color, fits: m.right <= skip.left && meta.scrollWidth <= meta.clientWidth + 1, wide: m.width > name.width - 2, percent: pct.getClientRects().length > 0 }; });
  assert.deepEqual(facts, { bar: 0, color: 'rgb(255, 158, 166)', fits: true, wide: true, percent: true });
});
