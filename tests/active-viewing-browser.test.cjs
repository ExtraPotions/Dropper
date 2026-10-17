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
    setMenuOpen: setRailOpen,
    menuState: () => ({ open: railOpen, coreOpen: ui.menuController.isOpen, dismissAt: ui.menuController.dismissAt, timer: ui.menuController.timerActive }),
    enforceMenuAt: now => ui.menuController.enforceDeadline(now),
    intent: viewingIntent, sync: syncViewingContext, ensure: ensureStreamPlaying,
    install: installViewingIntent, claim: claimDropViaGql, scan: scanClaimGroups,
    history: () => claimLedger().snapshot(), reconcile: reconcileClaimHistory,
    navigation: viewingNavigationAllowed, refresh: refreshOpenCampaignList,
    setGql: fn => { gql = fn; },
    parseAvailable: parseAvailableCampaigns, support: updateRoutingCampaignSupportEvidence, ingest: ingestTwitchGqlRows,
    configure: (drop, campaigns) => { currentDrop = drop; lastInventoryCampaigns = campaigns; lastCampaignCatalog = campaigns; },
    ignore: setCampaignGameIgnored, priority: campaignPriority, pickNext: pickNextOpenCampaignDrop,
    relayout: () => { applyAppearanceSettings(); layoutChrome(); },
    setActiveClaims: value => { settings.claimBonus = value; settings.claimDrops = value; syncClaimWatchers(); },
    queueScan: queueClaimScan, setPriority: setCampaignPriority, priorityEntry: campaignPriorityEntry,
    priorityRank: campaignPriorityRank, priorityOrder: readCampaignPriorityOrder, setPriorityPosition: setCampaignPriorityPosition,
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
    automationTab: () => isAutomationTab(), claimTab: () => claimAutomationTab(), controller: () => isAutoRoutingController(), publish: () => publishTabPresence(), badgeOnly: () => Boolean(settings.badgeOnly),
    streamLock: () => manualStreamLockSnapshot(),
    refreshHealth: () => { refreshStreamHealthSummary(); refreshEligibilityChecklist(); refreshViewingControls(); },
    confidence: () => earningConfidencePresentation(),
    systemHealth: systemHealthSnapshot,
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
    checkUpdates: force => scheduleUpdateCheck(force), updateState: () => loadUpdateState(), appVersion: () => APP_VERSION,
  };
  startDropper();
})();`);
assert.notEqual(exposed, source, 'test-only hooks inserted without changing distribution');

async function fixture(run, pathname = '/chosen_channel', { viewport = { width: 1280, height: 900 }, extra = '' } = {}) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport });
    await context.addCookies([
      { name: 'login', value: 'fixture-alice', domain: '.twitch.tv', path: '/' },
      { name: 'auth-token', value: 'fixture-token', domain: '.twitch.tv', path: '/' },
    ]);
    await context.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html><head><title>Dropper fixture</title></head><body>
      <video id="fixture-video"></video>
      <button id="fixture-control" data-a-target="player-play-pause-button">Pause</button>${extra}
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
    await page.goto('https://www.twitch.tv' + pathname);
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

test('System health shows product facts after the full userscript starts', async () => fixture(async page => {
  const facts=await page.evaluate(() => ({snapshot:window.__dropperTest.systemHealth(), rendered:document.querySelector('#tdh-root').shadowRoot.querySelector('[data-exp-health-reason]').textContent}));
  assert.equal(facts.snapshot.state,'waiting');
  assert.match(facts.rendered,/reward|Twitch/i);
}));

test('opening System refreshes health after viewing is paused', async () => fixture(async page => {
  await page.waitForFunction(()=>document.querySelector('#tdh-root').shadowRoot.querySelector('[data-exp-health-reason]').textContent.includes('reward'));
  await page.evaluate(()=>{
    window.__dropperTest.pauseIntent();
    window.dropperShow();
    document.querySelector('#tdh-root').shadowRoot.querySelector('[data-panel="tdh-diagnostics-body"]').click();
  });
  await page.waitForFunction(()=>document.querySelector('#tdh-root').shadowRoot.querySelector('[data-exp-health-state]').textContent==='Paused',null,{timeout:1500});
  assert.match(await page.locator('#tdh-root').evaluate(n=>n.shadowRoot.querySelector('[data-exp-health-reason]').textContent),/paused/i);
}));

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
    document.getElementById('tdh-root').shadowRoot.getElementById('tdh-allow-switching').click();
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

test('failed claim-history writes prevent network mutations and page clicks', async () => fixture(async page => {
  const result = await page.evaluate(async () => {
    const t = window.__dropperTest; let requests = 0, clicks = 0;
    t.setGql(async () => { requests++; return []; });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.includes('dropper-claim-history-v1')) throw new DOMException('Storage full', 'QuotaExceededError'); return original.call(this, key, value); };
    const claimed = await t.claim({ id: 'reward-a', campaignId: 'campaign-a', dropInstanceID: 'instance-a', requiredMinutes: 60, currentMinutes: 60 });
    const button = document.createElement('button'); button.dataset.aTarget = 'drops-claim-button'; button.textContent = 'Claim Now'; button.onclick = () => clicks++; document.body.append(button);
    t.setActiveClaims(true); t.scan();
    Storage.prototype.setItem = original;
    return { claimed, requests, clicks, history: t.history() };
  });
  assert.equal(result.claimed, false); assert.equal(result.requests, 0); assert.equal(result.clicks, 0); assert.equal(result.history.length, 0);
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

test('ranked game priority is account-scoped, does not navigate, and single-sized chrome fits different viewports', async () => fixture(async page => {
  const d = data(); d.campaigns[0].timeBasedDrops[0].self.currentMinutesWatched = 0;
  d.campaigns.push({
    id: 'campaign-b', name: 'Second campaign', status: 'ACTIVE',
    startAt: d.campaigns[0].startAt, endAt: d.campaigns[0].endAt,
    game: { name: 'Second game', displayName: 'Second game' },
    timeBasedDrops: [{ id: 'reward-b', name: 'Second reward', requiredMinutesWatched: 30, self: { currentMinutesWatched: 0, isClaimed: false } }],
  });
  await page.evaluate(({ drop, campaigns }) => { window.__dropperTest.configure(drop, campaigns); window.__dropperTest.refresh(); window.dropperShow(); }, d);
  const widths = [];
  for (const viewportWidth of [280, 596, 1280]) {
    const expected = Math.min(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('tdh-root')).getPropertyValue('--exp-menu-width'))), viewportWidth - 24);
    const mode = `viewport ${viewportWidth}`;
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await page.evaluate(mode => { const t = window.__dropperTest; t.relayout(); window.dropperShow(); const h = document.getElementById('tdh-root').shadowRoot.querySelector('[data-panel="tdh-drops-body"]'); const b = document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drops-body'); if (b.classList.contains('fl-tool-hidden')) h.click(); }, mode);
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
    assert.ok(box.left >= 0 && box.right <= viewportWidth); assert.ok(box.overflow <= 1, `${mode} content stays inside menu width`);
    assert.ok(box.top >= 8 && box.bottom <= 892, `${mode} menu stays inside the viewport`);
    // The menu may sit beside the row (exp-core places it left of the launcher grid) or above/below it, never on it.
    const clear = box.bottom <= box.rowTop - 7 || box.top >= box.rowBottom + 7 || box.right <= box.rowLeft - 7;
    assert.ok(clear, `${mode} menu does not overlap the progress/launcher row: ${JSON.stringify(box)}`);
    fs.mkdirSync(path.join(__dirname, '../test-artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, `../test-artifacts/active-viewing-${mode}.png`) });
  }
  await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
  await page.getByLabel('Priority position for Second game', { exact: true }).focus();
  await page.getByLabel('Priority position for Second game', { exact: true }).selectOption('1');
  const ranked = await page.evaluate(() => {
    const t = window.__dropperTest;
    return { rank: t.priorityRank('Second game').rank, order: t.priorityOrder(), path: location.pathname };
  });
  assert.equal(ranked.rank, 1);
  assert.equal(ranked.order[0], 'second game');
  assert.equal(ranked.path, '/chosen_channel');
  await page.evaluate(() => { document.cookie = 'login=fixture-bob; path=/; domain=.twitch.tv'; window.__dropperTest.sync(); });
  assert.equal(await page.evaluate(() => window.__dropperTest.priorityRank('Second game').rank), null);
}));


test('an unlinked campaign is still earned, then skipped for the next game once its drops are earned', async () => fixture(async page => {
  const now = Date.now();
  const iso = ms => new Date(ms).toISOString();
  const campaigns = [
    {
      id: 'unlinked', name: 'Unlinked', status: 'ACTIVE',
      startAt: iso(now - 60000), endAt: iso(now + 60 * 60000),
      game: { name: 'Unlinked Game', displayName: 'Unlinked Game' },
      self: { isAccountConnected: false, isEligible: true },
      timeBasedDrops: [{ id: 'u', name: 'Unlinked reward', requiredMinutesWatched: 60, self: { currentMinutesWatched: 30, isClaimed: false } }],
    },
    {
      id: 'linked', name: 'Linked', status: 'ACTIVE',
      startAt: iso(now - 60000), endAt: iso(now + 6 * 60 * 60000),
      game: { name: 'Next Game', displayName: 'Next Game' },
      self: { isAccountConnected: true, isEligible: true },
      timeBasedDrops: [{ id: 'n', name: 'Next reward', requiredMinutesWatched: 60, self: { currentMinutesWatched: 0, isClaimed: false } }],
    },
  ];
  const result = await page.evaluate(campaigns => {
    const t = window.__dropperTest;
    t.configure({ id: 'u', campaignId: 'unlinked', campaignKey: 'unlinked', name: 'Unlinked reward', game: 'Unlinked Game', requiredMinutes: 60, currentMinutes: 30, percent: 50 }, campaigns);
    t.refresh();
    const earning = t.pickNext(campaigns, [], [])?.game || '';
    const done = [{ ...campaigns[0], id: 'unlinked-done', timeBasedDrops: [{ ...campaigns[0].timeBasedDrops[0], self: { currentMinutesWatched: 60, isClaimed: false } }] }, campaigns[1]];
    return { earning, afterEarned: t.pickNext(done, [], [])?.game || '' };
  }, campaigns);
  assert.equal(result.earning, 'Unlinked Game');
  assert.equal(result.afterEarned, 'Next Game');
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

test('a later bonus can reuse a button after its previous bonus was confirmed', async () => fixture(async page => {
  await page.evaluate(() => {
    const t = window.__dropperTest; t.setActiveClaims(false);
    document.body.insertAdjacentHTML('beforeend', '<div class="community-points-summary"><button id="reused-bonus" aria-label="Claim Bonus"><span class="claimable-bonus__icon"></span></button></div>');
    window.__bonusClicks = 0;
    document.getElementById('reused-bonus').addEventListener('click', event => {
      window.__bonusClicks++;
      event.currentTarget.querySelector('.claimable-bonus__icon')?.remove();
    });
    t.setActiveClaims(true); t.scan();
  });
  await page.waitForFunction(() => window.__dropperTest.history().some(record => record.kind === 'bonus' && record.outcome === 'confirmed'));
  assert.equal(await page.evaluate(() => window.__bonusClicks), 1);
  await page.evaluate(() => {
    const t = window.__dropperTest;
    t.scan(); // The empty old control must not be clicked again.
    document.getElementById('reused-bonus').insertAdjacentHTML('beforeend', '<span class="claimable-bonus__icon"></span>');
    t.scan(); t.scan();
  });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__bonusClicks), 2, 'the next bonus gets a new claim identity');
  await page.waitForFunction(() => window.__dropperTest.history().filter(record => record.kind === 'bonus' && record.outcome === 'confirmed').length === 2);
}));

test('a bonus rerender while confirmation is pending does not trigger another claim', async () => fixture(async page => {
  await page.evaluate(() => {
    const t = window.__dropperTest; t.setActiveClaims(false);
    document.body.insertAdjacentHTML('beforeend', '<div class="community-points-summary"><button id="pending-bonus" aria-label="Claim Bonus"><span class="claimable-bonus__icon"></span></button></div>');
    window.__bonusClicks = 0;
    document.getElementById('pending-bonus').addEventListener('click', () => window.__bonusClicks++);
    t.setActiveClaims(true); t.scan();
  });
  await page.waitForFunction(() => window.__bonusClicks === 1);
  await page.evaluate(() => {
    document.querySelector('#pending-bonus .claimable-bonus__icon').outerHTML = '<span class="claimable-bonus__icon"></span>';
  });
  await page.waitForTimeout(1700);
  await page.evaluate(() => window.__dropperTest.scan());
  await page.waitForTimeout(200);
  const value = await page.evaluate(() => ({ clicks: window.__bonusClicks, history: window.__dropperTest.history() }));
  assert.equal(value.clicks, 1);
  assert.equal(value.history.filter(record => record.kind === 'bonus').length, 1);
  assert.equal(value.history.find(record => record.kind === 'bonus').outcome, 'pending');
}));

test('a confirmed bonus button can be remounted for a later bonus', async () => fixture(async page => {
  await page.evaluate(() => {
    const t = window.__dropperTest; t.setActiveClaims(false);
    document.body.insertAdjacentHTML('beforeend', '<div class="community-points-summary" id="remount-bonus-container"><button id="remount-bonus" aria-label="Claim Bonus"><span class="claimable-bonus__icon"></span></button></div>');
    window.__bonusButton = document.getElementById('remount-bonus');
    window.__bonusClicks = 0;
    window.__bonusButton.addEventListener('click', event => { window.__bonusClicks++; event.currentTarget.remove(); });
    t.setActiveClaims(true); t.scan();
  });
  await page.waitForFunction(() => window.__dropperTest.history().some(record => record.kind === 'bonus' && record.outcome === 'confirmed'));
  await page.evaluate(() => {
    document.getElementById('remount-bonus-container').append(window.__bonusButton);
    window.__dropperTest.scan(); window.__dropperTest.scan();
  });
  await page.waitForFunction(() => window.__bonusClicks === 2);
  await page.waitForFunction(() => window.__dropperTest.history().filter(record => record.kind === 'bonus' && record.outcome === 'confirmed').length === 2);
}));

test('Drop-only heartbeat scans do not cancel a queued bonus scan', async () => fixture(async page => {
  await page.evaluate(() => {
    const t = window.__dropperTest; t.setActiveClaims(false);
    document.body.insertAdjacentHTML('beforeend', '<div class="community-points-summary"><button id="queued-bonus" aria-label="Claim Bonus"><span class="claimable-bonus__icon"></span></button></div>');
    window.__bonusClicks = 0;
    document.getElementById('queued-bonus').addEventListener('click', () => window.__bonusClicks++);
    t.setActiveClaims(true);
    t.queueScan('heartbeat', true);
    t.scan(document, 'drop');
  });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__bonusClicks), 1);
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


test('native Twitch campaign data proves the selected campaign on the current stream', async () => fixture(async page => {
  const result = await page.evaluate(({ drop, campaigns }) => {
    const t = window.__dropperTest;
    t.configure({ ...drop, currentMinutes: 0, percent: 0, campaignStartAt: campaigns[0].startAt, campaignEndAt: campaigns[0].endAt }, campaigns);
    t.setRouting({ state: 'verify-stream', targetStream: 'chosen_channel', targetGame: 'Fixture game',
      targetCampaign: 'Fixture campaign', targetCampaignKey: 'campaign-a', targetDropId: 'reward-a', candidateEvidence: { dropsTagged: true } });
    const rows = t.parseAvailable({ data: { channelDropCampaigns: campaigns } });
    const accepted = t.support('chosen_channel', rows);
    return { accepted, proof: t.routing().candidateEvidence?.gqlCampaignSupported };
  }, data());
  assert.equal(result.accepted, true);
  assert.equal(result.proof, true);
}));

test('native Twitch campaign data never proves a different campaign', async () => fixture(async page => {
  const result = await page.evaluate(({ drop, campaigns }) => {
    const t = window.__dropperTest;
    t.configure({ ...drop, currentMinutes: 0, percent: 0, campaignStartAt: campaigns[0].startAt, campaignEndAt: campaigns[0].endAt }, campaigns);
    t.setRouting({ state: 'verify-stream', targetStream: 'chosen_channel', targetGame: 'Fixture game',
      targetCampaign: 'Fixture campaign', targetCampaignKey: 'campaign-a', targetDropId: 'reward-a', candidateEvidence: { dropsTagged: true } });
    const other = { ...campaigns[0], id: 'other-campaign', name: 'Other campaign', timeBasedDrops: [{ id: 'other-reward' }] };
    return t.support('chosen_channel', t.parseAvailable({ data: { channelDropCampaigns: [other] } }));
  }, data());
  assert.equal(result, false);
}));

test('native Twitch page traffic supplies campaign proof without waiting for a Dropper poll', async () => fixture(async page => {
  const proof = await page.evaluate(({ drop, campaigns }) => {
    const t = window.__dropperTest;
    t.configure({ ...drop, currentMinutes: 0, percent: 0, campaignStartAt: campaigns[0].startAt, campaignEndAt: campaigns[0].endAt }, campaigns);
    t.setRouting({ state: 'verify-stream', targetStream: 'chosen_channel', targetGame: 'Fixture game',
      targetCampaign: 'Fixture campaign', targetCampaignKey: 'campaign-a', targetDropId: 'reward-a' });
    t.ingest([{ data: { channelDropCampaigns: campaigns } }], 'twitch-page-intercept');
    return t.routing().candidateEvidence?.gqlCampaignSupported;
  }, data());
  assert.equal(proof, true);
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
  const protectedOtherCampaign = await page.evaluate(campaign => {
    const t = window.__dropperTest;
    t.configure({id:'other-reward',campaignKey:'other-campaign',name:'Other reward',game:'Other game',currentMinutes:5,requiredMinutes:60},[campaign]);
    return {continued:t.continueClaim({kind:'drop',rewardId:'first-reward',campaignId:campaign.id}),id:t.current()?.id};
  },campaign);
  assert.equal(protectedOtherCampaign.continued,false,'a claim elsewhere must preserve an already progressing campaign');
  assert.equal(protectedOtherCampaign.id,'other-reward');
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
    const button = root.getElementById('exp-support-button');
    const close = root.getElementById('tdh-rail-close');
    const actions = button?.closest('.header-actions');
    return {
      button: Boolean(button),
      close: Boolean(close),
      siblings: actions ? [...actions.children].map(node => node.id || node.className) : [],
      expanded: button?.getAttribute('aria-expanded'),
      popoverHidden: root.getElementById('exp-support-popover')?.hidden,
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
    root.getElementById('exp-support-button').click();
    const popover = root.getElementById('exp-support-popover');
    const supportLink = root.querySelector('#exp-support-popover a');
    return {
      hidden: popover.hidden,
      text: popover.textContent.replace(/\s+/g, ' ').trim(),
      expanded: root.getElementById('exp-support-button').getAttribute('aria-expanded'),
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
  assert.match(accountState.warningText, /Linked Game requires a linked game account to claim rewards. Dropper still earns its watch time./);
  // An unlinked campaign is still earned, so its time-left line shows like any other.
  assert.equal(accountState.deadlineHidden, false);
  assert.notEqual(accountState.compact, '⚠ Account Link Required');

  const earnedState = await page.evaluate(({ start, end }) => {
    const t = window.__dropperTest;
    const drop = { id: 'reward-link', campaignId: 'campaign-link', campaignKey: 'campaign-link', name: 'Linked reward', game: 'Linked Game', requiredMinutes: 60, currentMinutes: 60, percent: 100 };
    t.configure(drop, [{
      id: 'campaign-link', name: 'Linked campaign', status: 'ACTIVE', startAt: start, endAt: end,
      game: { name: 'Linked Game', displayName: 'Linked Game' },
      self: { isAccountConnected: false, isEligible: true },
      timeBasedDrops: [{ id: 'reward-link', name: 'Linked reward', requiredMinutesWatched: 60, self: { currentMinutesWatched: 60, isClaimed: false } }],
    }]);
    t.refreshEligibility();
    return { code: t.eligibilityState().code, compact: document.getElementById('tdh-root').shadowRoot.getElementById('tdh-eligibility-summary').textContent };
  }, { start: accountStart, end: accountEnd });
  assert.deepEqual(earnedState, { code: 'account-link', compact: '⚠ Account Link Required' });

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


test('support popover stays inside viewport-clamped menu bounds', async () => fixture(async page => {
  const geometry = await page.evaluate(async () => {
    window.dropperShow();
    const t = window.__dropperTest;
    t.relayout();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const root = document.getElementById('tdh-root').shadowRoot;
    root.getElementById('exp-support-button').click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const menu = root.getElementById('tdh-tools-dock').getBoundingClientRect();
    const popover = root.getElementById('exp-support-popover').getBoundingClientRect();
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
        pickerOff: row.querySelector('.campaign-priority-position').disabled,
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
    assert.ok(view.list.every(item => item.pickerOff), `${strategy}: hand-ranking pickers are off outside My Priority`);
    assert.match(view.note, /Choose My Priority to rank games/);
  }

  // My Priority: jump directly to a rank and shift intervening games in order.
  await choose('priority');
  assert.deepEqual((await snapshot()).list.map(item => item.game), ['Alpha', 'Bravo', 'Charlie']);
  await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
  await page.getByLabel('Priority position for Charlie', { exact: true }).focus();
  await page.getByLabel('Priority position for Charlie', { exact: true }).selectOption('1');
  let view = await snapshot();
  assert.deepEqual(view.list.map(item => item.game), ['Charlie', 'Alpha', 'Bravo'], 'one selection reorders the list');
  assert.equal(view.picks, 'Charlie', 'the router follows the hand-ranked order');
  assert.match(view.note, /Choose a priority position/);
  await page.getByLabel('Priority position for Charlie', { exact: true }).press('Tab');

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
      // Dropper routed to this stream itself (as opposed to the viewer choosing it), so it may move on its own;
      // that also means this is the tab automatic switching runs in.
      t.claimTab(); t.sync(); t.intent.allowSwitching();
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

test('campaign position picker supports long jumps, keyboard focus and uninterrupted refresh at phone width', async () => fixture(async page => {
  const startAt = new Date(Date.now() - 86400000).toISOString(), endAt = new Date(Date.now() + 86400000).toISOString();
  const campaigns = Array.from({ length: 12 }, (_, index) => ({
    id: `game-${index}`, name: `Campaign ${index}`, status: 'ACTIVE', startAt, endAt,
    game: { name: `Game ${String(index + 1).padStart(2, '0')}`, displayName: `Game ${String(index + 1).padStart(2, '0')}` },
    timeBasedDrops: [{ id: `reward-${index}`, name: `Reward ${index}`, requiredMinutesWatched: 60, self: { currentMinutesWatched: 0, isClaimed: false } }],
  }));
  await page.setViewportSize({ width: 360, height: 900 });
  await page.evaluate(campaigns => {
    const t = window.__dropperTest; t.configure(null, campaigns); t.setStrategy('priority'); t.refresh(); window.dropperShow();
    const root = document.getElementById('tdh-root').shadowRoot;
    if (root.getElementById('tdh-drops-body').classList.contains('fl-tool-hidden')) root.querySelector('[data-panel="tdh-drops-body"]').click();
  }, campaigns);
  await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
  const picker = page.getByLabel('Priority position for Game 12', { exact: true });
  assert.equal(await page.locator('.campaign-priority-position option').count(), 12, 'inactive pickers keep only their current position');
  await picker.focus();
  assert.equal(await picker.locator('option').count(), 12);
  assert.equal(await page.evaluate(() => {
    const root = document.getElementById('tdh-root').shadowRoot, active = root.activeElement;
    window.__dropperTest.refresh();
    return active.isConnected && active === root.activeElement;
  }), true, 'background refresh preserves the active native picker');
  await picker.selectOption('1');
  const names = () => page.locator('.campaign-game-name').allTextContents();
  assert.deepEqual(await names(), ['Game 12', ...Array.from({ length: 11 }, (_, index) => `Game ${String(index + 1).padStart(2, '0')}`)]);
  assert.equal(await picker.evaluate(node => node.getRootNode().activeElement === node), true, 'focus follows the moved game');
  await picker.press('End');
  assert.equal(await picker.inputValue(), '12');
  assert.deepEqual(await names(), Array.from({ length: 12 }, (_, index) => `Game ${String(index + 1).padStart(2, '0')}`));
  await picker.press('Home');
  assert.equal(await picker.inputValue(), '1');
  await picker.press('Tab');
  assert.equal(await picker.evaluate(node => node.getRootNode().activeElement !== node), true, 'Tab leaves the picker normally');
  assert.equal(await picker.locator('option').count(), 1, 'blur releases unused options');
  const layout = await page.locator('#tdh-open-campaigns').evaluate(node => {
    const select = node.querySelector('.campaign-priority-position'), rect = select.getBoundingClientRect();
    return { overflow: node.scrollWidth - node.clientWidth, height: rect.height, left: rect.left, right: rect.right };
  });
  assert.ok(layout.overflow <= 1 && layout.left >= 0 && layout.right <= 360, JSON.stringify(layout));
  assert.ok(layout.height >= 36, 'position control has a usable target');
}));

test('choosing a priority position also moves an earning Dropper right away', async () => orderFixture(async page => {
  const moved = await page.evaluate(() => {
    const t = window.__dropperTest, games = window.__campaigns.map(item => ({ game: item.game.name }));
    t.setPriorityPosition('Charlie', 1, games);
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

// Update checks come from exp-core's release checker: one small GitHub release lookup, never the script from main.
const releaseFixture = (responder, run) => fixture(async page => {
  await page.evaluate(() => {
    window.__updateRequests = [];
  });
  await page.evaluate(source => {
    window.GM_xmlhttpRequest = details => {
      window.__updateRequests.push(details.url);
      queueMicrotask(() => { const reply = new Function('details', 'return (' + source + ')(details)')(details); (reply.error ? details.onerror : details.onload)?.(reply); });
      return { abort() {} };
    };
  }, responder.toString());
  await run(page);
});
const launcherHasUpdate = page => page.evaluate(() => Boolean(document.getElementById('tdh-root').shadowRoot.querySelector('.launcher, [data-exp-part="launcher"]')?.classList.contains('update-available')));

test('a newer GitHub release is reported through exp-core and marks the launcher', async () => releaseFixture(
  () => ({ status: 200, responseText: JSON.stringify({ tag_name: 'v99.0.0', body: '## 99.0.0\n\n- First highlight\n- Second highlight\n' }) }),
  async page => {
    await page.evaluate(() => window.__dropperTest.checkUpdates(true));
    await page.waitForFunction(() => window.__dropperTest.updateState().availableVersion === '99.0.0');
    await page.waitForFunction(() => document.getElementById('tdh-root').shadowRoot.querySelector('.launcher, [data-exp-part="launcher"]')?.classList.contains('update-available'));
    const requests = await page.evaluate(() => window.__updateRequests);
    assert.deepEqual(requests, ['https://api.github.com/repos/ExtraPotions/Dropper/releases/latest'], 'one release lookup, not a download of the script from main');
    assert.equal(await launcherHasUpdate(page), true);
    const state = await page.evaluate(() => window.__dropperTest.updateState());
    assert.equal(state.lastRemoteVersion, '99.0.0');
    assert.equal(state.lastHttpStatus, 200);
  }));

test('a release that is not newer leaves Dropper up to date', async () => releaseFixture(
  () => ({ status: 200, responseText: JSON.stringify({ tag_name: 'v1.0.0', body: '## 1.0.0\n\n- Old\n' }) }),
  async page => {
    await page.evaluate(() => window.__dropperTest.checkUpdates(true));
    await page.waitForFunction(() => window.__dropperTest.updateState().lastRemoteVersion === '1.0.0');
    const state = await page.evaluate(() => window.__dropperTest.updateState());
    assert.equal(state.availableVersion, '');
    assert.equal(await launcherHasUpdate(page), false);
  }));

test('a failed release lookup is recorded quietly and never claims an update', async () => releaseFixture(
  () => ({ status: 500, responseText: '{}' }),
  async page => {
    await page.evaluate(() => window.__dropperTest.checkUpdates(true));
    await page.waitForFunction(() => window.__dropperTest.updateState().lastError !== '');
    const state = await page.evaluate(() => window.__dropperTest.updateState());
    assert.equal(state.availableVersion, '');
    assert.notEqual(state.lastError, '');
    assert.equal(await launcherHasUpdate(page), false);
  }));

// The launcher sits at the bottom of Dropper's row when the launchers are anchored at the bottom and at the top of
// the row when anchored at the top, so the progress card never ends up above the edge of the window.
test('the progress card stays fully inside the window wherever the launchers are dragged', async () => fixture(async page => {
  const d = data();
  await page.evaluate(({ drop, campaigns }) => { window.__dropperTest.configure(drop, campaigns); window.__dropperTest.refresh(); window.dropperShow(); }, d);
  for (const [delta, anchor] of [['0', 'bottom'], ['-300', 'bottom'], ['-600', 'top'], ['-5000', 'top']]) {
    await page.evaluate(value => {
      localStorage.setItem('exp:v3:launcher-grid-delta', value);
      document.dispatchEvent(new CustomEvent('exp-core:coordination', { detail: { type: 'launcher-grid-moved' } }));
    }, delta);
    await page.waitForFunction(expected => document.documentElement.dataset.expLauncherAnchor === expected, anchor);
    await page.waitForTimeout(250);
    const geo = await page.evaluate(() => {
      const root = document.getElementById('tdh-root').shadowRoot;
      const box = node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
      return { row: box(root.querySelector('.badge-row')), launcher: box(root.getElementById('tdh-settings-launcher')), card: box(root.querySelector('#tdh-drop-card')), viewport: innerHeight };
    });
    const detail = `${anchor} anchor at delta ${delta}: ${JSON.stringify(geo)}`;
    assert.ok(geo.row.top >= 7 && geo.row.bottom <= geo.viewport - 7, `the launcher row stays inside the window. ${detail}`);
    if (geo.card.height > 0) assert.ok(geo.card.top >= 7 && geo.card.bottom <= geo.viewport - 7, `the progress card stays inside the window. ${detail}`);
    if (anchor === 'top') assert.ok(Math.abs(geo.launcher.top - geo.row.top) <= 1, `anchored at the top, the launcher is at the top of the row. ${detail}`);
    else assert.ok(Math.abs(geo.launcher.bottom - geo.row.bottom) <= 1, `anchored at the bottom, the launcher is at the bottom of the row. ${detail}`);
  }
}));


test('custom Dropper menu delegates outside closing, select protection and deadline enforcement to Core', async () => fixture(async page => {
  await page.evaluate(() => window.__dropperTest.setMenuOpen(true, false));
  let state = await page.evaluate(() => window.__dropperTest.menuState());
  assert.equal(state.open, true); assert.equal(state.coreOpen, true); assert.equal(state.timer, true);
  assert.ok(state.dismissAt > Date.now());
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  assert.equal((await page.evaluate(() => window.__dropperTest.menuState())).open, true, 'synthetic outside events do not dismiss');
  await page.evaluate(() => {
    const root = document.getElementById('tdh-root').shadowRoot;
    const select = document.createElement('select'); select.id = 'fixture-native-select';
    select.innerHTML = '<option>One</option><option>Two</option>';
    root.getElementById('tdh-tools-dock').append(select); select.focus();
  });
  await page.mouse.click(20, 800);
  assert.equal((await page.evaluate(() => window.__dropperTest.menuState())).open, true, 'native select focus protects outside presses');
  await page.evaluate(() => document.getElementById('tdh-root').shadowRoot.getElementById('fixture-native-select').blur());
  await page.mouse.click(20, 800);
  state = await page.evaluate(() => window.__dropperTest.menuState());
  assert.equal(state.open, false); assert.equal(state.coreOpen, false); assert.equal(state.timer, false);
  const deadline = await page.evaluate(() => {
    const t = window.__dropperTest; t.setMenuOpen(true, false);
    return t.menuState().dismissAt;
  });
  assert.equal(await page.evaluate(time => window.__dropperTest.enforceMenuAt(time), deadline), true);
  assert.equal((await page.evaluate(() => window.__dropperTest.menuState())).open, false);
}));

test('custom Dropper menu yields suite ownership without replacing progress geometry', async () => fixture(async page => {
  for (const mode of [360, 596, 1280]) {
    await page.setViewportSize({ width: mode, height: 900 });
    await page.evaluate(mode => { const t=window.__dropperTest; t.relayout(); t.setMenuOpen(true, false); }, mode);
    const before = await page.evaluate(() => {
      const root=document.getElementById('tdh-root').shadowRoot;
      const dock=root.getElementById('tdh-tools-dock');
      window.__menuNodeBefore=dock;
      return { width:dock.getBoundingClientRect().width, owner:document.documentElement.getAttribute('data-exp-open-menu') };
    });
    assert.equal(before.owner, 'dropper');
    const result = await page.evaluate(() => {
      document.documentElement.setAttribute('data-exp-open-menu','shift');
      document.dispatchEvent(new Event('exp-core:menu-open'));
      const t=window.__dropperTest; const closed=t.menuState(); t.setMenuOpen(true,false);
      const dock=document.getElementById('tdh-root').shadowRoot.getElementById('tdh-tools-dock');
      return { closed, sameNode: dock === window.__menuNodeBefore, width:dock.getBoundingClientRect().width, owner:document.documentElement.getAttribute('data-exp-open-menu') };
    });
    assert.equal(result.closed.open, false); assert.equal(result.closed.coreOpen, false);
    assert.equal(result.sameNode, true); assert.equal(result.width,before.width);
    assert.equal(result.owner,'dropper');
  }
}));

// The 2026-10 review opened twitch.tv/directory in a new tab and Dropper moved it to a stream with no click.
test('a newly opened Twitch tab is left where it is until the viewer chooses it for automatic switching', async () => fixture(async page => {
  const before = await page.evaluate(() => {
    const t = window.__dropperTest; t.setFindNext(true); t.sync();
    const allowed = t.navigation('automatic-routing'); t.refreshHealth();
    const root = document.getElementById('tdh-root').shadowRoot;
    return { allowed, automationTab: t.automationTab(), offer: !root.getElementById('tdh-allow-switching').hidden, status: root.getElementById('tdh-viewing-status').textContent };
  });
  assert.equal(before.allowed, false, 'a browsing tab is not navigated: ' + JSON.stringify(before));
  assert.equal(before.automationTab, false);
  assert.equal(before.offer, true, 'the tab offers Use Automatic Switching: ' + JSON.stringify(before));
  assert.match(before.status, /this tab/i);
  const after = await page.evaluate(() => {
    const t = window.__dropperTest;
    document.getElementById('tdh-root').shadowRoot.getElementById('tdh-allow-switching').click();
    return { allowed: t.navigation('automatic-routing'), automationTab: t.automationTab() };
  });
  assert.deepEqual(after, { allowed: true, automationTab: true });
  // The choice belongs to this tab and survives Dropper's own navigation (a new document in the same tab).
  await page.reload();
  await page.addScriptTag({ content: exposed });
  await page.waitForFunction(() => !!window.__dropperTest);
  assert.equal(await page.evaluate(() => { const t = window.__dropperTest; t.setGql(async () => []); t.setFindNext(true); t.sync(); return t.automationTab() && t.navigation('automatic-routing'); }), true);
}, '/directory'));

// Measured in the 2026-10 review at 1394 x 295: the closed card covered 11% of the player controls and 27% of the stream info.
const SHORT_PLAYER = '<div data-a-target="player-controls" style="position:fixed;left:240px;top:145px;width:1139px;height:40px"></div><div id="live-channel-stream-information" style="position:fixed;left:240px;top:185px;width:1139px;height:107px"></div>';
const cardState = page => page.evaluate(() => { window.__dropperTest.relayout(); const card = document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card'); return { presentation: card.dataset.presentation, badgeOnly: window.__dropperTest.badgeOnly() }; });
test('repositioned progress clears every suite launcher in either injection order', async () => fixture(async page => {
  const core = fs.readFileSync(path.join(__dirname, '../vendor/exp-core/exp-core.js'), 'utf8');
  // PRISMA opts out of the flyout protocol, so the page keeps the launcher grid this test measures.
  const companions = ['shift', 'prisma'].map(id => `(()=>{${core}; ExtraPotionsCore.createProduct({id:'${id}',name:'${id}',version:'1.0.0',artwork:'https://example.invalid/icon.svg',getSettings:()=>({}),sections:[]});${id === 'prisma' ? `document.querySelector('[data-product-id="prisma"]').removeAttribute('data-exp-flyout');` : ''}})();`);
  for (const companionsFirst of [false, true]) {
    if (companionsFirst) await page.reload();
    for (const content of companions) await page.addScriptTag({ content });
    if (companionsFirst) await page.addScriptTag({ content: exposed });
    await page.waitForFunction(() => document.querySelectorAll('[data-exp-product-launcher="1"]').length === 3 && !!window.__dropperTest);
    await page.evaluate(() => window.__dropperTest.setGql(async () => []));
    for (const viewport of [{ width:561, height:810 }, { width:390, height:650 }, { width:1394, height:295 }]) {
      await page.setViewportSize(viewport);
      for (const delta of [0, -110, -(viewport.height - 120)]) {
        await page.evaluate(value => {
          localStorage.setItem('exp:v3:launcher-grid-delta', String(value));
          document.dispatchEvent(new CustomEvent('exp-core:coordination', { detail:{type:'launcher-grid-moved'} }));
        }, delta);
        await page.waitForTimeout(100);
        const facts = await page.evaluate(() => {
          window.__dropperTest.relayout();
          const card = document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card');
          const box = node => { const r=node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
          const r = box(card);
          const launchers = [...document.querySelectorAll('[data-exp-product-launcher="1"]')].map(host => ({product:host.dataset.productId, ...box(host.shadowRoot.querySelector('[data-exp-part="launcher"]'))}));
          return { card:r, presentation:card.dataset.presentation, launchers, overlaps:launchers.filter(b=>b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top), contained:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight };
        });
        assert.equal(facts.presentation, 'page-card');
        assert.ok(facts.card.width && facts.card.height && facts.contained, JSON.stringify(facts));
        assert.deepEqual(facts.overlaps, [], `companionsFirst=${companionsFirst}, delta=${delta}: ${JSON.stringify(facts)}`);
        if (viewport.width === 561 && delta === 0) {
          for (const { product } of facts.launchers) {
            const launcher = page.locator(`[data-exp-product-launcher="1"][data-product-id="${product}"] [data-exp-part="launcher"]`);
            await launcher.click();
            assert.equal(await launcher.getAttribute('aria-expanded'), 'true');
            await launcher.click();
            assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
          }
        }
      }
    }
  }
}, '/whithblade', { viewport:{width:561,height:810}, extra:'<div class="player-controls" style="position:fixed;left:0;top:0;width:calc(100vw - 64px);height:100vh"></div>' }));
test('the closed progress card stays visible without covering Twitch player controls', async () => fixture(async page => {
  await page.waitForTimeout(100);
  const state = await cardState(page);
  assert.deepEqual(state, { presentation: 'page-card', badgeOnly: false }, 'the card stays on the page without changing the saved preference');
  const covered = await page.evaluate(() => {
    const card = document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card').getBoundingClientRect();
    return [...document.querySelectorAll('[data-a-target="player-controls"],#live-channel-stream-information')].some(node => { const r = node.getBoundingClientRect(); return card.width && r.left < card.right && r.right > card.left && r.top < card.bottom && r.bottom > card.top; });
  });
  assert.equal(covered, false);
}, '/whithblade', { viewport: { width: 1394, height: 295 }, extra: SHORT_PLAYER }));
test('the closed progress card stays beside the launcher when it covers nothing', async () => fixture(async page => {
  await page.waitForTimeout(100);
  assert.deepEqual(await cardState(page), { presentation: 'page-card', badgeOnly: false });
}, '/whithblade'));

test('with Badge Only off progress stays on the page through menu open and dismissal on the reported narrow viewport', async () => fixture(async page => {
  await page.evaluate(() => window.__dropperTest.setMenuOpen(true));
  assert.equal((await cardState(page)).presentation, 'page-card');
  await page.evaluate(() => { const t = window.__dropperTest; t.enforceMenuAt(t.menuState().dismissAt + 1); });
  assert.deepEqual(await cardState(page), { presentation: 'page-card', badgeOnly: false });
  const facts = await page.evaluate(() => {
    const card = document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card');
    const r = card.getBoundingClientRect();
    return { width:r.width, height:r.height, visible:getComputedStyle(card).display !== 'none', contained:r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
  });
  assert.ok(facts.visible && facts.width > 0 && facts.height > 0 && facts.contained, JSON.stringify(facts));
  await page.setViewportSize({ width: 390, height: 650 });
  assert.equal((await cardState(page)).presentation, 'page-card');
}, '/whithblade', { viewport: { width: 561, height: 810 }, extra: '<div class="player-controls" style="position:fixed;left:0;top:650px;width:561px;height:50px"></div>' }));
// Measured in the 2026-10 review at 909 x 295: the progress header pushed the section subtabs below the menu's edge.
test('in a short window the open menu keeps its section tabs in view and shows Badge Only progress as one row', async () => fixture(async page => {
  await page.evaluate(() => { document.getElementById('tdh-root').shadowRoot.getElementById('tdh-badge-only').click(); window.__dropperTest.setMenuOpen(true); });
  await page.waitForTimeout(150);
  const facts = await page.evaluate(() => {
    const root = document.getElementById('tdh-root').shadowRoot, dock = root.querySelector('[data-exp-part="dock"],#mb-dock,.dock') || root.getElementById('tdh-rail');
    const panel = dock.getBoundingClientRect(), visibleSub = [...root.querySelectorAll('.exp-submenu-tablist')].find(node => node.getClientRects().length), tabs = (visibleSub || root.querySelector('.exp-section-tabs')).getBoundingClientRect();
    const card = root.getElementById('tdh-drop-card');
    const box = n => { const r = n?.getBoundingClientRect(); return r ? [Math.round(r.top), Math.round(r.bottom)] : null; };
    const layout = { panel: box(dock), header: box(root.querySelector('.rail-header,.header,[data-exp-part="header"]')), card: box(card), section: box(root.querySelector('.exp-section-tabs')), sub: box(visibleSub), scrollTop: dock.scrollTop, scrollHeight: dock.scrollHeight, dockTag: dock.id || dock.className };
    return { layout, tabsBottom: tabs.bottom, panelBottom: panel.bottom, reward: getComputedStyle(card.querySelector('.progress-reward-row')).display, percent: getComputedStyle(card.querySelector('.drop-percent')).display };
  });
  assert.ok(facts.tabsBottom <= facts.panelBottom, 'section and subsection tabs are inside the menu: ' + JSON.stringify(facts));
  assert.equal(facts.reward, 'none', 'detail rows give way: ' + JSON.stringify(facts));
  assert.notEqual(facts.percent, 'none', 'the percentage stays: ' + JSON.stringify(facts));
}, '/directory/category/albion-online', { viewport: { width: 909, height: 295 } }));

test('a newer tab chosen for automatic switching takes over from an older browsing tab', async () => fixture(async (page, context) => {
  await page.evaluate(() => window.__dropperTest.publish());
  const second = await context.newPage();
  await second.goto('https://www.twitch.tv/chosen_channel');
  await second.addScriptTag({ content: exposed });
  await second.waitForFunction(() => !!window.__dropperTest && !!document.getElementById('tdh-root')?.shadowRoot);
  await second.evaluate(() => { const t = window.__dropperTest; t.setGql(async () => []); t.setFindNext(true); document.getElementById('tdh-root').shadowRoot.getElementById('tdh-allow-switching').click(); t.publish(); });
  await page.evaluate(() => window.__dropperTest.publish());
  // Navigation itself is covered above; this page has no stubbed video, so only the controller role is compared.
  const roles = { older: await page.evaluate(() => window.__dropperTest.controller()), chosen: await second.evaluate(() => window.__dropperTest.automationTab() && window.__dropperTest.controller()) };
  assert.deepEqual(roles, { older: false, chosen: true });
}, '/directory'));

test('after the update, a tab that was already switching streams keeps doing so', async () => fixture(async page => {
  await page.evaluate(() => { const t = window.__dropperTest; t.setRouting({ state: 'earning', targetGame: 'Fixture game', targetStream: 'chosen_channel' }); });
  await page.reload();
  await page.addScriptTag({ content: exposed });
  await page.waitForFunction(() => !!window.__dropperTest);
  assert.equal(await page.evaluate(() => window.__dropperTest.automationTab()), true);
}));

test('choosing a tab that already has a window name still turns automatic switching on', async () => fixture(async page => {
  const after = await page.evaluate(() => {
    const t = window.__dropperTest; window.name = 'viewer-window'; t.setFindNext(true); t.sync();
    document.getElementById('tdh-root').shadowRoot.getElementById('tdh-allow-switching').click();
    return { allowed: t.navigation('automatic-routing'), automationTab: t.automationTab() };
  });
  assert.deepEqual(after, { allowed: true, automationTab: true });
}, '/directory'));

test('a tab opened from a switching tab is not adopted after the update', async () => fixture(async (page, context) => {
  await page.evaluate(() => window.__dropperTest.setRouting({ state: 'earning', targetGame: 'Fixture game', targetStream: 'chosen_channel' }));
  const [popup] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => { window.open('https://www.twitch.tv/directory', '_blank'); })]);
  await popup.waitForLoadState();
  await popup.addScriptTag({ content: exposed });
  await popup.waitForFunction(() => !!window.__dropperTest);
  const copied = await popup.evaluate(() => Object.keys(sessionStorage).length > 0);
  assert.equal(copied, true, 'the browser copied the opener tab\'s session state, which is the case under test');
  assert.equal(await popup.evaluate(() => window.__dropperTest.automationTab()), false);
}));

test('the progress card returns beside the launcher when the window grows again', async () => fixture(async page => {
  await page.waitForTimeout(100);
  assert.equal((await cardState(page)).presentation, 'page-card');
  assert.equal(await page.evaluate(() => document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card').style.position), 'fixed');
  // Only the page's own resize handling runs here, as when the viewer enlarges the window.
  await page.setViewportSize({ width: 1879, height: 885 });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card').dataset.presentation), 'page-card');
  assert.equal(await page.evaluate(() => document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card').style.position), '');
}, '/whithblade', { viewport: { width: 1394, height: 295 }, extra: SHORT_PLAYER }));
