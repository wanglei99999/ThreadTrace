'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { dispatchPendingNotificationEvents } = require('../src/application/use-cases/dispatchPendingNotificationEvents');

test('dispatch skips events scheduled for a future retry', async function () {
  const saved = [];
  const delivered = [];
  const repository = createRepository([
    {
      id: 'due-event',
      deliveryStatus: 'pending',
      deliveryAttempts: 0,
      nextDeliveryAt: '2026-06-18T09:59:00.000Z'
    },
    {
      id: 'future-event',
      deliveryStatus: 'failed',
      deliveryAttempts: 1,
      nextDeliveryAt: '2026-06-18T10:10:00.000Z'
    }
  ], saved);

  const result = await dispatchPendingNotificationEvents({
    notificationEventRepository: repository,
    notificationChannel: {
      channelKey: 'memory',
      async deliver(event) {
        delivered.push(event.id);
        return {
          channelKey: 'memory'
        };
      }
    },
    now: '2026-06-18T10:00:00.000Z',
    includeFailed: true
  });

  assert.deepEqual(delivered, ['due-event']);
  assert.equal(result.dispatchedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(saved[0].deliveryStatus, 'delivered');
  assert.equal(saved[0].nextDeliveryAt, undefined);
});

test('failed dispatch records exponential retry time', async function () {
  const saved = [];
  const repository = createRepository([
    {
      id: 'retry-event',
      deliveryStatus: 'pending',
      deliveryAttempts: 0,
      nextDeliveryAt: '2026-06-18T10:00:00.000Z'
    }
  ], saved);

  const result = await dispatchPendingNotificationEvents({
    notificationEventRepository: repository,
    notificationChannel: {
      channelKey: 'memory',
      async deliver() {
        throw new Error('temporary outage');
      }
    },
    now: '2026-06-18T10:00:00.000Z',
    retryBackoffMs: 1000,
    maxAttempts: 3
  });

  assert.equal(result.failedCount, 1);
  assert.equal(saved[0].deliveryStatus, 'failed');
  assert.equal(saved[0].deliveryAttempts, 1);
  assert.equal(saved[0].nextDeliveryAt, '2026-06-18T10:00:01.000Z');
  assert.equal(saved[0].lastDeliveryError.message, 'temporary outage');
});

test('dispatch skips acknowledged events even when they are delivery due', async function () {
  const saved = [];
  const delivered = [];
  const repository = createRepository([
    {
      id: 'acknowledged-pending',
      deliveryStatus: 'pending',
      deliveryAttempts: 0,
      nextDeliveryAt: '2026-06-18T09:59:00.000Z',
      acknowledgedAt: '2026-06-18T09:58:00.000Z'
    },
    {
      id: 'acknowledged-failed',
      deliveryStatus: 'failed',
      deliveryAttempts: 1,
      nextDeliveryAt: '2026-06-18T09:59:00.000Z',
      acknowledgedAt: '2026-06-18T09:58:00.000Z'
    },
    {
      id: 'open-pending',
      deliveryStatus: 'pending',
      deliveryAttempts: 0,
      nextDeliveryAt: '2026-06-18T09:59:00.000Z'
    }
  ], saved);

  const result = await dispatchPendingNotificationEvents({
    notificationEventRepository: repository,
    notificationChannel: {
      channelKey: 'memory',
      async deliver(event) {
        delivered.push(event.id);
        return {
          channelKey: 'memory'
        };
      }
    },
    now: '2026-06-18T10:00:00.000Z',
    includeFailed: true
  });

  assert.deepEqual(delivered, ['open-pending']);
  assert.equal(result.dispatchedCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 'open-pending');
});

function createRepository(events, saved) {
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
      return events.filter(function (event) {
        if (query.deliveryStatus && event.deliveryStatus !== query.deliveryStatus) return false;
        if (typeof query.acknowledged === 'boolean' && Boolean(event.acknowledgedAt) !== query.acknowledged) return false;
        return true;
      });
    }
  };
}
