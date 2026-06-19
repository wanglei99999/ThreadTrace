'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildSourceFailureRetryPlan,
  evaluateTrackedSourceSchedule
} = require('../src/domain/scheduling/trackedSourceSchedule');

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

test('tracked source schedule applies failure retry backoff before due work', function () {
  const source = {
    enabled: true,
    updatedAt: '2026-06-18T09:59:00.000Z',
    schedule: {
      nextRunAt: '2026-06-18T09:00:00.000Z'
    },
    runState: {
      status: 'failed',
      failureCount: 2,
      lastFinishedAt: '2026-06-18T09:59:00.000Z'
    }
  };

  const waiting = evaluateTrackedSourceSchedule(source, '2026-06-18T10:00:00.000Z', {
    sourceFailureRetryBackoffMs: 60 * 1000,
    sourceFailureMaxRetryBackoffMs: 60 * 60 * 1000
  });
  const elapsed = evaluateTrackedSourceSchedule(source, '2026-06-18T10:01:00.000Z', {
    sourceFailureRetryBackoffMs: 60 * 1000,
    sourceFailureMaxRetryBackoffMs: 60 * 60 * 1000
  });

  assert.equal(waiting.due, false);
  assert.equal(waiting.reason, 'waiting-failure-backoff');
  assert.equal(waiting.retryAt, '2026-06-18T10:01:00.000Z');
  assert.equal(waiting.failureCount, 2);
  assert.equal(waiting.backoffMs, 120000);
  assert.equal(waiting.baseReason, 'next-run-at');
  assert.equal(elapsed.due, true);
  assert.equal(elapsed.reason, 'failure-backoff-elapsed-next-run-at');
  assert.equal(elapsed.retryAt, '2026-06-18T10:01:00.000Z');
});

test('source failure retry plan can be disabled with zero backoff', function () {
  const plan = buildSourceFailureRetryPlan({
    updatedAt: '2026-06-18T09:59:00.000Z',
    runState: {
      status: 'failed',
      failureCount: 1,
      lastFinishedAt: '2026-06-18T09:59:00.000Z'
    }
  }, '2026-06-18T10:00:00.000Z', {
    sourceFailureRetryBackoffMs: 0
  });

  assert.equal(plan.active, false);
});
