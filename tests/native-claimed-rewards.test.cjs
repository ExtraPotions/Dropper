'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const parts=path.join(__dirname,'../src/parts');
const source=fs.readdirSync(parts).filter(n=>n.endsWith('.js')).sort().map(n=>fs.readFileSync(path.join(parts,n),'utf8').replace(/\r\n/g,'\n')).join('\n');
function block(a,b){const i=source.indexOf(a);assert.ok(i>=0,a);return source.slice(i,source.indexOf(b,i));}
function harness(storage=new Map()){
 const c={cleanText:v=>String(v??'').trim(),readSession:(k,d)=>storage.get(k)??d,writeSession:(k,v)=>storage.set(k,v)};
 vm.runInNewContext(block('  function nativeRewardClaimEvidence(', '\n  function checkGqlOperationResults(')+'\nthis.evidence=nativeRewardClaimEvidence;this.overlay=overlayNativeClaimedRewards;',c);return c;
}
const campaign='aa05e383-ee2e-4af2-a204-bb5e405ae984',group='c274caf2-bb26-11f1-ae1d-0a58a9feac02',item='dc639b50-1310-465f-a3a2-7a77e73d6014_CUSTOM_ID_ec4e9bbc-8355-4eaa-98b9-d2d30c61395b';
const nativeCampaign=()=>({id:campaign,name:'The Herbalist #3',game:{name:'HITMAN World of Assassination'},rewardGroups:[{id:group,name:'Green Grapes',progressCriteria:{requirementType:'WATCH',requirements:{minutesWatched:60},isRepeatable:false},rewards:[{id:item}]}],timeBasedDrops:[{id:group,name:'Green Grapes',requiredMinutesWatched:60,self:{isClaimed:false,currentMinutesWatched:null}}]});
const inventory=(status='CLAIMED',key=campaign,reward=item)=>({earnedDropRewards:{edges:[{node:{status,campaign:{id:key},item:{id:reward}}}]}});
test('native claimed history matches exact campaign and reward IDs to a non-repeatable group, across navigation',()=>{
 const storage=new Map(),c=harness(storage);c.evidence(inventory());c.evidence(null,[nativeCampaign()]);
 const next=harness(storage),result=next.overlay([nativeCampaign()]);assert.equal(result[0].timeBasedDrops[0].self.isClaimed,true);assert.equal(result[0].timeBasedDrops[0].self.currentMinutesWatched,null,'never invent watched minutes');
 assert.equal(next.evidence().claimedGroups.has(campaign+':'+group),true);
});
test('wrong campaign, wrong reward, unclaimed status, missing IDs and repeatable groups never suppress earning',()=>{
 for(const inv of [inventory('EARNED'),inventory('CLAIMED','other'),inventory('CLAIMED',campaign,'other'),inventory('CLAIMED','')]){const c=harness();c.evidence(inv,[nativeCampaign()]);assert.equal(c.overlay([nativeCampaign()])[0].timeBasedDrops[0].self.isClaimed,false);}
 for(const repeat of [true,undefined]){const c=harness(),row=nativeCampaign();row.rewardGroups[0].progressCriteria.isRepeatable=repeat;c.evidence(inventory(),[row]);assert.equal(c.overlay([row])[0].timeBasedDrops[0].self.isClaimed,false);}
});
test('all rewards in a group must be claimed and another unclaimed reward remains eligible',()=>{
 const c=harness(),row=nativeCampaign();row.rewardGroups[0].rewards.push({id:'second'});c.evidence(inventory(),[row]);assert.equal(c.overlay([row])[0].timeBasedDrops[0].self.isClaimed,false);
 c.evidence({earnedDropRewards:{edges:[{node:{status:'CLAIMED',campaign:{id:campaign},item:{id:'second'}}}]}},[row]);
 row.timeBasedDrops.push({id:'another-group',self:{isClaimed:false}});const out=c.overlay([row]);assert.equal(out[0].timeBasedDrops[0].self.isClaimed,true);assert.equal(out[0].timeBasedDrops[1].self.isClaimed,false);
});
test('explicit empty live session is inactive and diagnostics expose types without raw values',()=>{
 const c={};vm.runInNewContext(block('  function sessionResponseState(', '\n  function gqlOperationFailureKind')+'\nthis.classify=sessionResponseState;',c);
 const session={channel:null,game:null,currentMinutesWatched:0,requiredMinutesWatched:0,dropID:''};let out=c.classify({data:{currentUser:{dropCurrentSession:session}}});assert.equal(out.status,'inactive');assert.equal(out.valid,true);assert.equal(out.shape.valueSummary.dropID.empty,true);assert.equal(out.shape.valueSummary.currentMinutesWatched.type,'number');
 session.dropID='secret-reward-id';session.channel={id:'secret-channel'};out=c.classify({data:{currentUser:{dropCurrentSession:session}}});assert.equal(out.status,'ok');assert.ok(!JSON.stringify(out.shape).includes('secret-'));
});

function pickerHarness() {
 const c=harness();
 Object.assign(c,{
  Date, campaignKey:row=>row.id, normalizeExcludedCampaignKeys:keys=>keys,
  campaignMarkedComplete:()=>false, campaignIsRoutingOpen:()=>true,
  requiresSubscription:()=>false, campaignIsOpen:()=>true, dropperPreconditionsMet:()=>true,
  campaignWindow:()=>({endMs:Date.now()+86400000}), dropBenefitImage:()=>'',
  dropProgressPercent:()=>null, dropProgressComplete:()=>false,
  CAMPAIGN_WINNABLE_BUFFER_MS:0,CAMPAIGN_SHELL_MIN_WINDOW_MS:0,
  preferWinnableDrops:rows=>rows,rankCampaignCandidatesForStrategy:rows=>rows,
  preferCurrentWinnableOpenDrop:()=>null,
 });
 vm.runInNewContext(block('  function campaignWatchDrops(', '\n  function campaignMarkedComplete(')+
  block('  function pickNextOpenCampaignDrop(', '\n  function listOpenCampaignQueue(')+
  '\nthis.pick=pickNextOpenCampaignDrop;',c);
 c.markCampaignCompleteIfWatchDone=row=>c.campaignWatchDropsComplete(row);
 return c;
}

test('real picker skips the claimed group but selects another reward in the same campaign',()=>{
 const c=pickerHarness(),row=nativeCampaign();
 row.timeBasedDrops.push({id:'next',requiredMinutesWatched:90,self:{isClaimed:false,currentMinutesWatched:null}});
 c.evidence(inventory(),[row]);
 const selected=c.pick(c.overlay([row]));
 assert.equal(selected.id,'next');assert.equal(selected.campaignKey,campaign);
 assert.equal(selected.currentMinutes,null);
 assert.equal(c.pick(c.overlay([nativeCampaign()])),null,'one-reward claimed campaign is not reselected');
});

test('missing native groups prevent campaign completion and preserve a details lookup, including repeatable groups',()=>{
 for(const repeatable of [false,true,undefined]){
  const c=pickerHarness(),row=nativeCampaign();
  row.rewardGroups.push({id:'native-next',progressCriteria:{requirementType:'WATCH',isRepeatable:repeatable},rewards:[{id:'native-item'}]});
  c.evidence(inventory(),[row]);
  const overlaid=c.overlay([row]);
  assert.equal(overlaid[0].nativeRewardsPending,true);
  assert.equal(c.campaignWatchDropsComplete(overlaid[0]),false);
  const selected=c.pick(overlaid);assert.ok(selected);assert.equal(selected.needsDropDetails,true);
  assert.equal(selected.currentMinutes,null);
 }
});
