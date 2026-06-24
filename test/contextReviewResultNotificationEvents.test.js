'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  synthesizeContextReviewResultNotificationEvents
} = require('../src/application/use-cases/synthesizeContextReviewResultNotificationEvents');
const { createContextReviewResultEvent } = require('../src/domain/events/notificationEvent');

test('context review result notification synthesis defaults to dry-run', async function () {
  const saved = [];
  const result = await synthesizeContextReviewResultNotificationEvents({
    contextReviewResultRepository: reviewRepository([
      reviewRecord('review-1', 'warning'),
      reviewRecord('review-2', 'info')
    ]),
    notificationEventRepository: eventRepository([], saved),
    now: '2026-06-21T10:00:00.000Z'
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.reviewResultCount, 2);
  assert.equal(result.actionCount, 1);
  assert.equal(result.createdCount, 1);
  assert.equal(saved.length, 0);
  assert.equal(result.results[0].event.type, 'context-review-result');
  assert.equal(result.results[0].event.severity, 'warning');
});

test('context review result notification synthesis executes stable outbox events', async function () {
  const saved = [];
  const result = await synthesizeContextReviewResultNotificationEvents({
    contextReviewResultRepository: reviewRepository([
      reviewRecord('review-1', 'critical')
    ]),
    notificationEventRepository: eventRepository([], saved),
    execute: true,
    now: '2026-06-21T10:00:00.000Z'
  });

  assert.equal(result.dryRun, false);
  assert.equal(result.createdCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, result.results[0].event.id);
  assert.equal(saved[0].payload.recordId, 'review-1');
  assert.equal(saved[0].payload.handoffId, 'handoff-review-1');
});

test('context review result notification events carry and isolate source scope', async function () {
  const saved = [];
  const forumARecord = reviewRecord('review-1', 'critical', { sourceId: 'source-a', sourceKey: 'forum-a' });
  const forumBRecord = reviewRecord('review-1', 'critical', { sourceId: 'source-b', sourceKey: 'forum-b' });
  const result = await synthesizeContextReviewResultNotificationEvents({
    contextReviewResultRepository: reviewRepository([forumARecord, forumBRecord], function (query) {
      assert.equal(query.sourceKey, 'forum-a');
      return [forumARecord];
    }),
    notificationEventRepository: eventRepository([], saved),
    sourceKey: 'forum-a',
    execute: true,
    now: '2026-06-21T10:00:00.000Z'
  });
  const otherEvent = createContextReviewResultEvent({ record: forumBRecord });

  assert.equal(result.reviewResultCount, 1);
  assert.equal(result.createdCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].sourceId, 'source-a');
  assert.equal(saved[0].sourceKey, 'forum-a');
  assert.equal(saved[0].payload.sourceId, 'source-a');
  assert.equal(saved[0].payload.sourceKey, 'forum-a');
  assert.notEqual(saved[0].id, otherEvent.id);
});

test('context review result notification synthesis skips acknowledged and delivered events', async function () {
  const record1 = reviewRecord('review-1', 'warning');
  const record2 = reviewRecord('review-2', 'critical');
  const existing = [
    Object.assign(createContextReviewResultEvent({ record: record1 }), {
      acknowledgedAt: '2026-06-21T09:00:00.000Z'
    }),
    Object.assign(createContextReviewResultEvent({ record: record2 }), {
      deliveryStatus: 'delivered'
    })
  ];
  const saved = [];
  const result = await synthesizeContextReviewResultNotificationEvents({
    contextReviewResultRepository: reviewRepository([record1, record2]),
    notificationEventRepository: eventRepository(existing, saved),
    execute: true,
    now: '2026-06-21T10:00:00.000Z'
  });

  assert.equal(result.skippedCount, 2);
  assert.deepEqual(result.results.map(function (item) { return item.reason; }), ['already-acknowledged', 'already-delivered']);
  assert.equal(saved.length, 0);
});

function reviewRecord(id, severity, scope) {
  const safeScope = scope || {};
  return {
    id,
    status: severity === 'info' ? 'accepted' : 'partially-accepted',
    handoffId: 'handoff-' + id,
    sourceId: safeScope.sourceId,
    sourceKey: safeScope.sourceKey,
    reviewer: { id: 'operator-1' },
    submittedAt: '2026-06-21T09:00:00.000Z',
    summary: {
      remainingCount: severity === 'info' ? 0 : 1,
      mergeCandidates: [],
      blockedTasks: [],
      notification: {
        severity,
        reason: severity === 'info' ? 'review-completed' : 'review-has-remaining-tasks'
      },
      recommendedNextAction: 'Review action for ' + id
    }
  };
}

function reviewRepository(records, onList) {
  return {
    async saveReviewResult() {},
    async findReviewResult() {},
    async listReviewResults(query) {
      return onList ? onList(query) : records;
    }
  };
}

function eventRepository(events, saved) {
  return {
    async saveEvent(event) {
      saved.push(event);
    },
    async findEvent(id) {
      return events.find(function (event) {
        return event.id === id;
      });
    },
    async listEvents() {
      return events;
    }
  };
}
