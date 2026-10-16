'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
const featurePrepare = fs.readFileSync(path.join(root, 'scripts', 'prepare-feature-release.cjs'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Core updates do not start downstream publication', () => {
  assert.equal(fs.existsSync(path.join(root, '.github/workflows/sync-exp-core.yml')), false);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /repository_dispatch:|schedule:|consumer-rollout|needs:/u);
});



test('feature release preparation remains available', () => {
  assert.equal(pkg.scripts['prepare:release:feature'], 'node scripts/prepare-feature-release.cjs && npm run build');
  assert.equal(pkg.scripts['prepare:release:core'], undefined);
  assert.match(featurePrepare, /RELEASE_NOTES_JSON is required for a feature release/u);
  assert.match(featurePrepare, /notes\.length < 2 \|\| notes\.length > 4/u);
  assert.doesNotMatch(featurePrepare, /Updates the shared foundation to exp-core/u);
});
