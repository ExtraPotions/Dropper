'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadDropperSource } = require('./load-source.cjs');
const source = loadDropperSource();
function extract(name) {
  const match = new RegExp('^  (?:async )?function ' + name + '\\(', 'm').exec(source);
  assert.ok(match, name);
  return source.slice(match.index, source.indexOf('\n  }', match.index) + 4);
}
const copy = value => JSON.parse(JSON.stringify(value));
const summary = () => ({ id: 'campaign-d20', name: '/dnd d20 Badge',
  game: { id: '509577', displayName: 'Dungeons & Dragons' },
  timeBasedDrops: [{ id: 'reward-d20', requiredMinutesWatched: 30, requiredSubs: 0 }] });
const detail = () => ({ ...summary(), allow: { isEnabled: true, channels: [{ id: '32563943', name: 'dnd' }] },
  timeBasedDrops: [{ ...summary().timeBasedDrops[0], name: '/dnd d20 Badge',
    benefitEdges: [{ benefit: { name: '/dnd d20 Badge' } }] }] });
function context(extra = {}) {
  const c = { Date, cleanText: v => String(v ?? '').trim(), campaignKey: c => c.id,
    ...extra };
  vm.createContext(c);
  return c;
}
test('dashboard reward summaries preserve known names, channel restrictions and credited progress', () => {
  const prior = detail(); prior.timeBasedDrops[0].self = { currentMinutesWatched: 7 };
  const c = context({ lastCampaignCatalog: [prior] });
  vm.runInContext(['mergeCampaigns','withKnownCampaignDetails'].map(extract).join('\n'), c);
  const merged = c.withKnownCampaignDetails(summary());
  assert.equal(merged.allow.channels[0].name, 'dnd');
  assert.equal(merged.timeBasedDrops[0].name, '/dnd d20 Badge');
  assert.equal(merged.timeBasedDrops[0].self.currentMinutesWatched, 7);
  const updated = summary(); updated.allow = { isEnabled: false, channels: [] };
  updated.timeBasedDrops[0].self = { currentMinutesWatched: 8 };
  const fresh = c.withKnownCampaignDetails(updated);
  assert.equal(fresh.allow.isEnabled, false, 'explicit unrestricted response supersedes prior restrictions');
  assert.equal(fresh.timeBasedDrops[0].self.currentMinutesWatched, 8);
});
test('nonempty but partial dashboard reward arrays still request authoritative details', async () => {
  const requests = [];
  const c = context({ getToken: () => 'fixture', cookie: () => 'viewer', watchingLogin: () => '', readSession: () => '123456',
    gql: async ops => { requests.push(ops); return [{ data: { user: { dropCampaign: detail() } } }]; },
    logActivity: () => {} });
  vm.runInContext(extract('enrichCampaignsWithDropDetails'), c);
  const rows = await c.enrichCampaignsWithDropDetails([summary()]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0].variables.channelLogin, '123456', 'native parameter carries viewer ID, not login');
  assert.equal(rows[0].allow.channels[0].name, 'dnd');
  requests.length = 0;
  await c.enrichCampaignsWithDropDetails([detail()]);
  assert.equal(requests.length, 0, 'complete detail rows do not refetch');
  c.readSession = () => '';
  await c.enrichCampaignsWithDropDetails([summary()]);
  assert.equal(requests.length, 0, 'unknown viewer identity cannot fall back to a stream or login name');
});
test('native detail responses enter the routing cache and hydrate metadata without becoming progress evidence', () => {
  const hydrated = [], remembered = [];
  const c = context({ campaignDetailsCache: new Map(), currentDrop: null,
    lastCampaignCatalog: [summary()], lastInventoryCampaigns: [],
    lastTwitchGqlAt: 0, lastGqlSuccessAt: 0, lastGqlError: '', networkState: { consecutiveFailures: 2 },
    clearGqlFailurePause: () => {}, persistNetworkState: () => {},
    compactCampaignCatalog: rows => rows, rememberCampaignCatalog: rows => remembered.push(...rows),
    hydrateCurrentRewardDetails: row => hydrated.push(row),
    isAutoRoutingController: () => false, noteDeferredAutoRouting: () => {},
    routingCampaignPool: () => [], refreshDropCard: () => {},
  });
  vm.runInContext(['mergeCampaigns','withKnownCampaignDetails','ingestTwitchGqlRows'].map(extract).join('\n'), c);
  const row = { data: { user: { dropCampaign: detail() } } };
  assert.equal(c.ingestTwitchGqlRows([row]), true);
  assert.equal(c.campaignDetailsCache.get('campaign-d20').allow.channels[0].name, 'dnd');
  assert.equal(hydrated.length, 1);
  assert.equal(remembered.length, 1);
  assert.equal(hydrated[0].timeBasedDrops[0].self?.currentMinutesWatched, undefined);
  assert.equal(c.ingestTwitchGqlRows([{ ...row, errors: [{ message: 'unavailable' }] }]), false);
  assert.equal(c.ingestTwitchGqlRows([{ data: { user: { dropCampaign: { id: 'bad' } } } }]), false);
  assert.equal(c.campaignDetailsCache.has('bad'), false);
  c.lastCampaignCatalog = [detail()];
  c.lastCampaignCatalog[0].timeBasedDrops[0].self = { currentMinutesWatched: 7 };
  c.ingestTwitchGqlRows([row]);
  assert.equal(c.campaignDetailsCache.get('campaign-d20').timeBasedDrops[0].self.currentMinutesWatched, 7,
    'metadata-only native details cannot erase previously observed progress');
  assert.deepEqual(copy(c.lastInventoryCampaigns), []);
});
