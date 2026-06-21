'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getOperationalOverview } = require('../src/application/use-cases/getOperationalOverview');

test('operational overview summarizes sources, tasks, events, and raw pages', async function () {
  const notificationEvents = [
    { id: 'event-1', deliveryStatus: 'pending', nextDeliveryAt: '2026-06-18T09:59:00.000Z' },
    { id: 'event-2', deliveryStatus: 'failed', nextDeliveryAt: '2026-06-18T11:00:00.000Z' },
    { id: 'event-3', deliveryStatus: 'pending', nextDeliveryAt: '2026-06-18T09:59:00.000Z', acknowledgedAt: '2026-06-18T09:58:00.000Z' },
    { id: 'event-4', deliveryStatus: 'failed', nextDeliveryAt: '2026-06-18T09:59:00.000Z', acknowledgedAt: '2026-06-18T09:58:00.000Z' },
    { id: 'event-5', deliveryStatus: 'delivered', lastDeliveredAt: '2026-06-18T09:57:00.000Z' }
  ];
  const eventQueries = [];
  const overview = await getOperationalOverview({
    now: '2026-06-18T10:00:00.000Z',
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources() {
        return [
          {
            id: 'source-1',
            sourceKey: 'nga',
            sourceType: 'thread-url',
            displayName: 'due source',
            enabled: true,
            schedule: { intervalMinutes: 60 },
            runState: { status: 'completed', lastFinishedAt: '2026-06-18T08:00:00.000Z' }
          },
          {
            id: 'source-2',
            sourceKey: 'nga',
            sourceType: 'saved-html-directory',
            displayName: 'failed source',
            enabled: true,
            runState: { status: 'failed' }
          }
        ];
      }
    },
    taskRepository: {
      async saveTask() {},
      async findTask() {},
      async listTasks() {
        return [
          { id: 'task-1', status: 'completed', type: 'ingest-thread-url', createdAt: '2026-06-18T09:00:00.000Z' },
          { id: 'task-2', status: 'failed', type: 'ingest-thread-url', createdAt: '2026-06-18T09:30:00.000Z' }
        ];
      }
    },
    notificationEventRepository: {
      async saveEvent() {},
      async findEvent() {},
      async listEvents(query) {
        eventQueries.push(query);
        return notificationEvents.filter(function (event) {
          if (query.deliveryStatus && event.deliveryStatus !== query.deliveryStatus) return false;
          if (typeof query.acknowledged === 'boolean' && Boolean(event.acknowledgedAt) !== query.acknowledged) return false;
          return true;
        });
      }
    },
    rawThreadPageRepository: {
      async saveRawThreadPage() {},
      async findRawThreadPageByHash() {},
      async listRawThreadPages() {
        return [
          { contentSha1: 'raw-1', fetchedAt: '2026-06-18T09:50:00.000Z' }
        ];
      }
    },
    workerRunRepository: {
      async saveWorkerRun() {},
      async findWorkerRun() {},
      async listWorkerRuns() {
        return [
          {
            id: 'worker-run-1',
            workerType: 'operations',
            workerId: 'worker-a',
            status: 'running',
            startedAt: '2026-06-18T09:00:00.000Z',
            updatedAt: '2026-06-18T09:00:00.000Z',
            heartbeatAt: '2026-06-18T09:00:00.000Z'
          },
          {
            id: 'worker-run-2',
            workerType: 'notification-event',
            workerId: 'worker-b',
            status: 'completed',
            startedAt: '2026-06-18T09:55:00.000Z',
            updatedAt: '2026-06-18T09:56:00.000Z',
            heartbeatAt: '2026-06-18T09:56:00.000Z',
            finishedAt: '2026-06-18T09:56:00.000Z'
          }
        ];
      }
    },
    workerLeaseRepository: {
      async acquireWorkerLease() {},
      async renewWorkerLease() {},
      async releaseWorkerLease() {},
      async listWorkerLeases() {
        return [
          {
            leaseKey: 'worker:operations',
            workerType: 'operations',
            ownerId: 'worker-a',
            acquiredAt: '2026-06-18T09:00:00.000Z',
            updatedAt: '2026-06-18T09:00:00.000Z',
            expiresAt: '2026-06-18T09:05:00.000Z'
          },
          {
            leaseKey: 'worker:notification-event',
            workerType: 'notification-event',
            ownerId: 'worker-b',
            acquiredAt: '2026-06-18T09:59:00.000Z',
            updatedAt: '2026-06-18T09:59:00.000Z',
            expiresAt: '2026-06-18T10:04:00.000Z'
          }
        ];
      }
    },
    reviewActionAuditOverview: {
      status: 'ok',
      count: 2,
      taskCount: 1,
      plannedClosureCount: 1,
      plannedMergeCandidateCount: 1,
      latestGeneratedAt: '2026-06-18T09:58:00.000Z',
      byAction: {
        'tasks.closure': 1,
        'context.merge': 1
      },
      byAdapter: {
        'file-audit': 2
      }
    }
  });

  assert.equal(overview.sources.total, 2);
  assert.equal(overview.sources.due, 1);
  assert.equal(overview.sources.failed, 1);
  assert.equal(overview.tasks.failed, 1);
  assert.equal(overview.events.pending, 1);
  assert.equal(overview.events.failed, 1);
  assert.equal(overview.events.unacknowledged, 3);
  assert.equal(overview.events.dueForDelivery, 1);
  assert.ok(eventQueries.some(function (query) {
    return query.deliveryStatus === 'pending' && query.acknowledged === false;
  }));
  assert.ok(eventQueries.some(function (query) {
    return query.deliveryStatus === 'failed' && query.acknowledged === false;
  }));
  assert.equal(overview.workers.running, 1);
  assert.equal(overview.workers.stale, 1);
  assert.equal(overview.workers.completed, 1);
  assert.equal(overview.workers.latestHeartbeatAt, '2026-06-18T09:56:00.000Z');
  assert.equal(overview.workers.leases.active, 1);
  assert.equal(overview.workers.leases.expired, 1);
  assert.equal(overview.rawPages.total, 1);
  assert.equal(overview.rawPages.latestFetchedAt, '2026-06-18T09:50:00.000Z');
  assert.equal(overview.reviewActions.auditCount, 2);
  assert.equal(overview.reviewActions.taskCount, 1);
  assert.equal(overview.reviewActions.plannedClosureCount, 1);
  assert.equal(overview.reviewActions.plannedMergeCandidateCount, 1);
  assert.equal(overview.reviewActions.latestGeneratedAt, '2026-06-18T09:58:00.000Z');
});
