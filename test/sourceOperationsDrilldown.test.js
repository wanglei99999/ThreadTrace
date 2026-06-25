'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceOperationsDrilldown } = require('../src/application/use-cases/getSourceOperationsDrilldown');

test('source operations drilldown aggregates source-scoped health and recent records', async function () {
  const report = await getSourceOperationsDrilldown({
    now: '2026-06-18T10:00:00.000Z',
    sourceId: 'source-1',
    sourceKey: 'nga',
    limit: 20,
    sourceRepository: {
      async saveSource() {},
      async findSource(id) {
        assert.equal(id, 'source-1');
        return {
          id: 'source-1',
          sourceKey: 'nga',
          sourceType: 'saved-html-directory',
          displayName: 'NGA sample',
          enabled: true,
          schedule: { intervalMinutes: 60 },
          cursor: {
            sourceKey: 'nga',
            sourceThreadId: 'thread-1',
            title: 'NGA sample',
            postCount: 20,
            lastFloor: 19,
            lastPostId: 'post-20',
            fingerprint: 'cursor-fingerprint',
            capturedAt: '2026-06-18T08:00:00.000Z'
          },
          runState: {
            status: 'completed',
            lastFinishedAt: '2026-06-18T08:00:00.000Z',
            lastTaskId: 'task-ingest-1',
            lastCursorDiff: {
              changed: true,
              newPostCount: 4,
              previousPostCount: 16,
              nextPostCount: 20,
              previousLastFloor: 15,
              nextLastFloor: 19,
              previousLastPostId: 'post-16',
              nextLastPostId: 'post-20'
            }
          }
        };
      },
      async listSources() {
        return [];
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
            createdAt: '2026-06-18T09:50:00.000Z',
            updatedAt: '2026-06-18T09:51:00.000Z'
          },
          {
            id: 'task-2',
            type: 'source-ingest',
            status: 'completed',
            input: { sourceId: 'source-2', sourceKey: 'external' },
            createdAt: '2026-06-18T09:40:00.000Z',
            updatedAt: '2026-06-18T09:41:00.000Z'
          }
        ];
      }
    },
    notificationEventRepository: {
      async saveEvent() {},
      async findEvent() {},
      async listEvents(query) {
        return [
          {
            id: 'event-1',
            sourceId: query.sourceId,
            sourceKey: query.sourceKey || 'nga',
            deliveryStatus: query.deliveryStatus || 'failed',
            nextDeliveryAt: '2026-06-18T09:59:00.000Z',
            createdAt: '2026-06-18T09:55:00.000Z'
          },
          {
            id: 'event-other',
            sourceId: 'source-2',
            sourceKey: 'external',
            deliveryStatus: 'failed',
            createdAt: '2026-06-18T09:54:00.000Z'
          }
        ];
      }
    },
    workerRunRepository: {
      async saveWorkerRun() {},
      async findWorkerRun() {},
      async listWorkerRuns(query) {
        return [
          {
            id: 'run-source-1',
            workerType: 'due-source',
            workerId: 'worker-a',
            status: 'running',
            scope: { sourceId: 'source-1', sourceKey: 'nga' },
            startedAt: '2026-06-18T09:00:00.000Z',
            updatedAt: '2026-06-18T09:00:00.000Z',
            heartbeatAt: '2026-06-18T09:00:00.000Z'
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
            updatedAt: '2026-06-18T09:00:00.000Z',
            expiresAt: '2026-06-18T09:05:00.000Z'
          },
          {
            leaseKey: 'worker:due-source:source-id:source-2',
            workerType: 'due-source',
            ownerId: 'worker-b',
            updatedAt: '2026-06-18T09:00:00.000Z',
            expiresAt: '2026-06-18T10:05:00.000Z'
          }
        ];
      }
    },
    authorReviewQueue: {
      summary: {
        openCount: 1,
        byStatus: { open: 1 },
        byPriority: { high: 1 },
        byType: { 'evidence-gap': 1 }
      },
      items: [
        { id: 'queue-1', status: 'open', priority: 'high', type: 'evidence-gap', sourceKey: 'nga' }
      ]
    },
    reviewActionAuditOverview: {
      count: 2,
      taskCount: 1,
      plannedClosureCount: 1,
      plannedMergeCandidateCount: 1
    },
    reviewActionExecutions: {
      count: 1,
      staleRunningCount: 0,
      executions: [
        { id: 'execution-1', status: 'completed', sourceId: 'source-1', sourceKey: 'nga', taskId: 'review-task-1', updatedAt: '2026-06-18T09:53:00.000Z' }
      ]
    },
    notificationEventActionExecutions: {
      count: 2,
      staleRunningCount: 1,
      executions: [
        {
          key: 'notification-event-action:v1:event.acknowledge:event-1',
          actionKey: 'event.acknowledge',
          status: 'failed',
          eventId: 'event-1',
          sourceId: 'source-1',
          sourceKey: 'nga',
          updatedAt: '2026-06-18T09:58:00.000Z'
        },
        {
          key: 'notification-event-action:v1:event.acknowledge:event-2',
          actionKey: 'event.acknowledge',
          status: 'running',
          eventId: 'event-2',
          sourceId: 'source-1',
          sourceKey: 'nga',
          updatedAt: '2026-06-18T09:57:00.000Z',
          staleRunning: true
        }
      ]
    },
    sourceAttentionReport: {
      status: 'warn',
      summary: {
        total: 2,
        critical: 0,
        warning: 1,
        actionable: 1,
        highestPriorityScore: 92
      },
      sources: [
        {
          key: 'sourceId:source-1',
          attentionRank: 1,
          priorityScore: 92,
          severity: 'warning',
          signalCount: 2,
          runnable: true,
          source: {
            id: 'source-1',
            sourceKey: 'nga'
          },
          recommendedNextAction: 'run-source-insight-pipeline',
          recommendedCommand: 'node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id source-1',
          signals: [
            { severity: 'info', label: 'due' },
            { severity: 'warning', label: 'runbook' }
          ],
          commands: [
            'node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id source-1'
          ]
        }
      ]
    }
  });

  assert.equal(report.status, 'fail');
  assert.deepEqual(report.scope, {
    sourceId: 'source-1',
    sourceKey: 'nga'
  });
  assert.equal(report.sourceFound, true);
  assert.equal(report.collectionPlan.status, 'due');
  assert.equal(report.collectionPlan.cursor.present, true);
  assert.equal(report.collectionPlan.incremental.newPostCount, 4);
  assert.equal(report.collectionPlan.replay.taskId, 'task-ingest-1');
  assert.ok(report.collectionPlan.recommendedCommands.some(function (command) {
    return /source-drilldown --source-id source-1/.test(command);
  }));
  assert.equal(report.health.tasks.failed, 1);
  assert.equal(report.health.events.failed, 1);
  assert.equal(report.health.events.dueForDelivery, 1);
  assert.equal(report.health.workers.runs.stale, 1);
  assert.equal(report.health.workers.leases.expired, 1);
  assert.equal(report.health.authorReviewQueue.highPriorityOpenCount, 1);
  assert.equal(report.health.reviewActions.auditCount, 2);
  assert.equal(report.health.notificationEventActions.count, 2);
  assert.equal(report.health.notificationEventActions.failed, 1);
  assert.equal(report.health.notificationEventActions.staleRunning, 1);
  assert.equal(report.attention.found, true);
  assert.equal(report.attention.attentionRank, 1);
  assert.equal(report.attention.priorityScore, 92);
  assert.equal(report.attention.recommendedNextAction, 'run-source-insight-pipeline');
  assert.equal(report.attention.reportSummary.highestPriorityScore, 92);
  assert.ok(report.nextActions.some(function (action) {
    return action.key === 'sourceAttention.priority' && action.severity === 'warning' && /priority 92/.test(action.summary);
  }));
  assert.ok(report.nextActions.some(function (action) {
    return action.key === 'workers.stale' && action.severity === 'critical';
  }));
  assert.ok(report.nextActions.some(function (action) {
    return action.key === 'notificationEventActions.executionLedger' &&
      action.severity === 'critical' &&
      /event-action-executions/.test(action.recommendedCommand);
  }));
  assert.equal(report.recent.tasks.length, 1);
  assert.equal(report.recent.workerRuns.length, 1);
  assert.equal(report.recent.workerLeases.length, 1);
  assert.equal(report.recent.notificationEventActionExecutions[0].eventId, 'event-1');
  assert.deepEqual(report.timeline.slice(0, 4).map(function (item) { return item.kind; }), [
    'notification-event-action-execution',
    'notification-event-action-execution',
    'notification-event',
    'review-action-execution'
  ]);
  assert.equal(report.timeline[0].severity, 'critical');
  assert.equal(report.timeline[0].reference, 'event-1');
  assert.ok(report.timeline.some(function (item) {
    return item.kind === 'worker-run' && item.status === 'stale' && item.severity === 'critical';
  }));
  assert.ok(report.timeline.some(function (item) {
    return item.kind === 'worker-lease' && item.status === 'expired';
  }));
});

test('source operations drilldown warns for unresolved source scope', async function () {
  const report = await getSourceOperationsDrilldown({
    now: '2026-06-18T10:00:00.000Z',
    sourceKey: 'missing',
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources() {
        return [];
      }
    },
    taskRepository: {
      async saveTask() {},
      async findTask() {},
      async listTasks() {
        return [];
      }
    },
    notificationEventRepository: {
      async saveEvent() {},
      async findEvent() {},
      async listEvents() {
        return [];
      }
    }
  });

  assert.equal(report.status, 'warn');
  assert.equal(report.sourceFound, false);
  assert.equal(report.scope.sourceKey, 'missing');
  assert.equal(report.nextActions[0].key, 'source.resolve');
  assert.equal(report.attention, undefined);
});
