'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceCollectionHealthProfile } = require('../src/application/use-cases/getSourceCollectionHealthProfile');

test('source collection health profile summarizes automation and evidence gaps', async function () {
  const profile = await getSourceCollectionHealthProfile({
    now: '2026-06-25T10:00:00.000Z',
    drilldown: buildDrilldown()
  });

  assert.equal(profile.status, 'fail');
  assert.equal(profile.source.id, 'source-1');
  assert.equal(profile.automation.status, 'due');
  assert.equal(profile.automation.schedule.due, true);
  assert.equal(profile.incremental.cursor.present, true);
  assert.equal(profile.incremental.incremental.newPostCount, 4);
  assert.equal(profile.replay.available, true);
  assert.equal(profile.replay.rawPageHashCount, 2);
  assert.deepEqual(profile.replay.evidenceKinds, ['task', 'cursor', 'raw-pages', 'source-url']);
  assert.equal(profile.operations.tasks.failed, 1);
  assert.equal(profile.operations.events.failed, 1);
  assert.equal(profile.operations.workers.runs.stale, 1);
  assert.equal(profile.operations.workers.leases.expired, 1);
  assert.equal(profile.operations.timelineCount, 2);
  assert.equal(profile.checks.find(function (item) {
    return item.key === 'workers.runs';
  }).status, 'fail');
  assert.equal(profile.checks.find(function (item) {
    return item.key === 'collection.replayEvidence';
  }).status, 'ok');
  assert.ok(profile.nextActions.some(function (action) {
    return action.key === 'collectionHealth.workers.runs' && /worker-topology-plan/.test(action.recommendedCommand);
  }));
});

test('source collection health profile reports ready scheduled source', async function () {
  const drilldown = buildDrilldown({
    status: 'ok',
    health: {
      tasks: { failed: 0 },
      events: { unacknowledged: 0, failed: 0, dueForDelivery: 0 },
      workers: {
        runs: { stale: 0 },
        leases: { expired: 0 }
      }
    },
    timeline: [{ kind: 'task', status: 'completed', timestamp: '2026-06-25T09:00:00.000Z' }]
  });
  drilldown.collectionPlan.status = 'scheduled';
  drilldown.collectionPlan.schedule.decision = {
    due: false,
    reason: 'interval-waiting',
    nextRunAt: '2026-06-25T11:00:00.000Z'
  };
  drilldown.collectionPlan.incremental.lastChanged = false;
  drilldown.collectionPlan.lastRun.status = 'completed';

  const profile = await getSourceCollectionHealthProfile({
    drilldown,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(profile.status, 'ok');
  assert.equal(profile.nextActions[0].key, 'collectionHealth.ready');
});

function buildDrilldown(overrides) {
  const base = {
    generatedAt: '2026-06-25T10:00:00.000Z',
    status: 'fail',
    scope: { sourceId: 'source-1', sourceKey: 'nga' },
    sourceFound: true,
    source: {
      id: 'source-1',
      sourceKey: 'nga',
      sourceType: 'thread-url',
      displayName: 'NGA online thread'
    },
    health: {
      source: {
        status: 'completed',
        enabled: true,
        sourceType: 'thread-url',
        displayName: 'NGA online thread'
      },
      tasks: {
        failed: 1
      },
      events: {
        unacknowledged: 2,
        failed: 1,
        dueForDelivery: 1
      },
      workers: {
        runs: {
          stale: 1
        },
        leases: {
          expired: 1
        }
      }
    },
    collectionPlan: {
      status: 'due',
      strategy: {
        sourceType: 'thread-url',
        mode: 'online-thread',
        location: { url: 'https://example.test/thread' }
      },
      schedule: {
        enabled: true,
        intervalMinutes: 60,
        nextRunAt: '2026-06-25T10:00:00.000Z',
        decision: {
          due: true,
          reason: 'interval-elapsed',
          failureCount: 0
        }
      },
      cursor: {
        present: true,
        fingerprint: 'cursor-fingerprint',
        postCount: 20,
        lastFloor: 19
      },
      incremental: {
        enabled: true,
        lastChanged: true,
        newPostCount: 4,
        nextPostCount: 20
      },
      lastRun: {
        status: 'completed',
        lastTaskId: 'task-ingest-1',
        failureCount: 0
      },
      replay: {
        available: true,
        taskId: 'task-ingest-1',
        cursorFingerprint: 'cursor-fingerprint',
        rawPageHashes: ['hash-1', 'hash-2'],
        pageNumbers: [1, 2],
        sourceUrls: ['https://example.test/thread?page=1'],
        evidenceKinds: ['task', 'cursor', 'raw-pages', 'source-url'],
        location: { url: 'https://example.test/thread' }
      }
    },
    timeline: [
      { kind: 'worker-run', status: 'stale', timestamp: '2026-06-25T09:55:00.000Z' },
      { kind: 'notification-event', status: 'failed', timestamp: '2026-06-25T09:50:00.000Z' }
    ],
    nextActions: []
  };
  return Object.assign({}, base, overrides || {}, {
    health: Object.assign({}, base.health, overrides && overrides.health || {})
  });
}
