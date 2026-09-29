'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'sync-exp-core.yml'), 'utf8');
const prepare = fs.readFileSync(path.join(root, 'scripts', 'prepare-core-release.cjs'), 'utf8');
const featurePrepare = fs.readFileSync(path.join(root, 'scripts', 'prepare-feature-release.cjs'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Dropper delegates Core rollout orchestration to exp-core', () => {
  assert.match(workflow, /uses: ExtraPotions\/exp-core\/\.github\/workflows\/consumer-rollout\.yml@main/u);
  assert.match(workflow, /product: Dropper/u);
  assert.match(workflow, /node-version: "22"/u);
  assert.match(workflow, /script-asset: dropper\.user\.js/u);
  assert.match(workflow, /icon-asset: assets\/dropper-launcher\.svg/u);
  assert.match(workflow, /release-sections: 3/u);
});

test('Dropper keeps only its product-specific release preparation locally', () => {
  assert.match(prepare, /bumpPatch/u);
  assert.match(prepare, /Updates the shared foundation to exp-core/u);
  assert.match(prepare, /Twitch routing, campaign, claim, and playback behavior unchanged/u);
});


test('feature and Core release preparation stay separate', () => {
  assert.equal(pkg.scripts['prepare:release:feature'], 'node scripts/prepare-feature-release.cjs');
  assert.equal(pkg.scripts['prepare:release:core'], 'node scripts/prepare-core-release.cjs');
  assert.match(featurePrepare, /RELEASE_NOTES_JSON is required for a feature release/u);
  assert.match(featurePrepare, /notes\.length < 1 \|\| notes\.length > 4/u);
  assert.doesNotMatch(featurePrepare, /Updates the shared foundation to exp-core/u);
  assert.match(prepare, /Updates the shared foundation to exp-core/u);
});
