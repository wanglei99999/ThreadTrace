'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceTypeOperationsReport } = require('../src/application/use-cases/getSourceTypeOperationsReport');

test('source type operations report groups readiness schedule lifecycle and attention', function () {
  const report = getSourceTypeOperationsReport({
    now: '2026-06-25T10:00:00.000Z',
    sourceTypeReadiness: {
      generatedAt: '2026-06-25T09:59:00.000Z',
      sourceTypes: [
        readinessType('saved-html-directory', 'ok', [
          source('source-1', { displayName: 'NGA archive' }),
          source('source-2', { displayName: 'NGA retry' })
        ]),
        readinessType('normalized-thread-json', 'warn', [])
      ],
      unknownSourceTypes: []
    },
    sourceScheduleReport: {
      generatedAt: '2026-06-25T09:59:10.000Z',
      sources: [
        source('source-1', {
          decision: {
            due: true,
            reason: 'interval-elapsed'
          }
        }),
        source('source-2', {
          decision: {
            due: false,
            reason: 'waiting-failure-backoff'
          }
        })
      ]
    },
    sourceLifecycleReport: {
      generatedAt: '2026-06-25T09:59:20.000Z',
      sources: [
        source('source-1', {
          runState: {
            status: 'running'
          },
          disableGuard: {
            running: true,
            stale: false,
            blocked: true
          }
        }),
        source('source-2', {
          runState: {
            status: 'failed'
          },
          failureRetry: {
            active: true,
            elapsed: false
          }
        })
      ]
    },
    sourceAttentionReport: {
      generatedAt: '2026-06-25T09:59:30.000Z',
      sources: [
        {
          key: 'sourceId:source-2',
          source: source('source-2'),
          severity: 'warning',
          priorityScore: 110,
          signalCount: 2,
          runnable: false,
          recommendedCommand: 'node src/presentation/cli/threadtrace.js source-lifecycle-report',
          recommendedNextAction: 'wait-for-failure-backoff',
          commands: [
            'node src/presentation/cli/threadtrace.js reset-source-failure --source-id source-2 --retry-now true --execute true'
          ]
        }
      ]
    }
  });

  const savedHtml = report.sourceTypes.find(function (item) {
    return item.sourceType === 'saved-html-directory';
  });
  const normalizedJson = report.sourceTypes.find(function (item) {
    return item.sourceType === 'normalized-thread-json';
  });

  assert.equal(report.status, 'warn');
  assert.equal(report.summary.sourceTypeCount, 2);
  assert.equal(report.summary.warnSourceTypeCount, 2);
  assert.equal(report.summary.sourceCount, 2);
  assert.equal(report.summary.enabledSourceCount, 2);
  assert.equal(report.summary.dueSourceCount, 1);
  assert.equal(report.summary.runningSourceCount, 1);
  assert.equal(report.summary.failureRetryWaitingSourceCount, 1);
  assert.equal(report.summary.warningAttentionSourceCount, 1);
  assert.equal(report.summary.actionableSourceCount, 1);
  assert.equal(savedHtml.status, 'warn');
  assert.equal(savedHtml.readiness.status, 'ok');
  assert.equal(savedHtml.schedule.due, 1);
  assert.equal(savedHtml.schedule.byReason['waiting-failure-backoff'], 1);
  assert.equal(savedHtml.lifecycle.disableBlocked, 1);
  assert.equal(savedHtml.lifecycle.failureRetryWaiting, 1);
  assert.equal(savedHtml.attention.highestPriorityScore, 110);
  assert.match(savedHtml.recommendedCommands[0], /reset-source-failure/);
  assert.equal(savedHtml.topAttention[0].source.id, 'source-2');
  assert.equal(normalizedJson.status, 'warn');
  assert.equal(normalizedJson.readiness.sourceCount, 0);
});

function readinessType(sourceType, status, sources) {
  return {
    sourceType,
    description: sourceType,
    status,
    sourceCount: sources.length,
    enabledSourceCount: sources.filter(function (source) {
      return source.enabled !== false;
    }).length,
    compatibleSourceKeys: sourceType === 'saved-html-directory' ? ['nga'] : [],
    statusCounts: {
      ok: sources.length,
      warn: 0,
      fail: 0
    },
    sources,
    nextActions: []
  };
}

function source(id, overrides) {
  return Object.assign({
    id,
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: id,
    enabled: true,
    decision: {},
    runState: {
      status: 'completed'
    },
    disableGuard: {},
    failureRetry: {}
  }, overrides);
}
