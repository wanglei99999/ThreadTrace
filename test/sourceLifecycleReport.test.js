'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceLifecycleReport } = require('../src/application/use-cases/getSourceLifecycleReport');

test('source lifecycle report summarizes disable guards and lifecycle tasks', async function () {
  const report = await getSourceLifecycleReport({
    now: '2026-06-19T10:00:00.000Z',
    sourceRunStaleAfterMs: 10 * 60 * 1000,
    sourceFailureRetryBackoffMs: 60 * 1000,
    sourceFailureMaxRetryBackoffMs: 60 * 60 * 1000,
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources() {
        return [
          source('source-1', {
            displayName: 'Active source',
            runState: {
              status: 'running',
              lastStartedAt: '2026-06-19T09:59:00.000Z'
            }
          }),
          source('source-2', {
            displayName: 'Stale source',
            runState: {
              status: 'running',
              lastStartedAt: '2026-06-19T09:00:00.000Z'
            }
          }),
          source('source-3', {
            displayName: 'Disabled source',
            enabled: false,
            runState: {
              status: 'completed',
              lastFinishedAt: '2026-06-19T09:30:00.000Z'
            }
          }),
          source('source-4', {
            displayName: 'Failed source',
            updatedAt: '2026-06-19T09:59:00.000Z',
            schedule: {
              nextRunAt: '2026-06-19T09:00:00.000Z'
            },
            runState: {
              status: 'failed',
              failureCount: 2,
              lastFinishedAt: '2026-06-19T09:59:00.000Z'
            }
          })
        ];
      }
    },
    taskRepository: {
      async saveTask() {},
      async findTask() {},
      async listTasks() {
        return [
          {
            id: 'task-disable-1',
            type: 'disable-tracked-source',
            status: 'failed',
            input: {
              sourceId: 'source-1',
              execute: true,
              dryRun: false,
              force: false
            },
            error: {
              message: 'Tracked source is currently running: source-1'
            },
            createdAt: '2026-06-19T09:59:30.000Z',
            updatedAt: '2026-06-19T09:59:31.000Z'
          },
          {
            id: 'task-enable-1',
            type: 'enable-tracked-source',
            status: 'completed',
            input: {
              sourceId: 'source-3',
              execute: true,
              dryRun: false
            },
            createdAt: '2026-06-19T09:30:00.000Z',
            updatedAt: '2026-06-19T09:30:01.000Z'
          },
          {
            id: 'task-reset-1',
            type: 'reset-tracked-source-failure',
            status: 'completed',
            input: {
              sourceId: 'source-4',
              execute: true,
              dryRun: false,
              retryNow: true
            },
            createdAt: '2026-06-19T09:58:00.000Z',
            updatedAt: '2026-06-19T09:58:01.000Z'
          },
          {
            id: 'task-ingest-1',
            type: 'source-ingest',
            status: 'completed',
            input: {
              sourceId: 'source-1'
            },
            createdAt: '2026-06-19T09:00:00.000Z',
            updatedAt: '2026-06-19T09:00:01.000Z'
          }
        ];
      }
    }
  });

  assert.equal(report.status, 'warn');
  assert.equal(report.summary.total, 4);
  assert.equal(report.summary.enabled, 3);
  assert.equal(report.summary.disabled, 1);
  assert.equal(report.summary.running, 2);
  assert.equal(report.summary.staleRunning, 1);
  assert.equal(report.summary.failureRetryWaiting, 1);
  assert.equal(report.summary.disableBlocked, 1);
  assert.equal(report.blockedDisables.length, 1);
  assert.equal(report.blockedDisables[0].sourceId, 'source-1');
  assert.equal(report.blockedDisables[0].sourceKey, 'nga');
  assert.match(report.blockedDisables[0].recommendedCommands[1], /disable-source --source-id source-1 --force true --execute true/);
  assert.equal(report.sources[0].disableGuard.canDisable, false);
  assert.equal(report.sources[0].latestLifecycleTask.id, 'task-disable-1');
  assert.equal(report.sources[1].disableGuard.stale, true);
  assert.equal(report.sources[1].nextAction, 'disable-or-recover-stale-run');
  assert.match(report.sources[1].recommendedCommands[0], /disable-source --source-id source-2 --execute true/);
  assert.equal(report.sources[2].nextAction, 'enable-source');
  assert.match(report.sources[2].recommendedCommands[0], /enable-source --source-id source-3 --execute true/);
  assert.equal(report.sources[3].failureRetry.active, true);
  assert.equal(report.sources[3].failureRetry.elapsed, false);
  assert.equal(report.sources[3].failureRetry.retryAt, '2026-06-19T10:01:00.000Z');
  assert.equal(report.sources[3].latestLifecycleTask.id, 'task-reset-1');
  assert.equal(report.sources[3].nextAction, 'wait-for-failure-backoff');
  assert.match(report.sources[3].recommendedCommands[1], /reset-source-failure --source-id source-4 --retry-now true --execute true/);
  assert.deepEqual(report.recentLifecycleTasks.map(function (task) {
    return task.id;
  }), ['task-disable-1', 'task-reset-1', 'task-enable-1']);
});

function source(id, overrides) {
  return Object.assign({
    id,
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: id,
    location: {
      inputDir: 'example'
    },
    enabled: true,
    runState: {
      status: 'never-run',
      failureCount: 0
    }
  }, overrides);
}
