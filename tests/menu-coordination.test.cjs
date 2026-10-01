'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = require('./load-source.cjs').loadDropperSource();
const core = fs.readFileSync(path.join(__dirname, '../vendor/exp-core/exp-core.js'), 'utf8');

function extract(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, 'expected production function boundaries');
  return text.slice(start, end);
}

function fixture() {
  class Target {
    constructor() {
      this.listeners = new Map(); this.attributes = new Map(); this.dataset = {};
      this.classList = { toggle() {} }; this.style = { removeProperty() {} };
    }
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
    dispatchEvent(event) { for (const handler of [...this.listeners.get(event.type) || []]) handler(event); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
  }
  const document = new Target(); document.documentElement = new Target();
  const events = [], focus = [], closeRequests = [];
  document.addEventListener('exp-core:menu-open', () => events.push('exp-core:menu-open'));
  const noop = () => {};
  const c = {
    railOpen: false, document,
    ui: { dock: new Target(), launcher: new Target(), shadow: { getElementById: () => null } },
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type) { this.type = type; } },
    HTMLSelectElement: class {}, Date,
    setTimeout: () => { throw new Error('auto-close is disabled in this fixture'); }, clearTimeout: noop,
    collapseToolPanels: noop, collapseNestedPanels: noop, refreshTwitchAuthStatus: noop,
    layoutChrome: noop, requestAnimationFrame: noop, clearSkipStreamerArm: noop,
    ExtraPotionsCore: { focusMenuSurface: () => { focus.push('menu'); return true; } },
  };
  c.ui.launcher.focus = () => focus.push('launcher');
  vm.createContext(c);
  vm.runInContext('const menuControllers = new WeakMap();\n' +
    extract(core, '  function createMenuController(options = {}) {', '  function create(options) {') +
    '\nthis.createMenuController = createMenuController;\n' +
    extract(source, '  function setRailOpen(', '\n  function '), c);
  c.ui.menuController = c.createMenuController({
    id: 'dropper', host: new Target(), shadow: c.ui.shadow, panel: c.ui.dock,
    getSettings: () => ({ menuAutoClose: false }),
    setOpen(value, shouldFocus) { closeRequests.push([value, shouldFocus]); c.setRailOpen(value, shouldFocus); },
  });
  c.scheduleMenuDismiss = () => c.ui.menuController.scheduleDismiss();
  c.clearMenuDismissTimer = () => c.ui.menuController.cancelDismiss();
  return { c, Target, document, events, focus, closeRequests };
}

test('opening Dropper synchronously delegates ownership to the actual pinned Core controller', () => {
  const { c, document, events } = fixture();
  c.setRailOpen(true, false);
  assert.equal(c.railOpen, true);
  assert.equal(c.ui.menuController.isOpen, true);
  assert.equal(document.documentElement.getAttribute('data-exp-open-menu'), 'dropper');
  assert.deepEqual(events, ['exp-core:menu-open']);
  c.setRailOpen(false, false);
  assert.equal(c.ui.menuController.isOpen, false);
  assert.equal(document.documentElement.getAttribute('data-exp-open-menu'), null);
  assert.deepEqual(events, ['exp-core:menu-open']);
});

test('Core closes Dropper for another product without stealing focus or erasing its owner', () => {
  const { c, Target, document, focus, closeRequests } = fixture();
  c.setRailOpen(true, false);
  let other;
  other = c.createMenuController({
    id: 'shift', host: new Target(), panel: new Target(), shadow: {},
    getSettings: () => ({ menuAutoClose: false }), setOpen(value) { other.state(value); },
  });
  other.state(true);
  assert.equal(c.railOpen, false);
  assert.equal(c.ui.menuController.isOpen, false);
  assert.equal(other.isOpen, true);
  assert.equal(document.documentElement.getAttribute('data-exp-open-menu'), 'shift');
  assert.deepEqual(closeRequests, [[false, false]]);
  assert.deepEqual(focus, []);
  c.ui.menuController.destroy(); other.destroy();
});

test('explicit keyboard focus still returns to the menu and launcher', () => {
  const { c, focus } = fixture();
  c.setRailOpen(true, true); c.setRailOpen(false, true);
  assert.deepEqual(focus, ['menu', 'launcher']);
});
