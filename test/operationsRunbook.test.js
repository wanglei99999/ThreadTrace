'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getOperationsRunbook } = require('../src/application/use-cases/getOperationsRunbook');

test('operations runbook turns diagnostics and pipeline failures into actions', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: [
        {
          key: 'sources.ingestConfiguration',
          area: 'sources',
          status: 'fail',
          summary: 'Tracked sources have usable locations, handlers, and adapters.',
          evidence: { sourceCount: 2 }
        },
        {
          key: 'llm.configuration',
          area: 'llm',
          status: 'warn',
          summary: 'LLM provider configuration is ready for the selected provider.'
        },
        {
          key: 'resources.storage',
          area: 'resources',
          status: 'ok',
          summary: 'Primary storage resources are reachable.'
        }
      ]
    },
    pipelineRuns: {
      runs: [
        {
          taskId: 'task-1',
          status: 'failed',
          sourceId: 'source-1',
          source: {
            displayName: 'NGA archive'
          },
          semantic: {
            status: 'skipped'
          }
        }
      ]
    }
  });

  assert.equal(runbook.status, 'fail');
  assert.equal(runbook.actionCount, 3);
  assert.equal(runbook.actions[0].key, 'checklist.sources.ingestConfiguration');
  assert.equal(runbook.actions[0].severity, 'critical');
  assert.match(runbook.actions[0].recommendedCommand, /source-ingest-dry-run/);
  assert.match(runbook.actions[0].relatedCommands[0], /source-diagnostics/);
  assert.equal(runbook.actions[1].severity, 'warning');
  assert.equal(runbook.actions[2].key, 'pipeline.task-1');
  assert.match(runbook.actions[2].summary, /NGA archive/);
  assert.match(runbook.actions[2].relatedCommands[0], /source-ingest-dry-run/);
});

test('operations runbook points notification outbox warnings to overview and dispatch tools', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: [
        {
          key: 'notifications.outbox',
          area: 'notifications',
          status: 'warn',
          summary: 'Notification outbox has no unacknowledged failures or due delivery backlog.',
          evidence: {
            checks: [
              { key: 'events.dueForDelivery', status: 'warn' }
            ]
          }
        }
      ]
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'checklist.notifications.outbox');
  assert.match(runbook.actions[0].recommendedCommand, /operations-overview/);
  assert.match(runbook.actions[0].relatedCommands[0], /events-overview --acknowledged false/);
  assert.match(runbook.actions[0].relatedCommands[1], /list-events --acknowledged false --delivery-status failed/);
  assert.match(runbook.actions[0].relatedCommands[2], /dispatch-events/);
  assert.match(runbook.actions[0].relatedCommands[3], /ack-events --delivery-status delivered --dry-run true/);
});

test('operations runbook turns notification delivery backlog overview into actions', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-23T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-23T10:00:00.000Z',
      items: []
    },
    notificationEventOverview: {
      status: 'fail',
      dueForDeliveryCount: 2,
      failedCount: 1,
      retryExhaustedCount: 1,
      nextDeliveryAt: '2026-06-23T09:59:00.000Z',
      byOpenDeliveryStatus: {
        pending: 1,
        failed: 1
      },
      attention: {
        failedEvents: [{ id: 'event-1' }],
        retryExhaustedEvents: [{ id: 'event-1' }]
      }
    }
  });

  assert.equal(runbook.status, 'fail');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'notifications.outbox.deliveryBacklog');
  assert.equal(runbook.actions[0].severity, 'critical');
  assert.match(runbook.actions[0].recommendedCommand, /notification-diagnostics/);
  assert.match(runbook.actions[0].relatedCommands[2], /dispatch-events/);
  assert.equal(runbook.actions[0].evidence.retryExhaustedCount, 1);
});

test('operations runbook turns delivered notification overview into acknowledgement actions', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-23T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-23T10:00:00.000Z',
      items: []
    },
    notificationEventOverview: {
      status: 'ok',
      dueForDeliveryCount: 0,
      failedCount: 0,
      retryExhaustedCount: 0,
      oldestUnacknowledgedAt: '2026-06-23T09:00:00.000Z',
      byOpenDeliveryStatus: {
        delivered: 2,
        resolved: 1
      },
      attention: {
        reviewableEvents: [{ id: 'event-2' }]
      }
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'notifications.outbox.acknowledgeReviewable');
  assert.equal(runbook.actions[0].area, 'notifications');
  assert.match(runbook.actions[0].recommendedCommand, /ack-events --delivery-status delivered --dry-run true/);
  assert.match(runbook.actions[0].relatedCommands[2], /ack-events --delivery-status delivered --execute true/);
  assert.match(runbook.actions[0].relatedCommands[4], /archive-events/);
  assert.equal(runbook.actions[0].evidence.reviewableCount, 3);
});

test('operations runbook recommends resolved acknowledgement when only resolved events are open', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-23T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-23T10:00:00.000Z',
      items: []
    },
    notificationEventOverview: {
      status: 'ok',
      dueForDeliveryCount: 0,
      failedCount: 0,
      retryExhaustedCount: 0,
      byOpenDeliveryStatus: {
        resolved: 2
      },
      attention: {}
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.match(runbook.actions[0].recommendedCommand, /ack-events --delivery-status resolved --dry-run true/);
});

test('operations runbook points review action executor warnings to diagnostics and audit tools', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-21T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-21T10:00:00.000Z',
      items: [
        {
          key: 'reviewActions.executor',
          area: 'review-actions',
          status: 'warn',
          summary: 'Review action executor mode and readiness are visible before execute=true.',
          evidence: {
            mode: 'none',
            ready: false,
            dryRunOnly: true
          }
        }
      ]
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'checklist.reviewActions.executor');
  assert.match(runbook.actions[0].recommendedCommand, /review-action-executor-diagnostics/);
  assert.match(runbook.actions[0].relatedCommands[0], /review-action-audit-overview/);
  assert.match(runbook.actions[0].relatedCommands[1], /review-action-apply --execute true/);
});

test('operations runbook points review action ledger failures to execution inspection tools', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-21T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-21T10:00:00.000Z',
      items: [
        {
          key: 'reviewActions.executionLedger',
          area: 'review-actions',
          status: 'fail',
          summary: 'Review action execution ledger prevents duplicate downstream mutations.',
          evidence: {
            count: 3,
            completed: 1,
            running: 1,
            failed: 1
          }
        }
      ]
    }
  });

  assert.equal(runbook.status, 'fail');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'checklist.reviewActions.executionLedger');
  assert.equal(runbook.actions[0].severity, 'critical');
  assert.match(runbook.actions[0].recommendedCommand, /review-action-executions --status failed/);
  assert.match(runbook.actions[0].relatedCommands[0], /review-action-executions --status running/);
  assert.match(runbook.actions[0].relatedCommands[1], /review-action-gate/);
});

test('operations runbook points stale review action ledger runs to running inspection', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-21T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-21T10:00:00.000Z',
      items: [
        {
          key: 'reviewActions.executionLedger',
          area: 'review-actions',
          status: 'fail',
          summary: 'Review action execution ledger prevents duplicate downstream mutations.',
          evidence: {
            count: 1,
            completed: 0,
            running: 1,
            staleRunning: 1,
            failed: 0
          }
        }
      ]
    }
  });

  assert.equal(runbook.status, 'fail');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'checklist.reviewActions.executionLedger');
  assert.match(runbook.actions[0].recommendedCommand, /review-action-executions --status running/);
  assert.match(runbook.actions[0].relatedCommands[1], /review-action-gate/);
});

test('operations runbook flags duplicate idempotency task risk', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: [],
      readiness: {
        overview: {
          recent: {
            tasks: [
              task('task-2', 'completed', 'idem-1'),
              task('task-1', 'failed', 'idem-1'),
              task('task-3', 'completed', 'idem-2')
            ]
          }
        }
      }
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'idempotency.idem-1');
  assert.equal(runbook.actions[0].severity, 'warning');
  assert.equal(runbook.actions[0].evidence.reusableTaskId, 'task-2');
  assert.deepEqual(runbook.actions[0].evidence.taskIds, ['task-2', 'task-1']);
  assert.match(runbook.actions[0].recommendedCommand, /trace-context --idempotency-key idem-1/);
});

test('operations runbook flags open author review queue items', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-23T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-23T10:00:00.000Z',
      items: [],
      readiness: {
        overview: {
          authorReviewQueue: {
            openCount: 3,
            highPriorityOpenCount: 1,
            byPriority: { high: 1, medium: 2 },
            byType: { 'evidence-gap': 1, 'high-confidence-opinion': 2 },
            latestUpdatedAt: '2026-06-23T09:59:00.000Z'
          }
        }
      }
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'authorReviewQueue.open');
  assert.equal(runbook.actions[0].area, 'intelligence');
  assert.match(runbook.actions[0].recommendedCommand, /list-author-review-queue --status open/);
  assert.match(runbook.actions[0].relatedCommands[1], /synthesize-author-review-queue-events/);
  assert.match(runbook.actions[0].relatedCommands[2], /operationsWorkerMain.js --once --author-review-queue-events true/);
  assert.equal(runbook.actions[0].evidence.highPriorityOpenCount, 1);
});

test('operations runbook turns source lifecycle signals into actions', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: []
    },
    sourceLifecycleReport: {
      status: 'warn',
      blockedDisables: [
        {
          sourceId: 'source-running',
          displayName: 'Running source',
          lastStartedAt: '2026-06-19T09:59:00.000Z',
          staleAfterMs: 600000,
          nextAction: 'wait-for-run-or-force-disable',
          recommendedCommands: [
            'node src/presentation/cli/threadtrace.js source-lifecycle-report --source-run-stale-after-ms 600000',
            'node src/presentation/cli/threadtrace.js disable-source --source-id source-running --force true --execute true'
          ]
        }
      ],
      sources: [
        {
          id: 'source-failed',
          displayName: 'Failed source',
          failureRetry: {
            active: true,
            elapsed: false,
            retryAt: '2026-06-19T10:01:00.000Z',
            failureCount: 2,
            backoffMs: 120000
          },
          nextAction: 'wait-for-failure-backoff',
          recommendedCommands: [
            'node src/presentation/cli/threadtrace.js source-schedule-report --forum nga',
            'node src/presentation/cli/threadtrace.js reset-source-failure --source-id source-failed --retry-now true --execute true'
          ]
        }
      ]
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 2);
  assert.equal(runbook.actions[0].key, 'sourceLifecycle.disableBlocked.source-running');
  assert.equal(runbook.actions[0].severity, 'warning');
  assert.match(runbook.actions[0].recommendedCommand, /source-run-stale-after-ms 600000/);
  assert.match(runbook.actions[0].relatedCommands[0], /--force true --execute true/);
  assert.match(runbook.actions[0].relatedCommands[2], /list-sources/);
  assert.equal(runbook.actions[1].key, 'sourceLifecycle.failureRetry.source-failed');
  assert.equal(runbook.actions[1].evidence.retryAt, '2026-06-19T10:01:00.000Z');
  assert.match(runbook.actions[1].summary, /Failed source/);
  assert.match(runbook.actions[1].recommendedCommand, /source-schedule-report --forum nga/);
  assert.match(runbook.actions[1].relatedCommands[0], /reset-source-failure --source-id source-failed/);
  assert.match(runbook.actions[1].relatedCommands[2], /source-diagnostics/);
});

test('operations runbook turns review action gate warnings into actions', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: []
    },
    reviewActionGate: {
      status: 'warn',
      recommendedNextAction: 'Keep unresolved tasks open.',
      executable: {
        closeTaskCount: 1,
        mergeCandidateCount: 1
      },
      gates: [
        { key: 'reviewResults.blockers', status: 'warn' }
      ],
      nextActions: [
        { key: 'reviewResults.blockers', severity: 'warning' }
      ],
      actionPlan: {
        count: 1
      }
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'reviewResults.actionGate');
  assert.equal(runbook.actions[0].area, 'review-results');
  assert.match(runbook.actions[0].recommendedCommand, /review-action-gate/);
  assert.match(runbook.actions[0].relatedCommands[0], /review-action-apply/);
  assert.match(runbook.actions[0].relatedCommands[1], /review-action-plan/);
  assert.equal(runbook.actions[0].evidence.reviewResultCount, 1);
  assert.deepEqual(runbook.actions[0].evidence.warningGates, ['reviewResults.blockers']);
});

test('operations runbook ignores empty review action gate warnings', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: []
    },
    reviewActionGate: {
      status: 'warn',
      actionPlan: {
        count: 0
      }
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'ok');
  assert.equal(runbook.actionCount, 0);
});

test('operations runbook flags connector module load failures', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: [],
      diagnostics: {
        configuration: {
          connectors: {
            errorCount: 1,
            errors: [
              {
                modulePath: 'D:\\connectors\\broken.cjs',
                message: 'connector boom'
              }
            ]
          }
        }
      }
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'fail');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'connectors.modules.loadFailures');
  assert.equal(runbook.actions[0].severity, 'critical');
  assert.equal(runbook.actions[0].area, 'connectors');
  assert.match(runbook.actions[0].recommendedCommand, /connector-rollout-plan/);
  assert.match(runbook.actions[0].relatedCommands[0], /connector-readiness/);
  assert.equal(runbook.actions[0].evidence.errorCount, 1);
  assert.match(runbook.actions[0].evidence.errors[0].message, /connector boom/);
});

test('operations runbook recommends connector readiness diagnostics', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: [
        {
          key: 'connectors.readiness',
          area: 'connectors',
          status: 'warn',
          summary: 'Source connector catalog, modules, and adapter coverage are ready.',
          evidence: {
            connectorCount: 3
          }
        }
      ]
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'checklist.connectors.readiness');
  assert.match(runbook.actions[0].recommendedCommand, /connector-rollout-plan/);
  assert.match(runbook.actions[0].relatedCommands[0], /connector-readiness/);
});

test('operations runbook recommends worker topology plan for worker readiness warnings', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: [
        {
          key: 'workers.readiness',
          area: 'workers',
          status: 'warn',
          summary: 'Worker run history and leases need review.',
          evidence: {
            stale: 0,
            failed: 1
          }
        }
      ]
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'checklist.workers.readiness');
  assert.match(runbook.actions[0].recommendedCommand, /worker-topology-plan/);
  assert.match(runbook.actions[0].relatedCommands[0], /operations-readiness/);
});

function task(id, status, idempotencyKey) {
  return {
    id,
    type: 'demo-task',
    status,
    input: {
      _trace: {
        idempotencyKey
      }
    }
  };
}
