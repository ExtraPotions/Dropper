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
    queueScan: queueClaimScan, setPriority: setCampaignPriority, priorityEntry: campaignPriorityEntry,
    priorityRank: campaignPriorityRank, priorityOrder: readCampaignPriorityOrder, movePriority: moveCampaignPriority,
    rankCandidates: rankStreamCandidatesByEvidence,
    continueClaim: continueAfterConfirmedDropClaim, sweep: sweepClaimReadyInventory, current: () => currentDrop,
    status: () => ({ viewing: viewingIntent.snapshot(), selectors: claimHealth }),
    activityStatus: dropActivityStatus, claimSummary: claimHealthSummary,
    eligibilityCompact: eligibilityCompactPresentation,
    restoreMetadata: restoreCurrentDropMetadataFromKnownCampaigns,
    eligibilityState: activeRewardEligibility, refreshEligibility: refreshEligibilityControls, routingProof: persistedRoutingEligibilityProof,
    restoreVerification: restorePersistedRoutingVerification,
    setRouting: writeRoutingControllerSession,
    clearVerification: () => { lastStreamVerification = null; },
    verification: () => lastStreamVerification,
    setFindNext: value => { settings.findNextStream = Boolean(value); },
    setTestTheme: value => { settings.uiTheme=value;saveSettings();applyAppearanceSettings(); },
    pauseIntent: () => { viewingIntent.pause(true); },
    lockStream: value => setManualStreamLock(Boolean(value), 'test'),
    streamLock: () => manualStreamLockSnapshot(),
    refreshHealth: () => { refreshStreamHealthSummary(); refreshEligibilityChecklist(); refreshViewingControls(); },
    confidence: () => earningConfidencePresentation(),
    recoveryAction: () => recoveryActionState(),
    setStrategy: value => { settings.campaignStrategy = value; },
    strategy: () => normalizedCampaignStrategy(),
    rankCampaigns: items => rankCampaignCandidatesForStrategy(items, Date.now()),
    saveRecovery: () => saveRecoverySnapshot('test'),
    restoreRecovery: () => restoreRecoverySnapshot(),
    recoverySnapshot: () => loadRecoverySnapshot(),
    clearCurrentForRecovery: () => { currentDrop = null; removeSession('tdh-drop'); removeSession(ROUTING_SESSION_KEY); },
    recovered: () => lastSessionRecovery,
    applyOrder: reason => applyCampaignOrderNow(reason), routing: () => readRoutingControllerSession(),
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

test('Stay On This Stream visibly locks automatic routing and can be released', async () => fixture(async page => {
  const result = await page.evaluate(() => {
    const t = window.__dropperTest;
    t.setFindNext(true);
    t.intent.allowSwitching();
    const before = t.navigation('automatic-routing');
    t.lockStream(true);
    t.refreshHealth();
    const root = document.getElementById('tdh-root').shadowRoot;
    const button = root.getElementById('tdh-stream-lock');
    const locked = {
      allowed: t.navigation('automatic-routing'),
      pressed: button.getAttribute('aria-pressed'),
      label: button.textContent,
      lock: t.streamLock()?.login || '',
    };
    t.lockStream(false);
    const after = t.navigation('automatic-routing');
    return { before, locked, after };
  });
  assert.equal(result.before, true);
  assert.equal(result.locked.allowed, false);
  assert.equal(result.locked.pressed, 'true');
  assert.equal(result.locked.label, 'Release Stream Lock');
  assert.equal(result.locked.lock, 'chosen_channel');
  assert.equal(result.after, true);
}));

test('earning confidence and health surfaces use existing Twitch evidence without inventing status', async () => fixture(async page => {
  const d = data();
  d.drop.currentMinutes = 15; d.drop.percent = 25;
  d.campaigns[0].timeBasedDrops[0].self.currentMinutesWatched = 15;
  await page.evaluate(({ drop, campaigns }) => {
    const t = window.__dropperTest;
    t.configure(drop, campaigns);
    t.refreshHealth();
  }, d);
  const result = await page.evaluate(() => {
    const root = document.getElementById('tdh-root').shadowRoot;
    return {
      confidence: root.getElementById('tdh-earning-confidence-label')?.textContent || '',
      healthRows: root.querySelectorAll('#tdh-stream-health-list .status-check-row').length,
      eligibilityRows: root.querySelectorAll('#tdh-eligibility-checklist-list .status-check-row').length,
      recovery: window.__dropperTest.recoveryAction()?.label || '',
    };
  });
  assert.ok(['Waiting for Twitch','Not verified','Verified'].includes(result.confidence));
  assert.equal(result.healthRows, 6);
  assert.equal(result.eligibilityRows, 5);
  assert.ok(['Recheck Twitch','Find Another Stream'].includes(result.recovery));
}));

test('campaign strategy modes reorder viable campaigns without promoting known-unfinishable work', async () => fixture(async page => {
  const now = Date.now();
  const items = [
    { game: 'Priority', percent: 10, remainingMinutes: 50, endMs: now + 120 * 60000, sequenceFinishable: true },
    { game: 'Soon', percent: 20, remainingMinutes: 40, endMs: now + 45 * 60000, sequenceFinishable: true },
    { game: 'Almost', percent: 90, remainingMinutes: 10, endMs: now + 100 * 60000, sequenceFinishable: true },
    { game: 'Impossible', percent: 99, remainingMinutes: 60, endMs: now + 10 * 60000, sequenceFinishable: false },
  ];
  const result = await page.evaluate(items => {
    const t = window.__dropperTest;
    const first = {};
    for (const strategy of ['deadline','completion','shortest']) {
      t.setStrategy(strategy);
      first[strategy] = t.rankCampaigns(items)[0]?.game || '';
    }
    return first;
  }, items);
  assert.equal(result.deadline, 'Soon');
  assert.equal(result.completion, 'Almost');
  assert.equal(result.shortest, 'Almost');
}));

test('restart recovery restores a bounded target but requires Twitch verification again', async () => fixture(async page => {
  const d = data();
  d.drop.currentMinutes = 15; d.drop.percent = 25;
  await page.evaluate(({ drop, campaigns }) => {
    const t = window.__dropperTest;
    t.configure(drop, campaigns);
    t.saveRecovery();
    t.clearCurrentForRecovery();
    t.restoreRecovery();
    t.refreshHealth();
  }, d);
  const result = await page.evaluate(() => {
    const t = window.__dropperTest;
    const current = t.current();
    const restored = t.recovered();
    return {
      name: current?.name || '',
      game: current?.game || '',
      restored: Boolean(restored),
      sameStream: Boolean(restored?.sameStream),
      recoveryAction: t.recoveryAction()?.label || '',
      snapshot: Boolean(t.recoverySnapshot()),
    };
  });
  assert.equal(result.name, 'Fixture reward');
  assert.equal(result.game, 'Fixture game');
  assert.equal(result.restored, true);
  assert.equal(result.sameStream, true);
  assert.equal(result.snapshot, true);
  assert.ok(['Recheck Twitch','Find Another Stream'].includes(result.recoveryAction));
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
      <button id="redeem" data-a-target="drops-claim-button">Redeem Points</button>
      <button id="gift" data-a-target="drops-claim-button">Gift</button>
      <button id="disabled-drop" data-a-target="drops-claim-button" disabled>Claim Now</button>
      <button id="aria-disabled-drop" data-a-target="drops-claim-button" aria-disabled="true">Claim Now</button>
      <div inert><button id="inert-drop" data-a-target="drops-claim-button">Claim Now</button></div>
      <button id="pointer-drop" data-a-target="drops-claim-button" style="pointer-events:none">Claim Now</button>
      <button id="hidden-unsafe" aria-label="Claim Bonus" style="display:none">Claim Bonus</button>
      <div class="community-points-summary" id="bonus-container" style="display:none"><button id="bonus" aria-label="Claim Bonus"><span class="claimable-bonus__icon"></span></button></div>
      <button id="drop-claim" data-a-target="drops-claim-button">Claim Now</button>`);
    window.__clicks = {};
    for (const id of ['purchase', 'redeem', 'gift', 'disabled-drop', 'aria-disabled-drop', 'inert-drop', 'pointer-drop', 'hidden-unsafe', 'bonus', 'drop-claim']) document.getElementById(id).addEventListener('click', () => window.__clicks[id] = (window.__clicks[id] || 0) + 1);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.querySelector('video') });
    t.setActiveClaims(true); t.scan(); t.scan();
  });
  await page.waitForTimeout(350);
  let value = await page.evaluate(() => ({ clicks: window.__clicks, history: window.__dropperTest.history() }));
  assert.equal(value.clicks.purchase, undefined);
  assert.equal(value.clicks.redeem, undefined);
  assert.equal(value.clicks.gift, undefined);
  assert.equal(value.clicks['disabled-drop'], undefined);
  assert.equal(value.clicks['aria-disabled-drop'], undefined);
  assert.equal(value.clicks['inert-drop'], undefined);
  assert.equal(value.clicks['pointer-drop'], undefined);
  assert.equal(value.clicks['hidden-unsafe'], undefined);
  assert.equal(value.clicks.bonus, 1);
  assert.equal(value.clicks['drop-claim'], 1);
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

test('ranked game priority is account-scoped, does not navigate, and existing chrome retains all three widths', async () => fixture(async page => {
  const d = data(); d.campaigns[0].timeBasedDrops[0].self.currentMinutesWatched = 0;
  d.campaigns.push({
    id: 'campaign-b', name: 'Second campaign', status: 'ACTIVE',
    startAt: d.campaigns[0].startAt, endAt: d.campaigns[0].endAt,
    game: { name: 'Second game', displayName: 'Second game' },
    timeBasedDrops: [{ id: 'reward-b', name: 'Second reward', requiredMinutesWatched: 30, self: { currentMinutesWatched: 0, isClaimed: false } }],
  });
  await page.evaluate(({ drop, campaigns }) => { window.__dropperTest.configure(drop, campaigns); window.__dropperTest.refresh(); window.dropperShow(); }, d);
  const widths = [];
  for (const [mode, expected] of [['compact', 260]]) {
    await page.evaluate(mode => { const t = window.__dropperTest; t.setWidth(mode); window.dropperShow(); const h = document.getElementById('tdh-root').shadowRoot.querySelector('[data-panel="tdh-drops-body"]'); const b = document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drops-body'); if (b.classList.contains('fl-tool-hidden')) h.click(); }, mode);
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const root = document.getElementById('tdh-root').shadowRoot;
      const dock = root.getElementById('tdh-tools-dock'); const rect = dock.getBoundingClientRect();
      const row = root.querySelector('.badge-row').getBoundingClientRect();
      const cluster = root.querySelector('.cluster');
      const dockStyle = getComputedStyle(dock);
      const clusterStyle = getComputedStyle(cluster);
      const hostStyle = getComputedStyle(document.getElementById('tdh-root'));
      return {
        width: rect.width, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        rowTop: row.top, rowBottom: row.bottom, rowLeft: row.left, rowRight: row.right, overflow: dock.scrollWidth - dock.clientWidth,
        cssWidth: dockStyle.width, boxSizing: dockStyle.boxSizing, dockTransform: dockStyle.transform,
        clusterTransform: clusterStyle.transform, clusterWidth: clusterStyle.width,
        hostTransform: hostStyle.transform, dropperWidth: clusterStyle.getPropertyValue('--dropper-width').trim()
      };
    });
    widths.push(box.width); assert.ok(Math.abs(box.width - expected) <= 1, `${mode}: ${JSON.stringify(box)}`);
    assert.ok(box.left >= 0 && box.right <= 1280); assert.ok(box.overflow <= 1, `${mode} content stays inside menu width`);
    assert.ok(box.top >= 8 && box.bottom <= 892, `${mode} menu stays inside the viewport`);
    // The menu may sit beside the row (exp-core places it left of the launcher grid) or above/below it, never on it.
    const clear = box.bottom <= box.rowTop - 7 || box.top >= box.rowBottom + 7 || box.right <= box.rowLeft - 7;
    assert.ok(clear, `${mode} menu does not overlap the progress/launcher row: ${JSON.stringify(box)}`);
    fs.mkdirSync(path.join(__dirname, '../test-artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, `../test-artifacts/active-viewing-${mode}.png`) });
  }
  const ranked = await page.evaluate(() => {
    const root = document.getElementById('tdh-root').shadowRoot;
    const up = root.querySelector('[aria-label="Move Second game higher in game priority"]');
    up.click();
    const t = window.__dropperTest;
    return { rank: t.priorityRank('Second game').rank, order: t.priorityOrder(), path: location.pathname };
  });
  assert.equal(ranked.rank, 1);
  assert.equal(ranked.order[0], 'second game');
  assert.equal(ranked.path, '/chosen_channel');
  await page.evaluate(() => { document.cookie = 'login=fixture-bob; path=/; domain=.twitch.tv'; window.__dropperTest.sync(); });
  assert.equal(await page.evaluate(() => window.__dropperTest.priorityRank('Second game').rank), null);
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
    const pick = t.pickNext(campaigns, [], []);
    return { game: pick?.game || '', rank: t.priorityRank('Impossible Game').rank, url: location.pathname };
  }, campaigns);
  assert.equal(result.rank, 1);
  assert.equal(result.game, 'Viable Game');
  assert.equal(result.url, '/chosen_channel');
}));


test('bonus control dismissal confirms the page claim after Twitch removes the claimed control', async () => fixture(async page => {
  await page.evaluate(() => {
    const t = window.__dropperTest;
    t.setActiveClaims(false);
    const container = document.createElement('div');
    container.className = 'community-points-summary';
    const button = document.createElement('button');
    button.id = 'bonus-dismiss';
    button.setAttribute('aria-label', 'Claim Bonus');
    const icon = document.createElement('span');
    icon.className = 'claimable-bonus__icon';
    button.append(icon);
    container.append(button);
    document.body.append(container);
    button.addEventListener('click', () => setTimeout(() => button.remove(), 50), { once: true });
    t.setActiveClaims(true);
    t.scan();
  });
  await page.waitForTimeout(3400);
  const bonus = await page.evaluate(() => window.__dropperTest.history().find(record => record.kind === 'bonus'));
  assert.equal(bonus?.outcome, 'confirmed');
  assert.equal(bonus?.evidence, 'control-dismissed');
}));

test('mutation storms coalesce into the minimum claim scan interval', async () => fixture(async page => {
  const before = await page.evaluate(() => {
    const t = window.__dropperTest;
    t.setActiveClaims(true);
    t.scan();
    return t.status().selectors.bonus?.checks || 0;
  });
  await page.evaluate(() => {
    const t = window.__dropperTest;
    for (let i = 0; i < 50; i++) t.queueScan('mutation');
  });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__dropperTest.status().selectors.bonus?.checks || 0);
  assert.equal(after, before, 'no additional scan occurs before the five-second floor');
}));

test('campaign priority diagnostics distinguish saved preferences from the default', async () => fixture(async page => {
  const result = await page.evaluate(() => {
    const t = window.__dropperTest;
    t.setPriority('Fixture Game', 1);
    const saved = t.priorityEntry('Fixture Game');
    t.setPriority('Fixture Game', 0);
    const normal = t.priorityEntry('Fixture Game');
    return { saved: { value: saved.value, explicit: saved.explicit }, normal: { value: normal.value, explicit: normal.explicit } };
  });
  assert.deepEqual(result.saved, { value: 1, explicit: true });
  assert.deepEqual(result.normal, { value: 0, explicit: false });
}));


test('stream evidence ranking keeps live campaign ACL ahead of generic Drops candidates', async () => fixture(async page => {
  const ranked = await page.evaluate(() => window.__dropperTest.rankCandidates([
    { login: 'probationary', availability: 'live', visibleInCategory: true, viewers: 1 },
    { login: 'tagged', availability: 'live', visibleInCategory: true, dropsTagged: true, viewers: 1000 },
    { login: 'allowed', availability: 'live', visibleInCategory: true, allowListMatch: true, viewers: 5000 },
    { login: 'cached-allowed', availability: 'cached', freshCached: true, allowListMatch: true, viewers: 1 },
  ]).map(item => ({ login: item.login, rank: item.evidenceRank, label: item.evidenceLabel })));
  assert.deepEqual(ranked.map(item => item.login), ['allowed', 'tagged', 'probationary', 'cached-allowed']);
  assert.equal(ranked[0].label, 'live-campaign-allowed');
  assert.equal(ranked[1].label, 'live-drops-tagged');
  assert.equal(ranked[2].label, 'live-same-game');
  assert.equal(ranked[3].label, 'fresh-cache-allowed');
}));

test('viewer-count preference only breaks ties within the same evidence tier', async () => fixture(async page => {
  const order = await page.evaluate(() => {
    const t = window.__dropperTest;
    const root = document.getElementById('tdh-root').shadowRoot;
    const select = root.querySelector('#tdh-queue-preference');
    if (select) { select.value = 'Lowest Viewers'; select.dispatchEvent(new Event('change')); }
    return t.rankCandidates([
      { login: 'high-viewers-allowed', availability: 'live', visibleInCategory: true, allowListMatch: true, viewers: 9000 },
      { login: 'low-viewers-allowed', availability: 'live', visibleInCategory: true, allowListMatch: true, viewers: 10 },
      { login: 'low-viewers-tagged', availability: 'live', visibleInCategory: true, dropsTagged: true, viewers: 1 },
    ]).map(item => item.login);
  });
  assert.deepEqual(order, ['low-viewers-allowed', 'high-viewers-allowed', 'low-viewers-tagged']);
}));


test('confirmed claim unlocks the next claim-gated reward in the same campaign', async () => fixture(async page => {
  const now = Date.now();
  const campaign = {
    id: 'claim-gated-campaign',
    name: 'Claim Gated Campaign',
    status: 'ACTIVE',
    startAt: new Date(now - 60000).toISOString(),
    endAt: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
    game: { name: 'Fixture game', displayName: 'Fixture game', slug: 'fixture-game' },
    timeBasedDrops: [
      {
        id: 'first-reward',
        name: 'First Reward',
        requiredMinutesWatched: 30,
        self: { currentMinutesWatched: 30, isClaimed: false },
      },
      {
        id: 'second-reward',
        name: 'Second Reward',
        requiredMinutesWatched: 30,
        preconditionDrops: [{ id: 'first-reward', requiresClaim: true }],
        self: { currentMinutesWatched: 0, isClaimed: false },
      },
    ],
  };
  const result = await page.evaluate(campaign => {
    const t = window.__dropperTest;
    t.configure({
      id: 'first-reward', campaignId: campaign.id, campaignKey: campaign.id,
      name: 'First Reward', game: 'Fixture game', campaign: campaign.name,
      requiredMinutes: 30, currentMinutes: 30, remainingMinutes: 0, percent: 100,
    }, [campaign]);
    const continued = t.continueClaim({ kind: 'drop', rewardId: 'first-reward', campaignId: campaign.id });
    const current = t.current();
    return { continued, id: current?.id || '', campaignKey: current?.campaignKey || '', minutes: current?.currentMinutes };
  }, campaign);
  assert.equal(result.continued, true);
  assert.equal(result.id, 'second-reward');
  assert.equal(result.campaignKey, 'claim-gated-campaign');
  assert.equal(result.minutes, 0);
}));


test('inventory sweep claims completed rewards without leaving the active stream', async () => fixture(async page => {
  const now = Date.now();
  const current = {
    id: 'current-live', campaignId: 'current-campaign', campaignKey: 'current-campaign',
    dropInstanceID: 'instance-current', name: 'Current live reward', game: 'Current Game',
    requiredMinutes: 60, currentMinutes: 20, percent: 33,
  };
  const campaigns = [
    {
      id: 'current-campaign', name: 'Current Campaign', startAt: new Date(now - 60000).toISOString(), endAt: new Date(now + 4 * 3600000).toISOString(),
      game: { name: 'Current Game', displayName: 'Current Game' },
      timeBasedDrops: [{ id: 'current-live', name: 'Current live reward', requiredMinutesWatched: 60, self: { currentMinutesWatched: 20, isClaimed: false, dropInstanceID: 'instance-current' } }],
    },
    {
      id: 'older-ready', name: 'Older Ready', startAt: new Date(now - 60000).toISOString(), endAt: new Date(now + 3600000).toISOString(),
      game: { name: 'Other Game', displayName: 'Other Game' },
      timeBasedDrops: [
        { id: 'ready-a', name: 'Ready A', requiredMinutesWatched: 30, self: { currentMinutesWatched: 30, isClaimed: false, dropInstanceID: 'instance-a' } },
        { id: 'ready-b', name: 'Ready B', requiredMinutesWatched: 30, self: { currentMinutesWatched: 30, isClaimed: false, dropInstanceID: 'instance-b' } },
      ],
    },
  ];
  await page.evaluate(({ current, campaigns }) => {
    const t = window.__dropperTest;
    t.configure(current, campaigns);
    t.setActiveClaims(true);
    window.__sweepCalls = [];
    t.setGql(async requests => {
      window.__sweepCalls.push(requests[0]?.variables?.input?.dropInstanceID || '');
      return requests.map(() => ({ data: { claimDropRewards: { status: 'ELIGIBLE_FOR_ALL' } } }));
    });
  }, { current, campaigns });
  const result = await page.evaluate(async campaigns => {
    const t = window.__dropperTest;
    const confirmed = await t.sweep(campaigns, 'browser-test');
    return {
      confirmed,
      calls: window.__sweepCalls.slice(),
      history: t.history().map(item => ({ rewardId: item.rewardId, outcome: item.outcome })),
      current: t.current(),
      path: location.pathname,
    };
  }, campaigns);
  assert.equal(result.confirmed, 2);
  assert.deepEqual(result.calls, ['instance-a', 'instance-b']);
  assert.deepEqual(result.history.filter(item => item.outcome === 'confirmed').map(item => item.rewardId).sort(), ['ready-a', 'ready-b']);
  assert.equal(result.current.id, 'current-live');
  assert.equal(result.current.currentMinutes, 20);
  assert.equal(result.path, '/chosen_channel');
}));


test('off-stream status does not imply active earning when automatic switching is off', async () => fixture(async page => {
  const d = data();
  const result = await page.evaluate(({ drop, campaigns }) => {
    const t = window.__dropperTest;
    t.configure(drop, campaigns);
    t.setFindNext(false);
    history.pushState({}, '', '/');
    t.sync();
    const label = t.activityStatus(drop, '');
    return { label, path: location.pathname };
  }, d);
  assert.equal(result.path, '/');
  assert.match(result.label, /Fixture game · 60 \/ 60 min · Automatic switching off/);
  assert.doesNotMatch(result.label, /Working toward/i);
}));

test('claim history panel exposes a compact selector and sweep health summary', async () => fixture(async page => {
  const result = await page.evaluate(() => {
    const t = window.__dropperTest;
    t.setActiveClaims(true);
    t.scan();
    const root = document.getElementById('tdh-root').shadowRoot;
    return {
      summary: t.claimSummary(),
      rendered: root.getElementById('tdh-claim-health')?.textContent || '',
      panelCount: root.querySelectorAll('#tdh-claim-history-panel').length,
    };
  });
  assert.equal(result.panelCount, 1);
  assert.match(result.summary, /^Claims: none/);
  assert.match(result.summary, /Drop: monitoring/);
  assert.equal(result.rendered, result.summary);
}));


test('support heart replaces the permanent donation note and opens a compact popover', async () => fixture(async page => {
  const before = await page.evaluate(() => {
    window.dropperShow();
    const root = document.getElementById('tdh-root').shadowRoot;
    const button = root.getElementById('tdh-support-button');
    const close = root.getElementById('tdh-rail-close');
    const actions = button?.closest('.header-actions');
    return {
      button: Boolean(button),
      close: Boolean(close),
      siblings: actions ? [...actions.children].map(node => node.id || node.className) : [],
      expanded: button?.getAttribute('aria-expanded'),
      popoverHidden: root.getElementById('tdh-support-popover')?.hidden,
      permanentNote: Boolean(root.getElementById('tdh-support-note')),
    };
  });
  assert.equal(before.button, true);
  assert.equal(before.close, true);
  assert.equal(before.permanentNote, false);
  assert.equal(before.expanded, 'false');
  assert.equal(before.popoverHidden, true);
  assert.equal(before.siblings.at(-1), 'tdh-rail-close');

  const opened = await page.evaluate(() => {
    const root = document.getElementById('tdh-root').shadowRoot;
    root.getElementById('tdh-support-button').click();
    const popover = root.getElementById('tdh-support-popover');
    const supportLink = root.getElementById('tdh-support-link');
    return {
      hidden: popover.hidden,
      text: popover.textContent.replace(/\s+/g, ' ').trim(),
      expanded: root.getElementById('tdh-support-button').getAttribute('aria-expanded'),
      href: supportLink?.href || '',
      target: supportLink?.target || '',
      rel: supportLink?.rel || '',
    };
  });
  assert.equal(opened.hidden, false);
  assert.equal(opened.expanded, 'true');
  assert.match(opened.text, /Support Dropper/);
  assert.match(opened.text, /Donations are optional\. All features stay free\./);
  assert.equal(opened.href, 'https://ko-fi.com/expdare');
  assert.equal(opened.target, '_blank');
  assert.match(opened.rel, /noopener/);
  assert.match(opened.rel, /noreferrer/);
}));

test('eligibility uses a compact expandable chip with concise state wording', async () => fixture(async page => {
  const states = await page.evaluate(() => {
    const t = window.__dropperTest;
    return {
      eligible: t.eligibilityCompact({ code: 'eligible', estimateMinutes: 88 }),
      deadline: t.eligibilityCompact({ code: 'deadline-risk', estimateMinutes: 88 }),
      account: t.eligibilityCompact({ code: 'account-link' }),
      prerequisite: t.eligibilityCompact({ code: 'prerequisite-required' }),
      wrong: t.eligibilityCompact({ code: 'wrong-channel' }),
      unknown: t.eligibilityCompact({ code: 'unknown' }),
    };
  });
  assert.deepEqual(states.eligible, { text: '✓ Eligible · 88 min remaining', tone: 'good' });
  assert.deepEqual(states.deadline, { text: '⚠ Deadline Risk · 88 min needed', tone: 'bad' });
  assert.equal(states.account.text, '⚠ Account Link Required');
  assert.equal(states.prerequisite.text, '⚠ Previous Reward Required');
  assert.equal(states.wrong.text, '⚠ Stream Not Eligible');
  assert.equal(states.unknown.text, '? Eligibility Not Verified');

  const dom = await page.evaluate(() => {
    const root = document.getElementById('tdh-root').shadowRoot;
    const details = root.getElementById('tdh-reward-eligibility');
    return {
      tag: details?.tagName,
      open: details?.open,
      summary: root.getElementById('tdh-eligibility-summary')?.textContent || '',
      detail: root.getElementById('tdh-eligibility-detail')?.textContent || '',
      oldNote: details?.classList.contains('campaign-manager-note') || false,
    };
  });
  assert.equal(dom.tag, 'DETAILS');
  assert.equal(dom.open, false);
  assert.equal(dom.oldNote, false);
  assert.ok(dom.summary.length > 0);
  assert.ok(dom.detail.length > 0);
}));


test('account-link and deadline-risk cards render from verified campaign state', async () => fixture(async page => {
  const now = Date.now();
  const accountStart = new Date(now - 60 * 60 * 1000).toISOString();
  const accountEnd = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const accountState = await page.evaluate(({ start, end }) => {
    const t = window.__dropperTest;
    const drop = {
      id: 'reward-link', campaignId: 'campaign-link', campaignKey: 'campaign-link',
      name: 'Linked reward', game: 'Linked Game', requiredMinutes: 60, currentMinutes: 0, percent: 0,
    };
    const campaigns = [{
      id: 'campaign-link', name: 'Linked campaign', status: 'ACTIVE', startAt: start, endAt: end,
      game: { name: 'Linked Game', displayName: 'Linked Game' },
      self: { isAccountConnected: false, isEligible: true },
      timeBasedDrops: [{
        id: 'reward-link', name: 'Linked reward', requiredMinutesWatched: 60,
        self: { currentMinutesWatched: 0, isClaimed: false },
      }],
    }];
    t.configure(drop, campaigns);
    t.refreshEligibility();
    const root = document.getElementById('tdh-root').shadowRoot;
    const warning = root.getElementById('tdh-account-link-warning');
    const deadline = root.getElementById('tdh-deadline-status');
    return {
      warningHidden: warning.hidden,
      warningText: warning.textContent.replace(/\s+/g, ' ').trim(),
      deadlineHidden: deadline.hidden,
      compact: root.getElementById('tdh-eligibility-summary').textContent,
    };
  }, { start: accountStart, end: accountEnd });
  assert.equal(accountState.warningHidden, false);
  assert.match(accountState.warningText, /Game Account Not Linked/);
  assert.match(accountState.warningText, /Linked Game requires a linked game account/);
  assert.equal(accountState.deadlineHidden, true);
  assert.equal(accountState.compact, '⚠ Account Link Required');

  const deadlineStart = new Date(now - 60 * 60 * 1000).toISOString();
  const deadlineEnd = new Date(now + 20 * 60 * 1000).toISOString();
  const deadlineState = await page.evaluate(({ start, end }) => {
    const t = window.__dropperTest;
    const drop = {
      id: 'reward-deadline', campaignId: 'campaign-deadline', campaignKey: 'campaign-deadline',
      name: 'Deadline reward', game: 'Deadline Game', requiredMinutes: 60, currentMinutes: 0, percent: 0,
    };
    const campaigns = [{
      id: 'campaign-deadline', name: 'Deadline campaign', status: 'ACTIVE', startAt: start, endAt: end,
      game: { name: 'Deadline Game', displayName: 'Deadline Game' },
      self: { isAccountConnected: true, isEligible: true },
      timeBasedDrops: [{
        id: 'reward-deadline', name: 'Deadline reward', requiredMinutesWatched: 60,
        self: { currentMinutesWatched: 0, isClaimed: false },
      }],
    }];
    t.configure(drop, campaigns);
    t.setRouting({
      state: 'earning',
      targetStream: 'chosen_channel',
      targetGame: 'Deadline Game',
      targetCampaign: 'Deadline campaign',
      targetCampaignKey: 'campaign-deadline',
      targetDropId: 'reward-deadline',
      candidateEvidence: {
        gqlEvidenceAt: Date.now(),
        gqlCampaignSupported: true,
        gqlSessionDropMatched: true,
      },
    });
    t.clearVerification();
    t.refreshEligibility();
    const root = document.getElementById('tdh-root').shadowRoot;
    const warning = root.getElementById('tdh-account-link-warning');
    const deadline = root.getElementById('tdh-deadline-status');
    return {
      warningHidden: warning.hidden,
      deadlineHidden: deadline.hidden,
      deadlineText: deadline.textContent,
      tone: deadline.dataset.tone,
      compact: root.getElementById('tdh-eligibility-summary').textContent,
    };
  }, { start: deadlineStart, end: deadlineEnd });
  assert.equal(deadlineState.warningHidden, true);
  assert.equal(deadlineState.deadlineHidden, false);
  assert.equal(deadlineState.tone, 'bad');
  assert.match(deadlineState.deadlineText, /Not finishable in time/);
  assert.equal(deadlineState.compact, '⚠ Deadline Risk · 60 min needed');
}));


test('support popover stays inside narrow menu bounds', async () => fixture(async page => {
  const geometry = await page.evaluate(async () => {
    window.dropperShow();
    const t = window.__dropperTest;
    t.setWidth('narrow');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const root = document.getElementById('tdh-root').shadowRoot;
    root.getElementById('tdh-support-button').click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const menu = root.getElementById('tdh-tools-dock').getBoundingClientRect();
    const popover = root.getElementById('tdh-support-popover').getBoundingClientRect();
    return {
      menu: { left: menu.left, right: menu.right, width: menu.width },
      popover: { left: popover.left, right: popover.right, width: popover.width },
    };
  });
  assert.ok(geometry.popover.left >= geometry.menu.left - 0.5);
  assert.ok(geometry.popover.right <= geometry.menu.right + 0.5);
  assert.ok(geometry.popover.width <= geometry.menu.width + 0.5);
}));


test('reload reconciliation restores exact reward metadata and persisted eligibility proof', async () => fixture(async page => {
  const now = Date.now();
  const start = new Date(now - 3600000).toISOString();
  const end = new Date(now + 8 * 3600000).toISOString();
  const campaigns = [{
    id: 'campaign-reload',
    name: "Donghwa's Gift (Sep 25)",
    status: 'ACTIVE',
    startAt: start,
    endAt: end,
    game: { name: 'Black Desert', displayName: 'Black Desert', slug: 'black-desert' },
    timeBasedDrops: [{
      id: 'reward-reload',
      name: '1 Hour (Sep 25)',
      requiredMinutesWatched: 60,
      self: { currentMinutesWatched: 1, isClaimed: false, dropInstanceID: '' },
    }],
  }];
  const drop = {
    id: 'reward-reload',
    campaignId: 'campaign-reload',
    campaignKey: 'campaign-reload',
    name: 'Current drop',
    game: 'Black Desert',
    campaign: "Donghwa's Gift (Sep 25)",
    campaignStartAt: start,
    campaignEndAt: end,
    dropStartAt: start,
    dropEndAt: end,
    requiredMinutes: 60,
    currentMinutes: 1,
    remainingMinutes: 59,
    percent: 2,
  };

  const result = await page.evaluate(({ drop, campaigns, now }) => {
    const t = window.__dropperTest;
    t.configure(drop, campaigns);
    const restoredMetadata = t.restoreMetadata();
    const afterMetadata = t.current();

    t.setRouting({
      state: 'earning',
      targetGame: 'Black Desert',
      targetCampaign: "Donghwa's Gift (Sep 25)",
      targetCampaignKey: 'campaign-reload',
      targetDropId: 'reward-reload',
      targetStream: 'chosen_channel',
      candidateEvidence: {
        gqlCampaignSupported: true,
        gqlSessionMatched: true,
        gqlSessionCampaignMatched: true,
        gqlSessionDropMatched: true,
        gqlEvidenceAt: now,
      },
    });
    t.clearVerification();
    const restoredVerification = t.restoreVerification(now);
    const fresh = t.eligibilityState();
    const verification = t.verification();

    t.setRouting({
      state: 'earning',
      targetGame: 'Black Desert',
      targetCampaign: "Donghwa's Gift (Sep 25)",
      targetCampaignKey: 'campaign-reload',
      targetDropId: 'reward-reload',
      targetStream: 'chosen_channel',
      candidateEvidence: {
        gqlCampaignSupported: true,
        gqlSessionMatched: true,
        gqlSessionCampaignMatched: true,
        gqlSessionDropMatched: true,
        gqlEvidenceAt: now - 5 * 60 * 1000,
      },
    });
    t.clearVerification();
    const stale = t.eligibilityState();

    t.setRouting({
      state: 'earning',
      targetGame: 'Black Desert',
      targetCampaign: "Donghwa's Gift (Sep 25)",
      targetCampaignKey: 'campaign-reload',
      targetDropId: 'different-reward',
      targetStream: 'chosen_channel',
      candidateEvidence: {
        gqlCampaignSupported: true,
        gqlSessionMatched: true,
        gqlSessionCampaignMatched: true,
        gqlSessionDropMatched: true,
        gqlEvidenceAt: now,
      },
    });
    t.clearVerification();
    const mismatch = t.eligibilityState();

    return {
      restoredMetadata,
      name: afterMetadata?.name,
      restoredVerification,
      verificationMethod: verification?.method || '',
      freshCode: fresh.code,
      staleCode: stale.code,
      mismatchCode: mismatch.code,
    };
  }, { drop, campaigns, now });

  assert.equal(result.restoredMetadata, true);
  assert.equal(result.name, '1 Hour (Sep 25)');
  assert.equal(result.restoredVerification, true);
  assert.equal(result.verificationMethod, 'routing-session-restored');
  assert.equal(result.freshCode, 'eligible');
  assert.equal(result.staleCode, 'unknown');
  assert.equal(result.mismatchCode, 'unknown');
}));

test('the campaign list follows Campaign Order and matches the campaign Dropper picks next', async () => fixture(async page => {
  const day = 86400000, start = new Date(Date.now() - day).toISOString();
  const campaign = (id, game, endInDays, minutes) => ({
    id, name: `${game} campaign`, status: 'ACTIVE', startAt: start, endAt: new Date(Date.now() + endInDays * day).toISOString(),
    game: { name: game, displayName: game },
    timeBasedDrops: [{ id: `reward-${id}`, name: `${game} reward`, requiredMinutesWatched: minutes, startAt: start, endAt: new Date(Date.now() + endInDays * day).toISOString(), self: { currentMinutesWatched: 0, isClaimed: false } }],
  });
  // Alpha ends last and is the longest; Bravo ends first; Charlie is the shortest.
  const campaigns = [campaign('alpha', 'Alpha', 9, 600), campaign('bravo', 'Bravo', 2, 120), campaign('charlie', 'Charlie', 5, 30)];
  await page.evaluate(campaigns => { window.__dropperTest.configure(null, campaigns); window.__dropperTest.refresh(); window.dropperShow(); window.__campaigns = campaigns; }, campaigns);
  const snapshot = () => page.evaluate(() => {
    const root = document.getElementById('tdh-root').shadowRoot;
    const pick = window.__dropperTest.pickNext(window.__campaigns);
    return {
      list: [...root.querySelectorAll('.campaign-game-row')].map(row => ({
        game: row.querySelector('.campaign-game-name').textContent,
        label: row.querySelector('.campaign-game-meta').textContent.match(/^(Watching now|Next up)/)?.[1] || '',
        arrowsOff: row.querySelector('.campaign-priority-button').disabled && row.querySelector('.campaign-priority-button:last-of-type').disabled,
      })),
      picks: pick?.game || '',
      note: root.getElementById('tdh-campaign-order-note').textContent,
    };
  });
  const choose = value => page.evaluate(value => {
    const select = document.getElementById('tdh-root').shadowRoot.getElementById('tdh-campaign-strategy');
    select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

  for (const [strategy, expected] of [['deadline', ['Bravo', 'Charlie', 'Alpha']], ['completion', ['Charlie', 'Bravo', 'Alpha']], ['shortest', ['Charlie', 'Bravo', 'Alpha']]]) {
    await choose(strategy);
    const view = await snapshot();
    assert.deepEqual(view.list.map(item => item.game), expected, `${strategy}: the list is in the order Dropper picks`);
    assert.equal(view.list[0].label, 'Next up', `${strategy}: the first game is marked next`);
    assert.equal(view.picks, expected[0], `${strategy}: the router picks the game shown first`);
    assert.ok(view.list.every(item => item.arrowsOff), `${strategy}: hand-ranking arrows are off outside My Priority`);
    assert.match(view.note, /Choose My Priority to rank games/);
  }

  // My Priority: arrows rank by hand and the list follows them.
  await choose('priority');
  assert.deepEqual((await snapshot()).list.map(item => item.game), ['Alpha', 'Bravo', 'Charlie']);
  await page.evaluate(() => {
    const row = [...document.getElementById('tdh-root').shadowRoot.querySelectorAll('.campaign-game-row')].find(item => item.querySelector('.campaign-game-name').textContent === 'Charlie');
    const up = row.querySelector('.campaign-priority-button[aria-label$="higher in game priority"]');
    up.click(); up.click();
  });
  let view = await snapshot();
  assert.deepEqual(view.list.map(item => item.game), ['Charlie', 'Alpha', 'Bravo'], 'the arrows reorder the list');
  assert.equal(view.picks, 'Charlie', 'the router follows the hand-ranked order');
  assert.match(view.note, /Use ↑ and ↓ to rank games/);

  // While a reward is being earned, that game is marked and the next game is the top of the rest.
  await page.evaluate(campaigns => window.__dropperTest.configure({ id: 'reward-bravo', campaignId: 'bravo', campaignKey: 'bravo', name: 'Bravo reward', game: 'Bravo', requiredMinutes: 120, currentMinutes: 30, percent: 25, isClaimed: false }, campaigns), campaigns);
  await page.evaluate(() => window.__dropperTest.refresh());
  view = await snapshot();
  assert.equal(view.list.find(item => item.game === 'Bravo').label, 'Watching now');
  assert.equal(view.list.find(item => item.game === 'Charlie').label, 'Next up');
}));

// Changing Campaign Order (or hand-ranking a game) acts immediately: Dropper leaves the campaign it is earning on
// for the top-ranked one, unless it is not allowed to navigate on its own.
async function orderFixture(run, { findNext = true, state = 'earning' } = {}) {
  const day = 86400000, start = new Date(Date.now() - day).toISOString();
  const campaign = (id, game, endInDays, minutes) => ({
    id, name: `${game} campaign`, status: 'ACTIVE', startAt: start, endAt: new Date(Date.now() + endInDays * day).toISOString(),
    game: { name: game, displayName: game },
    timeBasedDrops: [{ id: `reward-${id}`, name: `${game} reward`, requiredMinutesWatched: minutes, startAt: start, endAt: new Date(Date.now() + endInDays * day).toISOString(), self: { currentMinutesWatched: 0, isClaimed: false } }],
  });
  // Alpha ends last and is the longest; Bravo ends first; Charlie is the shortest.
  const campaigns = [campaign('alpha', 'Alpha', 9, 600), campaign('bravo', 'Bravo', 2, 120), campaign('charlie', 'Charlie', 5, 30)];
  return fixture(async page => {
    await page.evaluate(({ campaigns, findNext, state }) => {
      const t = window.__dropperTest;
      window.__campaigns = campaigns;
      t.setFindNext(findNext);
      // Dropper routed to this stream itself (as opposed to the viewer choosing it), so it may move on its own.
      t.sync(); t.intent.allowSwitching();
      // Earning Bravo: an in-progress reward with credited minutes.
      t.configure({ id: 'reward-bravo', campaignId: 'bravo', campaignKey: 'bravo', name: 'Bravo reward', game: 'Bravo', requiredMinutes: 120, currentMinutes: 30, percent: 25, isClaimed: false }, campaigns);
      t.setRouting({ state, targetGame: 'Bravo', targetCampaign: 'Bravo campaign', targetCampaignKey: 'bravo', targetDropId: 'reward-bravo', targetStream: 'chosen_channel' });
      t.refresh();
    }, { campaigns, findNext, state });
    await run(page);
  });
}
const routingView = page => page.evaluate(() => { const r = window.__dropperTest.routing(); return { state: r.state, game: r.targetGame, campaignKey: r.targetCampaignKey }; });

test('changing Campaign Order moves an earning Dropper to the top-ranked campaign right away', async () => orderFixture(async page => {
  await page.evaluate(() => window.__dropperTest.setStrategy('shortest')); // Charlie has the least time left.
  const result = await page.evaluate(() => window.__dropperTest.applyOrder('campaign-order-changed'));
  assert.equal(result.switched, true);
  assert.equal(result.game, 'Charlie');
  assert.equal(result.from, 'Bravo');
  const routing = await routingView(page);
  assert.equal(routing.game, 'Charlie', JSON.stringify(routing));
  assert.notEqual(routing.state, 'earning');
  assert.notEqual(await page.evaluate(() => window.__dropperTest.current()?.game), 'Bravo', 'the old campaign is no longer the current drop');
}));

test('Closest to Completion keeps an earning campaign that is already partly done', async () => orderFixture(async page => {
  await page.evaluate(() => window.__dropperTest.setStrategy('completion')); // Bravo is 25% done; the others are at 0%.
  const result = await page.evaluate(() => window.__dropperTest.applyOrder('campaign-order-changed'));
  assert.equal(result.switched, false);
  assert.equal(result.alreadyTop, true);
  assert.equal((await routingView(page)).game, 'Bravo');
}));

test('changing Campaign Order does nothing when the earning campaign is already first', async () => orderFixture(async page => {
  await page.evaluate(() => window.__dropperTest.setStrategy('deadline')); // Bravo ends soonest.
  const result = await page.evaluate(() => window.__dropperTest.applyOrder('campaign-order-changed'));
  assert.equal(result.switched, false);
  assert.equal(result.alreadyTop, true);
  assert.deepEqual(await routingView(page), { state: 'earning', game: 'Bravo', campaignKey: 'bravo' });
}));

test('hand-ranking a game with the arrows also moves an earning Dropper right away', async () => orderFixture(async page => {
  const moved = await page.evaluate(() => {
    const t = window.__dropperTest, games = window.__campaigns.map(item => ({ game: item.game.name }));
    t.movePriority('Charlie', -1, games); t.movePriority('Charlie', -1, games); // Alpha, Bravo, Charlie -> Charlie, Alpha, Bravo
    return t.applyOrder('campaign-priority-changed');
  });
  assert.equal(moved.switched, true);
  assert.equal(moved.game, 'Charlie');
  assert.equal((await routingView(page)).game, 'Charlie');
}));

test('a changed Campaign Order never overrides a pause, a locked stream, or switching being off', async () => {
  const blocked = async (why, arrange, options) => orderFixture(async page => {
    await page.evaluate(arrange);
    await page.evaluate(() => window.__dropperTest.setStrategy('shortest'));
    const result = await page.evaluate(() => window.__dropperTest.applyOrder('campaign-order-changed'));
    assert.equal(result.switched, false, why);
    assert.match(result.why, new RegExp(why, 'i'), JSON.stringify(result));
    assert.deepEqual(await routingView(page), { state: 'earning', game: 'Bravo', campaignKey: 'bravo' }, `${why}: still earning the current campaign`);
    assert.equal(await page.evaluate(() => window.__dropperTest.current()?.game), 'Bravo');
  }, options);
  await blocked('Automatic Switching Is Off', () => {}, { findNext: false });
  await blocked('Playback Paused', () => window.__dropperTest.pauseIntent());
  await blocked('Stream Locked', () => window.__dropperTest.lockStream(true));
});

test('a changed Campaign Order never interrupts a claim in progress', async () => orderFixture(async page => {
  await page.evaluate(() => window.__dropperTest.setStrategy('shortest'));
  const result = await page.evaluate(() => window.__dropperTest.applyOrder('campaign-order-changed'));
  assert.equal(result.switched, false);
  assert.equal((await routingView(page)).state, 'claim');
}, { state: 'claim' }));
