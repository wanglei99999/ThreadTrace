'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { archiveNotificationEvents } = require('../src/application/use-cases/archiveNotificationEvents');

test('notification event archive dry-run plans handled events only', async function () {
  const archived = [];
  const queries = [];
  const events = [
    event('event-1', {
      deliveryStatus: 'delivered',
      acknowledgedAt: '2026-05-01T10:00:00.000Z'
    }),
    event('event-2', {
      deliveryStatus: 'failed',
      acknowledgedAt: '2026-05-01T10:00:00.000Z'
    }),
    event('event-3', {
      deliveryStatus: 'resolved'
    }),
    event('event-4', {
      deliveryStatus: 'delivered',
      acknowledgedAt: '2026-06-20T10:00:00.000Z'
    })
  ];

  const result = await archiveNotificationEvents({
    notificationEventRepository: repository(events, archived, queries),
    sourceKey: 'forum-a',
    olderThanDays: 30,
    now: '2026-06-23T10:00:00.000Z',
    archiveLimit: 10
  });

  assert.equal(result.status, 'actionable');
  assert.equal(result.dryRun, true);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.archivedCount, 0);
  assert.equal(result.candidates[0].id, 'event-1');
  assert.equal(archived.length, 0);
  assert.deepEqual(queries[0], {
    type: undefined,
    sourceId: undefined,
    sourceKey: 'forum-a',
    includeArchived: false,
    limit: 500
  });
});

test('notification event archive executes through repository archive capability', async function () {
  const archived = [];
  const events = [
    event('event-1', {
      deliveryStatus: 'resolved',
      acknowledgedAt: '2026-05-01T10:00:00.000Z'
    })
  ];

  const result = await archiveNotificationEvents({
    notificationEventRepository: repository(events, archived, []),
    execute: true,
    archivedBy: 'operator',
    reason: 'done',
    batchId: 'batch-1',
    cutoffAt: '2026-06-01T00:00:00.000Z',
    now: '2026-06-23T10:00:00.000Z'
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.dryRun, false);
  assert.equal(result.archivedCount, 1);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].id, 'event-1');
  assert.equal(archived[0].metadata.archivedBy, 'operator');
  assert.equal(archived[0].metadata.reason, 'done');
  assert.equal(archived[0].metadata.batchId, 'batch-1');
  assert.equal(result.results[0].event.archivedAt, '2026-06-23T10:00:00.000Z');
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
    createdAt: '2026-05-01T09:00:00.000Z',
    deliveryStatus: 'pending',
    deliveryAttempts: 0
  }, overrides || {});
}

function repository(events, archived, queries) {
  return {
    async saveEvent() {},
    async findEvent() {},
    async archiveEvent(id, metadata) {
      const item = events.find(function (candidate) {
        return candidate.id === id;
      });
      if (!item) return undefined;
      archived.push({ id, metadata });
      return Object.assign({}, item, {
        archivedAt: metadata.archivedAt,
        archivedBy: metadata.archivedBy,
        archiveReason: metadata.reason,
        archiveBatchId: metadata.batchId
      });
    },
    async listEvents(query) {
      queries.push(query);
      return events.filter(function (item) {
        if (query.sourceKey && item.sourceKey !== query.sourceKey) return false;
        if (query.type && item.type !== query.type) return false;
        return true;
      }).slice(0, query.limit || events.length);
    }
  };
}
