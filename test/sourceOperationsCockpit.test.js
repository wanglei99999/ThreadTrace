'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceOperationsCockpit } = require('../src/application/use-cases/getSourceOperationsCockpit');

test('source operations cockpit prioritizes source, source type, and runbook work', function () {
  const report = getSourceOperationsCockpit({
    now: '2026-06-25T10:00:00.000Z',
    limit: 10,
    sourceAttentionReport: {
      generatedAt: '2026-06-25T09:59:00.000Z',
      status: 'warn',
      sources: [
        {
          key: 'sourceId:source-1',
          severity: 'warning',
          attentionRank: 1,
          priorityScore: 110,
          signalCount: 3,
          runnable: true,
          source: {
            id: 'source-1',
            sourceKey: 'nga',
            sourceType: 'saved-html-directory',
            displayName: 'NGA saved page'
          },
          signals: [
            { label: 'retry wait', summary: 'Failure retry window has not elapsed.' },
            { label: 'runbook', summary: 'Wait for failed source retry backoff.' }
          ],
          recommendedNextAction: 'wait-for-failure-backoff',
          recommendedCommand: 'node src/presentation/cli/threadtrace.js source-lifecycle-report',
          commands: ['node src/presentation/cli/threadtrace.js source-lifecycle-report']
        }
      ]
    },
    sourceTypeOperationsReport: {
      generatedAt: '2026-06-25T09:59:10.000Z',
      status: 'warn',
      sourceTypes: [
        {
          sourceType: 'saved-html-directory',
          status: 'warn',
          readiness: { sourceCount: 2 },
          schedule: { total: 2, due: 1 },
          lifecycle: { total: 2, failureRetryWaiting: 1 },
          attention: { total: 1, actionable: 1, highestPriorityScore: 110 },
          recommendedCommands: ['node src/presentation/cli/threadtrace.js reset-source-failure --source-id source-1 --retry-now true --execute true'],
          topAttention: [{ key: 'sourceId:source-1', priorityScore: 110 }]
        }
      ]
    },
    operationsRunbook: {
      generatedAt: '2026-06-25T09:59:20.000Z',
      status: 'fail',
      actions: [
        {
          key: 'sourceDiagnostics.source.location.nga',
          area: 'sources',
          severity: 'critical',
          title: 'Fix source key level diagnostics.',
          summary: 'Source location is missing required fields.',
          recommendedCommand: 'node src/presentation/cli/threadtrace.js sources-diagnostics',
          evidence: {
            sourceKey: 'nga'
          }
        }
      ]
    },
    sourceScheduleReport: {
      generatedAt: '2026-06-25T09:59:30.000Z',
      status: 'warn'
    },
    sourceLifecycleReport: {
      generatedAt: '2026-06-25T09:59:40.000Z',
      status: 'warn'
    }
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.fail, 1);
  assert.equal(report.summary.warning, 2);
  assert.equal(report.summary.runnable, 2);
  assert.equal(report.summary.sourceScoped, 2);
  assert.equal(report.summary.sourceTypeScoped, 1);
  assert.equal(report.summary.byKind['source-attention'], 1);
  assert.equal(report.summary.byKind['source-type-operations'], 1);
  assert.equal(report.summary.byKind.runbook, 1);
  assert.equal(report.queue[0].kind, 'source-type-operations');
  assert.equal(report.queue[0].rank, 1);
  assert.equal(report.queue[0].sourceType, 'saved-html-directory');
  assert.equal(report.queue[1].kind, 'runbook');
  assert.equal(report.queue[1].severity, 'critical');
  assert.equal(report.queue[2].source.id, 'source-1');
  assert.match(report.nextActions[0].summary, /saved-html-directory/);
});

test('source operations cockpit falls back to due sources when attention report is empty', function () {
  const report = getSourceOperationsCockpit({
    now: '2026-06-25T10:00:00.000Z',
    sourceAttentionReport: {
      status: 'ok',
      sources: []
    },
    sourceTypeOperationsReport: {
      status: 'ok',
      sourceTypes: []
    },
    operationsRunbook: {
      status: 'ok',
      actions: []
    },
    sourceScheduleReport: {
      generatedAt: '2026-06-25T09:59:30.000Z',
      status: 'ok',
      dueSources: [
        {
          id: 'source-due',
          sourceKey: 'nga',
          sourceType: 'saved-html-directory',
          displayName: 'Due source'
        }
      ]
    },
    sourceLifecycleReport: {
      status: 'ok'
    }
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.summary.total, 1);
  assert.equal(report.summary.runnable, 1);
  assert.equal(report.queue[0].kind, 'due-source');
  assert.equal(report.queue[0].source.id, 'source-due');
  assert.equal(report.queue[0].recommendedNextAction, 'run-source-ingest');
});

test('source operations cockpit returns an ok empty queue with a calm next action', function () {
  const report = getSourceOperationsCockpit({
    now: '2026-06-25T10:00:00.000Z',
    sourceAttentionReport: {},
    sourceTypeOperationsReport: {},
    operationsRunbook: {},
    sourceScheduleReport: {},
    sourceLifecycleReport: {}
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.summary.total, 0);
  assert.deepEqual(report.queue, []);
  assert.equal(report.nextActions[0].key, 'sourceOperationsCockpit.ok');
});
