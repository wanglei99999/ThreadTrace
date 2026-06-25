'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceTypeOperationsDrilldown } = require('../src/application/use-cases/getSourceTypeOperationsDrilldown');

test('source type operations drilldown aggregates family health and recent records', async function () {
  const sourceQueries = [];
  const report = await getSourceTypeOperationsDrilldown({
    now: '2026-06-25T10:00:00.000Z',
    sourceType: 'saved-html-directory',
    limit: 20,
    workerStaleAfterMs: 300000,
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources(query) {
        sourceQueries.push(query);
        return [
          source('source-1', { displayName: 'NGA archive', runState: { status: 'failed', failureCount: 1 } }),
          source('source-2', { displayName: 'NGA running', runState: { status: 'running', lastStartedAt: '2026-06-25T09:00:00.000Z' } })
        ];
      }
    },
    taskRepository: {
      async saveTask() {},
      async findTask() {},
      async listTasks() {
        return [
          {
            id: 'task-1',
            type: 'source-ingest',
            status: 'failed',
            input: { sourceId: 'source-1', sourceKey: 'nga' },
            error: { message: 'parse failed' },
            createdAt: '2026-06-25T09:50:00.000Z',
            updatedAt: '2026-06-25T09:51:00.000Z'
          },
          {
            id: 'task-other',
            type: 'source-ingest',
            status: 'failed',
            input: { sourceId: 'source-other', sourceKey: 'external' },
            createdAt: '2026-06-25T09:40:00.000Z',
            updatedAt: '2026-06-25T09:41:00.000Z'
          }
        ];
      }
    },
    notificationEventRepository: {
      async saveEvent() {},
      async findEvent() {},
      async listEvents() {
        return [
          {
            id: 'source-type-event',
            type: 'source-type-operations',
            payload: { sourceType: 'saved-html-directory' },
            deliveryStatus: 'pending',
            nextDeliveryAt: '2026-06-25T09:59:00.000Z',
            createdAt: '2026-06-25T09:58:00.000Z'
          },
          {
            id: 'source-event',
            type: 'source-attention',
            sourceId: 'source-1',
            sourceKey: 'nga',
            deliveryStatus: 'failed',
            createdAt: '2026-06-25T09:57:00.000Z'
          },
          {
            id: 'other-type-event',
            type: 'source-type-operations',
            payload: { sourceType: 'thread-url' },
            deliveryStatus: 'failed',
            createdAt: '2026-06-25T09:56:00.000Z'
          }
        ];
      }
    },
    workerRunRepository: {
      async saveWorkerRun() {},
      async findWorkerRun() {},
      async listWorkerRuns() {
        return [
          {
            id: 'run-1',
            workerType: 'due-source',
            status: 'running',
            scope: { sourceId: 'source-1', sourceKey: 'nga' },
            startedAt: '2026-06-25T09:00:00.000Z',
            heartbeatAt: '2026-06-25T09:00:00.000Z'
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
            leaseKey: 'worker:due-source:source-id:source-1',
            workerType: 'due-source',
            ownerId: 'worker-a',
            updatedAt: '2026-06-25T09:00:00.000Z',
            expiresAt: '2026-06-25T09:05:00.000Z'
          }
        ];
      }
    },
    sourceTypeOperationsReport: {
      status: 'warn',
      sourceTypes: [
        {
          sourceType: 'saved-html-directory',
          status: 'warn',
          readiness: { status: 'ok', sourceCount: 2 },
          schedule: { due: 1 },
          lifecycle: { failureRetryWaiting: 1 },
          attention: { total: 1, warning: 1, highestPriorityScore: 90 },
          recommendedCommands: ['node src/presentation/cli/threadtrace.js reset-source-failure --source-id source-1 --retry-now true --execute true'],
          topAttention: [{ source: { id: 'source-1' }, priorityScore: 90 }]
        }
      ]
    }
  });

  assert.equal(sourceQueries[0].sourceType, 'saved-html-directory');
  assert.equal(report.status, 'fail');
  assert.equal(report.sourceFound, true);
  assert.deepEqual(report.scope.sourceIds, ['source-1', 'source-2']);
  assert.equal(report.health.sources.total, 2);
  assert.equal(report.health.sources.failed, 1);
  assert.equal(report.health.tasks.failed, 1);
  assert.equal(report.health.events.total, 2);
  assert.equal(report.health.events.failed, 1);
  assert.equal(report.health.events.dueForDelivery, 2);
  assert.equal(report.health.events.byType['source-type-operations'], 1);
  assert.equal(report.health.workers.runs.stale, 1);
  assert.equal(report.health.workers.leases.expired, 1);
  assert.equal(report.health.operations.found, true);
  assert.ok(report.nextActions.some(function (action) {
    return action.key === 'workers.sourceType' && action.severity === 'critical';
  }));
  assert.equal(report.recent.sources.length, 2);
  assert.equal(report.recent.tasks.length, 1);
  assert.equal(report.recent.events.length, 2);
});

test('source type operations drilldown requires sourceType', async function () {
  await assert.rejects(function () {
    return getSourceTypeOperationsDrilldown({
      sourceRepository: repository(),
      taskRepository: repository(),
      notificationEventRepository: repository()
    });
  }, function (error) {
    assert.equal(error.code, 'source_type_required');
    assert.equal(error.statusCode, 400);
    return true;
  });
});

function source(id, overrides) {
  return Object.assign({
    id,
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: id,
    enabled: true,
    schedule: { intervalMinutes: 60 },
    runState: { status: 'completed', lastFinishedAt: '2026-06-25T08:00:00.000Z' }
  }, overrides);
}

function repository() {
  return {
    async saveSource() {},
    async findSource() {},
    async listSources() { return []; },
    async saveTask() {},
    async findTask() {},
    async listTasks() { return []; },
    async saveEvent() {},
    async findEvent() {},
    async listEvents() { return []; }
  };
}
