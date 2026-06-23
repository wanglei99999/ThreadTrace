'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { acknowledgeNotificationEvents } = require('../src/application/use-cases/acknowledgeNotificationEvents');

test('bulk notification acknowledgement defaults to open events in the filter window', async function () {
  const saved = [];
  const queries = [];
  const events = [
    event('event-1', { type: 'runbook-action', deliveryStatus: 'delivered' }),
    event('event-2', { type: 'runbook-action', deliveryStatus: 'failed' }),
    event('event-3', { type: 'source-changed', deliveryStatus: 'delivered' }),
    event('event-4', {
      type: 'runbook-action',
      deliveryStatus: 'delivered',
      acknowledgedAt: '2026-06-18T09:00:00.000Z'
    })
  ];

  const result = await acknowledgeNotificationEvents({
    notificationEventRepository: repository(events, saved, queries),
    type: 'runbook-action',
    deliveryStatus: 'delivered',
    acknowledgedBy: 'operator',
    note: 'handled',
    now: '2026-06-18T10:00:00.000Z',
    limit: 20
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.acknowledgedCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 'event-1');
  assert.equal(saved[0].acknowledgedBy, 'operator');
  assert.equal(saved[0].acknowledgedAt, '2026-06-18T10:00:00.000Z');
  assert.equal(saved[0].acknowledgementNote, 'handled');
  assert.deepEqual(queries[0], {
    type: 'runbook-action',
    sourceId: undefined,
    acknowledged: false,
    deliveryStatus: 'delivered',
    limit: 20
  });
  assert.deepEqual(result.filters, {
    type: 'runbook-action',
    acknowledged: false,
    deliveryStatus: 'delivered',
    limit: 20
  });
});

test('bulk notification acknowledgement handles explicit ids idempotently', async function () {
  const saved = [];
  const events = [
    event('event-1'),
    event('event-2', {
      acknowledgedAt: '2026-06-18T09:00:00.000Z',
      acknowledgedBy: 'other'
    })
  ];

  const result = await acknowledgeNotificationEvents({
    notificationEventRepository: repository(events, saved, []),
    eventIds: ['event-1', 'event-1', 'missing-event', 'event-2'],
    acknowledgedBy: 'batch',
    now: '2026-06-18T10:00:00.000Z'
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.requestedCount, 3);
  assert.equal(result.eventCount, 3);
  assert.equal(result.acknowledgedCount, 1);
  assert.equal(result.skippedCount, 2);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 'event-1');
  assert.equal(result.results[1].reason, 'not-found');
  assert.equal(result.results[2].reason, 'already-acknowledged');
});

function event(id, overrides) {
  return Object.assign({
    id,
    type: 'source-changed',
    severity: 'info',
    title: 'Event ' + id,
    summary: 'Summary ' + id,
    sourceId: 'source-1',
    sourceKey: 'forum-a',
    createdAt: '2026-06-18T09:00:00.000Z',
    deliveryStatus: 'pending',
    deliveryAttempts: 0,
    nextDeliveryAt: '2026-06-18T10:00:00.000Z'
  }, overrides || {});
}

function repository(events, saved, queries) {
  return {
    async saveEvent(item) {
      saved.push(item);
    },
    async findEvent(id) {
      return events.find(function (item) {
        return item.id === id;
      });
    },
    async listEvents(query) {
      queries.push(query);
      return events.filter(function (item) {
        if (query.type && item.type !== query.type) return false;
        if (query.sourceId && item.sourceId !== query.sourceId) return false;
        if (typeof query.acknowledged === 'boolean' && Boolean(item.acknowledgedAt) !== query.acknowledged) return false;
        if (query.deliveryStatus && (item.deliveryStatus || 'pending') !== query.deliveryStatus) return false;
        return true;
      }).slice(0, query.limit || events.length);
    }
  };
}
