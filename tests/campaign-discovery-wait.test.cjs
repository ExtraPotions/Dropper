'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadDropperSource} = require('./load-source.cjs');
const source = loadDropperSource(require('node:path').resolve(__dirname, '..'));
function load(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return source.slice(start, source.indexOf('\n  function ', start + 1));
}
function harness({alternative = true} = {}) {
  const drops = [{campaignKey:'r6',game:'Rainbow Six Siege'}, ...(alternative ? [{campaignKey:'other',game:'Other Game'}] : [])];
  const c = {
    Date, Set, Number, Object, cleanText:v=>String(v||'').trim(),
    ROUTING_STATES:{SELECT_CAMPAIGN:'select-campaign'},
    routingCampaignPool:()=>drops,
    pickNextOpenCampaignDrop:(_pool,excluded)=>drops.find(d=>!excluded.includes(d.campaignKey)),
    campaignIsExcluded:()=>false, dropFitsCampaignWindow:()=>true, campaignDetailsMissedRecently:()=>false,
    setStatus:v=>{c.status=v;},
    transitionRoutingController:(state,patch,reason)=>{c.transition={state,patch,reason};return c.transition;},
  };
  vm.createContext(c);
  for (const name of ['pickViableCampaign','routingControllerDeferUnavailableCampaign']) vm.runInContext(load(name),c);
  return c;
}
const session = {waitReason:'no-live-allowed-channel',targetCampaignKey:'r6',targetCampaign:'R6 Esports',streamDiscoveryStartedAt:1000,excludedCampaignKeys:[]};
test('unavailable restricted campaign yields to another campaign after bounded discovery',()=>{
  const c=harness();
  assert.equal(c.routingControllerDeferUnavailableCampaign(session,120999),false);
  assert.ok(c.routingControllerDeferUnavailableCampaign(session,121000));
  assert.equal(c.transition.state,'select-campaign');
  assert.equal(c.transition.patch.deferredCampaigns.r6,421000);
  assert.deepEqual(Array.from(c.transition.patch.excludedCampaignKeys),[]);
  const deferred={...session,...c.transition.patch};
  assert.equal(c.pickViableCampaign(deferred,{now:121001}).next.campaignKey,'other');
  assert.equal(c.pickViableCampaign(deferred,{now:421000}).next.campaignKey,'r6');
});
test('sole remaining campaign stays available and unrelated waits are not interrupted',()=>{
  const c=harness({alternative:false});
  assert.equal(c.routingControllerDeferUnavailableCampaign(session,121000),false);
  assert.equal(c.transition,undefined);
  assert.equal(harness().routingControllerDeferUnavailableCampaign({...session,waitReason:'claim-disabled'},121000),false);
});
test('a compatible visible stream is opened before unavailable campaign deferral',()=>{
  const waiting=load('routingControllerWaiting');
  assert.ok(waiting.indexOf('return routingControllerFindStream(now)') < waiting.indexOf('routingControllerDeferUnavailableCampaign(session, now)'));
  assert.match(load('routingControllerSelectCampaign'),/streamDiscoveryStartedAt: now/);
  assert.match(load('routingControllerFindStream'),/streamDiscoveryStartedAt: now/);
});
