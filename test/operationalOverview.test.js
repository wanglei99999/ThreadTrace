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
            input: {
              sourceId: 'source-1',
              sourceKey: 'nga'
            },
            startedAt: '2026-06-18T09:00:00.000Z',
            updatedAt: '2026-06-18T09:00:00.000Z',
            heartbeatAt: '2026-06-18T09:00:00.000Z'
          },
          {
            id: 'worker-run-2',
            workerType: 'notification-event',
            workerId: 'worker-b',
            status: 'completed',
            scope: {
              sourceKey: 'external'
            },
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
          },
          {
            leaseKey: 'worker:due-source:source-id:source-1',
            workerType: 'due-source',
            ownerId: 'worker-c',
            acquiredAt: '2026-06-18T09:58:00.000Z',
            updatedAt: '2026-06-18T09:58:00.000Z',
            expiresAt: '2026-06-18T10:03:00.000Z'
          },
          {
            leaseKey: 'worker:notification-event:source-key:external',
            workerType: 'notification-event',
            ownerId: 'worker-d',
            acquiredAt: '2026-06-18T09:40:00.000Z',
            updatedAt: '2026-06-18T09:40:00.000Z',
            expiresAt: '2026-06-18T09:45:00.000Z'
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
      },
      bySourceKey: {
        nga: 1,
        external: 1
      },
      bySourceId: {
        'source-nga': 1,
        'source-external': 1
      }
    },
    reviewActionExecutions: {
      status: 'ok',
      count: 2,
      runningStaleAfterMs: 600000,
      staleRunningCount: 1,
      staleRunningExecutions: [
        {
          key: 'context-review-action:v1:context.merge:1',
          action: 'context.merge',
          status: 'running',
          sourceId: 'source-external',
          sourceKey: 'external',
          taskId: 'review-action-task-2',
          updatedAt: '2026-06-18T09:40:00.000Z',
          runningAgeMs: 1200000
        }
      ],
      executions: [
        {
          key: 'context-review-action:v1:tasks.closure:1',
          action: 'tasks.closure',
          status: 'completed',
          sourceId: 'source-nga',
          sourceKey: 'nga',
          taskId: 'review-action-task-1',
          updatedAt: '2026-06-18T09:59:00.000Z'
        },
        {
          key: 'context-review-action:v1:context.merge:1',
          action: 'context.merge',
          status: 'running',
          sourceId: 'source-external',
          sourceKey: 'external',
          taskId: 'review-action-task-2',
          updatedAt: '2026-06-18T09:40:00.000Z',
          runningAgeMs: 1200000,
          staleRunning: true
        }
      ]
    },
    authorReviewQueue: {
      itemCount: 3,
      summary: {
        byStatus: { open: 2, confirmed: 1 },
        byPriority: { high: 2, medium: 1 },
        byType: { 'evidence-gap': 1, 'high-confidence-opinion': 1 },
        openCount: 2
      },
      items: [
        {
          id: 'author-review-high',
          status: 'open',
          sourceKey: 'nga',
          sourceThreadId: 'thread-1',
          priority: 'high',
          type: 'evidence-gap',
          updatedAt: '2026-06-18T09:57:00.000Z'
        },
        {
          id: 'author-review-medium',
          status: 'open',
          sourceKey: 'external',
          sourceThreadId: 'thread-2',
          priority: 'medium',
          type: 'high-confidence-opinion',
          updatedAt: '2026-06-18T09:56:00.000Z'
        },
        {
          id: 'author-review-confirmed',
          status: 'confirmed',
          sourceKey: 'nga',
          sourceThreadId: 'thread-3',
          priority: 'high',
          type: 'evidence-gap',
          updatedAt: '2026-06-18T09:55:00.000Z'
        }
      ]
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
  assert.equal(overview.workers.sourceScoped, 2);
  assert.equal(overview.workers.unscoped, 0);
  assert.equal(overview.workers.byWorkerType.operations, 1);
  assert.equal(overview.workers.bySourceId['source-1'], 1);
  assert.equal(overview.workers.bySourceKey.nga, 1);
  assert.equal(overview.workers.bySourceKey.external, 1);
  assert.equal(overview.workers.runningBySourceId['source-1'], 1);
  assert.equal(overview.workers.staleBySourceKey.nga, 1);
  assert.equal(overview.workers.latestHeartbeatAt, '2026-06-18T09:56:00.000Z');
  assert.deepEqual(overview.workers.latestRun.scope, {
    sourceId: 'source-1',
    sourceKey: 'nga'
  });
  assert.deepEqual(overview.workers.staleRuns[0].scope, {
    sourceId: 'source-1',
    sourceKey: 'nga'
  });
  assert.equal(overview.workers.leases.active, 2);
  assert.equal(overview.workers.leases.expired, 2);
  assert.equal(overview.workers.leases.sourceScoped, 2);
  assert.equal(overview.workers.leases.unscoped, 2);
  assert.equal(overview.workers.leases.byWorkerType['notification-event'], 2);
  assert.equal(overview.workers.leases.bySourceId['source-1'], 1);
  assert.equal(overview.workers.leases.bySourceKey.external, 1);
  assert.equal(overview.workers.leases.activeBySourceId['source-1'], 1);
  assert.equal(overview.workers.leases.expiredBySourceKey.external, 1);
  assert.deepEqual(overview.workers.leases.sourceScopedLeases[0].scope, {
    sourceId: 'source-1'
  });
  assert.deepEqual(overview.recent.workerLeases[2].scope, {
    sourceId: 'source-1'
  });
  assert.equal(overview.rawPages.total, 1);
  assert.equal(overview.rawPages.latestFetchedAt, '2026-06-18T09:50:00.000Z');
  assert.equal(overview.authorReviewQueue.openCount, 2);
  assert.equal(overview.authorReviewQueue.highPriorityOpenCount, 1);
  assert.equal(overview.authorReviewQueue.byType['evidence-gap'], 1);
  assert.equal(overview.authorReviewQueue.openBySourceKey.nga, 1);
  assert.equal(overview.authorReviewQueue.openBySourceKey.external, 1);
  assert.equal(overview.authorReviewQueue.highPriorityOpenBySourceKey.nga, 1);
  assert.equal(overview.authorReviewQueue.sourceHotspots[0].sourceKey, 'nga');
  assert.equal(overview.authorReviewQueue.sourceHotspots[0].highPriorityOpenCount, 1);
  assert.deepEqual(overview.authorReviewQueue.sourceHotspots[0].sourceThreadIds, ['thread-1', 'thread-3']);
  assert.equal(overview.authorReviewQueue.latestUpdatedAt, '2026-06-18T09:57:00.000Z');
  assert.equal(overview.recent.authorReviewQueue[0].id, 'author-review-high');
  assert.equal(overview.reviewActions.auditCount, 2);
  assert.equal(overview.reviewActions.taskCount, 1);
  assert.equal(overview.reviewActions.plannedClosureCount, 1);
  assert.equal(overview.reviewActions.plannedMergeCandidateCount, 1);
  assert.equal(overview.reviewActions.latestGeneratedAt, '2026-06-18T09:58:00.000Z');
  assert.equal(overview.reviewActions.bySourceKey.nga, 1);
  assert.equal(overview.reviewActions.bySourceKey.external, 1);
  assert.equal(overview.reviewActions.executions.count, 2);
  assert.equal(overview.reviewActions.executions.completed, 1);
  assert.equal(overview.reviewActions.executions.running, 1);
  assert.equal(overview.reviewActions.executions.staleRunning, 1);
  assert.equal(overview.reviewActions.executions.failed, 0);
  assert.equal(overview.reviewActions.executions.latestUpdatedAt, '2026-06-18T09:59:00.000Z');
  assert.equal(overview.reviewActions.executions.runningStaleAfterMs, 600000);
  assert.equal(overview.reviewActions.executions.bySourceKey.nga, 1);
  assert.equal(overview.reviewActions.executions.bySourceKey.external, 1);
  assert.equal(overview.reviewActions.executions.staleRunningBySourceKey.external, 1);
  assert.equal(overview.reviewActions.executions.staleRunningExecutions[0].taskId, 'review-action-task-2');
});

test('operational overview scopes source type windows without mixing sibling source keys', async function () {
  const sourceQueries = [];
  const overview = await getOperationalOverview({
    now: '2026-06-25T10:00:00.000Z',
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources(query) {
        sourceQueries.push(query);
        return [
          {
            id: 'source-html',
            sourceKey: 'nga',
            sourceType: 'saved-html-directory',
            displayName: 'NGA archive',
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
          { id: 'task-html', status: 'failed', input: { sourceId: 'source-html', sourceKey: 'nga' } },
          { id: 'task-url', status: 'failed', input: { sourceId: 'source-url', sourceKey: 'nga' } },
          { id: 'task-key-only', status: 'failed', input: { sourceKey: 'nga' } }
        ];
      }
    },
    notificationEventRepository: {
      async saveEvent() {},
      async findEvent() {},
      async listEvents(query) {
        return [
          {
            id: 'event-html',
            type: 'source-attention',
            deliveryStatus: query.deliveryStatus || 'pending',
            sourceId: 'source-html',
            sourceKey: 'nga'
          },
          {
            id: 'event-url',
            type: 'source-attention',
            deliveryStatus: query.deliveryStatus || 'pending',
            sourceId: 'source-url',
            sourceKey: 'nga'
          },
          {
            id: 'event-type',
            type: 'source-type-operations',
            deliveryStatus: query.deliveryStatus || 'pending',
            payload: { sourceType: 'saved-html-directory' }
          }
        ].filter(function (event) {
          if (query.deliveryStatus && event.deliveryStatus !== query.deliveryStatus) return false;
          return true;
        });
      }
    },
    rawThreadPageRepository: {
      async saveRawThreadPage() {},
      async findRawThreadPageByHash() {},
      async listRawThreadPages() {
        return [];
      }
    },
    workerRunRepository: {
      async saveWorkerRun() {},
      async findWorkerRun() {},
      async listWorkerRuns() {
        return [
          { id: 'run-html', status: 'running', input: { sourceId: 'source-html', sourceKey: 'nga' } },
          { id: 'run-url', status: 'running', input: { sourceId: 'source-url', sourceKey: 'nga' } },
          { id: 'run-key-only', status: 'running', input: { sourceKey: 'nga' } }
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
            leaseKey: 'worker:due-source:source-id:source-html',
            expiresAt: '2026-06-25T10:05:00.000Z'
          },
          {
            leaseKey: 'worker:due-source:source-id:source-url',
            expiresAt: '2026-06-25T10:05:00.000Z'
          },
          {
            leaseKey: 'worker:due-source:source-key:nga',
            expiresAt: '2026-06-25T10:05:00.000Z'
          }
        ];
      }
    }
  });

  assert.equal(sourceQueries[0].sourceType, 'saved-html-directory');
  assert.equal(sourceQueries[0].sourceKey, 'nga');
  assert.equal(overview.scope.sourceKey, 'nga');
  assert.equal(overview.scope.sourceType, 'saved-html-directory');
  assert.deepEqual(overview.scope.sourceIds, ['source-html']);
  assert.deepEqual(overview.scope.sourceKeys, ['nga']);
  assert.equal(overview.sources.total, 1);
  assert.equal(overview.sources.failed, 1);
  assert.equal(overview.tasks.total, 1);
  assert.equal(overview.tasks.failed, 1);
  assert.equal(overview.events.pending, 2);
  assert.equal(overview.events.failed, 2);
  assert.equal(overview.events.unacknowledged, 2);
  assert.equal(overview.workers.running, 1);
  assert.equal(overview.workers.leases.total, 1);
  assert.equal(overview.workers.leases.activeBySourceId['source-html'], 1);
});
