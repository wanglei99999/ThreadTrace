'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createPostgresAuthorReviewQueueRepository } = require('../src/infrastructure/postgres/postgresAuthorReviewQueueRepository');

test('postgres author review queue repository upserts and filters records', async function () {
  const queries = [];
  const repository = createPostgresAuthorReviewQueueRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        if (/select record from author_review_queue_items where id/.test(sql)) {
          return {
            rows: [
              {
                record: sampleItem()
              }
            ]
          };
        }
        if (/select record from author_review_queue_items/.test(sql)) {
          return {
            rows: [
              {
                record: sampleItem()
              }
            ]
          };
        }
        return { rows: [] };
      }
    }
  });

  await repository.saveItem(sampleItem());
  const found = await repository.findItem('author-review:test');
  const listed = await repository.listItems({
    status: 'open',
    sourceKey: 'forum-a',
    sourceThreadId: 'thread-1',
    type: 'high-confidence-opinion',
    priority: 'medium',
    limit: 5
  });

  assert.match(queries[0].sql, /insert into author_review_queue_items/);
  assert.match(queries[0].sql, /on conflict \(id\) do update/);
  assert.equal(queries[0].params[0], 'author-review:test');
  assert.equal(queries[0].params[1], 'open');
  assert.match(queries[2].sql, /status = \$1/);
  assert.match(queries[2].sql, /source_key = \$2/);
  assert.match(queries[2].sql, /source_thread_id = \$3/);
  assert.match(queries[2].sql, /type = \$4/);
  assert.match(queries[2].sql, /priority = \$5/);
  assert.deepEqual(queries[2].params, ['open', 'forum-a', 'thread-1', 'high-confidence-opinion', 'medium', 5]);
  assert.equal(found.id, 'author-review:test');
  assert.equal(listed[0].sourceThreadId, 'thread-1');
});

function sampleItem() {
  return {
    id: 'author-review:test',
    status: 'open',
    sourceKey: 'forum-a',
    sourceThreadId: 'thread-1',
    type: 'high-confidence-opinion',
    priority: 'medium',
    score: 78,
    title: 'Validate opinion',
    firstSeenAt: '2026-06-23T10:00:00.000Z',
    lastSeenAt: '2026-06-23T10:00:00.000Z',
    createdAt: '2026-06-23T10:00:00.000Z',
    updatedAt: '2026-06-23T10:00:00.000Z',
    refs: []
  };
}
