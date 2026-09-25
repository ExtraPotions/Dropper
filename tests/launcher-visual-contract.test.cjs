'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { loadDropperSource } = require('./load-source.cjs');
const root = path.resolve(__dirname, '..');
const source = loadDropperSource(root);
const launcher = fs.readFileSync(path.join(root, 'assets', 'dropper-launcher.svg'), 'utf8');

test('launcher mark is a dedicated borderless asset', () => {
  const badge = fs.readFileSync(path.join(root, 'assets', 'dropper-icon.svg'));
  assert.equal(crypto.createHash('sha256').update(badge).digest('hex'), '2f1822b2e7791475619e94ecbc7ba5784e2af9ff2a034a21684c34068037056a');
  assert.equal(crypto.createHash('sha256').update(launcher).digest('hex'), '730dd1b661c995ffdfed7e3883393affa24bcbbe88932e35c6835f3f474ca449');
  assert.match(launcher, /Dropper Launcher Mark/u);
  assert.doesNotMatch(launcher, /borderGrad|<rect x="32"|<rect x="42"/u);
  assert.match(source, /function dropperGemSvg\(className\)/u);
  assert.match(source, /<svg class="\$\{className\}" viewBox="0 0 1024 1024"/u);
  assert.match(source, /dropperGemSvg\("icon"\)/u);
});

test('launcher, spacing, menu badge, and source badge use exact suite measurements', () => {
  assert.match(source, /#tdh-settings-launcher \{[\s\S]*?width:48px;[\s\S]*?height:48px;/u);
  assert.match(source, /#tdh-settings-launcher \.icon \{[^}]*width:40px; height:40px;/u);
  assert.match(source, /#tdh-settings-launcher \.ring \{[^}]*width:44px; height:44px;/u);
  assert.match(source, /\.header-icon \.menu-icon \{ width:38px; height:38px;/u);
  assert.match(source, /column \* 56/u);
  const png = fs.readFileSync(path.join(root, 'assets', 'dropper-icon-128.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 128);
  assert.equal(png.readUInt32BE(20), 128);
});

test('progress panel and launcher remain one stable row', () => {
  assert.match(source, /\.badge-row \{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:8px!important;[\s\S]*?min-height:112px!important;/u);
  assert.match(source, /#tdh-drop-card \{position:relative!important;[\s\S]*?min-height:112px!important;[\s\S]*?border-radius:12px!important;/u);
  assert.match(source, /#tdh-settings-launcher \{[\s\S]*?width:48px;[\s\S]*?border-radius:10px;/u);
  assert.doesNotMatch(source, /\.badge-row:has\(#tdh-drop-card/u);
  assert.doesNotMatch(source, /#tdh-drop-card\.collapsed/u);
  assert.doesNotMatch(source, /#tdh-drop-card:not\(\.collapsed\)/u);
});

test('campaign navigation strip is gone and does not change progress geometry', () => {
  assert.doesNotMatch(source, /campaign-topmenu/u);
  assert.doesNotMatch(source, /toggleCampaignNavigation/u);
  assert.doesNotMatch(source, /campaign-nav-hidden/u);
  assert.doesNotMatch(source, /classList\.toggle\("collapsed"/u);
  assert.match(source, /ui\.cluster\.dataset\.launcherAnchor = anchor;/u);
  assert.match(source, /#tdh-drop-card \{position:relative!important;[\s\S]*?cursor:default!important;/u);
});

test('menu focus does not paint an outer browser outline', () => {
  assert.match(source, /#tdh-tools-dock:focus \{ outline:none; \}/u);
  assert.match(source, /#tdh-tools-dock \{[^}]*border:0;/u);
});

test('Dropper progress starts at twelve o clock and advances clockwise', () => {
  const pathData = 'M18 3H24A9 9 0 0 1 33 12V24A9 9 0 0 1 24 33H12A9 9 0 0 1 3 24V12A9 9 0 0 1 12 3H18Z';
  assert.match(source, new RegExp(`<path class="fill" id="tdh-ring" d="${pathData.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.doesNotMatch(source, /\.fill\s*\{[^}]*transform\s*:\s*rotate/u);
});

test('settings open collapsed and retain a themed last-category marker', () => {
  assert.match(source, /collapseToolPanels\(\);\s+collapseNestedPanels\(\);/u);
  assert.match(source, /lastPanelId = header\.dataset\.panel/u);
  assert.match(source, /\.fl-tool-header\.last-opened \{ box-shadow:inset 3px 0 0 #b783ff; \}/u);
  const titles = [...source.matchAll(/<span class="fl-tool-title">([^<]+)<\/span>/gu)].map((match) => match[1]);
  assert.deepEqual(titles, ['Drops', 'Streams', 'Appearance', 'Diagnostics']);
});

test('menu sections group related Dropper controls without token-only rows', () => {
  const section = (id) => source.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<\\/div></section>`, 'u'))?.[1] || '';
  assert.match(section('tdh-drops-body'), /tdh-claim-drops/u);
  assert.match(section('tdh-drops-body'), /tdh-keep-tab/u);
  assert.match(section('tdh-drops-body'), /tdh-toggle-inventory/u);
  assert.match(section('tdh-drops-body'), /tdh-hide-sub-promos/u);
  assert.doesNotMatch(section('tdh-drops-body'), /tdh-find-next/u);
  assert.doesNotMatch(section('tdh-streams-body'), /tdh-skip-stream/u);
  assert.match(section('tdh-streams-body'), /tdh-queue-enabled/u);
  assert.match(section('tdh-streams-body'), /tdh-background-earning/u);
  assert.doesNotMatch(section('tdh-streams-body'), /tdh-toggle-inventory/u);
  assert.match(section('tdh-progress-body'), /tdh-progress-title/u);
  assert.match(section('tdh-progress-body'), /tdh-reduce-motion/u);
  assert.match(section('tdh-progress-body'), /themeSwatchesHtml\(\)/u);
  assert.match(section('tdh-progress-body'), /tdh-collapsed-width/u);
  assert.match(section('tdh-diagnostics-body'), /tdh-diagnostics-toggle/u);
  assert.match(section('tdh-diagnostics-body'), /tdh-reset-session/u);
  assert.match(section('tdh-diagnostics-body'), /tdh-refresh-campaign-data/u);
});

test('nested panels reopen collapsed with a themed last-submenu marker', () => {
  assert.match(source, /function collapseNestedPanels\(\)/u);
  assert.match(source, /lastSubmenuId = "inventory"/u);
  assert.match(source, /lastSubmenuId = "diagnostics"/u);
  assert.match(source, /\.life-btn\.last-opened \{ box-shadow:inset 3px 0 0 #b783ff; \}/u);
});

test('recover panel and dock use compact trailing spacing', () => {
  assert.match(source, /padding:9px 9px 4px;/u);
  assert.match(source, /#tdh-diagnostics-body \{ padding-bottom:2px; \}/u);
});

test('appearance uses the locked eight-slot palette system', () => {
  assert.match(source, /id="tdh-theme-swatches" role="radiogroup" aria-label="Menu Theme"/u);
  assert.match(source, /name:"Dropper gem"/u);
  assert.match(source, /#0b0713 0 38%,#7a46c8 38% 69%,#2a8c9b 69% 100%/u);
  assert.match(source, /\.exp-theme-swatch\{[^}]*width:22px!important;[^}]*height:22px!important;[^}]*border-radius:5px!important/u);
  const themeBlock = source.match(/const UI_THEMES = Object\.freeze\(\[([\s\S]*?)\]\);/u)?.[1] || '';
  assert.deepEqual([...themeBlock.matchAll(/id:"([^"]+)"/gu)].map((match) => match[1]), ['ember', 'midnight', 'glacier', 'contrast', 'verdant', 'pride', 'twitch', 'dropper']);
  assert.match(themeBlock, /id:"glacier", name:"Glacier"/u);
  assert.match(themeBlock, /id:"twitch", name:"Twitch"/u);
  assert.match(source, /const CRIMSON_THEME = Object\.freeze\(\{ id:"crimson", name:"Crimson"/u);
});


test('Skip On conditions are a left label with vertically stacked toggles', () => {
  assert.match(source, /<div class="queue-switches-label">Skip On<\/div>/u);
  assert.doesNotMatch(source, /<fieldset class="queue-switches"><legend>Switch On<\/legend>/u);
  assert.match(source, /\.queue-switches\{display:grid;grid-template-columns:minmax\(58px,\.7fr\) minmax\(0,1\.3fr\);/u);
  assert.match(source, /\.queue-switches-label\{grid-column:1;grid-row:1\/span 3;/u);
  assert.match(source, /\.queue-switches>\.fl-switch\{grid-column:2;display:flex!important;flex-direction:row!important;/u);
});


test('launcher host is protected from hostile site CSS', () => {
  assert.match(source, /function protectLauncherHost\(host\)/u);
  assert.match(source, /:host\{all:initial!important;position:fixed!important;/u);
  assert.match(source, /z-index:2147483647!important/u);
  assert.match(source, /content-visibility:visible!important/u);
  assert.match(source, /host\.parentNode !== document\.documentElement/u);
  assert.match(source, /host\.showPopover\(\)/u);
  assert.match(source, /protectionStyle\.dataset\.expHostProtection/u);
});

test('progress visibility preserves the badge-only controls', () => {
  assert.match(source, /const progressVisible = !settings\.badgeOnly && progressCard/u);
  assert.match(source, /const reserveHeight = progressVisible \? Math\.max\(48, progressCard\.offsetHeight \|\| 48\) : 48;/u);
  assert.match(source, /\.progress-stack\.badge-only \.badge-row \{ justify-content:flex-end; min-height:48px!important; \}/u);
  assert.doesNotMatch(source, /const firstProductSlot = dropper \? columns \* reservedRows : 0;/u);
});

test('launcher helper tooltip is removed', () => {
  assert.doesNotMatch(source, /#tdh-settings-launcher::before \{[^}]*bottom:calc\(100% \+ 7px\);/u);
  assert.doesNotMatch(source, /#tdh-settings-launcher\.tip-below::before/u);
  assert.doesNotMatch(source, /launcher\.classList\.toggle\("tip-below"/u);
  assert.doesNotMatch(source, /#tdh-drop-card\.collapsed/u);
  assert.doesNotMatch(source, /preview-below/u);
  assert.doesNotMatch(source, /Hover To Preview/u);
});

test('menu section titles do not carry redundant helper tips', () => {
  assert.doesNotMatch(source, /fl-tool-header has-tooltip/u);
  assert.doesNotMatch(source, /fl-tool-header[^>]*data-tip="/u);
  assert.doesNotMatch(source, /id="tdh-skip-stream"/u);
  assert.match(source, /const labelClass = tip \? "fl-switch-text has-tooltip" : "fl-switch-text";/u);
  assert.match(source, /switchHtml\("tdh-claim-drops", "Auto-Claim Drops", "",/u);
  assert.match(source, /switchHtml\("tdh-reduce-motion", "Reduce Motion", "",/u);
  assert.match(source, /switchHtml\("tdh-notifications", "Status Toasts", "[^"]+",/u);
  assert.match(source, /switchHtml\("tdh-keep-tab", "Keep Tab Active", "[^"]+",/u);
  assert.match(source, /switchHtml\("tdh-badge-only", "Badge Only", "[^"]+",/u);
});


test('unified progress panel follows the 3.2 layout without campaign navigation', () => {
  assert.doesNotMatch(source, /id="tdh-drop-card"[^>]*data-help="Click To Show Campaign Navigation"/u);
  assert.doesNotMatch(source, /id="tdh-compact-line"/u);
  assert.match(source, /class="progress-head"/u);
  assert.match(source, /class="progress-reward-row"/u);
  assert.match(source, /id="tdh-skip-streamer"/u);
  assert.match(source, /function skipCurrentStreamer\(\)/u);
  assert.doesNotMatch(source, /campaign-topmenu/u);
  assert.doesNotMatch(source, /toggleCampaignNavigation/u);
  assert.match(source, /#tdh-settings-launcher \{[\s\S]*?width:48px;[\s\S]*?border-radius:10px;/u);
  assert.match(source, /data-collapsed-width="compact"\] \{ width:min\(260px/u);
  assert.match(source, /data-collapsed-width="narrow"\] \{ width:min\(220px/u);
  assert.match(source, /data-collapsed-width="full"\] \{ width:min\(var\(--dropper-width, 312px\)/u);
});
