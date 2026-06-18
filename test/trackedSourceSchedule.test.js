'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { evaluateTrackedSourceSchedule } = require('../src/domain/scheduling/trackedSourceSchedule');

test('tracked source schedule evaluates interval and next run rules', function () {
  const now = '2026-06-18T10:00:00.000Z';
  const baseSource = {
    enabled: true,
    runState: {
      status: 'completed',
      lastFinishedAt: '2026-06-18T08:30:00.000Z'
    }
  };

  assert.equal(evaluateTrackedSourceSchedule(Object.assign({}, baseSource), now).due, false);
  assert.equal(evaluateTrackedSourceSchedule(Object.assign({}, baseSource, {
    schedule: { intervalMinutes: 60 }
  }), now).due, true);
  assert.equal(evaluateTrackedSourceSchedule(Object.assign({}, baseSource, {
    schedule: { intervalMinutes: 120 }
  }), now).due, false);
  assert.equal(evaluateTrackedSourceSchedule(Object.assign({}, baseSource, {
    schedule: { nextRunAt: '2026-06-18T09:59:00.000Z' }
  }), now).due, true);
  assert.equal(evaluateTrackedSourceSchedule(Object.assign({}, baseSource, {
    runState: { status: 'running' },
    schedule: { intervalMinutes: 1 }
  }), now).reason, 'source-running');
});
