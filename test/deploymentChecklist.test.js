'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getDeploymentChecklist } = require('../src/application/use-cases/getDeploymentChecklist');

test('deployment checklist aggregates runtime, source, readiness, notification, and llm checks', function () {
  const checklist = getDeploymentChecklist({
    now: '2026-06-19T10:00:00.000Z',
    sourceKey: 'missing',
    sourceType: 'external-feed',
    diagnostics: {
      status: 'warn',
      generatedAt: '2026-06-19T10:00:00.000Z',
      configuration: {
        storageMode: 'file',
        llm: {
          provider: 'openai-compatible'
        }
      },
      checks: [
        { key: 'resources.storeDir', status: 'ok', summary: 'Store directory is writable.' },
        { key: 'config.llm.apiKey', status: 'warn', summary: 'Remote LLM provider has an API key configured.' }
      ]
    },
    sourceDiagnostics: {
      status: 'fail',
      sourceCount: 2,
      nextActions: [
        {
          key: 'source.handler',
          sourceId: 'source-fail',
          severity: 'critical',
          summary: 'Register a source ingest handler.',
          evidenceSummary: 'sourceId=source-fail sourceType=external-feed registeredHandler=false'
        }
      ],
      sources: [
        {
          sourceId: 'source-ok',
          sourceKey: 'nga',
          sourceType: 'saved-html-directory',
          displayName: 'NGA archive',
          status: 'ok',
          checks: []
        },
        {
          sourceId: 'source-fail',
          sourceKey: 'missing',
          sourceType: 'external-feed',
          displayName: 'External feed',
          status: 'fail',
          checks: [
            {
              key: 'source.handler',
              status: 'fail',
              value: 'external-feed',
              summary: 'Tracked source type has an ingest handler.'
            }
          ]
        }
      ]
    },
    adapterDiagnostics: {
      status: 'ok',
      adapterCount: 1
    },
    connectorReadiness: {
      status: 'warn',
      connectorCount: 3,
      sourceCount: 2,
      modules: {
        count: 1,
        errorCount: 0
      }
    },
    notificationDiagnostics: {
      channel: 'file',
      checks: [
        { key: 'notifications.channel', status: 'ok', summary: 'Notification channel is supported.' },
        { key: 'notifications.fileDeliveryDir', status: 'ok', summary: 'File notification delivery directory is writable.' }
      ]
    },
    reviewActionExecutorDiagnostics: {
      status: 'ok',
      mode: 'file-audit',
      ready: true,
      dryRunOnly: false,
      mutatesSourceTruth: false,
      audit: {
        count: 2,
        taskCount: 1,
        plannedClosureCount: 1,
        plannedMergeCandidateCount: 1
      },
      checks: [
        { key: 'reviewActionExecutor.configured', status: 'ok', summary: 'Review action executor mode is configured.' },
        { key: 'reviewActionExecutor.closeTasks', status: 'ok', summary: 'Executor closeTasks(request) method is required for execute=true.' },
        { key: 'reviewActionExecutor.mergeContext', status: 'ok', summary: 'Executor mergeContext(request) method is required for execute=true.' }
      ]
    },
    reviewActionExecutions: {
      status: 'ok',
      count: 2,
      executions: [
        {
          key: 'context-review-action:v1:tasks.closure:1',
          action: 'tasks.closure',
          status: 'completed',
          taskId: 'task-1',
          updatedAt: '2026-06-19T09:59:00.000Z'
        },
        {
          key: 'context-review-action:v1:context.merge:1',
          action: 'context.merge',
          status: 'completed',
          taskId: 'task-1',
          updatedAt: '2026-06-19T09:58:00.000Z'
        }
      ]
    },
    notificationEventActionExecutions: {
      status: 'ok',
      count: 1,
      executions: [
        {
          key: 'notification-event-action:v1:event.acknowledge:event-1',
          actionKey: 'event.acknowledge',
          status: 'completed',
          eventId: 'event-1',
          sourceKey: 'nga',
          updatedAt: '2026-06-19T09:57:00.000Z'
        }
      ]
    },
    readiness: {
      status: 'fail',
      checks: [
        { key: 'workers.stale', status: 'fail', summary: 'Worker runs are stale.' },
        { key: 'events.failed', status: 'warn', summary: 'Notification events failed delivery.' },
        { key: 'events.dueForDelivery', status: 'warn', summary: 'Notification events are due for delivery.' }
      ]
    }
  });

  assert.equal(checklist.status, 'fail');
  assert.equal(checklist.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'resources.storage';
  }).status, 'ok');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'workers.readiness';
  }).status, 'fail');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'adapters.contract';
  }).status, 'ok');
  const connectorItem = checklist.items.find(function (item) {
    return item.key === 'connectors.readiness';
  });
  assert.equal(connectorItem.status, 'warn');
  assert.equal(connectorItem.evidence.connectorCount, 3);
  assert.equal(connectorItem.evidence.modules.count, 1);
  const sourceItem = checklist.items.find(function (item) {
    return item.key === 'sources.ingestConfiguration';
  });
  assert.equal(sourceItem.status, 'fail');
  assert.equal(sourceItem.evidence.sourceKey, 'missing');
  assert.equal(sourceItem.evidence.sourceType, 'external-feed');
  assert.equal(sourceItem.evidence.summary.sourceCount, 2);
  assert.equal(sourceItem.evidence.summary.fail, 1);
  assert.equal(sourceItem.evidence.summary.nextActionCount, 1);
  assert.equal(sourceItem.evidence.summary.actionDetails[0].sourceId, 'source-fail');
  assert.match(sourceItem.evidence.summary.actionDetails[0].evidenceSummary, /registeredHandler=false/);
  assert.equal(sourceItem.evidence.summary.failedSources[0].sourceId, 'source-fail');
  assert.equal(sourceItem.evidence.summary.failedSources[0].failedChecks[0].key, 'source.handler');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'notifications.outbox';
  }).status, 'warn');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'notifications.outbox';
  }).evidence.checks.length, 2);
  const eventActionLedgerItem = checklist.items.find(function (item) {
    return item.key === 'notificationEventActions.executionLedger';
  });
  assert.equal(eventActionLedgerItem.status, 'ok');
  assert.equal(eventActionLedgerItem.evidence.count, 1);
  assert.equal(eventActionLedgerItem.evidence.completed, 1);
  assert.equal(eventActionLedgerItem.evidence.latestUpdatedAt, '2026-06-19T09:57:00.000Z');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'notifications.channel';
  }).status, 'ok');
  const reviewActionExecutorItem = checklist.items.find(function (item) {
    return item.key === 'reviewActions.executor';
  });
  assert.equal(reviewActionExecutorItem.status, 'ok');
  assert.equal(reviewActionExecutorItem.evidence.mode, 'file-audit');
  assert.equal(reviewActionExecutorItem.evidence.audit.count, 2);
  assert.equal(reviewActionExecutorItem.evidence.checks.length, 3);
  const reviewActionLedgerItem = checklist.items.find(function (item) {
    return item.key === 'reviewActions.executionLedger';
  });
  assert.equal(reviewActionLedgerItem.status, 'ok');
  assert.equal(reviewActionLedgerItem.evidence.count, 2);
  assert.equal(reviewActionLedgerItem.evidence.completed, 2);
  assert.equal(reviewActionLedgerItem.evidence.latestUpdatedAt, '2026-06-19T09:59:00.000Z');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'llm.configuration';
  }).status, 'warn');
});

test('deployment checklist includes LLM preflight and semantic evaluation evidence when provided', function () {
  const checklist = getDeploymentChecklist({
    now: '2026-06-25T10:00:00.000Z',
    diagnostics: {
      status: 'ok',
      configuration: {
        storageMode: 'file',
        llm: {
          provider: 'mock'
        }
      },
      checks: [
        { key: 'resources.storeDir', status: 'ok', summary: 'Store directory is writable.' },
        { key: 'config.llm.provider', status: 'ok', summary: 'LLM provider is configured.' }
      ]
    },
    adapterDiagnostics: { status: 'ok', adapterCount: 1 },
    connectorReadiness: { status: 'ok', connectorCount: 1, sourceCount: 1 },
    sourceDiagnostics: { status: 'ok', sourceCount: 1, sources: [] },
    notificationDiagnostics: {
      channel: 'file',
      checks: [
        { key: 'notifications.channel', status: 'ok', summary: 'Notification channel is supported.' }
      ]
    },
    reviewActionExecutorDiagnostics: { status: 'ok', mode: 'file-audit', ready: true, checks: [] },
    reviewActionExecutions: { status: 'ok', count: 0, executions: [] },
    notificationEventActionExecutions: { status: 'ok', count: 0, executions: [] },
    readiness: { status: 'ok', checks: [] },
    llmPreflight: {
      status: 'ok',
      provider: 'mock',
      traceId: 'llm-preflight:mock:test',
      task: 'thread-history-semantic-enrichment',
      schemaVersion: 'semantic-enrichment.v1',
      checks: [
        { key: 'llm.semantic.validation', status: 'ok', summary: 'Provider output matched the semantic enrichment contract.' }
      ],
      validation: { status: 'ok' },
      outputPreview: { evidenceRefCount: 2 }
    },
    llmEvaluation: {
      status: 'warn',
      provider: 'mock',
      traceId: 'llm-evaluation:mock:test',
      task: 'thread-history-semantic-enrichment',
      schemaVersion: 'semantic-enrichment.v1',
      sampleCount: 1,
      summary: { ok: 0, warn: 1, fail: 0 },
      results: [
        {
          id: 'weak-sample',
          title: 'Weak sample',
          status: 'warn',
          validation: { status: 'ok' },
          qualityChecks: [
            { key: 'llm.output.evidenceRefs.present', status: 'warn', summary: 'Insights should cite source evidence references.' }
          ]
        }
      ],
      nextActions: [
        { key: 'llm.evaluation.review', severity: 'info', summary: 'Review warning evaluation samples.' }
      ]
    }
  });

  assert.equal(checklist.status, 'warn');
  const preflightItem = checklist.items.find(function (item) {
    return item.key === 'llm.preflight';
  });
  const evaluationItem = checklist.items.find(function (item) {
    return item.key === 'llm.semanticEvaluation';
  });
  assert.equal(preflightItem.status, 'ok');
  assert.equal(preflightItem.evidence.validationStatus, 'ok');
  assert.equal(evaluationItem.status, 'warn');
  assert.equal(evaluationItem.evidence.sampleCount, 1);
  assert.equal(evaluationItem.evidence.warningSamples[0].qualityChecks[0].key, 'llm.output.evidenceRefs.present');
  assert.equal(checklist.llmEvaluation.summary.warn, 1);
});

test('deployment checklist fails when review action execution ledger has failed records', function () {
  const checklist = getDeploymentChecklist({
    now: '2026-06-19T10:00:00.000Z',
    diagnostics: {
      status: 'ok',
      configuration: {
        storageMode: 'file',
        llm: {
          provider: 'mock'
        }
      },
      checks: [
        { key: 'resources.storeDir', status: 'ok', summary: 'Store directory is writable.' },
        { key: 'config.llm.provider', status: 'ok', summary: 'LLM provider is configured.' }
      ]
    },
    adapterDiagnostics: { status: 'ok', adapterCount: 1 },
    connectorReadiness: { status: 'ok', connectorCount: 1, sourceCount: 1 },
    sourceDiagnostics: { status: 'ok', sourceCount: 1, sources: [] },
    notificationDiagnostics: {
      channel: 'file',
      checks: [
        { key: 'notifications.channel', status: 'ok', summary: 'Notification channel is supported.' }
      ]
    },
    reviewActionExecutorDiagnostics: {
      status: 'ok',
      mode: 'file-audit',
      ready: true,
      checks: []
    },
    reviewActionExecutions: {
      status: 'ok',
      count: 1,
      executions: [
        {
          key: 'context-review-action:v1:tasks.closure:failed',
          action: 'tasks.closure',
          status: 'failed',
          taskId: 'task-failed',
          sourceId: 'source-nga',
          sourceKey: 'nga',
          updatedAt: '2026-06-19T09:59:00.000Z'
        }
      ]
    },
    readiness: {
      status: 'ok',
      checks: [
        { key: 'workers.stale', status: 'ok', summary: 'Worker runs are stale.' },
        { key: 'events.failed', status: 'ok', summary: 'Notification events failed delivery.' }
      ]
    }
  });

  assert.equal(checklist.status, 'fail');
  const item = checklist.items.find(function (item) {
    return item.key === 'reviewActions.executionLedger';
  });
  assert.equal(item.status, 'fail');
  assert.equal(item.evidence.bySourceKey.nga, 1);
  assert.equal(item.evidence.failedExecutions[0].sourceKey, 'nga');
});

test('deployment checklist fails when review action execution ledger has stale running records', function () {
  const checklist = getDeploymentChecklist({
    now: '2026-06-21T10:00:00.000Z',
    diagnostics: {
      status: 'ok',
      configuration: {
        storageMode: 'file',
        llm: {
          provider: 'mock'
        }
      },
      checks: [
        { key: 'resources.storeDir', status: 'ok', summary: 'Store directory is writable.' },
        { key: 'config.llm.provider', status: 'ok', summary: 'LLM provider is configured.' }
      ]
    },
    adapterDiagnostics: { status: 'ok', adapterCount: 1 },
    connectorReadiness: { status: 'ok', connectorCount: 1, sourceCount: 1 },
    sourceDiagnostics: { status: 'ok', sourceCount: 1, sources: [] },
    notificationDiagnostics: {
      channel: 'file',
      checks: [
        { key: 'notifications.channel', status: 'ok', summary: 'Notification channel is supported.' }
      ]
    },
    reviewActionExecutorDiagnostics: {
      status: 'ok',
      mode: 'file-audit',
      ready: true,
      checks: []
    },
    reviewActionExecutions: {
      status: 'ok',
      healthStatus: 'warn',
      count: 1,
      runningStaleAfterMs: 600000,
      staleRunningCount: 1,
      staleRunningExecutions: [
        {
          key: 'context-review-action:v1:context.merge:stale',
          action: 'context.merge',
          status: 'running',
          taskId: 'task-stale',
          sourceId: 'source-external',
          sourceKey: 'external',
          updatedAt: '2026-06-21T09:40:00.000Z',
          runningAgeMs: 1200000
        }
      ],
      executions: [
        {
          key: 'context-review-action:v1:context.merge:stale',
          action: 'context.merge',
          status: 'running',
          taskId: 'task-stale',
          sourceId: 'source-external',
          sourceKey: 'external',
          updatedAt: '2026-06-21T09:40:00.000Z',
          runningAgeMs: 1200000,
          staleRunning: true
        }
      ]
    },
    readiness: {
      status: 'ok',
      checks: [
        { key: 'workers.stale', status: 'ok', summary: 'Worker runs are stale.' },
        { key: 'events.failed', status: 'ok', summary: 'Notification events failed delivery.' }
      ]
    }
  });

  const item = checklist.items.find(function (check) {
    return check.key === 'reviewActions.executionLedger';
  });
  assert.equal(checklist.status, 'fail');
  assert.equal(item.status, 'fail');
  assert.equal(item.evidence.staleRunning, 1);
  assert.equal(item.evidence.staleRunningBySourceKey.external, 1);
  assert.equal(item.evidence.staleRunningExecutions[0].taskId, 'task-stale');
  assert.equal(item.evidence.staleRunningExecutions[0].sourceKey, 'external');
});

test('deployment checklist fails when notification event action execution ledger needs attention', function () {
  const checklist = getDeploymentChecklist({
    now: '2026-06-21T10:00:00.000Z',
    notificationEventActionExecutions: {
      status: 'ok',
      count: 2,
      runningStaleAfterMs: 600000,
      staleRunningCount: 1,
      staleRunningExecutions: [
        {
          key: 'notification-event-action:v1:event.acknowledge:event-stale',
          actionKey: 'event.acknowledge',
          status: 'running',
          eventId: 'event-stale',
          sourceKey: 'external',
          updatedAt: '2026-06-21T09:40:00.000Z',
          runningAgeMs: 1200000
        }
      ],
      executions: [
        {
          key: 'notification-event-action:v1:event.acknowledge:event-failed',
          actionKey: 'event.acknowledge',
          status: 'failed',
          eventId: 'event-failed',
          sourceId: 'source-nga',
          sourceKey: 'nga',
          updatedAt: '2026-06-21T09:59:00.000Z'
        },
        {
          key: 'notification-event-action:v1:event.acknowledge:event-stale',
          actionKey: 'event.acknowledge',
          status: 'running',
          eventId: 'event-stale',
          sourceKey: 'external',
          updatedAt: '2026-06-21T09:40:00.000Z',
          runningAgeMs: 1200000,
          staleRunning: true
        }
      ]
    }
  });

  const item = checklist.items.find(function (check) {
    return check.key === 'notificationEventActions.executionLedger';
  });
  assert.equal(checklist.status, 'fail');
  assert.equal(item.status, 'fail');
  assert.equal(item.evidence.failed, 1);
  assert.equal(item.evidence.staleRunning, 1);
  assert.equal(item.evidence.bySourceKey.nga, 1);
  assert.equal(item.evidence.staleRunningBySourceKey.external, 1);
  assert.equal(item.evidence.failedExecutions[0].eventId, 'event-failed');
  assert.equal(item.evidence.staleRunningExecutions[0].eventId, 'event-stale');
});
