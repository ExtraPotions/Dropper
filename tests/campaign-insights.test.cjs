'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const partPath = path.join(root, 'src', 'parts', '06-campaign-insights.js');

function loadInsights() {
  const context = {};
  vm.runInNewContext(
    `${fs.readFileSync(partPath, 'utf8')}
     this.api = { insightsSpan, summarizeCampaignPlan, campaignPlanText, subscriptionRewardsByGame,
       subscriptionRewardText, unclaimedRewards, unclaimedRewardLine };`,
    context,
  );
  return context.api;
}

const api = loadInsights();
// The module runs in its own realm, so compare plain copies of its objects.
const plain = (value) => JSON.parse(JSON.stringify(value));
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-29T12:00:00Z');

test('spans read as days, hours, or minutes', () => {
  assert.equal(api.insightsSpan(12), '12m');
  assert.equal(api.insightsSpan(310), '5h 10m');
  assert.equal(api.insightsSpan(3 * 1440 + 5 * 60 + 40), '3d 5h');
  assert.equal(api.insightsSpan(-5), '0m');
  assert.equal(api.insightsSpan(undefined), '0m');
});

test('the planner adds up known watch time, skips ignored games, and counts risk and unknowns', () => {
  const queue = [
    { game: 'Alpha', endMs: NOW + 2 * DAY, sequenceRemainingMinutes: 120, sequenceFinishable: true },
    { game: 'Beta', endMs: NOW + 1 * DAY, sequenceRemainingMinutes: 600, sequenceFinishable: false },
    { game: 'Gamma', endMs: NOW + 3 * DAY, sequenceRemainingMinutes: null, sequenceFinishable: null },
    { game: 'Ignored', endMs: NOW + 1000, sequenceRemainingMinutes: 5000, sequenceFinishable: false },
    { game: 'NoDate', endMs: Number.MAX_SAFE_INTEGER, sequenceRemainingMinutes: 30, sequenceFinishable: null },
  ];
  const summary = api.summarizeCampaignPlan(queue, { isIgnored: (game) => game === 'Ignored', now: NOW });
  assert.deepEqual(plain(summary), {
    campaigns: 4,
    games: 4,
    remainingMinutes: 750,
    unknown: 1,
    atRisk: 1,
    earliestEndMs: NOW + 1 * DAY,
  });
  assert.equal(
    api.campaignPlanText(summary, NOW),
    'Planner: about 12h 30m of watching left · 4 open campaigns · first ends in 1d 0h · 1 may not finish in time · 1 without a known time',
  );
});

test('the planner says so when no watch time is known, and stays silent with nothing open', () => {
  const unknownOnly = api.summarizeCampaignPlan([{ game: 'A', endMs: NOW + DAY, sequenceRemainingMinutes: null }], { now: NOW });
  assert.equal(api.campaignPlanText(unknownOnly, NOW), 'Planner: watch time not known yet · 1 open campaign · first ends in 1d 0h');
  assert.equal(api.campaignPlanText(api.summarizeCampaignPlan([], { now: NOW }), NOW), '');
  assert.equal(api.campaignPlanText(null, NOW), '');
  assert.equal(api.summarizeCampaignPlan(undefined, { now: NOW }).campaigns, 0);
});

test('subscription rewards are counted per game and only while unclaimed', () => {
  const campaigns = [
    {
      game: { displayName: 'Alpha' },
      timeBasedDrops: [
        { requiredSubs: 2, self: { isClaimed: false } },
        { requiredSubs: 1, self: { isClaimed: true } },
        { requiredMinutesWatched: 60, self: { isClaimed: false } },
      ],
    },
    { game: { name: 'Alpha' }, drops: [{ requiredSubscriptionCount: 5 }] },
    { game: { displayName: 'Beta' }, timeBasedDrops: [{ requiredMinutesWatched: 30 }] },
    { game: { displayName: '' }, timeBasedDrops: [{ requiredSubs: 1 }] },
  ];
  const map = api.subscriptionRewardsByGame(campaigns, (name) => name.toLowerCase());
  assert.deepEqual([...map.keys()], ['alpha']);
  assert.deepEqual(plain(map.get('alpha')), { count: 2, maxSubs: 5 });
  assert.equal(api.subscriptionRewardText(map.get('alpha')), '2 subscription rewards (up to 5 subs)');
  assert.equal(api.subscriptionRewardText({ count: 1, maxSubs: 1 }), '1 subscription reward (up to 1 sub)');
  assert.equal(api.subscriptionRewardText(undefined), '');
});

test('unclaimed rewards are fully earned drops that were not claimed, oldest campaign first', () => {
  const campaigns = [
    {
      game: { displayName: 'Alpha' },
      endAt: new Date(NOW - 6 * DAY).toISOString(),
      timeBasedDrops: [
        { name: 'Old Hat', requiredMinutesWatched: 60, self: { currentMinutesWatched: 60, isClaimed: false } },
        { name: 'Done Already', requiredMinutesWatched: 60, self: { currentMinutesWatched: 60, isClaimed: true } },
        { name: 'Not Yet', requiredMinutesWatched: 60, self: { currentMinutesWatched: 30, isClaimed: false } },
        { name: 'Needs Subs', requiredSubs: 1, requiredMinutesWatched: 0, self: { currentMinutesWatched: 0 } },
      ],
    },
    {
      game: { displayName: 'Beta' },
      endAt: new Date(NOW - 1 * DAY).toISOString(),
      timeBasedDrops: [{ benefitEdges: [{ benefit: { name: 'Fresh Skin' } }], requiredMinutesWatched: 30, self: { currentMinutesWatched: 45 } }],
    },
    {
      game: { displayName: 'Gamma' },
      endAt: new Date(NOW + 2 * DAY).toISOString(),
      timeBasedDrops: [{ name: 'Running Reward', requiredMinutesWatched: 10, self: { currentMinutesWatched: 10 } }],
    },
  ];
  const items = api.unclaimedRewards(campaigns, NOW);
  assert.deepEqual(plain(items.map((item) => item.name)), ['Old Hat', 'Fresh Skin', 'Running Reward']);
  assert.deepEqual(plain(items.map((item) => item.claimSoon)), [true, false, false]);
  assert.deepEqual(plain(items.map((item) => item.ended)), [true, true, false]);
  assert.equal(api.unclaimedRewardLine(items[0]), 'Old Hat · Alpha · campaign ended 6d 0h ago · claim soon');
  assert.equal(api.unclaimedRewardLine(items[2]), 'Running Reward · Gamma · campaign still running');
  assert.deepEqual(plain(api.unclaimedRewards(undefined, NOW)), []);
});

test('the menu wires the insights in without adding settings', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'dropper.user.js'), 'utf8');
  for (const marker of ['id="tdh-unclaimed-panel"', 'id="tdh-unclaimed-list"', 'id="tdh-unclaimed-summary"', 'campaignPlannerText(now)', 'refreshUnclaimedRewards(now)', 'subscriptionRewardText(subscriptionRewards.get(item.key))']) {
    assert.ok(source.includes(marker), marker);
  }
  const insights = fs.readFileSync(partPath, 'utf8');
  assert.ok(!/saveSettings|settings\./u.test(insights), 'insights read data and never write settings');
});
