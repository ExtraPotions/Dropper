'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
for (const [pointer, context, minTarget] of [['fine pointer', {}, 28], ['coarse pointer', { hasTouch: true, isMobile: true }, 44]]) test(`System groups Status, Support, and Reset and keeps them readable and contained (${pointer})`, async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 360, height: 720 }, ...context });
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({contentType:'text/html',body:'<main>Fixture</main>'}) : r.abort());
  await page.goto('https://www.twitch.tv/layout-fixture');
  await page.evaluate(() => { window.GM_xmlhttpRequest = () => {}; });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  const host = page.locator('#tdh-root'); await host.waitFor({state:'attached'});
  await host.locator('#tdh-settings-launcher').click(); await host.locator('[data-exp-section-tab="tdh-diagnostics-body"]').click();
  const system = host.locator('[data-exp-product-system]');
  assert.deepEqual(await system.locator('[data-exp-system-item]').evaluateAll(nodes => nodes.map(n => n.dataset.expSystemItem)), ['status','support','reset']);
  assert.equal(await system.locator('[data-exp-system-item="status"]').evaluate(n => n.open), true, 'Status stays open so Resume recovery is visible');
  assert.equal(await host.locator('#tdh-progress-body [data-dropper-menu-preferences]').count(), 1, 'Menu Preferences live in Appearance');
  await system.getByRole('tab',{name:'Support',exact:true}).click();
  assert.deepEqual(await system.locator('.action-pair button').evaluateAll(nodes => nodes.map(n => n.textContent)), ['Copy Diagnostics','Show Diagnostics'], 'Copy comes first');
  assert.equal(await system.getByRole('button',{name:'Show Diagnostics',exact:true}).count(),1);
  assert.equal(await system.getByRole('button',{name:'Copy Diagnostics',exact:true}).count(),1);
  assert.equal(await system.getByText('Maintenance',{exact:true}).count(),0);
  for(const width of [280,596,1280]) {
    await page.setViewportSize({width,height:720});
    for(const name of ['Status','Support','Reset']) {
      await system.getByRole('tab',{name,exact:true}).click();
      const result=await system.evaluate(group=>({horizontal:group.scrollWidth-group.clientWidth,selected:group.querySelectorAll('[role="tab"][aria-selected="true"]').length,visiblePanels:[...group.querySelectorAll('[role="tabpanel"]')].filter(n=>!n.hidden).length,targets:[...group.querySelectorAll('[role="tab"]')].map(n=>n.getBoundingClientRect().height)}));
      assert.ok(result.horizontal<=1,JSON.stringify(result));assert.equal(result.selected,1);assert.equal(result.visiblePanels,1);assert.ok(result.targets.every(height=>height>=minTarget),JSON.stringify(result));
      if(name==='Support')assert.equal(await system.getByRole('button',{name:'Show Diagnostics',exact:true}).isVisible(),true);
      if(name==='Reset'){const button=system.getByRole('button',{name:'Reset All Settings',exact:true});assert.equal(await button.isVisible(),true);assert.deepEqual(await button.evaluate(n=>{const s=getComputedStyle(n);return {destructive:n.dataset.expDestructive,color:s.color,border:s.borderTopColor,background:s.backgroundColor};}),{destructive:'1',color:'rgb(252, 165, 165)',border:'rgb(248, 113, 113)',background:'rgba(0, 0, 0, 0)'},'Reset keeps the destructive outline style');}
    }
  }
});
test('Dropper menu has one primary action and a header status', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 360, height: 720 } });
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({contentType:'text/html',body:'<main>Fixture</main>'}) : r.abort());
  await page.goto('https://www.twitch.tv/layout-fixture');
  await page.evaluate(() => { window.GM_xmlhttpRequest = () => {}; });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  const host = page.locator('#tdh-root'); await host.waitFor({state:'attached'});
  await host.locator('#tdh-settings-launcher').click();
  const primary = host.locator('[data-exp-primary="1"]');
  assert.equal(await primary.count(), 1);
  assert.equal(await primary.getAttribute('id'), 'tdh-toggle-inventory');
  const status = host.locator('[data-exp-part="status"]');
  assert.equal(await status.count(), 1);
  assert.ok((await status.textContent()).trim().length > 0, 'header status text is not empty');
});
