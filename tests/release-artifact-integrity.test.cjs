'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

test('release rejects a rebuilt artifact that differs from its tagged source', t => {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8');
  const command = workflow.match(/^\s+(git diff --exit-code -- src\/dropper\.user\.js dropper\.user\.js)$/m)?.[1];
  assert.ok(command && workflow.indexOf(command) < workflow.indexOf('- name: Publish assets'));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dropper-release-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
  git(['init']); fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(path.join(directory, 'src/dropper.user.js'), 'source\n');
  fs.writeFileSync(path.join(directory, 'dropper.user.js'), 'install\n');
  git(['add', '.']); git(['-c', 'user.name=expDARE', '-c', 'user.email=5340947+ExtraPotions@users.noreply.github.com', 'commit', '-m', 'Fixture']);
  const check = () => spawnSync('git', command.split(' ').slice(1), { cwd: directory }).status;
  assert.equal(check(), 0);
  fs.writeFileSync(path.join(directory, 'dropper.user.js'), 'rebuilt install\n');
  assert.equal(check(), 1);
});
