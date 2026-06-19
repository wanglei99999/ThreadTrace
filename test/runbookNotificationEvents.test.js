'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { synthesizeRunbookNotificationEvents } = require('../src/application/use-cases/synthesizeRunbookNotificationEvents');

test('runbook notification event synthesis defaults to dry-run', async function () {
  const saved = [];
  const result = await synthesizeRunbookNotificationEvents({
    notificationEventRepository: repository([], saved),
    runbook: runbook([
      action('checklist.sources', 'critical'),
      action('checklist.llm', 'warning')
    ]),
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.actionCount, 2);
  assert.equal(result.createdCount, 2);
  assert.equal(result.eventCount, 2);
  assert.equal(saved.length, 0);
  assert.equal(result.results[0].event.type, 'runbook-action');
  assert.equal(result.results[0].event.deliveryStatus, 'pending');
  assert.equal(result.results[0].event.nextDeliveryAt, '2026-06-19T10:00:00.000Z');
});

test('runbook notification event synthesis executes stable outbox events', async function () {
  const saved = [];
  const result = await synthesizeRunbookNotificationEvents({
    notificationEventRepository: repository([], saved),
    runbook: runbook([
      action('sourceLifecycle.failureRetry.source-1', 'warning', {
        sourceId: 'source-1'
      })
    ]),
    execute: true,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(result.dryRun, false);
  assert.equal(result.createdCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, result.results[0].event.id);
  assert.equal(saved[0].sourceId, 'source-1');
  assert.equal(saved[0].payload.action.key, 'sourceLifecycle.failureRetry.source-1');
});

test('runbook notification event synthesis skips acknowledged and delivered events', async function () {
  const saved = [];
  const firstAction = action('source.acked', 'warning');
  const secondAction = action('source.delivered', 'critical');
  const existing = [
    existingEvent(firstAction, {
      acknowledgedAt: '2026-06-19T09:00:00.000Z',
      deliveryStatus: 'delivered'
    }),
    existingEvent(secondAction, {
      deliveryStatus: 'delivered'
    })
  ];
  const result = await synthesizeRunbookNotificationEvents({
    notificationEventRepository: repository(existing, saved),
    runbook: runbook([firstAction, secondAction]),
    execute: true,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(result.skippedCount, 2);
  assert.deepEqual(result.results.map(function (item) { return item.reason; }), ['already-acknowledged', 'already-delivered']);
  assert.equal(saved.length, 0);
});

test('runbook notification event synthesis updates pending event payload without resetting delivery state', async function () {
  const saved = [];
  const item = action('source.pending', 'warning');
  const existing = existingEvent(item, {
    deliveryStatus: 'failed',
    deliveryAttempts: 2,
    nextDeliveryAt: '2026-06-19T10:05:00.000Z',
    lastDeliveryError: {
      message: 'temporary outage'
    }
  });
  const result = await synthesizeRunbookNotificationEvents({
    notificationEventRepository: repository([existing], saved),
    runbook: runbook([Object.assign({}, item, {
      summary: 'Updated summary.'
    })]),
    execute: true,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(result.updatedCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].summary, 'Updated summary.');
  assert.equal(saved[0].deliveryStatus, 'failed');
  assert.equal(saved[0].deliveryAttempts, 2);
  assert.equal(saved[0].nextDeliveryAt, '2026-06-19T10:05:00.000Z');
  assert.equal(saved[0].lastDeliveryError.message, 'temporary outage');
});

function runbook(actions) {
  return {
    generatedAt: '2026-06-19T09:59:00.000Z',
    status: 'warn',
    actions
  };
}

function action(key, severity, evidence) {
  return {
    key,
    severity,
    area: 'sources',
    title: 'Action ' + key,
    summary: 'Summary ' + key,
    recommendedCommand: 'node src/presentation/cli/threadtrace.js operations-runbook',
    evidence: evidence || {}
  };
}

function existingEvent(item, overrides) {
  const { createRunbookActionEvent } = require('../src/domain/events/notificationEvent');
  return Object.assign(createRunbookActionEvent({
    action: item,
    createdAt: '2026-06-19T09:00:00.000Z'
  }), overrides);
}

function repository(events, saved) {
  return {
    async saveEvent(event) {
      saved.push(event);
    },
    async findEvent(id) {
      return events.find(function (event) {
        return event.id === id;
      });
    },
    async listEvents() {
      return events;
    }
  };
}
