'use strict';

const { assertContextReviewResultRepository } = require('../../application/ports/contextReviewResultRepository');
const { assertPostgresClient } = require('./postgresConnection');

function createPostgresContextReviewResultRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveReviewResult(record) {
      await client.query(
        [
          'insert into context_review_results (id, status, handoff_id, handoff_version, reviewer_id, submitted_at, record)',
          'values ($1,$2,$3,$4,$5,$6,$7)',
          'on conflict (id) do update set',
          'status = excluded.status,',
          'handoff_id = excluded.handoff_id,',
          'handoff_version = excluded.handoff_version,',
          'reviewer_id = excluded.reviewer_id,',
          'submitted_at = excluded.submitted_at,',
          'record = excluded.record'
        ].join(' '),
        [
          record.id,
          record.status,
          record.handoffId,
          record.handoffVersion,
          record.reviewer && record.reviewer.id,
          record.submittedAt || new Date().toISOString(),
          record
        ]
      );
    },

    async findReviewResult(id) {
      const result = await client.query(
        'select record from context_review_results where id = $1',
        [id]
      );
      return result.rows[0] && result.rows[0].record;
    },

    async listReviewResults(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.handoffId) {
        params.push(safeQuery.handoffId);
        where.push('handoff_id = $' + params.length);
      }
      if (safeQuery.status) {
        params.push(safeQuery.status);
        where.push('status = $' + params.length);
      }
      if (safeQuery.reviewerId) {
        params.push(safeQuery.reviewerId);
        where.push('reviewer_id = $' + params.length);
      }
      if (safeQuery.sourceId) {
        params.push(safeQuery.sourceId);
        where.push(sourceIdSql() + ' = $' + params.length);
      }
      if (safeQuery.sourceKey) {
        params.push(safeQuery.sourceKey);
        where.push(sourceKeySql() + ' = $' + params.length);
      }
      if (safeQuery.limit) {
        params.push(Number(safeQuery.limit));
      }
      const result = await client.query(
        'select record from context_review_results' +
          (where.length ? ' where ' + where.join(' and ') : '') +
          ' order by submitted_at desc' +
          (safeQuery.limit ? ' limit $' + params.length : ''),
        params
      );
      return result.rows.map(function (row) {
        return row.record;
      });
    }
  };

  return assertContextReviewResultRepository(repository);
}

function sourceIdSql() {
  return "coalesce(record->>'sourceId', record->'result'->>'sourceId', record->'trace'->>'sourceId')";
}

function sourceKeySql() {
  return "coalesce(record->>'sourceKey', record->'result'->>'sourceKey', record->'result'->>'forum', record->'trace'->>'sourceKey', record->'trace'->>'forum')";
}

module.exports = {
  createPostgresContextReviewResultRepository
};
