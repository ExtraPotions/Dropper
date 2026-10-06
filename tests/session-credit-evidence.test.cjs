'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const parts = path.join(__dirname, '../src/parts');
const source = fs.readdirSync(parts).filter(name => name.endsWith('.js')).sort().map(name => fs.readFileSync(path.join(parts, name), 'utf8').replace(/\r\n/g, '\n')).join('\n');
function block(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
function parser() {
  const context = { requiresSubscription: () => false, dropBenefitImage: () => '', campaignKey: c => c.id };
  vm.runInNewContext(block('  function dropProgressPercent', '\n  function dropProgressComplete') + block('  function parseSessionDrop', '\n  function parseAvailableCampaigns') + '\nthis.parse = parseSessionDrop;', context);
  return context.parse;
}
const campaigns = [{id:'campaign', name:'Campaign', game:{name:'Game'},timeBasedDrops:[{id:'reward',name:'Reward',requiredMinutesWatched:120,self:{currentMinutesWatched:null}}]}];
test('session identity with missing credit preserves unknown minutes, percentage and remaining time', () => {
  const result = parser()({data:{currentUser:{dropCurrentSession:{dropID:'reward',currentMinutesWatched:null}}}},campaigns);
  assert.equal(result.currentMinutes,null);
  assert.equal(result.percent,null);
  assert.equal(result.remainingMinutes,null);
  assert.equal(result.requiredMinutes,120);
});
test('direct reward session envelope preserves exact identity and reported minutes', () => {
  const result = parser()({data:{currentUser:{dropCurrentSession:{drop:{id:'reward',name:'Reward',self:{currentMinutesWatched:3},requiredMinutesWatched:120}}}}},campaigns);
  assert.ok(result);
  assert.equal(result.id,'reward');
  assert.equal(result.currentMinutes,3);
});
test('session operation separates absent sessions from unavailable and changed envelopes', () => {
  const context = {cleanText: value => String(value ?? '').trim()};
  assert.ok(source.includes('  function sessionResponseState('));
  vm.runInNewContext(block('  function sessionResponseState(', '\n  function gqlOperationFailureKind')+'\nthis.classify = sessionResponseState;',context);
  assert.equal(context.classify({data:{currentUser:{dropCurrentSession:null}}}).status,'absent');
  assert.equal(context.classify({data:{currentUser:{}}}).status,'shape-changed');
  assert.equal(context.classify({data:null}).status,'unavailable');
  assert.equal(context.classify({data:{currentUser:{dropCurrentSession:{unknown:1}}}}).status,'shape-changed');
  const unidentified = context.classify({data:{currentUser:{dropCurrentSession:{channel:null,game:null,currentMinutesWatched:null,requiredMinutesWatched:null,dropID:null}}}});
  assert.equal(unidentified.status,'unidentified');
  assert.equal(unidentified.valid,true,'a recognized Twitch session envelope without reward identity is not a schema change');
  assert.equal(context.classify({data:{currentUser:{dropCurrentSession:{dropID:'reward',currentMinutesWatched:0}}}}).status,'ok');
});
test('selecting a reward with known requirement and unknown credit preserves pending state and credit timestamp', () => {
  const context = { currentDrop:{id:'old-reward',name:'Old'},lastProgressAt:123,lastProgress:0,progressLabel:'',cleanText:v=>String(v??''),resolveCategorySlug:()=>'',writeSession:()=>{},removeSession:()=>{},saveRecoverySnapshot:()=>{},resetClaimReadyTimer:()=>{},logActivity:()=>{},syncProgressSurfaces:()=>{},refreshDropCard:()=>{},layoutChrome:()=>{} };
  vm.runInNewContext(block('  function dropProgressPercent', '\n  function dropProgressComplete')+block('  function adoptSelectedTargetDrop', '\n\n  function continueToNextGame')+'\nthis.select=adoptSelectedTargetDrop;',context);
  context.select({id:'reward',name:'Reward',requiredMinutes:120,currentMinutes:null,percent:null});
  assert.equal(context.currentDrop.currentMinutes,null);
  assert.equal(context.currentDrop.requiredMinutes,120);
  assert.equal(context.currentDrop.remainingMinutes,null);
  assert.equal(context.progressLabel,'');
  assert.equal(context.lastProgressAt,0,'a different reward cannot inherit recent credit from the old reward');
});
test('progress display keeps unknown credit pending even with stored initial zero', () => {
  const context = {currentDrop:{currentMinutes:null,requiredMinutes:120,percent:null},readSession:()=>0};
  vm.runInNewContext(block('  function dropProgressPercent', '\n  function dropProgressComplete')+block('  function authoritativeProgressPercent', '\n  function rememberResolvedRewardImage')+'\nthis.percent=authoritativeProgressPercent;',context);
  assert.equal(context.percent(),null);
});
test('catalog selection does not fabricate zero progress for an unstarted reward', () => {
  const context = {normalizeExcludedCampaignKeys:v=>v,cleanText:v=>String(v??''),campaignKey:c=>c.id,campaignMarkedComplete:()=>false,campaignIsRoutingOpen:()=>true,campaignWatchDrops:c=>c.timeBasedDrops,markCampaignCompleteIfWatchDone:()=>false,requiresSubscription:()=>false,campaignIsOpen:()=>true,dropperPreconditionsMet:()=>true,campaignWindow:()=>({}),dropBenefitImage:()=>'',preferWinnableDrops:v=>v,rankCampaignCandidatesForStrategy:v=>v,preferCurrentWinnableOpenDrop:()=>null};
  vm.runInNewContext(block('  function dropProgressPercent', '\n  function progressStallTimeoutMs')+block('  function pickNextOpenCampaignDrop','\n  function listOpenCampaignQueue')+'\nthis.pick=pickNextOpenCampaignDrop;',context);
  const picked = context.pick(campaigns);
  assert.equal(picked.currentMinutes,null);
  assert.equal(picked.percent,null);
  assert.equal(picked.remainingMinutes,null);
  assert.equal(picked.requiredMinutes,120);
});
test('initial catalog zero does not refresh the credited timestamp, but a later actual minute does', () => {
  const context = {currentDrop:null,lastProgressAt:123,lastProgress:0,lastCheckedAt:0,dropMatchesLockedHandoff:()=>true,reconcileDropIdentity:v=>v,isSyntheticWaitingDrop:()=>false,cleanText:v=>String(v??''),dropBenefitImage:()=>'',resetClaimReadyTimer:()=>{},resolveCategorySlug:()=>'',logActivity:()=>{},writeSession:()=>{},removeSession:()=>{},saveRecoverySnapshot:()=>{},reconcileRoutingTargetWithCurrentDrop:()=>{},syncProgressSurfaces:()=>{},refreshDropCard:()=>{},layoutChrome:()=>{},maybeClaimCurrentDrop:()=>{},watchingLogin:()=>'',recordProgressTimeline:()=>{},recoveryNavigationState:()=>({suspended:true})};
  vm.runInNewContext(block('  function dropProgressPercent','\n  function progressStallTimeoutMs')+block('  function applyDrop(', '\n  function storageAccountLogin')+'\nthis.apply=applyDrop;',context);
  context.apply({id:'reward',name:'Reward',currentMinutes:0,requiredMinutes:120});
  assert.equal(context.lastProgressAt,0);
  context.apply({id:'reward',name:'Reward',currentMinutes:1,requiredMinutes:120});
  assert.ok(context.lastProgressAt>123);
  context.currentDrop = {id:'reward',name:'Reward',currentMinutes:null,requiredMinutes:120};
  context.lastProgressAt = 123;
  context.apply({id:'reward',name:'Reward',currentMinutes:20,requiredMinutes:120,fromLiveInventory:true});
  assert.equal(context.currentDrop.currentMinutes,20, 'historical positive credit is shown as an authoritative baseline');
  assert.equal(context.lastProgressAt,123, 'first historical observation does not prove current stream credit');
  context.apply({id:'reward',name:'Reward',currentMinutes:21,requiredMinutes:120,fromLiveInventory:true});
  assert.ok(context.lastProgressAt>123, 'only a subsequent observed increase establishes fresh credit');
  context.apply({id:'different-reward',name:'Different',currentMinutes:20,requiredMinutes:120,fromLiveInventory:true});
  assert.equal(context.lastProgressAt,0,'historical progress on a new reward does not inherit prior fresh credit');
});
test('reconciliation with no credited observation stays unknown', () => {
  const context = { lastInventoryCampaigns:[],lastProgressReconcile:null,inventorySnapshotContainsDrop:()=>false,cleanText:v=>String(v??'') };
  vm.runInNewContext(block('  function reconcileDropProgress', '\n  function resetClaimReadyTimer')+'\nthis.reconcile=reconcileDropProgress;',context);
  assert.equal(context.reconcile({id:'reward',currentMinutes:null,requiredMinutes:120},{id:'reward',currentMinutes:null,requiredMinutes:120}),null);
  assert.equal(context.lastProgressReconcile.chosenMinutes,null);
});
test('opening the next channel clears prior credited timestamps without fabricating credit', () => {
  const stored = new Map([['tdh-progress-at', 123], ['dropper-credited-progress-at-v1',123]]);
  const navigations = [];
  const context = {lastProgressAt:123,lastStreamSwitch:0,settings:{queueEnabled:true,muteRestarted:false},document:{querySelectorAll:()=>[]},viewingNavigationAllowed:()=>true,isAutoRoutingController:()=>true,discoverQueueCandidates:()=>[{href:'https://www.twitch.tv/nextchannel'}],streamLoginFromUrl:()=> 'nextchannel',logActivity:()=>{},setStatus:()=>{},writeSession:(key,value)=>stored.set(key,value),removeSession:key=>stored.delete(key),autoNavigateTwitch:href=>navigations.push(href)};
  vm.runInNewContext(block('  function findNextStream(', '\n  function muteOpenedStreamsEnabled')+'\nthis.next=findNextStream;',context);
  context.next();
  assert.equal(context.lastProgressAt,0);
  assert.equal(stored.has('tdh-progress-at'),false);
  assert.equal(stored.has('dropper-credited-progress-at-v1'),false);
  assert.equal(navigations.length,1);
});
test('recovery rejects legacy initialization timestamps and restores only versioned credit evidence', () => {
  function restore(marker) {
    const context = {settings:{resumeSessionOnRestart:true,findNextStream:false},currentDrop:null,lastProgressAt:0,lastProgress:0,progressLabel:'',loadRecoverySnapshot:()=>({drop:{id:'reward',name:'Reward',percent:null},progressAt:123,progressEvidenceVersion:marker}),writeSession:()=>{},removeSession:()=>{},watchingLogin:()=>'',cleanText:v=>String(v??''),logActivity:()=>{},queueGqlPollSoon:()=>{}};
    vm.runInNewContext(block('  function restoreRecoverySnapshot(', '\n  function refreshSessionRecoveryStatus')+'\nthis.restore=restoreRecoverySnapshot;',context);
    context.restore();
    return context;
  }
  assert.equal(restore(undefined).lastProgressAt,0);
  assert.equal(restore(1).lastProgressAt,123);
  assert.equal(restore(1).progressLabel,'');
});
test('recovery snapshot preserves unknown reward progress', () => {
  const context = {cleanText:v=>String(v??''),isSyntheticWaitingDrop:()=>false};
  vm.runInNewContext(block('  function compactRecoveryDrop(', '\n  function loadRecoverySnapshot')+'\nthis.compact=compactRecoveryDrop;',context);
  const saved=context.compact({id:'reward',name:'Reward',game:'Game',campaignKey:'campaign',currentMinutes:null,percent:null,remainingMinutes:null,requiredMinutes:120});
  assert.equal(saved.currentMinutes,null);
  assert.equal(saved.percent,null);
  assert.equal(saved.remainingMinutes,null);
  assert.equal(saved.requiredMinutes,120);
});
test('resetting prevents settings and session reads from migrating legacy records', () => {
  let touches=0;
  const context = {productResetting:true,DEFAULTS:{findNextStream:false},twitchSessionLogin:()=> 'fixture',cleanText:v=>String(v??''),scopedSessionStorageKey:v=>v,ACCOUNT_SCOPE_OWNER_KEY:'owner',sessionStorage:{getItem:()=>{touches++;return null;}},localStorage:{getItem:()=>{touches++;return null;},setItem:()=>{touches++;}}};
  vm.runInNewContext(block('  function legacyStateBelongsToCurrentAccount(', '\n  function loadSettings')+block('  function loadSettings(', '\n  function persistSettingsSnapshot')+block('  function readSession(', '\n  function writeSession')+'\nthis.owner=legacyStateBelongsToCurrentAccount;this.load=loadSettings;this.read=readSession;',context);
  assert.equal(context.owner(),false);
  assert.equal(context.read('legacy-key','fallback'),'fallback');
  assert.equal(context.load().findNextStream,false);
  assert.equal(touches,0);
});
test('campaign support stays in verification until selected reward earning is proved', () => {
  const context = {currentDrop:{id:'reward',name:'Reward',game:'Game',campaignKey:'campaign',currentMinutes:20,percent:17},lastStreamVerification:null,PAGE_STARTED_AT:0,STREAM_ROUTE_SETTLE_MS:0,GQL_MIN_GAP_MS:15000,ROUTING_FIRST_CREDIT_DEADLINE_MS:360000,ROUTING_STATES:{EARNING:'earning',FIND_STREAM:'find-stream'},routing:{state:'verify-stream',targetStream:'channel',targetGame:'Game',targetDropId:'reward',targetCampaignKey:'campaign',candidateEvidence:{gqlCampaignSupported:true},verifyBaselineMinutes:null,verifyBaselinePercent:null,deadlineAt:190000},cleanText:v=>String(v??''),watchingLogin:()=> 'channel',readStreamInfo:()=>({live:true,game:'Game',dropsEnabled:true}),gameNamesMatch:(a,b)=>a===b,setStatus:()=>{},requestFinalVerificationPoll:()=>false,routingControllerAddFailedStream:()=>[]};
  context.readRoutingControllerSession=()=>context.routing;
  context.syncRoutingCampaignAllowListEvidence=session=>session;
  context.writeRoutingControllerSession=session=>(context.routing=session);
  context.transitionRoutingController=(state,patch)=>(context.routing={...context.routing,...patch,state},true);
  vm.runInNewContext(block('  function routingControllerVerifyStream(', '\n  function routingControllerEarning')+'\nthis.verify=routingControllerVerifyStream;',context);
  context.verify(100000);
  assert.equal(context.routing.state,'verify-stream','campaign support alone is eligibility evidence, not earning proof');
  assert.equal(context.lastStreamVerification,null,'historical progress does not create a verified earning record');
  assert.equal(context.routing.verifyBaselineMinutes,20);
  context.currentDrop={...context.currentDrop,currentMinutes:21,percent:18};
  context.verify(101000);
  assert.equal(context.routing.state,'earning');
  assert.equal(context.lastStreamVerification.proof.progressConfirmed,true,'20→21 is an observed increase');
});

test('exact selected reward session can prove earning before the first credited minute', () => {
  const context = {currentDrop:{id:'reward',name:'Reward',game:'Game',campaignKey:'campaign',currentMinutes:null,percent:null},lastStreamVerification:null,PAGE_STARTED_AT:0,STREAM_ROUTE_SETTLE_MS:0,GQL_MIN_GAP_MS:15000,ROUTING_FIRST_CREDIT_DEADLINE_MS:360000,ROUTING_STATES:{EARNING:'earning',FIND_STREAM:'find-stream'},routing:{state:'verify-stream',targetStream:'channel',targetGame:'Game',targetDropId:'reward',targetCampaignKey:'campaign',candidateEvidence:{gqlCampaignSupported:true,gqlSessionDropMatched:true,gqlSessionIdentityLevel:'exact-drop'},verifyBaselineMinutes:null,verifyBaselinePercent:null,deadlineAt:190000},cleanText:v=>String(v??''),watchingLogin:()=> 'channel',readStreamInfo:()=>({live:true,game:'Game',dropsEnabled:true}),gameNamesMatch:(a,b)=>a===b,setStatus:()=>{},requestFinalVerificationPoll:()=>false,routingControllerAddFailedStream:()=>[]};
  context.readRoutingControllerSession=()=>context.routing;
  context.syncRoutingCampaignAllowListEvidence=session=>session;
  context.writeRoutingControllerSession=session=>(context.routing=session);
  context.transitionRoutingController=(state,patch)=>(context.routing={...context.routing,...patch,state},true);
  vm.runInNewContext(block('  function routingControllerVerifyStream(', '\n  function routingControllerEarning')+'\nthis.verify=routingControllerVerifyStream;',context);
  context.verify(100000);
  assert.equal(context.routing.state,'earning');
  assert.equal(context.lastStreamVerification.method,'session-drop-match');
  assert.equal(context.lastStreamVerification.proof.sessionDropMatched,true);
  assert.equal(context.lastStreamVerification.proof.progressConfirmed,false);
});
test('legacy progress proof also requires known baselines rather than interpreting null as zero', () => {
  const context={lastProgressAt:0,dropMatchesHandoffTarget:()=>true};
  vm.runInNewContext(block('  function creditedProgressProvesStream(', '\n  function completeVerifiedHandoff')+'\nthis.proves=creditedProgressProvesStream;',context);
  const pending={verifyBaselineMinutes:null,verifyBaselinePercent:null};
  assert.equal(context.proves({currentMinutes:20,percent:17},pending,{currentMinutes:null,percent:null}),false);
  assert.equal(context.proves({currentMinutes:21,percent:18},{verifyBaselineMinutes:20,verifyBaselinePercent:17}),true);
});
