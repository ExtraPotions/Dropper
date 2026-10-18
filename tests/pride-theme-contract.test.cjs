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

const PRIDE_PALETTE = Object.freeze({
  bg: '#100a12',
  panel: '#1d1222',
  line: '#4a2b50',
  text: '#f0ddea',
  muted: '#b89db4',
  accent: '#c34f7d',
  accent2: '#dd6793',
});
const PRIDE_RAINBOW = 'linear-gradient(90deg,#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4)';
const PRIDE_RAINBOW_VERTICAL = 'linear-gradient(180deg,#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4)';

function prideThemeBlock() {
  const themeBlock = source.match(/const UI_THEMES = Object\.freeze\(\[([\s\S]*?)\]\);/u)?.[1] || '';
  const prideEntry = themeBlock.match(/\{ id:"pride"[^}]+\}/u)?.[0] || '';
  return prideEntry;
}

function dropperThemeBlock() {
  const themeBlock = source.match(/const UI_THEMES = Object\.freeze\(\[([\s\S]*?)\]\);/u)?.[1] || '';
  return themeBlock.match(/\{ id:"dropper"[^}]+\}/u)?.[0] || '';
}

test('pride palette source contract matches the strengthened menu colors', () => {
  const prideEntry = prideThemeBlock();
  for (const [key, value] of Object.entries(PRIDE_PALETTE)) {
    assert.match(prideEntry, new RegExp(`${key}:"${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,'u'));
  }
});

test('pride palette is visibly distinct from dropper gem defaults', () => {
  const prideEntry = prideThemeBlock();
  const dropperEntry = dropperThemeBlock();
  assert.notEqual(prideEntry, dropperEntry);
  for (const key of Object.keys(PRIDE_PALETTE)) {
    const prideValue = prideEntry.match(new RegExp(`${key}:"([^"]+)"`, 'u'))?.[1];
    const dropperValue = dropperEntry.match(new RegExp(`${key}:"([^"]+)"`, 'u'))?.[1];
    assert.notEqual(prideValue, dropperValue, `expected pride ${key} to differ from dropper`);
  }
});

test('applyAppearanceSettings exposes the active theme id on the cluster dataset', () => {
  assert.match(source, /ui\.cluster\.dataset\.uiTheme\s*=\s*theme\.id/u);
});

test('pride theme uses shared gradient-skin treatments with the Pride rainbow palette', () => {
  assert.match(source, /const PRIDE_RAINBOW = "linear-gradient\(90deg,#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4\)"/u);
  assert.match(source, /const PRIDE_RAINBOW_VERTICAL = "linear-gradient\(180deg,#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4\)"/u);
  assert.match(source, /\.cluster\[data-theme-skin="gradient"\] #tdh-tools-dock/u);
  assert.match(source, /background-clip:padding-box,border-box/u);
  assert.match(source, /\.cluster\[data-theme-skin="gradient"\] \.header-divider/u);
  assert.match(source, /\.cluster\[data-theme-skin="gradient"\] :is\(\.fl-tool-header,\.life-btn\)\.last-opened::before/u);
  assert.match(source, /background:var\(--theme-skin-vertical\)/u);
  assert.doesNotMatch(source, /#tdh-drop-card\.collapsed/u);
  assert.doesNotMatch(source, /\.cluster\[data-ui-theme="pride"\][\s\S]{0,240}#9147ff/u);
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


test('with Badge Only off progress stays beside the launcher while the menu is open',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.route('https://www.twitch.tv/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));await page.goto('https://www.twitch.tv/menu-progress');await page.evaluate(()=>window.GM_xmlhttpRequest=()=>{});await page.addScriptTag({content:fs.readFileSync(installPath,'utf8')});
 const facts=await page.evaluate(()=>{const shadow=document.getElementById('tdh-root').shadowRoot,card=shadow.getElementById('tdh-drop-card');const before=card.parentElement.className;window.dropperShow();const inside=card.parentElement.className,visible=card.getBoundingClientRect().height>0,expanded=shadow.querySelector('[data-panel="tdh-drops-body"]').getAttribute('aria-expanded');shadow.getElementById('tdh-rail-close').click();return{before,inside,visible,expanded,after:card.parentElement.className,badgeOnly:shadow.getElementById('tdh-badge-only').getAttribute('aria-checked')};});assert.deepEqual(facts,{before:'cluster',inside:'cluster',visible:true,expanded:'true',after:'cluster',badgeOnly:'false'});
 }finally{await browser.close();}
});
