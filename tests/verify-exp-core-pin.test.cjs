'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'scripts', 'verify-exp-core-pin.cjs');
const vendor = path.join(__dirname, '..', 'vendor', 'exp-core');

// Runs the pin check with fetch answering 404 for the first `missing` requests, then the vendored bytes.
function run(missing, env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-'));
  const stub = path.join(dir, 'stub.cjs');
  fs.writeFileSync(stub, `
    const fs = require('node:fs'), path = require('node:path');
    let left = ${missing};
    globalThis.fetch = async (url) => {
      if (left-- > 0) return { ok: false, status: 404 };
      const name = url.endsWith('manifest.json') ? 'manifest.json' : 'exp-core.js';
      const bytes = fs.readFileSync(path.join(${JSON.stringify(vendor)}, name));
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    };`);
  const result = spawnSync(process.execPath, ['--require', stub, script], { encoding: 'utf8', env: { ...process.env, CI: '', EXP_CORE_PIN_WAIT_SECONDS: '', ...env } });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

test('in CI the pin check waits for a Core tag that is not published yet', () => {
  const result = run(2, { CI: 'true', EXP_CORE_PIN_WAIT_SECONDS: '5', EXP_CORE_PIN_POLL_SECONDS: '0.05' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Waiting for exp-core v\d+\.\d+\.\d+ to be published/u);
  assert.match(result.stdout, /matches v\d+\.\d+\.\d+ byte-for-byte/u);
});

test('the wait gives up after its limit', () => {
  const result = run(1000, { CI: 'true', EXP_CORE_PIN_WAIT_SECONDS: '0.2', EXP_CORE_PIN_POLL_SECONDS: '0.05' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTTP 404/u);
});

test('outside CI a missing Core tag fails at once', () => {
  const started = Date.now();
  const result = run(1, {});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTTP 404/u);
  assert.ok(Date.now() - started < 5000);
});
