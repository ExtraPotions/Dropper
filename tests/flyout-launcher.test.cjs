'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { openProduct, openFlyout, hubBox } = require('./helpers/flyout.cjs');

// A Twitch channel page: the top bar (search and the right-hand icons) and the chat column's Stream Chat title bar.
const TWITCH = `<nav data-a-target="top-nav-container" style="position:fixed;top:0;left:0;right:0;height:50px;background:#18181b"><div class="top-nav__menu" style="display:flex;align-items:center;height:50px"><div style="width:371px;flex:none"></div><div style="flex:1;display:flex;justify-content:center"><input type="search" data-a-target="tw-input" style="width:356px;height:36px"><button style="width:36px;height:36px">S</button></div><div style="display:flex;gap:8px;padding:0 8px;flex:none"><button style="width:56px;height:30px">Log In</button><button style="width:68px;height:30px">Sign Up</button></div></div></nav>
<div class="stream-chat-header" style="position:fixed;left:1260px;top:50px;width:340px;height:40px;background:#18181b">Stream Chat</div>`;
const OTHER = fs.readFileSync(path.join(__dirname, '../vendor/exp-core/exp-core.js'), 'utf8');
const otherProduct = id => `(()=>{\n${OTHER}\nExtraPotionsCore.createProduct({id:'${id}',name:'${id}',version:'1.0.0',artwork:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="%2380d7d2"/></svg>',theme:{id:'${id}',name:'${id}',swatch:'#80d7d2',bg:'#101014',panel:'#18181d',line:'#34343b',text:'#efeff1',muted:'#adadb8',accent:'#80d7d2',accent2:'#80d7d2',skin:'#80d7d2',skinVertical:'#80d7d2'},sections:[]});\n})();`;

async function open(t, { others = ['shift'], body = TWITCH, drop = null, viewport = { width: 1600, height: 900 } } = {}) {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }]);
  const page = await context.newPage();
  if (drop) await page.addInitScript(value => sessionStorage.setItem('tdh-drop:account:signed-out', value), JSON.stringify(drop));
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: `<body style="margin:0;background:#0e0e10;color:#ccc">${body}</body>` }) : r.abort());
  await page.goto('https://www.twitch.tv/sample_streamer');
  await page.evaluate(() => { window.GM_xmlhttpRequest = () => ({ abort() {} }); });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  for (const id of others) await page.addScriptTag({ content: otherProduct(id) });
  const host = page.locator('#tdh-root'); await host.waitFor({ state: 'attached' });
  await page.waitForTimeout(600);
  return { page, host };
}
const strip = host => host.evaluate(n => {
  const s = n.shadowRoot, card = s.getElementById('tdh-drop-card'), r = card.getBoundingClientRect();
  const shown = id => { const e = s.getElementById(id); return Boolean(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); };
  return { presentation: card.dataset.presentation, anchor: card.dataset.stripAnchor || '', box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    channel: shown('tdh-stream-channel'), percent: shown('tdh-drop-percent'), meta: shown('tdh-drop-meta'), name: shown('tdh-drop-name'), status: shown('tdh-drop-state'),
    art: shown('tdh-strip-art'), stripMeta: shown('tdh-strip-meta'), skip: shown('tdh-skip-streamer'),
    radius: getComputedStyle(card).borderRadius, bg: getComputedStyle(card).backgroundColor };
});


for(const others of [[],['shift'],['prisma','ward','shift']])test('compact card remains independent of launcher peers: '+others.join(','),async t=>{
 const {page,host}=await open(t,{others});const initial=await strip(host);assert.equal(initial.presentation,'compact-card');assert.ok(initial.box[2]>0&&initial.box[3]>0);
 assert.ok(initial.box[0]>=0&&initial.box[1]>=0&&initial.box[0]+initial.box[2]<=1600&&initial.box[1]+initial.box[3]<=900);
 await host.locator('[data-exp-part="launcher"]').evaluate(n=>n.click());await host.locator('.exp-menu-workspace').waitFor();
 const a=await host.locator('#tdh-drop-card').boundingBox(),b=await host.locator('[data-exp-part="dock"]').boundingBox();assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'menu clears card');
 assert.equal(await host.locator('#tdh-card-pause').count(),1);assert.equal(await host.locator('[data-exp-part="dock"] #tdh-card-pause').count(),0);
 if(others.length){await host.locator('#tdh-rail-close').click();await openFlyout(page);assert.equal((await hubBox(page)).open,true);}
});
test('compact card and notice stay bounded at a narrow width and with long reward text',async t=>{
 const {page,host}=await open(t,{viewport:{width:360,height:700},body:''});await host.evaluate(n=>{const r=n.shadowRoot;r.getElementById('tdh-drop-name').textContent='A long campaign reward '.repeat(8);r.getElementById('tdh-stream-game').textContent='A very long game name '.repeat(8);});
 await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await page.waitForTimeout(100);
 assert.ok(await host.locator('#tdh-drop-card').evaluate(n=>{const r=n.getBoundingClientRect();return n.scrollWidth<=n.clientWidth&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
 await host.locator('[data-exp-part="launcher"]').evaluate(n=>n.click());await host.locator('#tdh-header-version').click();
 assert.ok(await host.locator('.update-notice:visible').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
});
