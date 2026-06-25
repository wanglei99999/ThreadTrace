'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createSynthesisResultCounts,
  eventMatchesSourceScope,
  existingEventSkipReason,
  getNotificationSynthesisPolicyReport,
  isAlertSeverity,
  mergeExistingNotificationDeliveryState,
  normalizeAlertSeverity,
  shouldAlertForSourceAttention
} = require('../src/application/use-cases/notificationSynthesisPolicy');

test('notification synthesis policy normalizes alert severities', function () {
  assert.equal(normalizeAlertSeverity('warn'), 'warning');
  assert.equal(isAlertSeverity('critical'), true);
  assert.equal(isAlertSeverity('warning'), true);
  assert.equal(isAlertSeverity('warn'), true);
  assert.equal(isAlertSeverity('info'), false);
});

test('notification synthesis policy evaluates source attention by severity or priority score', function () {
  assert.equal(shouldAlertForSourceAttention({ severity: 'warning', priorityScore: 1 }), true);
  assert.equal(shouldAlertForSourceAttention({ severity: 'info', priorityScore: 90 }, {
    priorityScoreThreshold: 80
  }), true);
  assert.equal(shouldAlertForSourceAttention({ severity: 'info', priorityScore: 79 }, {
    priorityScoreThreshold: 80
  }), false);
});

test('notification synthesis policy identifies immutable existing event states', function () {
  assert.equal(existingEventSkipReason({ acknowledgedAt: '2026-06-25T10:00:00.000Z' }), 'already-acknowledged');
  assert.equal(existingEventSkipReason({ deliveryStatus: 'delivered' }), 'already-delivered');
  assert.equal(existingEventSkipReason({ deliveryStatus: 'pending' }), undefined);
});

test('notification synthesis policy preserves delivery state when updating events', function () {
  const merged = mergeExistingNotificationDeliveryState({
    createdAt: '2026-06-25T09:00:00.000Z',
    deliveryStatus: 'failed',
    deliveryAttempts: 2,
    lastDeliveryError: { message: 'webhook down' },
    nextDeliveryAt: '2026-06-25T09:05:00.000Z',
    acknowledgedBy: undefined
  }, {
    createdAt: '2026-06-25T10:00:00.000Z',
    deliveryStatus: 'pending',
    deliveryAttempts: 0,
    nextDeliveryAt: '2026-06-25T10:00:00.000Z',
    payload: { refreshed: true }
  });

  assert.equal(merged.createdAt, '2026-06-25T09:00:00.000Z');
  assert.equal(merged.deliveryStatus, 'failed');
  assert.equal(merged.deliveryAttempts, 2);
  assert.equal(merged.lastDeliveryError.message, 'webhook down');
  assert.equal(merged.nextDeliveryAt, '2026-06-25T09:05:00.000Z');
  assert.deepEqual(merged.payload, { refreshed: true });
});

test('notification synthesis policy matches source scopes and counts result statuses', function () {
  assert.equal(eventMatchesSourceScope({ sourceId: 'source-a', sourceKey: 'forum-a' }, {
    sourceId: 'source-a'
  }), true);
  assert.equal(eventMatchesSourceScope({ sourceId: 'source-a', sourceKey: 'forum-a' }, {
    sourceKey: 'forum-b'
  }), false);

  assert.deepEqual(createSynthesisResultCounts([
    { status: 'created' },
    { status: 'updated' },
    { status: 'resolved' },
    { status: 'reopened' },
    { status: 'skipped' }
  ]), {
    eventCount: 4,
    createdCount: 1,
    updatedCount: 1,
    resolvedCount: 1,
    reopenedCount: 1,
    skippedCount: 1
  });
});

test('notification synthesis policy report exposes shared rules and event type policies', function () {
  const report = getNotificationSynthesisPolicyReport({
    now: '2026-06-25T10:00:00.000Z',
    priorityScoreThreshold: 85
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.generatedAt, '2026-06-25T10:00:00.000Z');
  assert.equal(report.defaults.dryRun, true);
  assert.deepEqual(report.defaults.immutableExistingStates, ['acknowledged', 'delivered']);
  assert.equal(report.defaults.sourceAttentionPriorityScoreThreshold, 85);
  assert.ok(report.sharedRules.find(function (rule) {
    return rule.key === 'preserve-delivery-state';
  }));

  const sourceAttention = report.eventTypes.find(function (item) {
    return item.type === 'source-attention';
  });
  assert.equal(sourceAttention.sourceScoped, true);
  assert.equal(sourceAttention.staleResolution, true);
  assert.ok(sourceAttention.alertRules.find(function (rule) {
    return rule.key === 'priority-score-threshold' && rule.threshold === 85;
  }));

  const sourceTypeOperations = report.eventTypes.find(function (item) {
    return item.type === 'source-type-operations';
  });
  assert.equal(sourceTypeOperations.sourceScoped, false);
  assert.equal(sourceTypeOperations.staleResolution, true);
  assert.ok(sourceTypeOperations.alertRules.find(function (rule) {
    return rule.key === 'operations-pressure' && rule.threshold === 85;
  }));
  assert.ok(sourceTypeOperations.alertRules.find(function (rule) {
    return rule.key === 'readiness-warnings-opt-in';
  }));
});
