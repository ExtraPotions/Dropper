'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('System tools use readable full-width rows and remain contained when expanded', async t => {
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
  const maintenance = await host.evaluate(h => {
    const s = h.shadowRoot;
    const body = s.getElementById('tdh-diagnostics-body');
    const sections = [...body.querySelectorAll('details')].filter(d => d.querySelector(':scope > summary')?.textContent.trim() === 'Maintenance');
    const section = sections[0];
    section.open = true;
    const ids = ['tdh-check-updates', 'tdh-refresh-campaign-data', 'tdh-clear-activity', 'tdh-refresh-now', 'tdh-reset-session'];
    return { count: sections.length, inTools: section.parentElement.hasAttribute('data-dropper-tools'),
      buttons: ids.map(id => ({id, count: body.querySelectorAll('#' + id).length, contained: section.contains(s.getElementById(id)), visible: s.getElementById(id).getBoundingClientRect().height > 0})) };
  });
  assert.equal(maintenance.count, 1, 'System must have one functional Maintenance section');
  assert.equal(maintenance.inTools, true);
  assert.ok(maintenance.buttons.every(b => b.count === 1 && b.contained && b.visible), JSON.stringify(maintenance));
  for (const width of [280, 596, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    for (const open of [false,true]) {
      const result = await host.evaluate((h,{width,open}) => {
        const s=h.shadowRoot;
        const group=s.querySelector('[data-dropper-tools]');
        const cards=[...group.children];cards.forEach(c=>c.open=open);
        const rect=group.getBoundingClientRect(),body=group.parentElement.getBoundingClientRect();
        return { columns:getComputedStyle(group).gridTemplateColumns.split(' ').length,
          fullWidth:Math.abs(rect.width-(body.width-20))<2,
          horizontal:group.scrollWidth-group.clientWidth,
          diagnosticGap:rect.top-s.querySelector('#tdh-diagnostics-body > .action-pair').getBoundingClientRect().bottom,
          summaryTargets:cards.map(c=>c.querySelector('summary').getBoundingClientRect().height),
          cards:cards.map(c=>{const r=c.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,height:r.height};}) };
      },{width,open});
      assert.equal(result.columns,1,JSON.stringify({width,open,result}));
      assert.ok(result.fullWidth,JSON.stringify(result));
      assert.ok(result.horizontal<=1,JSON.stringify(result));
      assert.ok(result.diagnosticGap>=10,JSON.stringify(result));
      assert.ok(result.summaryTargets.every(height=>height>=24),JSON.stringify(result));
      if(!open)assert.ok(result.cards.every(c=>c.height>=36&&c.height<=40),JSON.stringify(result));
      if(open)assert.ok(result.cards.every(c=>Math.abs((c.right-c.left)-(result.cards[0].right-result.cards[0].left))<2));
      if(!open)assert.ok(Math.max(...result.cards.map(c=>c.height))-Math.min(...result.cards.map(c=>c.height))<=1,JSON.stringify(result));
      if(!open){assert.equal(result.cards[1].left,result.cards[0].left);assert.ok(result.cards[1].top>result.cards[0].top);}
    }
  }
});
