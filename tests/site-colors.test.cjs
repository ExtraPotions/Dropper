'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
// Mirrors Twitch: colour variables on :root, light/dark from the html class, and a dark overlay container with its own values.
const page = `<!doctype html><html class="tw-root--theme-dark"><style>:root{--color-background-body:#0e0e10;--color-background-base:#18181b;--color-text-base:#efeff1;--color-text-link:#bf94ff;--color-background-button-primary-default:#9147ff}
body{background:var(--color-background-body);color:var(--color-text-base)}.card{background:var(--color-background-base)}.overlay{--color-background-base:rgba(0,0,0,.85)}</style>
<body><main class="card">Directory</main><div class="overlay"><span class="card">Overlay</span></div></body></html>`;
test('Slate Blue menu and site modes persist independently and System follows the device',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const tab=await browser.newPage({viewport:{width:834,height:900},colorScheme:'dark'});
 await tab.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:page}):r.abort());await tab.goto('https://www.twitch.tv/directory');
 await tab.evaluate(()=>{window.GM_xmlhttpRequest=()=>{};window.stored=new Map();window.GM_getValue=(k,d)=>stored.has(k)?stored.get(k):d;window.GM_setValue=(k,v)=>stored.set(k,v);});
 await tab.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../dropper.user.js'),'utf8')});const host=tab.locator('#tdh-root');await host.waitFor({state:'attached'});
 await host.locator('#tdh-settings-launcher').click();await host.locator('[data-exp-section-tab=tdh-progress-body]').click();
 const site=host.getByRole('combobox',{name:'Site theme',exact:true}),menu=host.getByRole('combobox',{name:'Menu theme',exact:true});
 for(const select of [site,menu]){assert.deepEqual(await select.locator('option').allTextContents(),['Light','Dark','System']);assert.equal(await select.inputValue(),'system');}
 assert.equal(await host.getByRole('switch',{name:'Custom Opacity'}).count(),0);
 await site.selectOption('light');assert.equal(await tab.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(244, 246, 250)');
 assert.equal(await tab.evaluate(()=>stored.get('exp:v3:dropper:settings').siteColors),'light');
 await menu.selectOption('dark');assert.equal(await host.locator('#tdh-tools-dock').evaluate(n=>getComputedStyle(n).getPropertyValue('--theme-bg').trim()),'#111720');
 await site.selectOption('system');await tab.emulateMedia({colorScheme:'light'});await tab.waitForFunction(()=>document.documentElement.dataset.expSitePalette==='slate-blue-light');
 await menu.selectOption('system');await tab.emulateMedia({colorScheme:'dark'});await tab.waitForFunction(()=>document.documentElement.dataset.expSitePalette==='slate-blue-dark');
 assert.equal(await host.locator('#tdh-tools-dock').evaluate(n=>getComputedStyle(n).getPropertyValue('--theme-bg').trim()),'#111720');
 assert.equal(await tab.locator('#exp-site-colors-dropper').count(),1);
});
