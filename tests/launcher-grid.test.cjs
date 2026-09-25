'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadDropperSource } = require('./load-source.cjs');

function loadGridCoordinator() {
  const source = loadDropperSource(path.resolve(__dirname, '..'));
  const start = source.indexOf('  function registerBadgeGrid(host, productId, priority) {');
  const end = source.indexOf('\n  const APP_VERSION', start);
  assert.ok(start >= 0 && end > start, 'registerBadgeGrid source is available');
  const functionSource = source.slice(start, end).trim();

  const peers = [];
  const storage = new Map();
  const document = {
    addEventListener() {},
    dispatchEvent() {},
    querySelectorAll() {
      return peers.filter((node) => node.dataset.expProductLauncher === '1');
    },
  };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
  };
  class CustomEvent {}
  const register = new Function(
    'protectLauncherHost',
    'document',
    'localStorage',
    'requestAnimationFrame',
    'addEventListener',
    'layoutChrome',
    'CustomEvent',
    `${functionSource}\nreturn registerBadgeGrid;`,
  )(
    () => {},
    document,
    localStorage,
    () => 1,
    () => {},
    () => {},
    CustomEvent,
  );

  const createPeer = (id, priority, reservedRows) => {
    const properties = new Map();
    const node = {
      dataset: {},
      style: { setProperty(name, value) { properties.set(name, value); } },
    };
    if (reservedRows !== undefined) node.dataset.launcherReservedRows = String(reservedRows);
    peers.push(node);
    register(node, id, priority);
    return node;
  };

  return { createPeer, register };
}

function placement(node) {
  return {
    slot: node.dataset.launcherSlot,
    row: node.dataset.launcherRow,
    column: node.dataset.launcherColumn,
    span: node.dataset.launcherSpan,
  };
}

test('Dropper progress and badge-only mode preserve the same compact grid', () => {
  const { createPeer, register } = loadGridCoordinator();
  const dropper = createPeer('dropper', 90, 3);
  const shift = createPeer('shift', 100);
  const prisma = createPeer('prisma', 80);
  const ward = createPeer('ward', 60);

  assert.deepEqual(placement(dropper), { slot: '0', row: '0', column: '0', span: '1' });
  assert.deepEqual(placement(shift), { slot: '1', row: '0', column: '1', span: '1' });
  assert.deepEqual(placement(prisma), { slot: '2', row: '0', column: '2', span: '1' });
  assert.deepEqual(placement(ward), { slot: '3', row: '1', column: '0', span: '1' });

  dropper.dataset.launcherReservedRows = '1';
  register(ward, 'ward', 60);
  assert.deepEqual(placement(shift), { slot: '1', row: '0', column: '1', span: '1' });
  assert.deepEqual(placement(prisma), { slot: '2', row: '0', column: '2', span: '1' });
  assert.deepEqual(placement(ward), { slot: '3', row: '1', column: '0', span: '1' });
});
