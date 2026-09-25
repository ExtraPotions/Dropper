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

test('install artifact retains pride dataset hook and scoped selectors', () => {
  const install = fs.readFileSync(installPath, 'utf8');
  assert.match(install, /dataset\.uiTheme/u);
  assert.match(install, /id:"pride"/u);
  assert.match(install, /data-theme="\$\{theme\.id\}"/u);
  assert.match(install, /#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4/u);
});

test('pride theme computed contract exposes dataset and rainbow treatments', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      window.GM_xmlhttpRequest = ({ onload }) => {
        queueMicrotask(() => onload?.({ status: 204, responseText: '', finalUrl: '' }));
      };
    });
    await page.route('https://www.twitch.tv/**', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head><title>Twitch</title></head><body></body></html>',
    }));
    await page.goto('https://www.twitch.tv/dropper-pride-contract');
    await page.addScriptTag({ content: fs.readFileSync(installPath, 'utf8') });
    await page.waitForFunction(() => Boolean(document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-cluster')), null, { timeout: 15000 });

    const defaultTheme = await page.evaluate(() => document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-cluster')?.dataset?.uiTheme);
    assert.equal(defaultTheme, 'dropper');

    await page.evaluate(() => {
      window.dropperShow?.();
      const shadow = document.getElementById('tdh-root')?.shadowRoot;
      shadow?.querySelector('.exp-theme-swatch[data-theme="pride"]')?.click();
      const dropsHeader = shadow?.querySelector('[data-panel="tdh-drops-body"]');
      const dropsBody = shadow?.getElementById('tdh-drops-body');
      if (dropsHeader && dropsBody?.classList.contains('fl-tool-hidden')) dropsHeader.click();
    });
    await page.waitForTimeout(150);

    const computed = await page.evaluate((rainbow) => {
      const shadow = document.getElementById('tdh-root')?.shadowRoot;
      const cluster = shadow?.getElementById('tdh-cluster');
      const divider = shadow?.querySelector('.header-divider');
      const toggle = shadow?.querySelector('.toggleSwitch[aria-checked="true"]');
      const activePanel = shadow?.querySelector('.fl-tool-header.last-opened');
      const styles = (node) => (node ? getComputedStyle(node) : null);
      return {
        uiTheme: cluster?.dataset?.uiTheme || null,
        bg: styles(cluster)?.getPropertyValue('--theme-bg').trim(),
        accent: styles(cluster)?.getPropertyValue('--theme-accent').trim(),
        dividerBackground: styles(divider)?.backgroundImage || '',
        toggleBackground: styles(toggle)?.backgroundImage || '',
        activePanelBeforeBackground: activePanel ? getComputedStyle(activePanel, '::before').backgroundImage : '',
      };
    }, PRIDE_RAINBOW);

    assert.equal(computed.uiTheme, 'pride');
    assert.equal(computed.bg, PRIDE_PALETTE.bg);
    assert.equal(computed.accent, PRIDE_PALETTE.accent);
    assert.match(computed.dividerBackground, /linear-gradient/u);
    assert.match(computed.dividerBackground, /200,\s*78,\s*102/u);
    assert.doesNotMatch(computed.toggleBackground, /linear-gradient/u);
  } finally {
    await browser.close();
  }
});

test('Badge Only places the live progress card above the Drops section', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => { window.GM_xmlhttpRequest = () => {}; });
    await page.route('https://www.twitch.tv/**', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head><title>Twitch</title></head><body></body></html>',
    }));
    await page.goto('https://www.twitch.tv/dropper-badge-only-contract');
    await page.addScriptTag({ content: fs.readFileSync(installPath, 'utf8') });
    await page.waitForFunction(() => Boolean(document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-drop-card')));
    const facts = await page.evaluate(async () => {
      window.dropperShow?.();
      const shadow = document.getElementById('tdh-root').shadowRoot;
      shadow.querySelector('[data-panel="tdh-progress-body"]').click();
      shadow.getElementById('tdh-badge-only').click();
      shadow.querySelector('[data-panel="tdh-drops-body"]').click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const slot = shadow.getElementById('tdh-badge-only-progress-slot');
      const card = shadow.getElementById('tdh-drop-card');
      const dropsBody = shadow.getElementById('tdh-drops-body');
      const launcher = shadow.getElementById('tdh-settings-launcher');
      return {
        parent: card.parentElement.id,
        slotParent: slot.parentElement.id,
        slotAboveDrops: slot.nextElementSibling?.querySelector?.('[data-panel="tdh-drops-body"]') != null,
        slotInsideDrops: dropsBody.contains(slot),
        presentation: card.dataset.presentation,
        slotHidden: slot.hidden,
        cardVisible: getComputedStyle(card).display !== 'none' && card.getBoundingClientRect().height > 0,
        launcherRow: launcher.parentElement.className,
      };
    });
    assert.deepEqual(facts, {
      parent: 'tdh-badge-only-progress-slot',
      slotParent: 'tdh-tools-dock',
      slotAboveDrops: true,
      slotInsideDrops: false,
      presentation: 'menu-card',
      slotHidden: false,
      cardVisible: true,
      launcherRow: 'badge-row',
    });
  } finally {
    await browser.close();
  }
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
    assert.match(facts.backgroundImage, /linear-gradient/u);
    assert.ok(facts.top >= 8, `notice top ${facts.top} should remain visible`);
    assert.ok(facts.left >= 8, `notice left ${facts.left} should remain visible`);
    assert.ok(facts.right <= 1912, `notice right ${facts.right} should remain visible`);
    assert.ok(facts.bottom <= 877, `notice bottom ${facts.bottom} should remain visible`);
  } finally {
    await browser.close();
  }
});
