'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadDropperSource} = require('./load-source.cjs');
function validator() {
  const source = loadDropperSource();
  const start = source.indexOf('  function validateTwitchBridgePayload(');
  assert.ok(start >= 0, 'bridge validator exists');
  const end = source.indexOf('\n  function handleInterceptedTwitchPayload', start);
  const c = {URL, location:{href:'https://www.twitch.tv/example',pathname:'/example'},
    storageAccountLogin:()=> 'viewer', CLIENT_IDS:['client'],
    GQL_OPS:{inventory:{name:'Inventory'},stream:{name:'VideoPlayerStreamInfoOverlayChannel'},claim:{name:'DropsPage_ClaimDropRewards'},details:{name:'DropCampaignDetails'}}, Date};
  vm.runInNewContext(source.slice(start,end),c);
  return detail => c.validateTwitchBridgePayload(detail,'correlation');
}
function payload() {
  return {secret:'correlation',url:'https://gql.twitch.tv/gql',status:200,
    requestScope:{account:'viewer',path:'/example'},headers:{'client-id':'client'},
    operations:[{name:'Inventory',hash:'a'.repeat(64),variableKeys:[]}],
    json:[{data:{currentUser:{inventory:{dropCampaignsInProgress:[]}}}}]};
}
test('valid Drops reads survive while unrelated headers and fields are discarded',()=>{
  const p=payload();p.headers.authorization='OAuth private';p.headers.cookie='private';p.json[0].data.chat='private';
  const result=validator()(p);assert.ok(result);assert.equal(result.headers.authorization,undefined);
  assert.equal(result.headers.cookie,undefined);assert.equal(result.json[0].data.chat,undefined);
});
test('rejects wrong endpoints, stale scope, invalid credentials and mismatched batches',()=>{
  const validate=validator();
  for(const change of [p=>p.url='https://gql.twitch.tv.evil/gql',p=>p.url='http://gql.twitch.tv/gql',
    p=>p.url='https://gql.twitch.tv:444/gql',p=>p.url='https://user@gql.twitch.tv/gql',
    p=>p.requestScope.account='other',p=>p.requestScope.path='/other',p=>p.secret='other',
    p=>p.headers['client-id']='other',p=>p.headers['client-integrity']='bad\nvalue',
    p=>p.operations.push(p.operations[0]),p=>p.status=NaN,
    p=>p.operations[0].hash='invalid',p=>p.operations[0].variableKeys=['__proto__'],
    p=>p.json=[{}],p=>p.json=[{data:'malformed'}],p=>p.json=[{errors:'malformed'}]]) {
    const p=payload();change(p);assert.equal(validate(p),null);
  }
});
test('rejects oversized, recursive and prototype-bearing payloads without changing state',()=>{
  const validate=validator();
  const huge=payload();huge.json[0].data.currentUser.inventory.padding='x'.repeat(2*1024*1024);assert.equal(validate(huge),null);
  const circular=payload();circular.json[0].data.currentUser.inventory.self=circular;assert.equal(validate(circular),null);
  const hostile=payload();hostile.json[0].data.currentUser.inventory=JSON.parse('{"__proto__":{"polluted":true}}');assert.equal(validate(hostile),null);
});
test('mixed batches retain supported rows in matching order and exclude unrelated operations',()=>{
  const p=payload();p.operations.unshift({name:'Chat',hash:'b'.repeat(64),variableKeys:[]});p.json.unshift({data:{chat:'private'}});
  const result=validator()(p);assert.equal(result.operations.length,1);assert.equal(result.operations[0].name,'Inventory');assert.equal(result.json.length,1);
  const unrelated=payload();unrelated.operations[0].name='Chat';assert.equal(validator()(unrelated),null);
});
test('integrity responses retain only bounded token and valid expiration',()=>{
  const p=payload();p.url='https://gql.twitch.tv/integrity';p.operations=null;
  p.json={token:'token',expiration:Math.floor(Date.now()/1000)+300,private:'discard'};
  const validate=validator(),result=validate(p);assert.ok(result);assert.equal(result.json.private,undefined);
  p.json.expiration=1;assert.equal(validate(p),null);
});

test('supported stream, campaign-detail and claim operations retain their public response fields',()=>{
 const p=payload();p.operations=['VideoPlayerStreamInfoOverlayChannel','DropCampaignDetails','DropsPage_ClaimDropRewards'].map(name=>({name,hash:'a'.repeat(64),variableKeys:[]}));
 p.json=[{data:{user:{id:'1',login:'stream',stream:{id:'live'},broadcastSettings:{title:'Title'},email:'private'}}},
  {data:{user:{dropCampaign:{id:'campaign'}}}}, {data:{claimDropRewards:{status:'ELIGIBLE_FOR_ALL',private:'discard'}}}];
 const rows=validator()(p).json;assert.equal(rows[0].data.user.stream.id,'live');assert.equal(rows[0].data.user.email,undefined);
 assert.equal(rows[1].data.user.dropCampaign.id,'campaign');assert.equal(rows[2].data.claimDropRewards.status,'ELIGIBLE_FOR_ALL');assert.equal(rows[2].data.claimDropRewards.private,undefined);
});

test('page hook preserves fetch responses and XHR calls while sending only Drops data',async()=>{
  const source=loadDropperSource(),start=source.indexOf('  function twitchPageNetworkHook(');
  assert.ok(start>=0,'readable page hook exists');
  const end=source.indexOf('\n  function installTwitchNetworkHooks',start);
  const events=[],calls=[];let load;
  const response={status:200,clone:()=>({text:async()=>JSON.stringify([{data:{chat:'private'}},{data:{currentUser:{inventory:{},email:'private'}}}])})};
  function X(){};X.prototype.open=function(...args){calls.push(args)};X.prototype.setRequestHeader=function(){};
  X.prototype.send=function(body){calls.push(body)};X.prototype.addEventListener=function(_,cb){load=cb};
  const c={URL,Headers,location:{href:'https://www.twitch.tv/example',pathname:'/example'},document:{cookie:'login=viewer'},
    CustomEvent:function(type,options){this.type=type;this.detail=options.detail},window:{fetch:async()=>response,XMLHttpRequest:X,dispatchEvent:e=>events.push(e)}};
  vm.runInNewContext(source.slice(start,end),c);c.twitchPageNetworkHook('channel','correlation',['Inventory']);
  const body=JSON.stringify([{operationName:'Chat',extensions:{persistedQuery:{sha256Hash:'b'.repeat(64)}},variables:{text:'private'}},
    {operationName:'Inventory',extensions:{persistedQuery:{sha256Hash:'a'.repeat(64)}},variables:{}}]);
  assert.equal(await c.window.fetch('https://gql.twitch.tv/gql',{body,headers:{authorization:'OAuth private','client-id':'client'}}),response);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.length,1);assert.equal(events[0].detail.headers.authorization,undefined);
  assert.equal(events[0].detail.json.length,1);assert.equal(events[0].detail.json[0].data.currentUser.email,undefined);
  const x=new X();x.open('POST','https://gql.twitch.tv/gql');x.setRequestHeader('Authorization','OAuth private');x.send(body);
  x.status=200;x.responseText=JSON.stringify([{data:{chat:'private'}},{data:{currentUser:{inventory:{}}}}]);load();
  assert.equal(events.length,2);assert.equal(events[1].detail.json.length,1);assert.equal(calls[1],body);
  await c.window.fetch('https://example.com/',{body});assert.equal(events.length,2);
});
