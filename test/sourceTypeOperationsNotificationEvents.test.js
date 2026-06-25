'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  synthesizeSourceTypeOperationsNotificationEvents
} = require('../src/application/use-cases/synthesizeSourceTypeOperationsNotificationEvents');
const {
  buildSourceTypeOperationsEventId,
  createSourceTypeOperationsEvent
} = require('../src/domain/events/notificationEvent');

test('source type operations notification synthesis defaults to dry-run', async function () {
  const saved = [];
  const item = sourceTypeItem('saved-html-directory', {
    lifecycle: {
      failureRetryWaiting: 1
    }
  });
  const result = await synthesizeSourceTypeOperationsNotificationEvents({
    notificationEventRepository: repository([], saved),
    sourceTypeOperationsReport: report([item]),
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.actionCount, 1);
  assert.equal(result.createdCount, 1);
  assert.equal(result.eventCount, 1);
  assert.equal(saved.length, 0);
  assert.equal(result.results[0].event.type, 'source-type-operations');
  assert.equal(result.results[0].event.payload.sourceType, 'saved-html-directory');
  assert.equal(result.results[0].event.deliveryStatus, 'pending');
});

test('source type operations notification synthesis executes stable source type events', async function () {
  const saved = [];
  const item = sourceTypeItem('thread-url', {
    attention: {
      warning: 1,
      highestPriorityScore: 90
    }
  });
  const result = await synthesizeSourceTypeOperationsNotificationEvents({
    notificationEventRepository: repository([], saved),
    sourceTypeOperationsReport: report([item]),
    execute: true,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.createdCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, buildSourceTypeOperationsEventId(item));
  assert.equal(saved[0].severity, 'warning');
  assert.equal(saved[0].payload.attention.warning, 1);
});

test('source type operations notification synthesis ignores pure readiness warnings by default', async function () {
  const saved = [];
  const result = await synthesizeSourceTypeOperationsNotificationEvents({
    notificationEventRepository: repository([], saved),
    sourceTypeOperationsReport: report([
      sourceTypeItem('normalized-thread-json', {
        status: 'warn',
        readiness: {
          status: 'warn',
          sourceCount: 0,
          enabledSourceCount: 0
        }
      })
    ]),
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.actionCount, 0);
  assert.equal(result.eventCount, 0);
  assert.equal(saved.length, 0);
});

test('source type operations notification synthesis can include readiness warnings explicitly', async function () {
  const saved = [];
  const result = await synthesizeSourceTypeOperationsNotificationEvents({
    notificationEventRepository: repository([], saved),
    sourceTypeOperationsReport: report([
      sourceTypeItem('normalized-thread-json', {
        status: 'warn',
        readiness: {
          status: 'warn',
          sourceCount: 0,
          enabledSourceCount: 0
        }
      })
    ]),
    includeReadinessWarnings: true,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.actionCount, 1);
  assert.equal(result.results[0].sourceType, 'normalized-thread-json');
});

test('source type operations notification synthesis resolves stale scoped events', async function () {
  const saved = [];
  const active = sourceTypeItem('thread-url', {
    attention: {
      warning: 1,
      highestPriorityScore: 90
    }
  });
  const stale = sourceTypeItem('saved-html-directory', {
    lifecycle: {
      failureRetryWaiting: 1
    }
  });
  const queries = [];
  const result = await synthesizeSourceTypeOperationsNotificationEvents({
    notificationEventRepository: repository([
      existingEvent(stale, { deliveryStatus: 'failed' })
    ], saved, queries),
    sourceTypeOperationsReport: report([active]),
    execute: true,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.createdCount, 1);
  assert.equal(result.resolvedCount, 1);
  assert.equal(saved.length, 2);
  assert.equal(saved[1].deliveryStatus, 'resolved');
  assert.equal(saved[1].acknowledgedBy, 'source-type-operations-synthesizer');
  assert.equal(saved[1].payload.resolution.reason, 'source-type-operations-cleared');
  assert.equal(queries[0].type, 'source-type-operations');
});

test('source type operations notification synthesis reopens auto-resolved events', async function () {
  const saved = [];
  const item = sourceTypeItem('thread-url', {
    lifecycle: {
      staleRunning: 1
    }
  });
  const resolved = existingEvent(item, {
    deliveryStatus: 'resolved',
    nextDeliveryAt: undefined,
    acknowledgedAt: '2026-06-25T09:00:00.000Z',
    acknowledgedBy: 'source-type-operations-synthesizer'
  });
  resolved.payload = Object.assign({}, resolved.payload, {
    resolution: {
      status: 'resolved',
      resolvedAt: '2026-06-25T09:00:00.000Z',
      reason: 'source-type-operations-cleared'
    }
  });
  const result = await synthesizeSourceTypeOperationsNotificationEvents({
    notificationEventRepository: repository([resolved], saved),
    sourceTypeOperationsReport: report([item]),
    execute: true,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.reopenedCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].deliveryStatus, 'pending');
  assert.equal(saved[0].payload.previousResolution.reason, 'source-type-operations-cleared');
});

function report(sourceTypes) {
  return {
    generatedAt: '2026-06-25T09:59:00.000Z',
    status: 'warn',
    sourceTypes
  };
}

function sourceTypeItem(sourceType, overrides) {
  const safeOverrides = overrides || {};
  return Object.assign({
    sourceType,
    status: 'warn',
    readiness: {
      status: 'ok',
      sourceCount: 1,
      enabledSourceCount: 1
    },
    schedule: {
      due: 0,
      running: 0
    },
    lifecycle: {
      running: 0,
      staleRunning: 0,
      disableBlocked: 0,
      failureRetryWaiting: 0
    },
    attention: {
      total: 0,
      critical: 0,
      warning: 0,
      actionable: 0,
      highestPriorityScore: 0
    },
    recommendedCommands: [],
    topAttention: []
  }, safeOverrides);
}

function existingEvent(item, overrides) {
  return Object.assign(createSourceTypeOperationsEvent({
    item,
    createdAt: '2026-06-25T09:00:00.000Z'
  }), overrides);
}

function repository(events, saved, queries) {
  return {
    async saveEvent(event) {
      saved.push(event);
    },
    async findEvent(id) {
      return events.find(function (event) {
        return event.id === id;
      });
    },
    async listEvents(query) {
      if (queries) queries.push(query || {});
      const safeQuery = query || {};
      return events.filter(function (event) {
        if (safeQuery.type && event.type !== safeQuery.type) return false;
        if (safeQuery.acknowledged === false && event.acknowledgedAt) return false;
        return true;
      });
    }
  };
}
