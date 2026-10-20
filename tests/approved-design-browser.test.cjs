'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const {assembleParts}=require('../scripts/assemble-parts.cjs');
const {assembleDropperSource}=require('../scripts/core-modules.cjs');
const source=assembleDropperSource(assembleParts(root),root);
const exposed=source.replace('  startDropper();\n})();',`  window.__approvedDesign={
    drop(value){currentDrop=value;refreshStreamInfo();syncProgressSurfaces();},
    open:setRailOpen,layout:layoutChrome,dock:positionChatProgressCard,
    size(value){ExtraPotionsCore.setMenuSizePreference(value);},
    pause(){syncViewingContext();viewingIntent.pause(true);syncCompactState();},
    intent:()=>viewingIntent.snapshot(),settings:()=>({...settings}),
    strategy(value){settings.findNextStream=value;refreshStreamPolicyControl();},
    arm:armSkipCurrentStreamer,info:readStreamInfo,
    state:()=>({drop:currentDrop,routing:readRoutingControllerSession(),grace:explicitViewingNavigationUntil}),
  };startDropper();\n})();`);
assert.notEqual(source,exposed);
const evidence=process.env.EXP_APPROVED_EVIDENCE;if(evidence)require('fs').mkdirSync(evidence,{recursive:true});
const reward={id:'fixture-reward',campaignKey:'fixture-campaign',game:'Target Game',name:'Fixture reward',requiredMinutes:60,currentMinutes:49,percent:81};
async function fixture(t,run,{chat=false,width=1280}={}){
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext({viewport:{width,height:900}});
 await context.addCookies([{name:'login',value:'fixture-viewer',domain:'.twitch.tv',path:'/'},{name:'auth-token',value:'fixture-token',domain:'.twitch.tv',path:'/'}]);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:`<!doctype html><video></video><div id="live-channel-stream-information"><h1 data-a-target="stream-title">Fixture live</h1><a data-a-target="stream-game-link" href="/directory/category/another-game">Another Game</a><span class="tw-channel-status-text-indicator">LIVE</span></div>${chat?'<aside class="stream-chat" style="position:fixed;right:-1px;top:90px;width:340px;height:700px"><div class="chat-room__content"><div id="fixture-leaderboard" style="height:71px"><button aria-label="Previous leaderboard set">Previous</button></div><p>Fixture chat</p></div></aside>':''}`}):r.abort());
 await page.addInitScript(()=>{const values=new Map();window.GM_getValue=(k,d)=>values.has(k)?values.get(k):d;window.GM_setValue=(k,v)=>values.set(k,v);window.GM_xmlhttpRequest=o=>{queueMicrotask(()=>o.onerror?.({status:503}));return{abort(){}};};document.addEventListener('DOMContentLoaded',()=>{const v=document.querySelector('video');let paused=false;Object.defineProperty(v,'paused',{get:()=>paused});Object.defineProperty(v,'readyState',{get:()=>4});v.play=()=>{paused=false;v.dispatchEvent(new Event('playing'));return Promise.resolve()};v.pause=()=>{paused=true;v.dispatchEvent(new Event('pause'));};});});
 await page.goto('https://www.twitch.tv/fixture-channel');await page.addScriptTag({content:exposed});const host=page.locator('#tdh-root');await host.waitFor({state:'attached'});await run(page,host);assert.deepEqual(errors,[]);
}
test('IA1 has Campaigns Settings Look System and keeps infrequent controls under Advanced',async t=>fixture(t,async(page,host)=>{
 await page.evaluate(()=>window.__approvedDesign.open(true,true));assert.deepEqual(await host.getByRole('tab').allTextContents(),['Campaigns','Settings','Look','System']);
 await host.getByRole('tab',{name:'Settings',exact:true}).click();const advanced=host.locator('#tdh-settings-advanced');assert.equal(await advanced.count(),1);assert.equal(await advanced.evaluate(e=>e.open),false);
 assert.equal(await host.getByRole('combobox',{name:'Stream switching',exact:true}).count(),1);assert.equal(await advanced.locator('#tdh-quiet-hours').count(),1);assert.equal(await advanced.locator('#tdh-queue-count').count(),1);
 assert.equal(await host.locator('#tdh-streams-body').getByRole('switch',{name:'Claim completed Drops',exact:true}).isVisible(),true);
}));
test('one DP1 card moves between chat and menu, with credited time, confirmed Skip and state-aware Pause Resume',async t=>fixture(t,async(page,host)=>{
 await page.evaluate(drop=>window.__approvedDesign.drop(drop),reward);const card=host.locator('#tdh-drop-card');
 assert.equal(await card.locator('.compact-card-actions #tdh-drop-meta').count(),1);assert.equal(await card.locator('.compact-card-actions #tdh-skip-streamer').isVisible(),true);
 if(evidence){await page.waitForTimeout(500);await card.screenshot({path:path.join(evidence,'progress-outside-waiting.png')});}
 await card.getByRole('button',{name:'Pause',exact:true}).click();assert.equal(await card.locator('#tdh-card-pause').innerText(),'Resume');
 await card.locator('#tdh-skip-streamer').click();assert.equal(await card.locator('.skip-label').innerText(),'Confirm');assert.equal(await page.evaluate(()=>window.__approvedDesign.intent().paused),true);await page.keyboard.press('Escape');assert.equal(await card.locator('.skip-label').innerText(),'Skip');
 await page.evaluate(()=>window.__approvedDesign.open(true,true));assert.equal(await host.locator('[data-exp-part=dock] #tdh-drop-card').count(),1);assert.equal(await card.locator('#tdh-card-menu').isVisible(),false);assert.equal(await card.locator('#tdh-card-pause').innerText(),'Resume');if(evidence){await card.screenshot({path:path.join(evidence,'progress-inside-paused.png')});await host.locator('[data-exp-part=dock]').screenshot({path:path.join(evidence,'dropper-menu-paused.png')});}
 const menuBoxes=[];for(let n=0;n<4;n++){await page.evaluate(()=>window.__approvedDesign.layout());menuBoxes.push(await host.locator('[data-exp-part=dock]').boundingBox());}assert.ok(menuBoxes.every(b=>Math.abs(b.x-menuBoxes[0].x)<1&&Math.abs(b.y-menuBoxes[0].y)<1),'own embedded card does not displace its menu');
 for(const mode of ['standard','compact','mini']){await page.evaluate(mode=>{window.__approvedDesign.size(mode);},mode);assert.equal(await host.locator('#tdh-drop-card').count(),1);assert.equal(await host.getAttribute('data-exp-menu-size'),mode);assert.ok(await card.evaluate(n=>{const a=n.getBoundingClientRect(),b=n.closest('[data-exp-part=dock]').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&n.scrollWidth<=n.clientWidth;}));}
 await page.evaluate(()=>window.__approvedDesign.open(false,true));assert.equal(await host.locator('[data-exp-part=dock] #tdh-drop-card').count(),0);assert.equal(await card.locator('#tdh-card-menu').isVisible(),true);
}));
test('chat slot touching the viewport edge docks and stays stable across repeated layout',async t=>fixture(t,async(page,host)=>{
 await page.evaluate(drop=>window.__approvedDesign.drop(drop),reward);await page.evaluate(()=>{window.__approvedDesign.open(false,true);window.__approvedDesign.layout();});const card=host.locator('#tdh-drop-card');
 assert.equal(await card.getAttribute('data-chat-docked'),'true');const samples=[];for(let i=0;i<4;i++){await page.evaluate(()=>window.__approvedDesign.layout());samples.push(await card.boundingBox());}assert.ok(samples.every(r=>Math.abs(r.x-samples[0].x)<1&&Math.abs(r.y-samples[0].y)<1));assert.ok(samples[0].x+samples[0].width<=1280);
 await page.evaluate(()=>window.__approvedDesign.open(true,true));assert.equal(await page.locator('#fixture-leaderboard').getAttribute('aria-hidden'),null,'menu placement restores native leaderboard');
},{chat:true}));
test('progress identity follows the selected reward rather than another channel category, and empty credit stays unknown',async t=>fixture(t,async(page,host)=>{
 await page.evaluate(drop=>window.__approvedDesign.drop(drop),reward);assert.equal(await page.evaluate(()=>window.__approvedDesign.info().game),'Another Game');assert.equal(await host.locator('#tdh-stream-game').innerText(),'Target Game');
 await page.evaluate(()=>window.__approvedDesign.drop(null));assert.equal(await host.locator('#tdh-drop-meta').innerText(),'— / — min');assert.equal(await host.locator('#tdh-card-pause').innerText(),'Resume');assert.equal(await host.locator('#tdh-card-pause').isDisabled(),true);
}));


test('one switching policy retains preferences and confirmed Skip never resumes manual pause or discards credit',async t=>fixture(t,async(page,host)=>{
 await page.evaluate(drop=>{window.__approvedDesign.drop(drop);window.__approvedDesign.open(true,true);window.__approvedDesign.pause();},reward);
 await host.getByRole('tab',{name:'Settings',exact:true}).click();const policy=host.getByRole('combobox',{name:'Stream switching',exact:true});
 await page.evaluate(()=>window.__approvedDesign.strategy(true));assert.equal(await policy.inputValue(),'held','a browsing tab does not pretend navigation is enabled');await policy.selectOption('off');assert.equal(await page.evaluate(()=>window.__approvedDesign.settings().findNextStream),false);
 await policy.selectOption('stopped-earning');assert.equal(await page.evaluate(()=>window.__approvedDesign.settings().switchPolicy),'stopped-earning');assert.equal(await page.evaluate(()=>window.__approvedDesign.intent().paused),true);
 await policy.selectOption('normal');const skip=host.locator('#tdh-skip-streamer');await skip.click();await skip.click();
 const result=await page.evaluate(()=>({state:window.__approvedDesign.state(),intent:window.__approvedDesign.intent(),url:location.href}));assert.equal(result.intent.paused,true);assert.equal(result.state.grace,0);assert.equal(result.state.drop.currentMinutes,49);assert.equal(result.state.drop.id,reward.id);assert.equal(result.state.routing.state,'find-stream');assert.match(result.url,/fixture-channel$/);assert.equal(await host.locator('#tdh-card-pause').innerText(),'Resume');
}));
