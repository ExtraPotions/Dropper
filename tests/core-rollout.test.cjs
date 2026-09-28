'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'sync-exp-core.yml'), 'utf8');
const sync = fs.readFileSync(path.join(root, 'scripts', 'sync-exp-core.cjs'), 'utf8');
const prepare = fs.readFileSync(path.join(root, 'scripts', 'prepare-core-release.cjs'), 'utf8');

test('Dropper Core rollout is pin-driven and no-ops when Core is unchanged', () => {
  assert.match(workflow, /Sync latest released Core/u);
  assert.match(workflow, /git diff --quiet -- vendor\/exp-core/u);
  assert.match(workflow, /steps\.changed\.outputs\.value == 'true'/u);
  assert.match(sync, /releases\/latest/u);
  assert.match(sync, /vendor[\s\S]*exp-core/u);
});

test('Dropper Core rollout verifies before publishing', () => {
  const order = [
    'Prepare consumer patch release',
    'Verify pinned Core',
    'Rebuild and test consumer',
    'Commit Core-driven patch release',
    'Publish Core-driven release',
  ].map(label => workflow.indexOf(label));
  assert.ok(order.every(index => index >= 0), JSON.stringify(order));
  assert.deepEqual([...order].sort((a,b) => a-b), order);
  assert.match(workflow, /node scripts\/verify-exp-core-pin\.cjs/u);
  assert.match(workflow, /npm test/u);
  assert.match(workflow, /gh release create/u);
});

test('Dropper Core rollout prepares a patch version instead of changing product semantics', () => {
  assert.match(prepare, /bumpPatch/u);
  assert.match(prepare, /Updates the shared foundation to exp-core/u);
  assert.match(prepare, /product-specific engine behavior unchanged|Twitch routing, campaign, claim, and playback behavior unchanged/u);
});
