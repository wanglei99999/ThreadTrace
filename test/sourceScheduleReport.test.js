'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceScheduleReport } = require('../src/application/use-cases/getSourceScheduleReport');

test('source schedule report previews due and skipped source decisions', async function () {
  const report = await getSourceScheduleReport({
    now: '2026-06-19T10:00:00.000Z',
    sourceFailureRetryBackoffMs: 60 * 1000,
    sourceFailureMaxRetryBackoffMs: 60 * 60 * 1000,
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources() {
        return [
          source('source-due', {
            schedule: {
              intervalMinutes: 60
            },
            runState: {
              status: 'completed',
              lastFinishedAt: '2026-06-19T08:30:00.000Z'
            }
          }),
          source('source-waiting-retry', {
            schedule: {
              nextRunAt: '2026-06-19T09:00:00.000Z'
            },
            runState: {
              status: 'failed',
              failureCount: 2,
              lastFinishedAt: '2026-06-19T09:59:00.000Z'
            }
          }),
          source('source-disabled', {
            enabled: false,
            schedule: {
              intervalMinutes: 1
            }
          })
        ];
      }
    }
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.due, 1);
  assert.equal(report.summary.skipped, 2);
  assert.equal(report.summary.byReason['interval-elapsed'], 1);
  assert.equal(report.summary.byReason['waiting-failure-backoff'], 1);
  assert.equal(report.summary.byReason['source-disabled'], 1);
  assert.equal(report.summary.byCollectionStatus.due, 1);
  assert.equal(report.summary.byCollectionStatus['retry-waiting'], 1);
  assert.equal(report.summary.byCollectionStatus.disabled, 1);
  assert.equal(report.dueSources[0].id, 'source-due');
  assert.equal(report.dueSources[0].decision.nextRunAt, '2026-06-19T09:30:00.000Z');
  assert.equal(report.dueSources[0].collectionPlan.status, 'due');
  assert.equal(report.dueSources[0].collectionPlan.strategy.mode, 'local-archive');
  assert.equal(report.dueSources[0].collectionPlan.schedule.decision.reason, 'interval-elapsed');
  assert.equal(report.skippedSources[0].id, 'source-waiting-retry');
  assert.equal(report.skippedSources[0].decision.retryAt, '2026-06-19T10:01:00.000Z');
  assert.equal(report.skippedSources[0].decision.backoffMs, 120000);
  assert.equal(report.skippedSources[0].collectionPlan.status, 'retry-waiting');
});

test('source schedule report filters by collection status while preserving unfiltered summary', async function () {
  const report = await getSourceScheduleReport({
    now: '2026-06-19T10:00:00.000Z',
    collectionStatus: 'retry-waiting,disabled',
    sourceFailureRetryBackoffMs: 60 * 1000,
    sourceFailureMaxRetryBackoffMs: 60 * 60 * 1000,
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources() {
        return [
          source('source-due', {
            schedule: { intervalMinutes: 60 },
            runState: { status: 'completed', lastFinishedAt: '2026-06-19T08:30:00.000Z' }
          }),
          source('source-waiting-retry', {
            schedule: { nextRunAt: '2026-06-19T09:00:00.000Z' },
            runState: {
              status: 'failed',
              failureCount: 2,
              lastFinishedAt: '2026-06-19T09:59:00.000Z'
            }
          }),
          source('source-disabled', {
            enabled: false,
            schedule: { intervalMinutes: 1 }
          })
        ];
      }
    }
  });

  assert.deepEqual(report.collectionStatus, ['retry-waiting', 'disabled']);
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.due, 0);
  assert.equal(report.summary.byCollectionStatus['retry-waiting'], 1);
  assert.equal(report.summary.byCollectionStatus.disabled, 1);
  assert.equal(report.unfilteredSummary.total, 3);
  assert.equal(report.unfilteredSummary.byCollectionStatus.due, 1);
  assert.deepEqual(report.sources.map(function (item) { return item.id; }), ['source-waiting-retry', 'source-disabled']);
});

function source(id, overrides) {
  return Object.assign({
    id,
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: id,
    enabled: true,
    location: { inputDir: 'example' },
    schedule: undefined,
    runState: {
      status: 'never-run',
      failureCount: 0
    }
  }, overrides);
}
