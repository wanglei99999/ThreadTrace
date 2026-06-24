'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceAttentionReport } = require('../src/application/use-cases/getSourceAttentionReport');

test('source attention report merges source schedule lifecycle and runbook signals', function () {
  const report = getSourceAttentionReport({
    now: '2026-06-25T10:00:00.000Z',
    scheduleReport: {
      generatedAt: '2026-06-25T09:59:00.000Z',
      dueSources: [
        source('source-due', {
          displayName: 'Due source',
          decision: {
            reason: 'interval-elapsed'
          }
        })
      ],
      skippedSources: [
        source('source-retry', {
          displayName: 'Retry source',
          runState: {
            status: 'failed',
            failureCount: 2
          },
          decision: {
            reason: 'waiting-failure-backoff',
            retryAt: '2026-06-25T10:01:00.000Z',
            backoffMs: 120000
          }
        })
      ]
    },
    lifecycleReport: {
      generatedAt: '2026-06-25T09:59:10.000Z',
      sources: [
        source('source-due', {
          nextAction: 'disable-source'
        }),
        source('source-retry', {
          displayName: 'Retry source',
          runState: {
            status: 'failed',
            failureCount: 2
          },
          failureRetry: {
            active: true,
            elapsed: false,
            retryAt: '2026-06-25T10:01:00.000Z',
            backoffMs: 120000
          },
          nextAction: 'wait-for-failure-backoff'
        }),
        source('source-blocked', {
          displayName: 'Blocked source',
          runState: {
            status: 'running'
          },
          disableGuard: {
            blocked: true
          },
          nextAction: 'wait-for-run-or-force-disable'
        })
      ]
    },
    operationsRunbook: {
      generatedAt: '2026-06-25T09:59:20.000Z',
      actions: [
        {
          key: 'sourceLifecycle.failureRetry.source-retry',
          area: 'sources',
          severity: 'warning',
          title: 'Wait for failed source retry backoff.',
          recommendedCommand: 'node src/presentation/cli/threadtrace.js source-lifecycle-report',
          evidence: {
            sourceId: 'source-retry',
            sourceKey: 'nga'
          }
        },
        {
          key: 'sourceDiagnostics.source.location.nga',
          area: 'sources',
          severity: 'critical',
          title: 'Fix source key level diagnostics.',
          evidence: {
            sourceKey: 'nga'
          }
        }
      ]
    }
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.total, 4);
  assert.equal(report.summary.critical, 1);
  assert.equal(report.summary.warning, 2);
  assert.equal(report.summary.info, 1);
  assert.equal(report.summary.runnable, 1);
  assert.equal(report.summary.actionable, 3);
  assert.equal(report.summary.highestPriorityScore, 128);
  assert.equal(report.summary.bySignal.due, 1);
  assert.equal(report.summary.bySignal['retry wait'], 2);
  assert.equal(report.summary.bySignal.runbook, 2);
  assert.equal(report.sources[0].severity, 'critical');
  assert.equal(report.sources[0].attentionRank, 1);
  assert.equal(report.sources[0].priorityScore, 128);
  assert.equal(report.sources[0].source.sourceKey, 'nga');
  assert.equal(report.sources[0].source.id, undefined);
  const retrySource = report.sources.find(function (item) {
    return item.source.id === 'source-retry';
  });
  assert.equal(retrySource.attentionRank, 2);
  assert.equal(retrySource.priorityScore, 110);
  assert.equal(retrySource.signalCount, 3);
  assert.equal(retrySource.recommendedCommand, 'node src/presentation/cli/threadtrace.js source-lifecycle-report');
  assert.equal(retrySource.recommendedNextAction, 'wait-for-failure-backoff');
  assert.equal(retrySource.commands[0], 'node src/presentation/cli/threadtrace.js source-lifecycle-report');
  assert.equal(retrySource.nextAction, 'wait-for-failure-backoff');
  const dueSource = report.sources.find(function (item) {
    return item.source.id === 'source-due';
  });
  assert.equal(dueSource.runnable, true);
});

test('source attention report returns ok for empty inputs', function () {
  const report = getSourceAttentionReport({
    now: '2026-06-25T10:00:00.000Z',
    scheduleReport: {},
    lifecycleReport: {},
    operationsRunbook: {}
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.summary.total, 0);
  assert.equal(report.summary.actionable, 0);
  assert.equal(report.summary.highestPriorityScore, 0);
  assert.deepEqual(report.sources, []);
});

function source(id, overrides) {
  return Object.assign({
    id,
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: id,
    enabled: true,
    runState: {
      status: 'completed',
      failureCount: 0
    },
    decision: {},
    disableGuard: {},
    failureRetry: {}
  }, overrides);
}
