'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const { createFileAuthorReviewQueueRepository } = require('../src/infrastructure/storage/fileAuthorReviewQueueRepository');
const { syncAuthorReviewQueue } = require('../src/application/use-cases/syncAuthorReviewQueue');
const { listAuthorReviewQueue } = require('../src/application/use-cases/listAuthorReviewQueue');
const { updateAuthorReviewQueueItemStatus } = require('../src/application/use-cases/updateAuthorReviewQueueItemStatus');

test('author review queue sync persists durable records and status updates', async function () {
  const baseDir = path.join(process.cwd(), '.tmp', 'author-review-queue-test');
  await fs.rm(baseDir, { recursive: true, force: true });
  const repository = createFileAuthorReviewQueueRepository({ baseDir });
  const dashboard = sampleDashboard();

  const firstSync = await syncAuthorReviewQueue({
    now: '2026-06-23T10:00:00.000Z',
    dashboard,
    authorReviewQueueRepository: repository
  });
  const secondSync = await syncAuthorReviewQueue({
    now: '2026-06-23T10:05:00.000Z',
    dashboard,
    authorReviewQueueRepository: repository
  });
  const listed = await listAuthorReviewQueue({
    now: '2026-06-23T10:06:00.000Z',
    authorReviewQueueRepository: repository
  });
  const confirmed = await updateAuthorReviewQueueItemStatus({
    now: '2026-06-23T10:07:00.000Z',
    itemId: listed.items[0].id,
    status: 'confirmed',
    reviewedBy: 'operator',
    note: 'source floor checked',
    authorReviewQueueRepository: repository
  });
  const openOnly = await listAuthorReviewQueue({
    status: 'open',
    authorReviewQueueRepository: repository
  });
  const confirmedOnly = await listAuthorReviewQueue({
    status: 'confirmed',
    authorReviewQueueRepository: repository
  });

  assert.equal(firstSync.createdCount, 2);
  assert.equal(firstSync.updatedCount, 0);
  assert.equal(secondSync.createdCount, 0);
  assert.equal(secondSync.updatedCount, 2);
  assert.equal(listed.itemCount, 2);
  assert.equal(listed.summary.byStatus.open, 2);
  assert.equal(listed.items[0].seenCount, 2);
  assert.equal(listed.items[0].sourceKey, 'forum-a');
  assert.equal(listed.items[0].sourceThreadId, 'thread-1');
  assert.equal(confirmed.item.status, 'confirmed');
  assert.equal(confirmed.item.review.reviewedBy, 'operator');
  assert.equal(confirmed.item.review.note, 'source floor checked');
  assert.equal(openOnly.itemCount, 1);
  assert.equal(confirmedOnly.itemCount, 1);

  await fs.rm(baseDir, { recursive: true, force: true });
});

function sampleDashboard() {
  return {
    generatedAt: '2026-06-23T09:59:00.000Z',
    status: 'ok',
    sourceKey: 'forum-a',
    revisionMode: 'latest-per-thread',
    reportType: 'basic-history',
    reportCount: 1,
    reportRevisionCount: 1,
    recommendedNextAction: 'Work the queue.',
    reviewQueue: [
      {
        key: 'opinion:thread-1:3',
        type: 'high-confidence-opinion',
        priority: 'medium',
        score: 78,
        title: 'Validate high-confidence opinion from Alice',
        summary: 'Alpha looks strong.',
        reason: 'high-confidence-opinion',
        nextAction: 'Confirm floor.',
        author: { sourceAuthorId: 'author-1', displayName: 'Alice' },
        refs: [
          {
            sourceKey: 'forum-a',
            sourceThreadId: 'thread-1',
            floor: 3,
            sourcePostId: 'thread-1-p3'
          }
        ]
      },
      {
        key: 'gap:thread-1:alpha',
        type: 'evidence-gap',
        priority: 'high',
        score: 100,
        title: 'Review evidence gap for Alpha',
        summary: 'Needs explicit support.',
        reason: 'contains-inferred-opinion-link',
        nextAction: 'Open floor range.',
        entity: { type: 'stock', normalized: 'alpha', displayName: 'Alpha' },
        refs: [
          {
            sourceKey: 'forum-a',
            sourceThreadId: 'thread-1',
            floor: 0
          }
        ]
      }
    ]
  };
}
