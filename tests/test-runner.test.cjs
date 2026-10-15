'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/run-tests.cjs'), 'utf8');
for (const platform of ['win32', 'linux']) {
  test('test runner limits only Windows and propagates failure: ' + platform, () => {
    let invocation, exitCode;
    const directory = path.basename(__dirname);
    vm.runInNewContext(source, {
      __dirname: path.join(__dirname, '../scripts'),
      require(name) {
        if (name === 'node:fs') return { existsSync: () => directory === 'tests-v3', readdirSync: () => ['b.test.cjs', 'fixture.txt', 'a.test.cjs'] };
        if (name === 'node:child_process') return { spawnSync(...args) { invocation = args; return { status: 7 }; } };
        return require(name);
      },
      process: { platform, execPath: process.execPath, exit(code) { exitCode = code; } },
      console,
    });
    assert.deepEqual(Array.from(invocation[1]), ['--test', ...(platform === 'win32' ? ['--test-concurrency=2'] : []), path.join(directory, 'a.test.cjs'), path.join(directory, 'b.test.cjs')]);
    assert.equal(exitCode, 7);
    assert.equal(invocation[2].cwd, path.resolve(__dirname, '..'));
  });
}
