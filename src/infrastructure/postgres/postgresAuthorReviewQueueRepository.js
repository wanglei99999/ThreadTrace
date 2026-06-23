'use strict';

const { assertAuthorReviewQueueRepository } = require('../../application/ports/authorReviewQueueRepository');
const { assertPostgresClient } = require('./postgresConnection');
const { pushLimit, toIso } = require('./postgresRows');

function createPostgresAuthorReviewQueueRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveItem(item) {
      await client.query(
        [
          'insert into author_review_queue_items (',
          'id, status, source_key, source_thread_id, type, priority, score, title, first_seen_at, last_seen_at, updated_at, record',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          'on conflict (id) do update set',
          'status = excluded.status,',
          'source_key = excluded.source_key,',
          'source_thread_id = excluded.source_thread_id,',
          'type = excluded.type,',
          'priority = excluded.priority,',
          'score = excluded.score,',
          'title = excluded.title,',
          'first_seen_at = excluded.first_seen_at,',
          'last_seen_at = excluded.last_seen_at,',
          'updated_at = excluded.updated_at,',
          'record = excluded.record'
        ].join(' '),
        [
          item.id,
          item.status,
          item.sourceKey,
          item.sourceThreadId,
          item.type,
          item.priority,
          item.score || 0,
          item.title,
          item.firstSeenAt,
          item.lastSeenAt,
          item.updatedAt,
          item
        ]
      );
    },

    async findItem(id) {
      const result = await client.query(
        'select record from author_review_queue_items where id = $1',
        [id]
      );
      return result.rows[0] && normalizeRecord(result.rows[0].record);
    },

    async listItems(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.status) {
        params.push(safeQuery.status);
        where.push('status = $' + params.length);
      }
      if (safeQuery.sourceKey) {
        params.push(safeQuery.sourceKey);
        where.push('source_key = $' + params.length);
      }
      if (safeQuery.sourceThreadId) {
        params.push(safeQuery.sourceThreadId);
        where.push('source_thread_id = $' + params.length);
      }
      if (safeQuery.type) {
        params.push(safeQuery.type);
        where.push('type = $' + params.length);
      }
      if (safeQuery.priority) {
        params.push(safeQuery.priority);
        where.push('priority = $' + params.length);
      }
      const result = await client.query(
        'select record from author_review_queue_items' +
          (where.length ? ' where ' + where.join(' and ') : '') +
          ' order by updated_at desc' +
          pushLimit(params, safeQuery.limit),
        params
      );
      return result.rows.map(function (row) {
        return normalizeRecord(row.record);
      });
    }
  };

  return assertAuthorReviewQueueRepository(repository);
}

function normalizeRecord(record) {
  if (!record) return record;
  return Object.assign({}, record, {
    firstSeenAt: toIso(record.firstSeenAt),
    lastSeenAt: toIso(record.lastSeenAt),
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt)
  });
}

module.exports = {
  createPostgresAuthorReviewQueueRepository
};
