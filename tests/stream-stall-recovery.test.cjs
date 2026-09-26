'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');

const { loadDropperSource } = require('./load-source.cjs');
const source = loadDropperSource();

const stallTimeoutStart = source.indexOf('  function progressStallTimeoutMs');
const stalledRecoveryStart = source.indexOf('  function stalledProgressNeedsRecovery(');
const needsStreamStart = source.indexOf('  function activeDropNeedsStream()');
assert.notEqual(stallTimeoutStart, -1, 'progress stall timeout helper is present');
assert.notEqual(stalledRecoveryStart, -1, 'stalled progress recovery decision is present');
assert.notEqual(needsStreamStart, -1, 'active campaign routing decision is present');

const stalledRecoveryContext = {
  viewingNavigationAllowed: () => true,
  settings: { findNextStream: true, queueEnabled: true, queueOnStall: true },
  currentDrop: { currentMinutes: 75, requiredMinutes: 90 },
  dropProgressComplete: () => false,
  isAutoSwitchPaused: () => false,
  HEALTHY_STREAM_STALLED_MS: 360000,
  UNHEALTHY_STREAM_STALLED_MS: 120000,
  ROUTING_STATES: {
    FIND_STREAM: 'find-stream',
    OPEN_STREAM: 'open-stream',
    VERIFY_STREAM: 'verify-stream',
    WAITING: 'waiting',
    EARNING: 'earning',
  },
  readRoutingControllerSession: () => ({ state: 'earning' }),
  streamEarningHealthSnapshot: () => ({
    healthy: true,
    videoPlaying: true,
    inVerificationGrace: false,
    progressAgeMs: 360001,
  }),
};
vm.runInNewContext(
  `${source.slice(stallTimeoutStart, needsStreamStart)}\nthis.stalledProgressNeedsRecovery = stalledProgressNeedsRecovery;\nthis.progressStallTimeoutMs = progressStallTimeoutMs;`,
  stalledRecoveryContext,
);
assert.equal(stalledRecoveryContext.progressStallTimeoutMs(true), 360000, 'healthy streams keep the 6-minute stall');
assert.equal(stalledRecoveryContext.progressStallTimeoutMs(false), 120000, 'unhealthy streams stall after 2 minutes');
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), true, 'progress beyond the healthy stall threshold enters recovery');
stalledRecoveryContext.settings.queueOnStall = false;
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, 'disabled queue-on-stall prevents automatic recovery');
stalledRecoveryContext.settings.queueOnStall = true;
stalledRecoveryContext.isAutoSwitchPaused = () => true;
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, 'manual auto-switch pause prevents stalled recovery');
stalledRecoveryContext.isAutoSwitchPaused = () => false;
stalledRecoveryContext.streamEarningHealthSnapshot = () => ({
  healthy: false,
  videoPlaying: false,
  inVerificationGrace: false,
  progressAgeMs: 120001,
});
stalledRecoveryContext.viewingNavigationAllowed = () => false;
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, 'a viewer pause remains protected beyond the old 2-minute stall');
stalledRecoveryContext.viewingNavigationAllowed = () => true;
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), true, 'an authorized unhealthy stream can recover after the 2-minute stall');
stalledRecoveryContext.streamEarningHealthSnapshot = () => ({
  healthy: false,
  videoPlaying: false,
  inVerificationGrace: false,
  progressAgeMs: 119999,
});
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, 'an authorized unhealthy stream does not recover before the 2-minute stall');
stalledRecoveryContext.streamEarningHealthSnapshot = () => ({
  healthy: false,
  videoPlaying: false,
  inVerificationGrace: true,
  progressAgeMs: 120001,
});
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, 'the 90-second verification window blocks stall recovery');
stalledRecoveryContext.streamEarningHealthSnapshot = () => ({
  healthy: false,
  videoPlaying: true,
  inVerificationGrace: true,
  progressAgeMs: 120001,
});
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, 'an unhealthy but playing stream still honors verification grace');
