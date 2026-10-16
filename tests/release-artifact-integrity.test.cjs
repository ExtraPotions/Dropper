'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('manual publication uploads committed assets without rebuilding them', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8');
  assert.match(workflow, /sha256sum dropper\.user\.js; cd assets && sha256sum dropper-launcher\.svg/u);
  assert.match(workflow, /gh release create/u);
  assert.match(workflow, /--target "\$GITHUB_SHA"/u);
  assert.doesNotMatch(workflow, /npm |needs:|download-artifact|--clobber/u);
});
