'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assembleDropperSource, readCoreBundle } = require('../scripts/core-modules.cjs');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'src', 'dropper.user.js'), 'utf8');

test('Dropper has one complete pinned Core injection point and no shared shadow blocks', () => {
  assert.equal((template.match(/BEGIN EXP CORE/gu) || []).length, 1);
  assert.equal((template.match(/END EXP CORE/gu) || []).length, 1);
  assert.doesNotMatch(template, /BEGIN SHARED (?:MENU ARRANGEMENT|DIAGNOSTICS|PRODUCT TOOLS)/u);
  assert.doesNotMatch(template, /const ExtraPotionsDiagnostics = \(\(\) =>/u);
  assert.doesNotMatch(template, /const ExtraPotionsTools = \(\(\) =>/u);
  assert.doesNotMatch(template, /const ExpMenuArrangement = \(\(\) =>/u);
});

test('Dropper assembles the complete pinned exp-core bundle before product code', () => {
  const core = readCoreBundle(root);
  const assembled = assembleDropperSource(template, root);
  assert.ok(assembled.includes(core));
  assert.match(assembled, /const ExtraPotionsCore = \(\(\) =>/u);
  assert.ok(assembled.indexOf(core) < assembled.indexOf('const SETTINGS_KEY = "tdh-settings-v3"'));
});

test('Dropper delegates shared launcher and notice infrastructure to exp-core', () => {
  assert.doesNotMatch(template, /function protectLauncherHost\s*\(/u);
  assert.match(template, /ExtraPotionsCore\.registerLauncher\(host, \{ productId \}\)/u);
  assert.doesNotMatch(template, /registerBadgeGrid\(host, "dropper", \d+/u);
  assert.match(template, /ExtraPotionsCore\.registerDiagnosticsProduct\(productId, APP_VERSION, host\)/u);
  assert.match(template, /ExtraPotionsCore\.claimNotice\("dropper", changeId\)/u);
  assert.match(template, /ExtraPotionsCore\.layoutFloatingNotices\(\)/u);
  assert.match(template, /ExtraPotionsCore\.publishMenuPalette\?\.\(ui\.host, semantic\)/u);
  assert.match(template, /const \{ PRIDE_RAINBOW, UI_THEMES \} = ExtraPotionsCore\.reference;/u);
  assert.doesNotMatch(template, /const UI_THEMES = Object\.freeze\(\[/u);
  assert.match(template, /ExtraPotionsCore\.compareVersions\(a, b\)/u);
});

test('Dropper uses the public Core API for shared tool services', () => {
  assert.doesNotMatch(template, /ExtraPotionsTools\./u);
  // Core's support control brings its own donation options and placement.
  assert.match(template, /ExtraPotionsCore\.createSupportControl\(/u);
  assert.doesNotMatch(template, /ExtraPotionsCore\.(?:createBitcoinDonation|placeDonationPanel)\(/u);
  assert.match(template, /ExtraPotionsCore\.createCompatibilityControls\(\)/u);
  assert.match(template, /ExtraPotionsCore\.createDiagnosticsReport\(/u);
  assert.doesNotMatch(template, /ExtraPotionsDiagnostics\.createReport/u);
  assert.match(template, /ExtraPotionsCore\.publishMenuPalette\?\.\(ui\.host/u);
});

test('obsolete shared source copies stay removed', () => {
  for (const file of ['shared-diagnostics.js','shared-product-tools.js','shared-menu-arrangement.js']) {
    assert.equal(fs.existsSync(path.join(root, 'src', file)), false, file);
  }
});

test('private Core globals disappear once the public API is available', () => {
  const pin = fs.readFileSync(path.join(root, 'vendor', 'exp-core', 'PIN'), 'utf8').trim().replace(/^v/, '');
  const parts = pin.split('.').map(Number);
  const modern = parts[0] > 3 || (parts[0] === 3 && (parts[1] > 3 || (parts[1] === 3 && parts[2] >= 13)));
  if (!modern) return;
  assert.doesNotMatch(template, /ExtraPotionsDiagnostics\./u);
  assert.doesNotMatch(template, /ExpMenuArrangement\./u);
  assert.match(template, /ExtraPotionsCore\.bindDiagnosticsControls/u);
  assert.match(template, /ExtraPotionsCore\.mountMenuArrangement/u);
});

test('Dropper uses neutral Core width and opacity variables with temporary legacy mirrors', () => {
  assert.match(template, /--exp-menu-width/u);
  assert.match(template, /--exp-ui-opacity/u);
  assert.match(template, /setProperty\("--exp-menu-width"/u);
  assert.match(template, /setProperty\("--exp-ui-opacity"/u);
  assert.match(template, /var\(--exp-menu-width,var\(--dropper-width, 312px\)\)/u);
  assert.match(template, /var\(--exp-ui-opacity,var\(--dropper-ui-opacity,1\)\)/u);
});


test('Dropper publishes stable Core surface markers', () => {
  assert.match(template, /id="tdh-tools-dock" data-exp-part="dock"/u);
  assert.match(template, /id="tdh-settings-launcher" data-exp-part="launcher"/u);
  assert.match(template, /class="badge-row" data-exp-part="launcher-row"/u);
  assert.match(template, /id="tdh-drop-card" data-exp-part="progress-card"/u);
  assert.match(template, /id="tdh-update-notice" data-exp-update-notice="1"/u);
});
