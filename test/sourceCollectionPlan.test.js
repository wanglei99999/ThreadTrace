'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildSourceCollectionPlan } = require('../src/application/use-cases/buildSourceCollectionPlan');

test('source collection plan summarizes schedule cursor increment and replay evidence', function () {
  const plan = buildSourceCollectionPlan({
    id: 'source-1',
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'NGA archive',
    enabled: true,
    location: { inputDir: 'example' },
    schedule: { intervalMinutes: 60 },
    cursor: {
      sourceKey: 'nga',
      sourceThreadId: 'thread-1',
      title: 'Thread',
      postCount: 20,
      lastFloor: 19,
      lastPostId: 'post-20',
      fingerprint: 'cursor-fingerprint',
      capturedAt: '2026-06-19T09:59:00.000Z'
    },
    runState: {
      status: 'completed',
      lastTaskId: 'task-1',
      lastFinishedAt: '2026-06-19T09:59:00.000Z',
      lastCursorDiff: {
        changed: true,
        newPostCount: 3,
        previousPostCount: 17,
        nextPostCount: 20,
        previousLastFloor: 16,
        nextLastFloor: 19,
        previousLastPostId: 'post-17',
        nextLastPostId: 'post-20'
      }
    }
  }, {
    due: true,
    reason: 'interval-elapsed',
    nextRunAt: '2026-06-19T10:00:00.000Z'
  }, {
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(plan.status, 'due');
  assert.equal(plan.strategy.mode, 'local-archive');
  assert.equal(plan.schedule.decision.reason, 'interval-elapsed');
  assert.equal(plan.cursor.present, true);
  assert.equal(plan.cursor.lastFloor, 19);
  assert.equal(plan.incremental.newPostCount, 3);
  assert.equal(plan.incremental.nextLastPostId, 'post-20');
  assert.equal(plan.replay.available, true);
  assert.deepEqual(plan.replay.evidenceKinds, ['task', 'cursor', 'saved-html-directory']);
  assert.match(plan.recommendedCommands[0], /run-source-insight-pipeline --source-id source-1/);
});

test('source collection plan marks failed sources waiting for retry backoff', function () {
  const plan = buildSourceCollectionPlan({
    id: 'source-failed',
    sourceKey: 'rss',
    sourceType: 'normalized-thread-json',
    enabled: true,
    location: { inputFile: 'feed.json' },
    runState: {
      status: 'failed',
      failureCount: 2,
      lastError: { message: 'bad feed' }
    }
  }, {
    due: false,
    reason: 'waiting-failure-backoff',
    retryAt: '2026-06-19T10:01:00.000Z',
    backoffMs: 120000,
    failureCount: 2
  });

  assert.equal(plan.status, 'retry-waiting');
  assert.equal(plan.strategy.mode, 'external-normalized-feed');
  assert.equal(plan.schedule.decision.retryAt, '2026-06-19T10:01:00.000Z');
  assert.equal(plan.lastRun.lastError.message, 'bad feed');
  assert.deepEqual(plan.replay.evidenceKinds, ['normalized-json-file']);
});
