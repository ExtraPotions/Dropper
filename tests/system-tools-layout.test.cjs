'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
test('System groups Status, Support, and Reset and keeps them readable and contained', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 360, height: 720 } });
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({contentType:'text/html',body:'<main>Fixture</main>'}) : r.abort());
  await page.goto('https://www.twitch.tv/layout-fixture');
  await page.evaluate(() => { window.GM_xmlhttpRequest = () => {}; });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  const host = page.locator('#tdh-root'); await host.waitFor({state:'attached'});
  await host.locator('#tdh-settings-launcher').click(); await host.locator('[data-panel="tdh-diagnostics-body"]').click();
  const system = host.locator('[data-exp-product-system]');
  assert.deepEqual(await system.locator(':scope > [data-exp-system-item]').evaluateAll(nodes => nodes.map(n => n.dataset.expSystemItem)), ['status','support','reset']);
  assert.equal(await system.locator('[data-exp-system-item="status"]').evaluate(n => n.open), true, 'Status stays open so Resume recovery is visible');
  assert.equal(await host.locator('#tdh-progress-body [data-dropper-menu-preferences]').count(), 1, 'Menu Preferences live in Appearance');
  await system.locator('[data-exp-system-item="support"]').evaluate(n => { n.open = true; });
  assert.deepEqual(await system.locator('.action-pair button').evaluateAll(nodes => nodes.map(n => n.textContent)), ['Copy Diagnostics','Show Diagnostics'], 'Copy comes first');
  assert.equal(await system.getByRole('button',{name:'Show Diagnostics',exact:true}).count(),1);
  assert.equal(await system.getByRole('button',{name:'Copy Diagnostics',exact:true}).count(),1);
  assert.equal(await system.getByText('Maintenance',{exact:true}).count(),0);
  for(const width of [280,596,1280]) {
    await page.setViewportSize({width,height:720});
    for(const open of [false,true]) {
      const result = await system.evaluate((group, open) => {
        const cards = [...group.querySelectorAll(':scope > details')]; cards.forEach(c => { c.open = open; });
        const status=group.querySelector('[data-exp-system-item="status"]'),support=group.querySelector('[data-exp-system-item="support"]'),issue=group.querySelector('[data-exp-system-report]'),reset=group.querySelector('[data-exp-system-item="reset"] button');
        return { columns:getComputedStyle(group).gridTemplateColumns.split(' ').length, horizontal:group.scrollWidth-group.clientWidth,
          diagnosticGap:support.getBoundingClientRect().top-status.getBoundingClientRect().bottom,
          summaryTargets:cards.map(c=>c.querySelector('summary').getBoundingClientRect().height),
          issueWidth:issue.getBoundingClientRect().width,resetWidth:reset.getBoundingClientRect().width };
      },open);
      assert.equal(result.columns,1,JSON.stringify({width,open,result})); assert.ok(result.horizontal<=1,JSON.stringify(result));
      assert.ok(result.diagnosticGap>=7,JSON.stringify(result)); assert.ok(result.summaryTargets.every(height=>height>=24),JSON.stringify(result));
      // Buttons inside closed groups are hidden; compare their widths when the groups are open.
      if(open)assert.ok(Math.abs(result.issueWidth-result.resetWidth)<2,JSON.stringify(result));
    }
  }
});
