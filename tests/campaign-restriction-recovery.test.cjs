'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readdirSync(path.join(__dirname,'../src/parts')).sort().map(n=>fs.readFileSync(path.join(__dirname,'../src/parts',n),'utf8')).join('\n');
function load(name,c){const m=new RegExp('  function '+name+'\\([^]*?\\n  \\}').exec(source);assert.ok(m,name);vm.runInNewContext(m[0],c);}
function context(storage=new Map()) {return {cleanText:v=>String(v||'').trim(),currentDrop:{campaignKey:'campaign-a'},campaignIsRoutingOpen:()=>true,findCampaignForDrop:pool=>pool[0],routingCampaignPool:()=>[],readSession:(key,fallback)=>storage.get(key)??fallback,writeSession:(key,value)=>storage.set(key,value)};}

test('real campaign pool retains fetched restrictions when inventory has an empty summary',()=>{
  const storage=new Map(),c=context(storage);
  Object.assign(c,{Date,campaignKey:n=>n.id,lastCampaignCatalog:[],campaignDetailsCache:new Map([['campaign-a',{id:'campaign-a',allow:{isEnabled:true,channels:[{login:'listed',id:'1'}]}}]]),lastInventoryCampaigns:[{id:'campaign-a',allow:{isEnabled:true,channels:[]}}],openCampaignsFromMemory:()=>[],scrapeCampaignsFromPage:()=>[],suppressPageCampaignsWithAuthoritativeMatches:v=>v,overlayCurrentDropProgressOnCampaigns:v=>v});
  c.overlayNativeClaimedRewards = campaigns => campaigns;
  for(const name of ['mergeCampaigns','routingCampaignPool','campaignAllowedChannels','activeCampaignAllowedChannels'])load(name,c);
  assert.equal(c.activeCampaignAllowedChannels()[0]?.login,'listed');
  assert.equal(storage.size,1);
  c.lastInventoryCampaigns=[{id:'campaign-a',allow:{isEnabled:false,channels:[]}}];
  assert.equal(c.activeCampaignAllowedChannels().length,0);
  c.lastInventoryCampaigns=[{id:'campaign-a',allow:{isEnabled:true,channels:[{login:'replacement',id:'2'}]}}];
  assert.equal(c.activeCampaignAllowedChannels()[0]?.login,'replacement');
});

test('diagnostics reject unlisted tagged channels for a restricted campaign',()=>{
  const c={Date,cleanText:v=>String(v||''),readRoutingControllerSession:()=>({}),currentDrop:{campaignKey:'campaign-a',game:'Game'},resolveCategorySlug:()=>'',activeCampaignAllowedChannels:()=>[{login:'listed'}],routingControllerFailedSet:()=>new Set(),lastRoutingCandidateSnapshot:{at:1000,visible:[{login:'unlisted',dropsTagged:true}]},normalizeGameName:v=>v,pruneStandbyCache:()=>[],STANDBY_LIVE_FRESH_MS:60000,streamCandidateEvidence:()=>({rank:1,label:'tagged'})};
  load('routingCandidateDiagnosticsSnapshot',c);
  const row=c.routingCandidateDiagnosticsSnapshot(1000).visible[0];
  assert.equal(row.routable,false);assert.equal(row.reason,'campaign-allow-list-mismatch');
});
test('known campaign channels survive a new page with incomplete campaign data and never leak to another campaign',()=>{
  const storage=new Map(),first=context(storage);load('campaignAllowedChannels',first);load('activeCampaignAllowedChannels',first);
  first.routingCampaignPool=()=>[{allow:{isEnabled:true,channels:[{login:'Listed',id:'1'}]}}];
  assert.equal(first.activeCampaignAllowedChannels()[0].login,'listed');
  const next=context(storage);load('campaignAllowedChannels',next);load('activeCampaignAllowedChannels',next);
  assert.equal(next.activeCampaignAllowedChannels()[0]?.login,'listed');
  next.routingCampaignPool=()=>[{allow:{isEnabled:true,channels:[]}}];
  assert.equal(next.activeCampaignAllowedChannels()[0]?.login,'listed');
  next.routingCampaignPool=()=>[];
  next.currentDrop={campaignKey:'campaign-b'};assert.equal(next.activeCampaignAllowedChannels().length,0);
  next.currentDrop={campaignKey:'campaign-a'};next.routingCampaignPool=()=>[{allow:{isEnabled:false,channels:[]}}];assert.equal(next.activeCampaignAllowedChannels().length,0);
  next.routingCampaignPool=()=>[];assert.equal(next.activeCampaignAllowedChannels().length,0);
});
test('a known restricted campaign rejects a generic Drops-tagged channel',()=>{
  const c={cleanText:v=>String(v||''),resolveCategorySlug:()=> 'game',sortStreamCandidates:v=>v,collectDirectoryStreamCandidates:()=>[{login:'unlisted',dropsTagged:true},{login:'listed',dropsTagged:false}],activeCampaignAllowedChannels:()=>[{login:'listed'}],routingControllerFailedSet:()=>new Set(),rankStreamCandidatesByEvidence:v=>v,settings:{excludedChannels:[]},currentDrop:{game:'Game'},Date,streamViewerCount:v=>Number(v||0),lastRoutingCandidateSnapshot:null};
  load('classifyRoutingCandidates',c);const result=c.classifyRoutingCandidates('Game','game',{},1000);
  assert.equal(result.candidates.some(n=>n.login==='unlisted'),false);
  assert.equal(result.candidates.some(n=>n.login==='listed'),true);
});
test('a recovery-blocked move clears Opening state and pending destination',()=>{
  let session={state:'open-stream',targetStream:'unlisted',navigationTarget:'https://www.twitch.tv/unlisted',deadlineAt:1000};
  const c={isTrustedTwitchUrl:()=>true,routingControllerNavigationInFlight:()=>false,autoNavigateTwitch:()=>false,recoveryNavigationState:()=>({suspended:true}),ROUTING_STATES:{PAUSED:'paused'},transitionRoutingController:(state,patch)=>session={...session,...patch,state},setStatus:()=>{}};
  load('routingControllerNavigate',c);assert.equal(c.routingControllerNavigate('https://www.twitch.tv/unlisted'),false);
  assert.equal(session.state,'paused');assert.equal(session.deadlineAt,0);assert.equal(session.navigationTarget,null);assert.equal(session.targetStream,'');
});
