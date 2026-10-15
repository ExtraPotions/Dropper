'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const vendor = path.join(root, 'vendor', 'exp-core');
const tag = fs.readFileSync(path.join(vendor, 'PIN'), 'utf8').trim();

function run(missing, env, status = 404) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    const target = path.join(dir, 'vendor', 'exp-core');
    fs.mkdirSync(target, { recursive: true });
    for (const name of ['PIN', 'exp-core.js', 'manifest.json']) fs.writeFileSync(path.join(target, name), 'unchanged');
    const script = path.join(dir, 'scripts', 'sync-exp-core.cjs');
    fs.copyFileSync(path.join(root, 'scripts', 'sync-exp-core.cjs'), script);
    const stub = path.join(dir, 'stub.cjs'), calls = path.join(dir, 'calls');
    fs.writeFileSync(stub, `
      const fs = require('node:fs'), path = require('node:path');
      const attempts = new Map();
      globalThis.fetch = async (url, { signal }) => {
        fs.appendFileSync(${JSON.stringify(calls)}, url + '\\n');
        const count = (attempts.get(url) || 0) + 1;
        attempts.set(url, count);
        const status = ${JSON.stringify(status)};
        const responseStatus = typeof status === 'object' ? status[url.endsWith('manifest.json') ? 'manifest' : 'bundle'] : status;
        if (responseStatus === 'pending') return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => { console.log('Companion request aborted'); reject(signal.reason); }, { once: true });
        });
        if (count <= ${missing}) return { ok: false, status: responseStatus };
        const name = url.endsWith('manifest.json') ? 'manifest.json' : 'exp-core.js';
        const bytes = fs.readFileSync(path.join(${JSON.stringify(vendor)}, name));
        return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
      };`);
    const result = spawnSync(process.execPath, ['--require', stub, script, tag], { encoding: 'utf8', timeout: 10000, env: { ...process.env, CI: '', EXP_CORE_SYNC_WAIT_SECONDS: '', EXP_CORE_SYNC_POLL_SECONDS: '', ...env } });
    assert.ifError(result.error);
    result.calls = fs.readFileSync(calls, 'utf8').trim().split('\n');
    for (const name of ['PIN', 'exp-core.js', 'manifest.json']) assert.deepEqual(fs.readFileSync(path.join(target, name)), result.status === 0 ? fs.readFileSync(path.join(vendor, name)) : Buffer.from('unchanged'));
    return result;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('in CI a 404 then success syncs the Core dist files', () => {
  const result = run(1, { CI: 'true', EXP_CORE_SYNC_WAIT_SECONDS: '2', EXP_CORE_SYNC_POLL_SECONDS: '0.05' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Waiting for exp-core v\d+\.\d+\.\d+ files/u);
  assert.match(result.stdout, /Synced vendored exp-core/u);
  assert.equal(result.calls.length, 4);
});

test('the wait gives up after its limit without changing the vendor', () => {
  const started = Date.now();
  const result = run(1000, { CI: 'true', EXP_CORE_SYNC_WAIT_SECONDS: '0.2', EXP_CORE_SYNC_POLL_SECONDS: '0.05' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTTP 404/u);
  assert.match(result.stdout, /Waiting for exp-core/u);
  assert.ok(result.calls.length > 2);
  assert.ok(Date.now() - started >= 200);
  assert.ok(Date.now() - started < 5000);
});

test('outside CI a 404 fails at once', () => {
  const result = run(1, {});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTTP 404/u);
  assert.doesNotMatch(result.stdout, /Waiting/u);
  assert.equal(result.calls.length, 2);
});

test('in CI other HTTP failures are not retried', () => {
  const result = run(1, { CI: 'true' }, 503);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTTP 503/u);
  assert.doesNotMatch(result.stdout, /Waiting/u);
  assert.equal(result.calls.length, 2);
});

for (const failed of ['bundle', 'manifest']) test(`a fatal ${failed} response cancels the other file's CI retry wait`, () => {
  const started = Date.now();
  const result = run(1000, { CI: 'true', EXP_CORE_SYNC_WAIT_SECONDS: '4', EXP_CORE_SYNC_POLL_SECONDS: '4' },
    { bundle: failed === 'bundle' ? 503 : 404, manifest: failed === 'manifest' ? 503 : 404 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTTP 503/u);
  assert.doesNotMatch(result.stdout, /Synced vendored/u);
  assert.equal(result.calls.length, 2, 'no retry survives the fatal companion response');
  assert.ok(Date.now() - started < 3000, 'failure does not wait for the other file');
});

for (const failed of ['bundle', 'manifest']) test(`a fatal ${failed} response aborts the other in-flight request`, () => {
  const result = run(1000, { CI: 'true' },
    { bundle: failed === 'bundle' ? 503 : 'pending', manifest: failed === 'manifest' ? 503 : 'pending' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTTP 503/u);
  assert.match(result.stdout, /Companion request aborted/u);
  assert.equal(result.calls.length, 2);
});
