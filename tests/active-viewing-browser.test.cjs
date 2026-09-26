'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { loadDropperSource } = require('./load-source.cjs');
const source = loadDropperSource();
const exposed = source.replace('  startDropper();\n})();', `
  window.__dropperTest = {
    intent: viewingIntent, sync: syncViewingContext, ensure: ensureStreamPlaying,
    install: installViewingIntent, claim: claimDropViaGql, scan: scanClaimGroups,
    history: () => claimLedger().snapshot(), reconcile: reconcileClaimHistory,
    navigation: viewingNavigationAllowed, refresh: refreshOpenCampaignList,
    setGql: fn => { gql = fn; },
    configure: (drop, campaigns) => { currentDrop = drop; lastInventoryCampaigns = campaigns; lastCampaignCatalog = campaigns; },
    ignore: setCampaignGameIgnored, priority: campaignPriority, pickNext: pickNextOpenCampaignDrop,
    setWidth: mode => { settings.collapsedPanelWidth = mode; applyAppearanceSettings(); },
    setActiveClaims: value => { settings.claimBonus = value; settings.claimDrops = value; syncClaimWatchers(); },
    status: () => ({ viewing: viewingIntent.snapshot(), selectors: claimHealth }),
    pauseIntent: () => { viewingIntent.pause(true); },
  };
  startDropper();
})();`);
assert.notEqual(exposed, source, 'test-only hooks inserted without changing distribution');

async function fixture(run) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([
      { name: 'login', value: 'fixture-alice', domain: '.twitch.tv', path: '/' },
      { name: 'auth-token', value: 'fixture-token', domain: '.twitch.tv', path: '/' },
    ]);
    await context.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html><head><title>Dropper fixture</title></head><body>
      <video id="fixture-video"></video>
      <button id="fixture-control" data-a-target="player-play-pause-button">Pause</button>
    </body></html>` }));
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.GM_xmlhttpRequest = ({ onload }) => queueMicrotask(() => onload?.({ status: 503, responseText: '{}' }));
      window.__makeVideo = node => {
        let paused = false;
        node.playCount = 0; node.pauseCount = 0;
        Object.defineProperty(node, 'paused', { configurable: true, get: () => paused });
        Object.defineProperty(node, 'readyState', { configurable: true, get: () => 4 });
        node.play = () => { node.playCount++; paused = false; node.dispatchEvent(new Event('playing')); return Promise.resolve(); };
        node.pause = () => { node.pauseCount++; if (!paused) { paused = true; node.dispatchEvent(new Event('pause')); } };
        return node;
      };
      document.addEventListener('DOMContentLoaded', () => {
        window.__makeVideo(document.querySelector('video'));
        document.querySelector('#fixture-control').addEventListener('click', () => {
          const video = document.querySelector('video');
          if (video.paused) video.play(); else video.pause();
        });
      });
    });
    await page.goto('https://www.twitch.tv/chosen_channel');
    await page.addScriptTag({ content: exposed });
    await page.waitForFunction(() => !!window.__dropperTest && !!document.getElementById('tdh-root')?.shadowRoot);
    await page.evaluate(() => window.__dropperTest.setGql(async () => []));
    await run(page, context);
    assert.deepEqual(errors, [], 'full userscript has no uncaught browser errors');
  } finally { await browser.close(); }
}
function data() {
  const start = new Date(Date.now() - 86400000).toISOString();
  const end = new Date(Date.now() + 86400000).toISOString();
  return {
    drop: { id: 'reward-a', campaignId: 'campaign-a', campaignKey: 'campaign-a', dropInstanceID: 'instance-a', name: 'Fixture reward', game: 'Fixture game', requiredMinutes: 60, currentMinutes: 60, percent: 100 },
    campaigns: [{ id: 'campaign-a', name: 'Fixture campaign', status: 'ACTIVE', startAt: start, endAt: end, game: { name: 'Fixture game', displayName: 'Fixture game' }, timeBasedDrops: [{ id: 'reward-a', name: 'Fixture reward', requiredMinutesWatched: 60, self: { dropInstanceID: 'instance-a', currentMinutesWatched: 60, isClaimed: false } }] }],
  };
}

test('full userscript preserves deliberate pause, player replacement, and explicit resume without enabling routing', async () => fixture(async page => {
  await page.click('#fixture-control');
  let value = await page.evaluate(() => {
    const t = window.__dropperTest; t.sync();
    const before = document.querySelector('video').playCount;
    for (let i = 0; i < 30; i++) t.ensure();
    return { before, after: document.querySelector('video').playCount, state: t.status().viewing, navigation: t.navigation('stall-recovery') };
  });
  assert.equal(value.state.pauseReason, 'viewer'); assert.equal(value.state.paused, true);
  assert.equal(value.before, value.after); assert.equal(value.navigation, false);
  value = await page.evaluate(() => {
    const next = window.__makeVideo(document.createElement('video'));
    document.querySelector('video').replaceWith(next); window.__dropperTest.sync();
    return { paused: next.paused, state: window.__dropperTest.status().viewing };
  });
  assert.equal(value.paused, true); assert.equal(value.state.pauseReason, 'viewer');
  await page.click('#fixture-control');
  value = await page.evaluate(() => ({ paused: document.querySelector('video').paused, state: window.__dropperTest.status().viewing, navigation: window.__dropperTest.navigation('stall-recovery') }));
  assert.equal(value.paused, false); assert.equal(value.state.paused, false); assert.equal(value.navigation, false);
}));

test('screen/fullscreen/PiP observations do not grant navigation or install duplicate input listeners', async () => fixture(async page => {
  const result = await page.evaluate(() => {
    const t = window.__dropperTest; const first = t.status().viewing.generation;
    let added = 0; const original = document.addEventListener;
    document.addEventListener = function (...args) { added++; return original.apply(this, args); };
    t.install(); t.install(); document.addEventListener = original;
    for (const type of ['fullscreenchange', 'enterpictureinpicture', 'leavepictureinpicture']) document.dispatchEvent(new Event(type));
    return { added, before: first, after: t.status().viewing.generation, route: t.navigation('campaign-priority') };
  });
  assert.equal(result.added, 0); assert.equal(result.before, result.after); assert.equal(result.route, false);
}));

test('claim attempts are deduplicated and only an exact API confirmation settles them', async () => fixture(async page => {
  await page.evaluate(({ drop, campaigns }) => window.__dropperTest.configure(drop, campaigns), data());
  const result = await page.evaluate(async () => {
    const t = window.__dropperTest; let calls = 0; let resolve;
    t.setGql(() => { calls++; return new Promise(done => { resolve = done; }); });
    const first = t.claim({ id: 'reward-a', campaignId: 'campaign-a', campaignKey: 'campaign-a', dropInstanceID: 'instance-a', requiredMinutes: 60, currentMinutes: 60 });
    while (!resolve) await new Promise(done => setTimeout(done, 0));
    const pending = t.history()[0].outcome;
    await t.claim({ id: 'reward-a', campaignId: 'campaign-a', campaignKey: 'campaign-a', dropInstanceID: 'instance-a', requiredMinutes: 60, currentMinutes: 60 });
    resolve([{ data: { claimDropRewards: { status: 'ELIGIBLE_FOR_ALL' } } }]);
    await first;
    return { calls, pending, history: t.history() };
  });
  assert.equal(result.calls, 1); assert.equal(result.pending, 'pending');
  assert.equal(result.history.length, 1); assert.equal(result.history[0].outcome, 'confirmed');
}));

test('page claiming ignores purchases, keeps clicks pending, and uses scoped fullscreen exceptions only', async () => fixture(async page => {
  await page.evaluate(({ drop, campaigns }) => window.__dropperTest.configure(drop, campaigns), data());
  await page.evaluate(() => {
    const t = window.__dropperTest; t.setActiveClaims(false);
    document.body.insertAdjacentHTML('beforeend', `
      <button id="purchase" data-a-target="drops-claim-button">Claim subscription</button>
      <button id="redeem">Redeem Points</button>
      <button id="hidden-unsafe" aria-label="Claim Bonus" style="display:none">Claim Bonus</button>
      <div class="community-points-summary" id="bonus-container" style="display:none"><button id="bonus" aria-label="Claim Bonus"><span class="claimable-bonus__icon"></span></button></div>
      <button id="drop-claim" data-a-target="drops-claim-button">Claim Now</button>`);
    window.__clicks = {};
    for (const id of ['purchase', 'redeem', 'hidden-unsafe', 'bonus', 'drop-claim']) document.getElementById(id).addEventListener('click', () => window.__clicks[id] = (window.__clicks[id] || 0) + 1);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.querySelector('video') });
    t.setActiveClaims(true); t.scan(); t.scan();
  });
  await page.waitForTimeout(350);
  let value = await page.evaluate(() => ({ clicks: window.__clicks, history: window.__dropperTest.history() }));
  assert.equal(value.clicks.purchase, undefined); assert.equal(value.clicks.redeem, undefined); assert.equal(value.clicks['hidden-unsafe'], undefined);
  assert.equal(value.clicks.bonus, 1); assert.equal(value.clicks['drop-claim'], 1);
  assert.ok(value.history.every(record => record.outcome === 'pending'));
  await page.evaluate(({ campaigns }) => { campaigns[0].timeBasedDrops[0].self.isClaimed = true; window.__dropperTest.reconcile(campaigns); window.__dropperTest.reconcile(campaigns); }, data());
  value = await page.evaluate(() => window.__dropperTest.history());
  assert.equal(value.filter(record => record.outcome === 'confirmed').length, 1);
  assert.equal(value.find(record => record.kind === 'bonus').outcome, 'pending');
}));

test('an account change discards an in-flight response and cannot populate the new account history', async () => fixture(async page => {
  await page.evaluate(({ drop, campaigns }) => window.__dropperTest.configure(drop, campaigns), data());
  const result = await page.evaluate(async () => {
    const t = window.__dropperTest; let resolve;
    t.setGql(() => new Promise(done => { resolve = done; }));
    const pending = t.claim({ id: 'reward-a', campaignId: 'campaign-a', campaignKey: 'campaign-a', dropInstanceID: 'instance-a', requiredMinutes: 60, currentMinutes: 60 });
    while (!resolve) await new Promise(done => setTimeout(done, 0));
    document.cookie = 'login=fixture-bob; path=/; domain=.twitch.tv'; t.sync();
    resolve([{ data: { claimDropRewards: { status: 'ELIGIBLE_FOR_ALL' } } }]);
    const accepted = await pending; const bob = t.history();
    document.cookie = 'login=fixture-alice; path=/; domain=.twitch.tv'; t.sync();
    return { accepted, bob, alice: t.history() };
  });
  assert.equal(result.accepted, false); assert.deepEqual(result.bob, []);
  assert.equal(result.alice[0].outcome, 'discarded');
}));

test('campaign priority is account-scoped, does not navigate, and existing chrome retains all three widths', async () => fixture(async page => {
  const d = data(); d.campaigns[0].timeBasedDrops[0].self.currentMinutesWatched = 0;
  await page.evaluate(({ drop, campaigns }) => { window.__dropperTest.configure(drop, campaigns); window.__dropperTest.refresh(); window.dropperShow(); }, d);
  const widths = [];
  for (const [mode, expected] of [['full', 312], ['compact', 260], ['narrow', 220]]) {
    await page.evaluate(mode => { const t = window.__dropperTest; t.setWidth(mode); window.dropperShow(); const h = document.getElementById('tdh-root').shadowRoot.querySelector('[data-panel="tdh-drops-body"]'); const b = document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drops-body'); if (b.classList.contains('fl-tool-hidden')) h.click(); }, mode);
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const root = document.getElementById('tdh-root').shadowRoot;
      const dock = root.getElementById('tdh-tools-dock'); const rect = dock.getBoundingClientRect();
      const row = root.querySelector('.badge-row').getBoundingClientRect();
      return { width: rect.width, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, rowTop: row.top, rowBottom: row.bottom, overflow: dock.scrollWidth - dock.clientWidth };
    });
    widths.push(box.width); assert.ok(Math.abs(box.width - expected) <= 1, `${mode}: ${box.width}`);
    assert.ok(box.left >= 0 && box.right <= 1280); assert.ok(box.overflow <= 1, `${mode} content stays inside menu width`);
    assert.ok(box.top >= 8 && box.bottom <= 892, `${mode} menu stays inside the viewport`);
    assert.ok(box.bottom <= box.rowTop - 7 || box.top >= box.rowBottom + 7, `${mode} menu does not overlap the progress/launcher row: ${JSON.stringify(box)}`);
    fs.mkdirSync(path.join(__dirname, '../test-artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, `../test-artifacts/active-viewing-${mode}.png`) });
  }
  await page.evaluate(() => {
    const select = document.getElementById('tdh-root').shadowRoot.querySelector('[aria-label="Fixture game campaign priority"]');
    select.value = '1'; select.dispatchEvent(new Event('change'));
  });
  assert.equal(await page.evaluate(() => window.__dropperTest.priority('Fixture game')), 1);
  assert.ok(page.url().endsWith('/chosen_channel'));
  await page.evaluate(() => { document.cookie = 'login=fixture-bob; path=/; domain=.twitch.tv'; window.__dropperTest.sync(); });
  assert.equal(await page.evaluate(() => window.__dropperTest.priority('Fixture game')), 0);
}));


test('known-unfinishable campaign cannot win even with high personal priority', async () => fixture(async page => {
  const now = Date.now();
  const iso = ms => new Date(ms).toISOString();
  const campaigns = [
    {
      id: 'impossible', name: 'Impossible', status: 'ACTIVE',
      startAt: iso(now - 60000), endAt: iso(now + 20 * 60000),
      game: { name: 'Impossible Game', displayName: 'Impossible Game' },
      timeBasedDrops: [{ id: 'i', name: 'Impossible reward', requiredMinutesWatched: 60, self: { currentMinutesWatched: 0, isClaimed: false } }],
    },
    {
      id: 'viable', name: 'Viable', status: 'ACTIVE',
      startAt: iso(now - 60000), endAt: iso(now + 90 * 60000),
      game: { name: 'Viable Game', displayName: 'Viable Game' },
      timeBasedDrops: [{ id: 'v', name: 'Viable reward', requiredMinutesWatched: 30, self: { currentMinutesWatched: 10, isClaimed: false } }],
    },
  ];
  const result = await page.evaluate(campaigns => {
    const t = window.__dropperTest;
    t.configure(null, campaigns);
    t.refresh();
    const root = document.getElementById('tdh-root').shadowRoot;
    const select = root.querySelector('[aria-label="Impossible Game campaign priority"]');
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    const pick = t.pickNext(campaigns, [], []);
    return { game: pick?.game || '', priority: t.priority('Impossible Game'), url: location.pathname };
  }, campaigns);
  assert.equal(result.priority, 1);
  assert.equal(result.game, 'Viable Game');
  assert.equal(result.url, '/chosen_channel');
}));
