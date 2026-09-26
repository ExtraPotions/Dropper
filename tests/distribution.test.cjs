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
  assert.ok(bullets.length >= 4 && bullets.length <= 16, 'current changelog stays concise');
});

test('in-app release notes and update checker stay current-only but functional', () => {
  const source = loadDropperSource(root);
  const releaseNotesBlock = source.match(/const RELEASE_NOTES = \{([\s\S]*?)\};/u)?.[1] || '';
  const currentVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const versions = [...releaseNotesBlock.matchAll(/"(\d+\.\d+\.\d+(?:-[\w.-]+)?)": \[/gu)].map((match) => match[1]);
  assert.equal(versions[0], currentVersion, 'current development or stable version is first');
  assert.deepEqual(versions.slice(1, 3), ['3.2.31', '3.2.30']);
  assert.doesNotMatch(releaseNotesBlock, /"3\.1\.32": \[/u);
  const currentNotes = releaseNotesBlock.slice(releaseNotesBlock.indexOf(JSON.stringify(currentVersion))).split('],')[0];
  const bullets = [...currentNotes.matchAll(/"([^"]+)"/gu)];
  assert.ok(bullets.length >= 2 && bullets.length <= 5, 'current release notes stay concise');

  assert.match(source, /const UPDATE_URL = "https:\/\/raw\.githubusercontent\.com\/ExtraPotions\/Dropper\/main\/dropper\.user\.js"/u);
  assert.match(source, /const INSTALL_URL = `https:\/\/raw\.githubusercontent\.com\/ExtraPotions\/Dropper\/main\/dropper\.user\.js\?v=\$\{APP_VERSION\}`/u);
  assert.match(source, /function scheduleUpdateCheck\(/u);
  assert.match(source, /RELEASE_NOTES\[APP_VERSION\]/u);
  assert.match(source, /compareVersions\(remoteVersion, APP_VERSION\)/u);
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
  assert.match(source, /const MENU_INACTIVITY_DISMISS_MS = 15 \* 1000;/u);
  assert.match(source, /\/\* 3\.2\.0 progress panel \*\//u);
});

test('README stays feature-focused without npm install guidance', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /## What Dropper Does/u);
  assert.match(readme, /href="https:\/\/raw\.githubusercontent\.com\/ExtraPotions\/Dropper\/main\/dropper\.user\.js(?:\?v=[\d.A-Za-z-]+)?"/u);
  assert.match(readme, /docs\/screenshots\/progress-panel\.png/u);
  assert.match(readme, /docs\/screenshots\/drops-menu\.png/u);
  assert.match(readme, /docs\/screenshots\/streams-menu\.png/u);
  assert.match(readme, /docs\/screenshots\/appearance-menu\.png/u);
  assert.match(readme, /docs\/screenshots\/diagnostics-menu\.png/u);
  assert.doesNotMatch(readme, /all_menus_expanded/u);
  assert.doesNotMatch(readme, /npm (install|test|run)/iu);
  assert.doesNotMatch(readme, /node_modules/iu);
});
