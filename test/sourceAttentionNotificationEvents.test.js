'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { synthesizeSourceAttentionNotificationEvents } = require('../src/application/use-cases/synthesizeSourceAttentionNotificationEvents');
const { buildSourceAttentionEventId, createSourceAttentionEvent } = require('../src/domain/events/notificationEvent');

test('source attention notification synthesis defaults to dry-run', async function () {
  const saved = [];
  const item = attentionItem('source-1', {
    severity: 'warning',
    priorityScore: 82
  });
  const result = await synthesizeSourceAttentionNotificationEvents({
    notificationEventRepository: repository([], saved),
    sourceAttentionReport: report([item]),
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.actionCount, 1);
  assert.equal(result.createdCount, 1);
  assert.equal(result.eventCount, 1);
  assert.equal(saved.length, 0);
  assert.equal(result.results[0].event.type, 'source-attention');
  assert.equal(result.results[0].event.sourceId, 'source-1');
  assert.equal(result.results[0].event.sourceKey, 'forum-a');
  assert.equal(result.results[0].event.deliveryStatus, 'pending');
  assert.equal(result.results[0].event.payload.priorityScore, 82);
});

test('source attention notification synthesis executes stable scoped outbox events', async function () {
  const saved = [];
  const sourceA = attentionItem('source-a', {
    sourceKey: 'forum-a',
    severity: 'warning'
  });
  const sourceB = attentionItem('source-b', {
    sourceKey: 'forum-b',
    severity: 'warning'
  });
  const result = await synthesizeSourceAttentionNotificationEvents({
    notificationEventRepository: repository([], saved),
    sourceAttentionReport: report([sourceA, sourceB]),
    execute: true,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.createdCount, 2);
  assert.equal(saved.length, 2);
  assert.notEqual(saved[0].id, saved[1].id);
  assert.equal(saved[0].id, buildSourceAttentionEventId(sourceA));
  assert.equal(saved[0].sourceId, 'source-a');
  assert.equal(saved[1].sourceKey, 'forum-b');
});

test('source attention notification synthesis can alert by priority threshold', async function () {
  const saved = [];
  const result = await synthesizeSourceAttentionNotificationEvents({
    notificationEventRepository: repository([], saved),
    sourceAttentionReport: report([
      attentionItem('source-low', {
        severity: 'info',
        priorityScore: 65
      }),
      attentionItem('source-high', {
        severity: 'info',
        priorityScore: 90
      })
    ]),
    priorityScoreThreshold: 80,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.actionCount, 1);
  assert.equal(result.results[0].event.sourceId, 'source-high');
});

test('source attention notification synthesis skips acknowledged and delivered events', async function () {
  const saved = [];
  const acked = attentionItem('source-acked');
  const delivered = attentionItem('source-delivered');
  const existing = [
    existingEvent(acked, {
      acknowledgedAt: '2026-06-25T09:00:00.000Z',
      deliveryStatus: 'pending'
    }),
    existingEvent(delivered, {
      deliveryStatus: 'delivered'
    })
  ];
  const result = await synthesizeSourceAttentionNotificationEvents({
    notificationEventRepository: repository(existing, saved),
    sourceAttentionReport: report([acked, delivered]),
    execute: true,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.skippedCount, 2);
  assert.deepEqual(result.results.map(function (item) { return item.reason; }), ['already-acknowledged', 'already-delivered']);
  assert.equal(saved.length, 0);
});

test('source attention notification synthesis resolves stale scoped events', async function () {
  const saved = [];
  const active = attentionItem('source-active', {
    sourceKey: 'forum-a'
  });
  const stale = attentionItem('source-stale', {
    sourceKey: 'forum-a'
  });
  const other = attentionItem('source-other', {
    sourceKey: 'forum-b'
  });
  const queries = [];
  const result = await synthesizeSourceAttentionNotificationEvents({
    notificationEventRepository: repository([
      existingEvent(stale, { deliveryStatus: 'failed' }),
      existingEvent(other, { deliveryStatus: 'pending' })
    ], saved, queries),
    sourceAttentionReport: report([active]),
    sourceKey: 'forum-a',
    execute: true,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.createdCount, 1);
  assert.equal(result.resolvedCount, 1);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].sourceId, 'source-active');
  assert.equal(saved[1].sourceId, 'source-stale');
  assert.equal(saved[1].deliveryStatus, 'resolved');
  assert.equal(saved[1].acknowledgedBy, 'source-attention-synthesizer');
  assert.equal(saved[1].payload.resolution.reason, 'source-attention-cleared');
  assert.equal(queries[0].sourceKey, 'forum-a');
});

test('source attention notification synthesis reopens auto-resolved events', async function () {
  const saved = [];
  const item = attentionItem('source-reopened');
  const resolved = existingEvent(item, {
    deliveryStatus: 'resolved',
    nextDeliveryAt: undefined,
    acknowledgedAt: '2026-06-25T09:00:00.000Z',
    acknowledgedBy: 'source-attention-synthesizer'
  });
  resolved.payload = Object.assign({}, resolved.payload, {
    resolution: {
      status: 'resolved',
      resolvedAt: '2026-06-25T09:00:00.000Z',
      reason: 'source-attention-cleared'
    }
  });
  const result = await synthesizeSourceAttentionNotificationEvents({
    notificationEventRepository: repository([resolved], saved),
    sourceAttentionReport: report([item]),
    execute: true,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.reopenedCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].deliveryStatus, 'pending');
  assert.equal(saved[0].payload.previousResolution.reason, 'source-attention-cleared');
});

function report(sources) {
  return {
    generatedAt: '2026-06-25T09:59:00.000Z',
    status: 'warn',
    sources
  };
}

function attentionItem(sourceId, overrides) {
  const safeOverrides = overrides || {};
  const sourceKey = safeOverrides.sourceKey || 'forum-a';
  return Object.assign({
    key: 'sourceId:' + sourceId,
    attentionRank: 1,
    priorityScore: 82,
    severity: 'warning',
    signalCount: 1,
    runnable: true,
    source: {
      id: sourceId,
      sourceKey,
      displayName: sourceId
    },
    recommendedNextAction: 'run-source-insight-pipeline',
    recommendedCommand: 'node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id ' + sourceId,
    signals: [
      {
        severity: 'warning',
        label: 'runbook',
        summary: 'Review source.'
      }
    ],
    commands: []
  }, safeOverrides);
}

function existingEvent(item, overrides) {
  return Object.assign(createSourceAttentionEvent({
    item,
    createdAt: '2026-06-25T09:00:00.000Z'
  }), overrides);
}

function repository(events, saved, queries) {
  return {
    async saveEvent(event) {
      saved.push(event);
    },
    async findEvent(id) {
      return events.find(function (event) {
        return event.id === id;
      });
    },
    async listEvents(query) {
      if (queries) queries.push(query || {});
      const safeQuery = query || {};
      return events.filter(function (event) {
        if (safeQuery.type && event.type !== safeQuery.type) return false;
        if (safeQuery.sourceId && event.sourceId !== safeQuery.sourceId) return false;
        if (safeQuery.sourceKey && event.sourceKey !== safeQuery.sourceKey) return false;
        if (safeQuery.acknowledged === false && event.acknowledgedAt) return false;
        return true;
      });
    }
  };
}
