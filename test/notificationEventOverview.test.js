'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getNotificationEventOverview } = require('../src/application/use-cases/getNotificationEventOverview');

test('notification event overview summarizes outbox pressure and distribution', async function () {
  const queries = [];
  const events = [
    event('event-1', {
      type: 'source-changed',
      severity: 'info',
      deliveryStatus: 'pending',
      nextDeliveryAt: '2026-06-18T09:59:00.000Z',
      sourceKey: 'forum-a'
    }),
    event('event-2', {
      type: 'runbook-action',
      severity: 'warning',
      deliveryStatus: 'failed',
      deliveryAttempts: 3,
      nextDeliveryAt: '2026-06-18T09:58:00.000Z',
      sourceKey: 'forum-a',
      lastDeliveryError: { message: 'webhook down' }
    }),
    event('event-3', {
      type: 'context-review-result',
      severity: 'warning',
      deliveryStatus: 'delivered',
      acknowledgedAt: '2026-06-18T09:57:00.000Z',
      sourceKey: 'unknown'
    }),
    event('event-4', {
      type: 'author-review-queue',
      severity: 'info',
      deliveryStatus: 'resolved',
      acknowledgedAt: '2026-06-18T09:56:00.000Z',
      sourceKey: 'forum-b'
    })
  ];

  const overview = await getNotificationEventOverview({
    notificationEventRepository: repository(events, queries),
    now: '2026-06-18T10:00:00.000Z',
    maxAttempts: 3,
    limit: 50
  });

  assert.equal(overview.status, 'fail');
  assert.equal(overview.eventCount, 4);
  assert.equal(overview.pendingCount, 1);
  assert.equal(overview.failedCount, 1);
  assert.equal(overview.unacknowledgedCount, 2);
  assert.equal(overview.acknowledgedCount, 2);
  assert.equal(overview.dueForDeliveryCount, 2);
  assert.equal(overview.retryExhaustedCount, 1);
  assert.equal(overview.nextDeliveryAt, '2026-06-18T09:58:00.000Z');
  assert.equal(overview.oldestUnacknowledgedAt, '2026-06-18T09:00:00.000Z');
  assert.equal(overview.latestCreatedAt, '2026-06-18T09:03:00.000Z');
  assert.equal(overview.byType['runbook-action'], 1);
  assert.equal(overview.bySeverity.warning, 2);
  assert.equal(overview.byDeliveryStatus.resolved, 1);
  assert.equal(overview.byAcknowledgement.unacknowledged, 2);
  assert.equal(overview.bySourceKey['forum-a'], 2);
  assert.equal(overview.attention.failedEvents[0].id, 'event-2');
  assert.equal(overview.attention.retryExhaustedEvents[0].lastDeliveryError.message, 'webhook down');
  assert.match(overview.recommendedNextAction, /channel diagnostics/);
  assert.deepEqual(queries[0], {
    type: undefined,
    sourceId: undefined,
    sourceKey: undefined,
    acknowledged: undefined,
    deliveryStatus: undefined,
    limit: 50
  });
});

test('notification event overview applies repository filters', async function () {
  const queries = [];
  const overview = await getNotificationEventOverview({
    notificationEventRepository: repository([
      event('event-1', { type: 'source-changed', deliveryStatus: 'pending' }),
      event('event-2', { type: 'runbook-action', deliveryStatus: 'pending', sourceKey: 'forum-b' })
    ], queries),
    type: 'runbook-action',
    sourceKey: 'forum-b',
    acknowledged: false,
    deliveryStatus: 'pending',
    now: '2026-06-18T10:00:00.000Z'
  });

  assert.equal(overview.eventCount, 1);
  assert.equal(overview.byType['runbook-action'], 1);
  assert.deepEqual(overview.filters, {
    type: 'runbook-action',
    sourceKey: 'forum-b',
    acknowledged: false,
    deliveryStatus: 'pending'
  });
  assert.equal(queries[0].type, 'runbook-action');
  assert.equal(queries[0].sourceKey, 'forum-b');
  assert.equal(queries[0].acknowledged, false);
  assert.equal(queries[0].deliveryStatus, 'pending');
});

function event(id, overrides) {
  const index = Number(id.split('-')[1] || 1);
  return Object.assign({
    id,
    type: 'source-changed',
    severity: 'info',
    title: 'Event ' + id,
    summary: 'Summary ' + id,
    sourceId: 'source-1',
    sourceKey: 'forum-a',
    createdAt: '2026-06-18T09:0' + (index - 1) + ':00.000Z',
    deliveryStatus: 'pending',
    deliveryAttempts: 0,
    nextDeliveryAt: '2026-06-18T10:00:00.000Z'
  }, overrides || {});
}

function repository(events, queries) {
  return {
    async saveEvent() {},
    async findEvent() {},
    async listEvents(query) {
      queries.push(query);
      return events.filter(function (item) {
        if (query.type && item.type !== query.type) return false;
        if (query.sourceId && item.sourceId !== query.sourceId) return false;
        if (query.sourceKey && item.sourceKey !== query.sourceKey) return false;
        if (typeof query.acknowledged === 'boolean' && Boolean(item.acknowledgedAt) !== query.acknowledged) return false;
        if (query.deliveryStatus && (item.deliveryStatus || 'pending') !== query.deliveryStatus) return false;
        return true;
      }).slice(0, query.limit || events.length);
    }
  };
}
