'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assembleParts, listParts } = require('../scripts/assemble-parts.cjs');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('src/dropper.user.js is exactly the source parts joined in order', () => {
  assert.equal(read('src/dropper.user.js'), assembleParts(root));
});

test('source parts are numbered without gaps and open and close the single shared function', () => {
  const names = listParts(root);
  assert.ok(names.length >= 2);
  assert.match(names[0], /^00-/u);
  const first = read(`src/parts/${names[0]}`);
  const last = read(`src/parts/${names.at(-1)}`);
  assert.match(first, /^\/\/ ==UserScript==/u);
  assert.ok(first.includes('(function twitchDropsHelper() {'));
  assert.match(last.trimEnd(), /\}\)\(\);$/u);
  for (const name of names.slice(1)) {
    assert.ok(!read(`src/parts/${name}`).includes('(function twitchDropsHelper() {'), `${name} must not reopen the function`);
  }
});

test('the version and release notes live only in the first part, where the release scripts edit them', () => {
  const names = listParts(root);
  const header = names[0];
  const counts = { version: 0, appVersion: 0, notes: 0 };
  for (const name of names) {
    const text = read(`src/parts/${name}`);
    const found = {
      version: /^\/\/ @version\s+\S+/mu.test(text),
      appVersion: /const APP_VERSION = /u.test(text),
      notes: /const RELEASE_NOTES = \{/u.test(text),
    };
    for (const [key, present] of Object.entries(found)) {
      if (!present) continue;
      counts[key] += 1;
      assert.equal(name, header, `${key} must be in ${header}`);
    }
  }
  assert.deepEqual(counts, { version: 1, appVersion: 1, notes: 1 });
  for (const script of ['scripts/prepare-feature-release.cjs', 'scripts/prepare-core-release.cjs']) {
    assert.ok(read(script).includes('HEADER_PART'), `${script} edits the first part`);
    assert.ok(/sort\(\)(\[0\]|;)/u.test(read(script)), `${script} picks the first part by sorted name`);
    assert.ok(!/read\('src\/dropper\.user\.js'\)/u.test(read(script)), `${script} no longer edits the generated file`);
  }
});
