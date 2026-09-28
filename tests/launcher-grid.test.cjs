'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'src', 'dropper.user.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, 'vendor', 'exp-core', 'exp-core.js'), 'utf8');

test('Dropper delegates launcher-grid ownership to pinned exp-core', () => {
  assert.match(
    template,
    /ExtraPotionsCore\.registerLauncher\(host, \{ productId, priority \}\)/u,
  );
  assert.match(template, /ExtraPotionsCore\.layout\(\)/u);
  assert.doesNotMatch(template, /function layoutGrid\s*\(/u);
  assert.doesNotMatch(template, /launcherSlot\s*=/u);
  assert.match(coreSource, /function layoutGrid\s*\(/u);
  assert.match(coreSource, /function registerLauncher\s*\(/u);
});

test('saved launcher order and grid-cell placement remain Core responsibilities', () => {
  assert.doesNotMatch(template, /exp:v3:launcher-order[^\n]*localStorage/u);
  assert.match(coreSource, /exp:v3:launcher-order/u);
  assert.match(coreSource, /launcherSlot/u);
  assert.match(coreSource, /launcherRow/u);
  assert.match(coreSource, /launcherColumn/u);
  assert.match(coreSource, /launcherSpan/u);
});
