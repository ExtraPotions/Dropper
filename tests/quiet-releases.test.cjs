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
