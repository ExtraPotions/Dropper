'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { loadDropperSource } = require('./load-source.cjs');
const source = loadDropperSource();

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeGameName = (value) => cleanText(value)
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

function ignoredStateContext() {
  const storage = new Map();
  const start = source.indexOf('  function campaignGameName');
  const end = source.indexOf('\n  function campaignMemoryResetMarker', start);
  assert.notEqual(start, -1, 'ignored-game state helpers are present');
  assert.notEqual(end, -1, 'ignored-game state helper block is complete');

  const context = {
    IGNORED_CAMPAIGN_GAMES_KEY: 'ignored-games-test',
    cleanText,
    normalizeGameName,
    scopedLocalStorageKey: (key) => `${key}:account:test-user`,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  vm.runInNewContext(
    `let ignoredCampaignGames = { updatedAt: 0, games: {} };\n${source.slice(start, end)}\n` +
    'this.api = {' +
      'load: loadIgnoredCampaignGames,' +
      'set: setCampaignGameIgnored,' +
      'prune: pruneIgnoredCampaignGames,' +
      'isIgnored: campaignGameIsIgnored,' +
      'state: () => ignoredCampaignGames,' +
      'replace: (next) => { ignoredCampaignGames = next; }' +
    '};',
    context,
  );
  return { api: context.api, storage };
}

test('ignored games persist per account and expire at their campaign end date', () => {
  const { api, storage } = ignoredStateContext();
  const now = Date.parse('2026-09-24T12:00:00Z');
  const end = Date.parse('2026-10-01T00:00:00Z');

  assert.equal(api.set('Example Game', end, true, now), true);
  assert.equal(api.isIgnored({ game: 'Example Game' }, now), true);
  assert.equal(api.state().games['example game'].expiresAt, end);
  assert.ok(storage.has('ignored-games-test:account:test-user'));

  api.prune(end + 1);
  assert.equal(api.isIgnored({ game: 'Example Game' }, end + 1), false);
  assert.deepEqual(Object.keys(api.state().games), []);
});

test('a refresh can extend an ignored game but never shortens it', () => {
  const { api } = ignoredStateContext();
  const now = Date.parse('2026-09-24T12:00:00Z');
  const firstEnd = Date.parse('2026-10-01T00:00:00Z');
  const laterEnd = Date.parse('2026-10-08T00:00:00Z');

  api.set('Example Game', laterEnd, true, now);
  api.set('Example Game', firstEnd, true, now + 1000);
  assert.equal(api.state().games['example game'].expiresAt, laterEnd);
});

test('open campaign games are grouped and ignored expiry follows the latest campaign', () => {
  const start = source.indexOf('  function listOpenCampaignGames');
  const end = source.indexOf('\n  function campaignQueueTriplet', start);
  assert.notEqual(start, -1, 'open-campaign game list helper is present');
  assert.notEqual(end, -1, 'open-campaign game list helper block is complete');

  const now = Date.parse('2026-09-24T12:00:00Z');
  const firstEnd = Date.parse('2026-10-01T00:00:00Z');
  const laterEnd = Date.parse('2026-10-08T00:00:00Z');
  const context = {
    cleanText,
    normalizeGameName,
    campaignGameName: (campaign) => cleanText(campaign?.game?.displayName || campaign?.game?.name || campaign?.game),
    ignoredCampaignGameKey: normalizeGameName,
    campaignKey: (campaign) => cleanText(campaign?.id).toLowerCase(),
    campaignRoutingState: (campaign, at, options) => {
      assert.equal(options.ignoreCompletion, true);
      assert.equal(options.ignoreUserPreference, true);
      const startMs = Date.parse(campaign.startAt || '') || 0;
      const endMs = Date.parse(campaign.endAt || '') || 0;
      return {
        open: Boolean(startMs && endMs && startMs <= at && endMs > at),
        endMs,
        endAt: campaign.endAt || '',
      };
    },
    pruneIgnoredCampaignGames: () => false,
    saveIgnoredCampaignGames: () => {},
  };
  vm.runInNewContext(
    `let ignoredCampaignGames = { updatedAt: 0, games: { 'example game': { game: 'Example Game', expiresAt: ${firstEnd}, ignoredAt: ${now} } } };\n` +
    `${source.slice(start, end)}\n` +
    'this.api = {' +
      'list: listOpenCampaignGames,' +
      'reconcile: reconcileIgnoredCampaignGames,' +
      'state: () => ignoredCampaignGames' +
    '};',
    context,
  );

  const campaigns = [
    { id: 'one', name: 'First Campaign', status: 'ACTIVE', startAt: '2026-09-01T00:00:00Z', endAt: '2026-10-01T00:00:00Z', game: { displayName: 'Example Game' } },
    { id: 'two', name: 'Second Campaign', status: 'ACTIVE', startAt: '2026-09-20T00:00:00Z', endAt: '2026-10-08T00:00:00Z', game: { displayName: 'Example Game' } },
    { id: 'expired', name: 'Old Campaign', status: 'ACTIVE', startAt: '2026-08-01T00:00:00Z', endAt: '2026-09-01T00:00:00Z', game: { displayName: 'Old Game' } },
  ];
  const games = context.api.list(campaigns, now);
  assert.equal(games.length, 1);
  assert.equal(games[0].game, 'Example Game');
  assert.equal(games[0].campaignCount, 2);
  assert.equal(games[0].latestEndMs, laterEnd);

  context.api.reconcile(games, now);
  assert.equal(context.api.state().games['example game'].expiresAt, laterEnd);
});

test('routing treats an ignored game as ineligible while campaign management can still list it', () => {
  const start = source.indexOf('  function campaignRoutingWindow');
  const end = source.indexOf('\n  function campaignMemoryRoutingState', start);
  assert.notEqual(start, -1, 'campaign routing state helper is present');
  assert.notEqual(end, -1, 'campaign routing state helper block is complete');

  const context = {
    cleanText,
    campaignIsExcluded: () => false,
    campaignGameIsIgnored: () => true,
    campaignMarkedComplete: () => false,
  };
  vm.runInNewContext(
    `${source.slice(start, end)}\nthis.routeState = campaignRoutingState;`,
    context,
  );
  const campaign = {
    id: 'open',
    status: 'ACTIVE',
    startAt: '2026-09-01T00:00:00Z',
    endAt: '2026-10-01T00:00:00Z',
    game: { displayName: 'Example Game' },
  };
  const now = Date.parse('2026-09-24T12:00:00Z');

  assert.equal(context.routeState(campaign, now).reason, 'ignored-game');
  assert.equal(context.routeState(campaign, now).open, false);
  assert.equal(context.routeState(campaign, now, { ignoreUserPreference: true }).open, true);
});

test('Drops menu exposes an automatically refreshed ignored-game checklist', () => {
  assert.match(source, /id="tdh-open-campaigns"/u);
  assert.match(source, /id="tdh-open-campaign-list"/u);
  assert.match(source, /role", "checkbox"/u);
  assert.match(source, /queueGqlPollSoon\("open-campaign-list", 0\)/u);
  assert.match(source, /refreshOpenCampaignList\(\);/u);
  assert.match(source, /campaignGameIsIgnored\(currentDrop, now\)/u);
});
