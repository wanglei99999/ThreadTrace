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
  assert.match(runbook.actions[0].relatedCommands[0], /list-events --acknowledged false --delivery-status failed/);
  assert.match(runbook.actions[0].relatedCommands[1], /dispatch-events/);
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
          nextAction: 'wait-for-run-or-force-disable'
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
          nextAction: 'wait-for-failure-backoff'
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
  assert.match(runbook.actions[0].recommendedCommand, /source-lifecycle-report/);
  assert.match(runbook.actions[0].relatedCommands[1], /--force true/);
  assert.equal(runbook.actions[1].key, 'sourceLifecycle.failureRetry.source-failed');
  assert.equal(runbook.actions[1].evidence.retryAt, '2026-06-19T10:01:00.000Z');
  assert.match(runbook.actions[1].summary, /Failed source/);
  assert.match(runbook.actions[1].relatedCommands[2], /reset-source-failure --source-id source-failed/);
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
