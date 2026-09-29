'use strict';

// Builds, then runs the test suite against an installed Chrome or Edge, so
// nothing has to be downloaded first. Usage: npm run test:installed-browser

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const preload = path.join(__dirname, 'use-installed-browser.cjs').replace(/\\/g, '/');
const testDirectory = fs.existsSync(path.join(root, 'tests-v3')) ? 'tests-v3' : 'tests';
const files = fs.readdirSync(path.join(root, testDirectory))
  .filter(name => name.endsWith('.test.cjs'))
  .map(name => path.join(testDirectory, name));

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build', '--silent'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (build.status !== 0) process.exit(build.status || 1);

const run = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${preload}`.trim() },
  stdio: 'inherit',
});
process.exit(run.status ?? 1);
