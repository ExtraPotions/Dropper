'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
test('installed Dropper migrates preferences, keeps the page bridge working, and resets manager data',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'login',value:'fixture',domain:'.twitch.tv',path:'/'}]);
 const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><main>Twitch fixture</main></body></html>'}));
 await page.addInitScript(()=>{
  window.fixtureManager=new Map([['exp:v3:shift:settings',{keep:'neighbor'}]]);
  window.GM_getValue=(key,fallback)=>fixtureManager.has(key)?fixtureManager.get(key):fallback;
  window.GM_setValue=(key,value)=>fixtureManager.set(key,structuredClone(value));window.GM_deleteValue=key=>fixtureManager.delete(key);window.GM_listValues=()=>[...fixtureManager.keys()];
  window.GM_xmlhttpRequest=({onload})=>queueMicrotask(()=>onload?.({status:503,responseText:'{}'}));
  localStorage.setItem('tdh-settings-v3',JSON.stringify({muteRestarted:false,findNextStream:false,claimDrops:false,claimBonus:false,keepTabActive:false,authToken:'obsolete-secret'}));
  window.fixtureEvents=[];window.addEventListener('tdh-twitch-gql-intercept-v1',e=>fixtureEvents.push(e.detail));
  window.fetch=async()=>new Response(JSON.stringify([{data:{chat:'private'}},{data:{currentUser:{inventory:{dropCampaignsInProgress:[],gameEventDrops:[]},email:'private'}}}]),{status:200});
 });
 await page.goto('https://www.twitch.tv/fixture');
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../dropper.user.js'),'utf8')});
 const host=page.locator('#tdh-root');await host.waitFor({state:'attached'});
 assert.equal(await page.evaluate(()=>fixtureManager.get('exp:v3:dropper:settings').muteRestarted),false);
 assert.equal(await page.evaluate(()=>fixtureManager.get('exp:v3:dropper:settings').authToken),undefined);
 assert.equal(await page.evaluate(()=>localStorage.getItem('tdh-settings-v3')),null);
 await page.evaluate(async()=>{
  const body=JSON.stringify(['Chat','Inventory'].map(operationName=>({operationName,variables:{},extensions:{persistedQuery:{sha256Hash:'a'.repeat(64)}}})));
  const response=await fetch('https://gql.twitch.tv/gql',{body,headers:{authorization:'OAuth private','client-id':'kimne78kx3ncx6brgo4mv6wki5h1ko'}});
  window.fixtureResponse=await response.json();
 });
 await page.waitForFunction(()=>fixtureEvents.length>0);
 const event=await page.evaluate(()=>fixtureEvents.at(-1));assert.equal(event.operations.length,1);assert.equal(event.operations[0].name,'Inventory');
 assert.equal(event.headers.authorization,undefined);assert.equal(event.json[0].data.currentUser.email,undefined);
 assert.equal(await page.evaluate(()=>fixtureResponse[0].data.chat),'private','Twitch still receives its original response');
 await page.evaluate(()=>dropperShow());await host.locator('[data-panel="tdh-diagnostics-body"]').click();
 await host.getByRole('tab',{name:'Reset',exact:true}).click();
 await host.getByRole('button',{name:'Reset All Settings',exact:true}).click();
 assert.equal(await page.evaluate(()=>fixtureManager.has('exp:v3:dropper:settings')),true,'first tap only arms reset');
 // Cancel the navigation while inspecting the state immediately after reset.
 await page.route('https://www.twitch.tv/fixture',r=>r.abort());
 await host.getByRole('button',{name:'Tap Again to Reset',exact:true}).click();
 assert.equal(await page.evaluate(()=>fixtureManager.has('exp:v3:dropper:settings')),false);
 assert.equal(await page.evaluate(()=>fixtureManager.has('exp:v3:shift:settings')),true);
});
