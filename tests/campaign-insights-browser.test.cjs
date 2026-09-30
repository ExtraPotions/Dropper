'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const installPath = path.join(__dirname, '..', 'dropper.user.js');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function campaignFixture(now) {
  const drop = (id, name, required, current, extra = {}) => ({
    id,
    name,
    requiredMinutesWatched: required,
    benefitEdges: [{ benefit: { id: `benefit-${id}`, name } }],
    self: { currentMinutesWatched: current, isClaimed: false },
    ...extra,
  });
  const campaign = (id, name, game, startAt, endAt, drops) => ({
    id,
    name,
    status: 'ACTIVE',
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(endAt).toISOString(),
    game: { id: `game-${id}`, name: game, displayName: game, slug: game.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
    timeBasedDrops: drops,
  });
  return [
    campaign('c1', 'Alpha Rewards', 'Alpha Quest', now - DAY, now + 2 * DAY, [drop('d1', 'Alpha Hat', 120, 20)]),
    campaign('c2', 'Beta Rewards', 'Beta Arena', now - DAY, now + 5 * DAY, [
      drop('d2', 'Beta Skin', 60, 0),
      drop('d3', 'Beta Sub Emote', 0, 0, { requiredSubs: 2 }),
    ]),
    // Ended six days ago, fully earned, never claimed.
    campaign('c3', 'Gamma Rewards', 'Gamma Grid', now - 20 * DAY, now - 6 * DAY, [drop('d4', 'Gamma Badge', 30, 30)]),
  ];
}

test('the campaign list shows the planner and subscription rewards, and unclaimed rewards get their own panel', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 420, height: 1000 } });
  await page.route('**/*', (route) => (route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><main>Insights fixture</main></body></html>' })
    : route.abort()));
  const now = Date.now();
  await page.addInitScript(({ campaigns, at }) => {
    window.GM_xmlhttpRequest = () => {};
    sessionStorage.setItem('dropper-campaign-catalog:account:signed-out', JSON.stringify({ at, campaigns }));
  }, { campaigns: campaignFixture(now), at: now });
  await page.goto('https://www.twitch.tv/insights-fixture');
  await page.addScriptTag({ content: fs.readFileSync(installPath, 'utf8') });
  const host = page.locator('#tdh-root');
  await host.waitFor({ state: 'attached' });
  await host.evaluate((node) => {
    const shadow = node.shadowRoot;
    shadow.querySelector('#tdh-settings-launcher').click();
    shadow.querySelector('.fl-tool-header[data-panel="tdh-drops-body"]').click();
    shadow.querySelector('#tdh-open-campaigns').open = true;
    shadow.querySelector('#tdh-claim-history-panel').open = true;
  });
  await page.waitForFunction(() => document.querySelector('#tdh-root')?.shadowRoot?.querySelector('#tdh-campaign-planner'), null, { timeout: 15000 });
  const facts = await host.evaluate((node) => {
    const shadow = node.shadowRoot;
    const unclaimed = shadow.querySelector('#tdh-unclaimed-panel');
    return {
      planner: shadow.querySelector('#tdh-campaign-planner')?.textContent || '',
      games: [...shadow.querySelectorAll('.campaign-game-name')].map((item) => item.textContent),
      metas: [...shadow.querySelectorAll('.campaign-game-meta')].map((item) => item.textContent),
      unclaimedHidden: unclaimed?.hidden,
      unclaimedInsideHistory: Boolean(shadow.querySelector('#tdh-claim-history-panel #tdh-unclaimed-panel')),
      badgeHidden: shadow.querySelector('#tdh-unclaimed-summary')?.hidden,
      unclaimedRows: [...shadow.querySelectorAll('#tdh-unclaimed-list .campaign-manager-note')].map((item) => item.textContent),
      unclaimedCount: shadow.querySelector('#tdh-unclaimed-summary')?.textContent,
    };
  });

  assert.match(facts.planner, /^Planner: about 2h 40m of watching left · 2 open campaigns · first ends in 2d 0h$/u, facts.planner);
  assert.deepEqual(facts.games.sort(), ['Alpha Quest', 'Beta Arena']);
  const beta = facts.metas.find((meta) => meta.includes('subscription'));
  assert.ok(beta && /1 subscription reward \(up to 2 subs\)/u.test(beta), JSON.stringify(facts.metas));
  assert.equal(facts.metas.filter((meta) => meta.includes('subscription')).length, 1, 'only the game with a subscription reward mentions it');
  assert.equal(facts.unclaimedHidden, false);
  assert.equal(facts.unclaimedInsideHistory, true, 'unclaimed rewards share the Claim History row');
  assert.equal(facts.badgeHidden, false);
  assert.equal(facts.unclaimedCount, '1 unclaimed');
  assert.match(facts.unclaimedRows[0], /^Gamma Badge · Gamma Grid · campaign ended 6d 0h ago · claim soon$/u);
  assert.match(facts.unclaimedRows.at(-1), /Drops Inventory/u);
});

test('with no campaigns the insights stay out of the way', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.route('**/*', (route) => (route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><main>Empty fixture</main></body></html>' })
    : route.abort()));
  await page.addInitScript(() => { window.GM_xmlhttpRequest = () => {}; });
  await page.goto('https://www.twitch.tv/insights-empty');
  await page.addScriptTag({ content: fs.readFileSync(installPath, 'utf8') });
  const host = page.locator('#tdh-root');
  await host.waitFor({ state: 'attached' });
  await host.evaluate((node) => {
    const shadow = node.shadowRoot;
    shadow.querySelector('#tdh-settings-launcher').click();
    shadow.querySelector('.fl-tool-header[data-panel="tdh-drops-body"]').click();
    shadow.querySelector('#tdh-open-campaigns').open = true;
  });
  await page.waitForTimeout(1500);
  const facts = await host.evaluate((node) => ({
    planner: Boolean(node.shadowRoot.querySelector('#tdh-campaign-planner')),
    unclaimedHidden: node.shadowRoot.querySelector('#tdh-unclaimed-panel')?.hidden,
    badgeHidden: node.shadowRoot.querySelector('#tdh-unclaimed-summary')?.hidden,
  }));
  assert.deepEqual(facts, { planner: false, unclaimedHidden: true, badgeHidden: true });
});
