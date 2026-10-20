'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');

async function openMenu(t) {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 960, height: 1200 } });
  await context.addCookies([{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }]);
  const page = await context.newPage();
  await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: '<main>Fixture</main>' }) : r.abort());
  await page.goto('https://www.twitch.tv/sample_streamer');
  await page.evaluate(() => { window.GM_xmlhttpRequest = () => ({ abort() {} }); });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8') });
  const host = page.locator('#tdh-root'); await host.waitFor({ state: 'attached' });
  await host.locator('#tdh-settings-launcher').click();
  return { page, host };
}


test('progress and Pause stay on one compact card inside the menu, then outside when closed',async t=>{
 const {page,host}=await openMenu(t);await page.waitForTimeout(100);
 const card=host.locator('#tdh-drop-card'),dock=host.locator('[data-exp-part="dock"]');
 assert.equal(await card.getAttribute('data-presentation'),'compact-card');assert.equal(await card.isVisible(),true);
 assert.equal(await dock.getByRole('button',{name:/^(Pause|Resume)$/}).count(),1);assert.equal(await host.locator('#tdh-card-pause').count(),1);
 const a=await card.boundingBox(),b=await dock.boundingBox();assert.ok(a.x>=b.x&&a.x+a.width<=b.x+b.width&&a.y>=b.y&&a.y+a.height<=b.y+b.height,'single card contained by menu');
 await host.locator('#tdh-settings-launcher').click();assert.equal(await card.isVisible(),true);
});
test('Advanced expands playback options inline and the header retains the tagline',async t=>{
 const {host}=await openMenu(t);await host.locator('[data-exp-section-tab="tdh-streams-body"]').click();
 const viewing=host.locator('summary').filter({hasText:/^Advanced$/});await viewing.click();
 assert.equal(await host.getByRole('switch',{name:'Mute Opened Streams'}).isVisible(),true);await host.locator('summary').filter({hasText:/^Interruption rules$/i}).click();assert.equal(await host.locator('#tdh-pause-switch').isVisible(),true);
 assert.equal(await host.locator('#tdh-remember-content-warnings').isVisible(),false);await host.locator('summary').filter({hasText:/^Playback options$/}).click();assert.equal(await host.locator('#tdh-remember-content-warnings').isVisible(),true);
 assert.equal(await host.locator('#tdh-rail-subtitle').textContent(),'Your Drops at a glance');
});
test('Badge Only collapses the same card and exposes its full detail on demand',async t=>{
 const {host,page}=await openMenu(t);await host.evaluate(n=>n.shadowRoot.getElementById('tdh-badge-only').click());await page.waitForTimeout(50);
 await host.locator('#tdh-rail-close').click();const card=host.locator('#tdh-drop-card');assert.equal(await card.getAttribute('data-collapsed'),'true');
 await host.getByRole('button',{name:'Show progress card',exact:true}).click();assert.equal(await card.getAttribute('data-collapsed'),'false');assert.equal(await host.locator('#tdh-card-pause').isVisible(),true);
 assert.equal(await host.locator('#tdh-drop-card').count(),1);
});
