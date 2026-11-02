'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const { loadDropperSource } = require('./load-source.cjs');

const root = path.resolve(__dirname, '..');
const source = loadDropperSource(root);
const installPath = path.join(root, 'dropper.user.js');

test('retired palettes and opacity controls cannot return from saved settings',()=>{
 assert.doesNotMatch(source,/PRIDE_RAINBOW|tdh-custom-opacity|tdh-opacity-range/);
 assert.match(source,/delete stored\.customOpacity/);assert.ok(source.includes("stored.uiTheme = ['light','dark','system'].includes(stored.uiTheme)"));
});

test('the changelog notice stays fixed inside the viewport', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 885 } });
    await page.addInitScript(() => {
      window.GM_xmlhttpRequest = () => {};
      localStorage.setItem('exp:v3:launcher-grid-delta', '4');
    });
    await page.route('https://www.twitch.tv/**', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head><title>Twitch</title></head><body></body></html>',
    }));
    await page.goto('https://www.twitch.tv/dropper-changelog-contract');
    await page.addScriptTag({ content: fs.readFileSync(installPath, 'utf8') });
    await page.waitForFunction(() => Boolean(document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-header-version')));
    const facts = await page.evaluate(async () => {
      window.dropperShow?.();
      const shadow = document.getElementById('tdh-root').shadowRoot;
      shadow.getElementById('tdh-header-version').click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const notice = shadow.getElementById('tdh-update-notice');
      const cluster = shadow.getElementById('tdh-cluster');
      const rect = notice.getBoundingClientRect();
      const style = getComputedStyle(notice);
      return {
        hidden: notice.hidden,
        parent: notice.parentElement?.id || null,
        position: style.position,
        color: style.color,
        clusterColor: getComputedStyle(cluster).color,
        backgroundImage: style.backgroundImage,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
    });
    assert.equal(facts.hidden, false);
    assert.equal(facts.parent, 'tdh-cluster');
    assert.equal(facts.position, 'fixed');
    assert.equal(facts.color, facts.clusterColor);
    assert.notEqual(facts.color, 'rgb(0, 0, 0)');
    assert.equal(facts.backgroundImage,'none');
    // 8px margins, with 1px of allowance for sub-pixel layout rounding.
    assert.ok(facts.top >= 7, `notice top ${facts.top} should remain visible`);
    assert.ok(facts.left >= 7, `notice left ${facts.left} should remain visible`);
    assert.ok(facts.right <= 1913, `notice right ${facts.right} should remain visible`);
    assert.ok(facts.bottom <= 878, `notice bottom ${facts.bottom} should remain visible`);
  } finally {
    await browser.close();
  }
});


test('with Badge Only off the same progress card moves into the menu and returns on close',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.route('https://www.twitch.tv/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));await page.goto('https://www.twitch.tv/menu-progress');await page.evaluate(()=>window.GM_xmlhttpRequest=()=>{});await page.addScriptTag({content:fs.readFileSync(installPath,'utf8')});
 const facts=await page.evaluate(()=>{const shadow=document.getElementById('tdh-root').shadowRoot,card=shadow.getElementById('tdh-drop-card');const before=card.parentElement.className;window.dropperShow();const inside=card.parentElement.className,visible=card.getBoundingClientRect().height>0,expanded=shadow.querySelector('[data-panel="tdh-drops-body"]').getAttribute('aria-expanded');shadow.getElementById('tdh-rail-close').click();return{before,inside,visible,expanded,after:card.parentElement.className,badgeOnly:shadow.getElementById('tdh-badge-only').getAttribute('aria-checked')};});assert.deepEqual(facts,{before:'cluster',inside:'badge-only-progress-slot',visible:true,expanded:'true',after:'cluster',badgeOnly:'false'});
 }finally{await browser.close();}
});
