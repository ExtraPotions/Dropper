'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('README screenshots and the shot list name the same images', () => {
  const config = require(path.join(root, 'docs', 'screenshots.config.cjs'));
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const referenced = [...new Set([...readme.matchAll(/docs\/screenshots\/([\w.-]+\.png)/g)].map(match => match[1]))].sort();
  assert.deepEqual(config.shots.map(shot => shot.file).sort(), referenced);
});

test('screenshots run through the shared exp-core tool', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.screenshots, /^node \.\.\/exp-core\/scripts\/capture-screenshots\.cjs (Dropper|SHIFT|WARD|PRISMA)$/);
  for (const retired of ['capture-screenshots', 'visual:capture']) assert.equal(pkg.scripts[retired], undefined, retired);
  for (const file of ['scripts/capture-screenshots.cjs', 'scripts/capture-visuals.cjs']) assert.equal(fs.existsSync(path.join(root, file)), false, file);
});
