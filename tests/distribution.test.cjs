'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { loadDropperSource } = require('./load-source.cjs');
const root = path.resolve(__dirname, '..');

const LEGACY_PATHS = [
  'RELEASE-NOTES-3.0.1.md',
  'RELEASE-NOTES-3.0.2.md',
  'RELEASE-NOTES-3.0.3.md',
  'RELEASE-NOTES-3.0.4.md',
  'RELEASE-NOTES-3.0.5.md',
  'RELEASE-NOTES-3.0.6.md',
  'preview/index.html',
  'dist-parts',
  'scripts/release.ps1',
  'dropper-loader.user.js',
  'src/shared-diagnostics.js',
  'src/shared-product-tools.js',
  'src/shared-menu-arrangement.js',
  'assets/dropper-launcher-1024.png',
  'assets/dropper-icon.svg',
  'assets/dropper-icon-1024.png',
  'assets/dropper-icon-128.png',
];

test('repository keeps only current docs, assets, and required build inputs', () => {
  for (const relativePath of LEGACY_PATHS) {
    assert.equal(
      fs.existsSync(path.join(root, relativePath)),
      false,
      `legacy path still present: ${relativePath}`,
    );
  }

  const screenshots = fs.readdirSync(path.join(root, 'docs', 'screenshots')).filter((name) => name.endsWith('.png'));
  assert.deepEqual(
    screenshots.sort(),
    [
      'appearance-menu.png',
      'diagnostics-menu.png',
      'drops-menu.png',
      'progress-panel.png',
      'streams-menu.png',
    ],
    'docs/screenshots should contain exactly five current images',
  );

  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  assert.match(changelog, /^## 3.2.4 — 2026-09-23/m);
  assert.match(changelog, /^## 3.2.3 — 2026-09-23/m);
  assert.match(changelog, /^## 3.2.0 — 2026-09-23/m);
  assert.match(changelog, /^## 3.1.57 — 2026-09-23/m);
  assert.match(changelog, /^## 3.1.36 — 2026-09-23/m);
  assert.match(changelog, /^## 3.1.35 — 2026-09-22/m);
  assert.match(changelog, /^## 3.1.34 — 2026-09-22/m);
  assert.match(changelog, /^## 3.1.33 — 2026-09-22/m);
  assert.match(changelog, /^## 3.1.27 — 2026-09-22/m);
  assert.match(changelog, /^## 3.1.16 — 2026-09-22/m);
  assert.match(changelog, /^## 3.1.0 — 2026-09-22/m);
  assert.match(changelog, /^## 3.0.78 — 2026-09-22/m);
  assert.doesNotMatch(changelog, /^## 3\.0\.11/m);
  const currentSection = changelog.split(/^## /m)[1] || '';
  const bullets = [...currentSection.matchAll(/^- .+$/gm)];
  assert.ok(bullets.length >= 2 && bullets.length <= 4, 'current changelog stays concise');
});

test('in-app release notes and update checker stay current-only but functional', () => {
  const source = loadDropperSource(root);
  const releaseNotesBlock = source.match(/const RELEASE_NOTES = \{([\s\S]*?)\};/u)?.[1] || '';
  const currentVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const versions = [...releaseNotesBlock.matchAll(/"(\d+\.\d+\.\d+(?:-[\w.-]+)?)": \[/gu)].map((match) => match[1]);
  assert.equal(versions[0], currentVersion, 'current development or stable version is first');
  const changelogVersions = [...fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').matchAll(/^## (\d+\.\d+\.\d+)/gm)].map(match => match[1]);
  assert.deepEqual(versions.slice(0, 3), changelogVersions.slice(0, 3));
  assert.doesNotMatch(releaseNotesBlock, /"3\.1\.32": \[/u);
  const currentNotes = releaseNotesBlock.slice(releaseNotesBlock.indexOf(JSON.stringify(currentVersion))).split('],')[0];
  const bullets = [...currentNotes.matchAll(/"([^"]+)"/gu)];
  assert.ok(bullets.length >= 2 && bullets.length <= 5, 'current release notes stay concise');

  // Installs and updates come from published releases, never from whatever is on the main branch.
  assert.match(source, /^\/\/ @updateURL\s+https:\/\/github\.com\/ExtraPotions\/Dropper\/releases\/latest\/download\/dropper\.user\.js$/mu);
  assert.match(source, /^\/\/ @downloadURL\s+https:\/\/github\.com\/ExtraPotions\/Dropper\/releases\/latest\/download\/dropper\.user\.js$/mu);
  assert.match(source, /^\/\/ @homepageURL\s+https:\/\/github\.com\/ExtraPotions\/Dropper$/mu);
  assert.match(source, /^\/\/ @supportURL\s+https:\/\/github\.com\/ExtraPotions\/Dropper\/issues$/mu);
  assert.match(source, /^\/\/ @connect\s+api\.github\.com$/mu);
  assert.doesNotMatch(source, /^\/\/ @(?:updateURL|downloadURL)\s+https:\/\/raw\.githubusercontent\.com/mu);
  // Install links come from exp-core's checker, which only points at published releases.
  assert.match(source, /actionUrl: updateChecker\.INSTALL_URL/u);
  assert.doesNotMatch(source, /INSTALL_URL = "https:/u, 'Dropper keeps no private copy of its install address');
  assert.doesNotMatch(source, /const UPDATE_URL\b|dropper_check/u, 'Dropper no longer downloads its own script from main to read a version');
  // The update check is exp-core's shared release checker.
  assert.match(source, /const updateChecker = ExtraPotionsCore\.createReleaseUpdateChecker\(\{\s*productId: "dropper",\s*repository: "ExtraPotions\/Dropper",\s*currentVersion: APP_VERSION,\s*\}\);/u);
  assert.match(source, /function scheduleUpdateCheck\(/u);
  assert.match(source, /updateChecker\.check\(force\)/u);
  assert.match(source, /RELEASE_NOTES\[APP_VERSION\]/u);
  assert.match(source, /compareVersions\(version, APP_VERSION\)/u);
});

test('GitHub releases publish only the latest three changelog sections', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.match(workflow, /section > 3/u);
  assert.match(workflow, /CHANGELOG\.md > release-notes\.md/u);
  assert.match(workflow, /--notes-file release-notes\.md/u);
  assert.doesNotMatch(workflow, /--notes-file CHANGELOG\.md/u);
});

test('unhealthy streams recover faster than healthy stalled streams', () => {
  const source = loadDropperSource(root);
  assert.match(source, /const UNHEALTHY_STREAM_STALLED_MS = 2 \* 60 \* 1000;/u);
  assert.match(source, /const HEALTHY_STREAM_STALLED_MS = 6 \* 60 \* 1000;/u);
  assert.match(source, /function ensureStreamPlaying\(explicit = false\)/u);
});

test('progress panel stays solid without auto-collapse fade timing', () => {
  const source = loadDropperSource(root);
  assert.doesNotMatch(source, /const PROGRESS_EXPAND_AUTO_COLLAPSE_MS = 30 \* 1000;/u);
  assert.match(source, /ExtraPotionsCore\.createMenuController/u);
  assert.match(source, /menuController\?\.enforceDeadline\(now\)/u);
  assert.match(source, /\/\* 3\.2\.0 progress panel \*\//u);
});

test('README stays feature-focused without npm install guidance', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /## What you can do/u);
  assert.match(readme, /https:\/\/github\.com\/ExtraPotions\/Dropper\/releases\/latest\/download\/dropper\.user\.js/u);
  assert.doesNotMatch(readme, /\/raw\/refs\/heads\/main\//u, 'the README installs a published release, not whatever is on main');
  assert.match(readme, /docs\/screenshots\/drops-menu\.png/u);
  assert.match(readme, /docs\/screenshots\/streams-menu\.png/u);
  assert.match(readme, /<table>[\s\S]*<tr>[\s\S]*<td[\s\S]*<td/u);
  assert.match(readme, /LICENSE-CODE\.md/u);
  assert.match(readme, /LICENSE-ASSETS\.md/u);
  assert.doesNotMatch(readme, /^#{1,6} .*?(Technical|Development|Changelog|Diagnostics)/imu);
  assert.doesNotMatch(readme, /all_menus_expanded/u);
  assert.doesNotMatch(readme, /npm (install|test|run)/iu);
  assert.doesNotMatch(readme, /node_modules/iu);
});
