'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('System tools fill both columns and remain contained when expanded', async t => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 360, height: 720 } });
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<main>Fixture</main>' })
    : route.abort());
  await page.goto('https://www.twitch.tv/layout-fixture');
  await page.evaluate(() => { window.GM_xmlhttpRequest = () => {}; });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  const host = page.locator('#tdh-root');
  await host.waitFor({ state: 'attached' });
  await host.evaluate(h => { const s=h.shadowRoot; s.querySelector('#tdh-settings-launcher').click(); s.querySelector('[data-panel="tdh-diagnostics-body"]').click(); });
  for (const width of ['full','compact','narrow']) {
    for (const open of [false,true]) {
      const result = await host.evaluate((h,{width,open}) => {
        const s=h.shadowRoot; s.querySelector('#tdh-cluster').dataset.panelWidth=width;
        const group=s.querySelector('[data-dropper-tools]');
        const cards=[...group.children];cards.forEach(c=>c.open=open);
        const rect=group.getBoundingClientRect(),body=group.parentElement.getBoundingClientRect();
        return { columns:getComputedStyle(group).gridTemplateColumns.split(' ').length,
          fullWidth:Math.abs(rect.width-(body.width-20))<2,
          horizontal:group.scrollWidth-group.clientWidth,
          cards:cards.map(c=>{const r=c.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,height:r.height};}) };
      },{width,open});
      assert.equal(result.columns,width==='narrow'?1:2,JSON.stringify({width,open,result}));
      assert.ok(result.fullWidth,JSON.stringify(result));
      assert.ok(result.horizontal<=1,JSON.stringify(result));
      if(open)assert.ok(result.cards.every(c=>Math.abs((c.right-c.left)-(result.cards[0].right-result.cards[0].left))<2));
      if(!open)assert.ok(Math.max(...result.cards.map(c=>c.height))-Math.min(...result.cards.map(c=>c.height))<=1,JSON.stringify(result));
      if(width!=='narrow' && !open){assert.ok(result.cards[1].left>result.cards[0].left);assert.equal(result.cards[1].top,result.cards[0].top);}
    }
  }
});
