'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const HEADER_PART = 'src/parts/00-setup-and-state.js';
const QUIET_LINE = /const QUIET_RELEASES = Object\.freeze\((\[[^\]\n]*\])\);/;
const quietList = text => JSON.parse(text.match(QUIET_LINE)[1]);
const quietHeadings = text => [...text.matchAll(/^## (\d+\.\d+\.\d+) .*\(quiet\)\s*$/gm)].map(m => m[1]);

test('changelog (quiet) headings and QUIET_RELEASES agree', () => {
  const listed = quietList(read(HEADER_PART));
  assert.deepEqual([...listed].sort(), quietHeadings(read('CHANGELOG.md')).sort());
  for (const version of listed) assert.ok(read(HEADER_PART).includes(`"${version}": [`), `${version} needs release notes`);
});

function prepare(env) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dropper-quiet-'));
  for (const file of ['package.json', 'package-lock.json', 'CHANGELOG.md', HEADER_PART, 'scripts/prepare-feature-release.cjs']) {
    fs.mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(work, file));
  }
  execFileSync(process.execPath, [path.join(work, 'scripts/prepare-feature-release.cjs')], {
    env: { ...process.env, RELEASE_NOTES_JSON: JSON.stringify(['First note.', 'Second note.']), ...env }, stdio: 'pipe',
  });
  const out = name => fs.readFileSync(path.join(work, name), 'utf8');
  const result = { version: JSON.parse(out('package.json')).version, changelog: out('CHANGELOG.md'), source: out(HEADER_PART) };
  fs.rmSync(work, { recursive: true, force: true });
  return result;
}

test('RELEASE_QUIET=1 marks both the changelog heading and QUIET_RELEASES', () => {
  const { version, changelog, source } = prepare({ RELEASE_QUIET: '1' });
  assert.match(changelog.split('\n')[0], new RegExp(`^## ${version.replaceAll('.', '\\.')} — \\d{4}-\\d{2}-\\d{2} \\(quiet\\)$`));
  assert.equal(quietList(source)[0], version);
});

test('a normal release leaves QUIET_RELEASES alone and adds no marker', () => {
  const before = quietList(read(HEADER_PART));
  const { changelog, source } = prepare({});
  assert.doesNotMatch(changelog.split('\n')[0], /\(quiet\)/);
  assert.deepEqual(quietList(source), before);
});

test('the Core-sync bot heading format passes the quiet consistency check', () => {
  const changelog = `## 9.9.9 — 2026-10-12\n\n- Includes exp-core 9.9.9.\n- Keeps every setting.\n\n${read('CHANGELOG.md')}`;
  assert.deepEqual([...quietList(read(HEADER_PART))].sort(), quietHeadings(changelog).sort());
});

const { chromium } = require('playwright');
const { loadDropperSource } = require('./load-source.cjs');

const releasedVersions = () => [...read(HEADER_PART).matchAll(/^\s*"(\d+\.\d+\.\d+)": \[/gm)].map(m => m[1]);

async function bootDropper(t, { release = null, previous = null, quiet = null } = {}) {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let source = loadDropperSource();
  if (quiet) source = source.replace(QUIET_LINE, `const QUIET_RELEASES = Object.freeze(${JSON.stringify(quiet)});`);
  await page.addInitScript(({ release, previous }) => {
    if (previous) localStorage.setItem('dropper-last-version-v2', previous);
    window.GM_xmlhttpRequest = o => {
      if (release && String(o.url).includes('api.github.com')) setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify(release) }), 0);
      return { abort() {} };
    };
  }, { release, previous });
  await page.route('https://www.twitch.tv/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('https://www.twitch.tv/quiet-release');
  await page.addScriptTag({ content: source });
  await page.waitForFunction(() => document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-settings-launcher'));
  return page;
}
const dropperFacts = page => page.evaluate(() => {
  const shadow = document.getElementById('tdh-root').shadowRoot;
  const launcher = shadow.getElementById('tdh-settings-launcher');
  const notice = shadow.getElementById('tdh-update-notice');
  return { badge: launcher.classList.contains('update-available'), label: launcher.getAttribute('aria-label'), card: !notice.hidden, text: notice.textContent };
});
const body = (version, quiet) => `## ${version} — 2026-10-12${quiet ? ' (quiet)' : ''}\n\n- First.\n- Second.`;

test('a normal available update shows the badge and the card (control)', async t => {
  const page = await bootDropper(t, { release: { tag_name: 'v99.0.0', body: body('99.0.0', false) } });
  await page.waitForFunction(() => !document.getElementById('tdh-root').shadowRoot.getElementById('tdh-update-notice').hidden, null, { timeout: 5000 });
  const facts = await dropperFacts(page);
  assert.equal(facts.badge, true);
  assert.match(facts.text, /Update Available/);
});

test('a quiet available update shows only the badge and its label', async t => {
  const page = await bootDropper(t, { release: { tag_name: 'v99.0.0', body: body('99.0.0', true) } });
  await page.waitForFunction(() => document.getElementById('tdh-root').shadowRoot.getElementById('tdh-settings-launcher').classList.contains('update-available'), null, { timeout: 5000 });
  await page.waitForTimeout(500);
  const facts = await dropperFacts(page);
  assert.equal(facts.card, false);
  assert.equal(facts.label, 'Open Dropper Settings · Update v99.0.0 Available');
});

test('Update Complete is skipped when every skipped release is quiet', async t => {
  const [current, previous] = releasedVersions();
  const page = await bootDropper(t, { previous, quiet: [current] });
  await page.waitForTimeout(1500);
  assert.equal((await dropperFacts(page)).card, false);
  assert.equal(await page.evaluate(() => localStorage.getItem('dropper-last-version-v2')), current);
});

test('Update Complete still shows when a skipped release was normal', async t => {
  const [current, , older] = releasedVersions();
  const page = await bootDropper(t, { previous: older, quiet: [current] });
  await page.waitForFunction(() => !document.getElementById('tdh-root').shadowRoot.getElementById('tdh-update-notice').hidden, null, { timeout: 5000 });
  assert.match((await dropperFacts(page)).text, /Update Complete/);
});
