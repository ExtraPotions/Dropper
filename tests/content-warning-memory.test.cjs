'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=require('./load-source.cjs').loadDropperSource();
const start=source.indexOf('  // BEGIN DROPPER CONTENT WARNING MEMORY');
const end=source.indexOf('  // END DROPPER CONTENT WARNING MEMORY',start);
assert.ok(start>=0&&end>start,'content warning memory is included in the assembled source');
const moduleSource=source.slice(start,end);
const gate=(labels=['Violent and Graphic Depictions'],extra='')=>`<div data-a-target="player-overlay-content-gate"><h2>Content Classification Labels</h2><ul>${labels.map(label=>`<li>${label}</li>`).join('')}</ul><button data-a-target="content-classification-gate-overlay-start-watching-button">Start Watching</button>${extra}</div>`;
async function fixture(t,{enabled=true,stored=[],html=gate()}={}){
 const browser=await chromium.launch();t.after(()=>browser.close());
 const page=await browser.newPage();
 await page.route('https://www.twitch.tv/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>'+html+'</body>'}));
 await page.goto('https://www.twitch.tv/firstchannel');
 await page.addScriptTag({content:`const settings={rememberContentWarnings:${enabled}};let productResetting=false;let sitePaused=false;const ExtraPotionsCore={suiteSitePaused:()=>sitePaused};const store=new Map([['exp:v3:dropper:content-warning-memory',${JSON.stringify(stored)}]]);window.GM_getValue=(k,f)=>store.has(k)?store.get(k):f;window.GM_setValue=(k,v)=>store.set(k,structuredClone(v));let recentPlaybackControl={action:'',at:0};function watchingLogin(){return location.pathname.split('/')[1]||'';}function logActivity(){}${moduleSource}\nwindow.testWarnings={process:()=>contentWarningMemory.process(),clear:()=>contentWarningMemory.clear(),dispose:()=>contentWarningMemory.dispose(),snapshot:()=>contentWarningMemory.snapshot(),stored:()=>store.get('exp:v3:dropper:content-warning-memory'),enable:value=>settings.rememberContentWarnings=value,pause:value=>sitePaused=value,reset:()=>{productResetting=true;contentWarningMemory.dispose();store.clear();}};contentWarningMemory.install();`});
 await page.evaluate(()=>{window.gateClicks=0;document.addEventListener('click',event=>{if(event.target.matches('[data-a-target="content-classification-gate-overlay-start-watching-button"]')){window.gateClicks++;if(!window.keepGate)event.target.closest('[data-a-target="player-overlay-content-gate"]').remove();}});});
 return page;
}
const installGate=async(page,labels,channel='secondchannel')=>page.evaluate(({html,channel})=>{history.pushState({},'', '/'+channel);document.body.insertAdjacentHTML('beforeend',html);},{html:gate(labels),channel});

test('manual acceptance is remembered site-wide and survives a fresh module instance',async t=>{
 const page=await fixture(t);await page.click('[data-a-target="content-classification-gate-overlay-start-watching-button"]');
 await page.waitForFunction(()=>testWarnings.stored().includes('graphic-violence'));
 const saved=await page.evaluate(()=>testWarnings.stored());
 await installGate(page,['Violent and Graphic Depictions']);await page.evaluate(()=>testWarnings.process());
 assert.equal(await page.locator('[data-a-target="player-overlay-content-gate"]').count(),0);
 assert.equal(await page.evaluate(()=>gateClicks),2);
 const restored=await fixture(t,{stored:saved});await restored.evaluate(()=>testWarnings.process());
 assert.equal(await restored.evaluate(()=>gateClicks),1);
});

test('new warning types require manual acceptance before combinations work across channels',async t=>{
 const page=await fixture(t,{stored:['graphic-violence'],html:gate(['Violent and Graphic Depictions','Gambling'])});
 await page.evaluate(()=>testWarnings.process());assert.equal(await page.evaluate(()=>gateClicks),0);
 await page.click('[data-a-target="content-classification-gate-overlay-start-watching-button"]');
 await page.waitForFunction(()=>testWarnings.stored().includes('gambling'));
 await installGate(page,['Gambling','Violent and Graphic Depictions']);await page.evaluate(()=>testWarnings.process());
 assert.equal(await page.evaluate(()=>gateClicks),2);
});

test('synthetic clicks and unsuccessful manual confirmations never teach new warnings',async t=>{
 const page=await fixture(t);await page.evaluate(()=>{keepGate=true;document.querySelector('button').click();});
 assert.deepEqual(await page.evaluate(()=>testWarnings.stored()),[]);
 await page.click('button');await page.waitForTimeout(2300);
 assert.deepEqual(await page.evaluate(()=>testWarnings.stored()),[]);
});

test('disabled, paused, hidden, and unrelated prompts are left alone',async t=>{
 const page=await fixture(t,{enabled:false,stored:['graphic-violence']});await page.evaluate(()=>testWarnings.process());
 assert.equal(await page.evaluate(()=>gateClicks),0);
 await page.evaluate(()=>{testWarnings.enable(true);testWarnings.pause(true);testWarnings.process();});
 assert.equal(await page.evaluate(()=>gateClicks),0);
 await page.evaluate(()=>{testWarnings.pause(false);document.querySelector('[data-a-target="player-overlay-content-gate"]').hidden=true;testWarnings.process();});
 assert.equal(await page.evaluate(()=>gateClicks),0);
 const unrelated=await fixture(t,{stored:['graphic-violence'],html:'<div data-a-target="player-overlay-content-gate"><p>Sign in to watch</p><button>Start Watching</button></div>'});
 await unrelated.evaluate(()=>testWarnings.process());assert.equal(await unrelated.locator('button').count(),1);
});

test('unknown labels, age-verification prompts, and disabled controls never auto-accept',async t=>{
 for(const html of [gate(['Violent and Graphic Depictions','Unknown classification']),gate(['Violent and Graphic Depictions'],'<p>Verify your age to watch</p>'),gate().replace('>Start Watching',' disabled>Start Watching')]){
  const page=await fixture(t,{stored:['graphic-violence'],html});await page.evaluate(()=>testWarnings.process());assert.equal(await page.evaluate(()=>gateClicks),0);
 }
});

test('a persistent warning is attempted only once per button and bounded across rerenders',async t=>{
 const page=await fixture(t,{stored:['graphic-violence']});await page.evaluate(()=>{keepGate=true;for(let i=0;i<20;i++)testWarnings.process();});
 assert.equal(await page.evaluate(()=>gateClicks),1);
 await page.evaluate(()=>{document.querySelector('[data-a-target="player-overlay-content-gate"]').remove();});
 await installGate(page,['Violent and Graphic Depictions'],'firstchannel');await page.evaluate(()=>testWarnings.process());
 assert.equal(await page.evaluate(()=>gateClicks),1);
});

test('forget and reset remove site-wide consent and diagnostics contain no page content',async t=>{
 const page=await fixture(t,{stored:['graphic-violence','junk','gambling']});
 const snapshot=await page.evaluate(()=>testWarnings.snapshot());assert.equal(snapshot.rememberedTypes,2);
 assert.doesNotMatch(JSON.stringify(snapshot),/Mature|Gambling|firstchannel/);
 await page.evaluate(()=>testWarnings.clear());await page.evaluate(()=>testWarnings.process());assert.equal(await page.evaluate(()=>gateClicks),0);
 assert.deepEqual(await page.evaluate(()=>testWarnings.stored()),[]);
 await page.evaluate(()=>testWarnings.reset());await page.click('button');await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>testWarnings.stored()),undefined);
});

test('a settings change in another tab disables site-wide acceptance',async t=>{
 const page=await fixture(t,{stored:['graphic-violence']});
 await page.evaluate(()=>{GM_setValue('exp:v3:dropper:settings',{rememberContentWarnings:false});testWarnings.process();});
 assert.equal(await page.evaluate(()=>gateClicks),0);
});

test('an explicit playback pause is preserved while remembered warnings wait',async t=>{
 const page=await fixture(t,{stored:['graphic-violence']});
 await page.evaluate(()=>{window.viewingIntent={snapshot:()=>({paused:true,pauseReason:'viewer'})};testWarnings.process();});
 assert.equal(await page.evaluate(()=>gateClicks),0);
});

test('failed manager writes do not create remembered consent',async t=>{
 const page=await fixture(t);await page.evaluate(()=>{GM_setValue=()=>{throw Error('blocked');};});
 await page.click('button');await page.waitForFunction(()=>testWarnings.snapshot().state==='storage-unavailable');
 assert.deepEqual(await page.evaluate(()=>testWarnings.stored()),[]);
});

test('the minified install learns across channel visits and the menu can forget warnings',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage();
 const manager=new Map([['exp:v3:dropper:settings',{rememberContentWarnings:true,claimBonus:false,claimDrops:false,keepTabActive:false}]]);
 await page.exposeFunction('readManager',key=>manager.get(key));
 await page.exposeFunction('writeManager',(key,value)=>manager.set(key,value));
 await page.route('https://www.twitch.tv/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>'+gate()+'</body>'}));
 await page.addInitScript(({saved})=>{
  const values=new Map(Object.entries(saved));
  window.GM_getValue=(key,fallback)=>values.has(key)?values.get(key):fallback;
  window.GM_setValue=(key,value)=>{values.set(key,value);void window.writeManager(key,value);};
  window.GM_xmlhttpRequest=options=>{queueMicrotask(()=>options.onerror?.({status:503}));return {abort(){}};};
  document.addEventListener('click',event=>{if(event.target.matches('button[data-a-target="content-classification-gate-overlay-start-watching-button"]'))event.target.closest('[data-a-target="player-overlay-content-gate"]').remove();});
 },{saved:Object.fromEntries(manager)});
 await page.addInitScript({content:require('node:fs').readFileSync(require('node:path').join(__dirname,'../dropper.user.js'),'utf8')});
 await page.goto('https://www.twitch.tv/firstchannel');await page.locator('#tdh-root').waitFor({state:'attached'});
 await page.click('[data-a-target="content-classification-gate-overlay-start-watching-button"]');
 await page.waitForFunction(()=>GM_getValue('exp:v3:dropper:content-warning-memory',[]).length===1);
 await installGate(page,['Violent and Graphic Depictions']);
 await page.locator('[data-a-target="player-overlay-content-gate"]').waitFor({state:'detached',timeout:7000});
 await page.evaluate(()=>dropperShow());
 const host=page.locator('#tdh-root');
 await host.evaluate(n=>n.shadowRoot.querySelector('[data-panel="tdh-streams-body"]').click());
 await host.evaluate(n=>{const playback=[...n.shadowRoot.querySelectorAll('details')].find(n=>n.querySelector('summary')?.textContent.trim()==='Playback options');playback.open=true;});
 const toggle=await host.evaluate(n=>n.shadowRoot.querySelector('#tdh-remember-content-warnings').getAttribute('role'));
 assert.equal(toggle,'switch');
 await host.evaluate(n=>n.shadowRoot.querySelector('#tdh-forget-content-warnings').click());
 assert.deepEqual(await page.evaluate(()=>GM_getValue('exp:v3:dropper:content-warning-memory',[])),[]);
 await installGate(page,['Violent and Graphic Depictions'],'thirdchannel');
 await page.waitForTimeout(5200);assert.equal(await page.locator('[data-a-target="player-overlay-content-gate"]').count(),1);
});
