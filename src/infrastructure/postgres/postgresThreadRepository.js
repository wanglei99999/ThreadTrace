'use strict';

const { assertThreadRepository } = require('../../application/ports/threadRepository');
const { assertPostgresClient } = require('./postgresConnection');

function createPostgresThreadRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveSnapshot(snapshot) {
      const lastPost = lastSnapshotPost(snapshot);
      await client.query(
        [
          'insert into thread_snapshots (',
          'source_key, source_thread_id, title, url, post_count, last_floor, last_post_id, captured_at, snapshot',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          'on conflict (source_key, source_thread_id) do update set',
          'title = excluded.title,',
          'url = excluded.url,',
          'post_count = excluded.post_count,',
          'last_floor = excluded.last_floor,',
          'last_post_id = excluded.last_post_id,',
          'captured_at = excluded.captured_at,',
          'snapshot = excluded.snapshot'
        ].join(' '),
        [
          snapshot.sourceKey,
          snapshot.sourceThreadId,
          snapshot.title,
          snapshot.url || null,
          (snapshot.posts || []).length,
          lastPost ? lastPost.floor : null,
          lastPost ? lastPost.sourcePostId : null,
          new Date().toISOString(),
          snapshot
        ]
      );
    },

    async findSnapshot(query) {
      const result = await client.query(
        'select snapshot from thread_snapshots where source_key = $1 and source_thread_id = $2',
        [query.sourceKey, query.sourceThreadId]
      );
      return result.rows[0] ? result.rows[0].snapshot : undefined;
    },

    async listSnapshots(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.sourceKey) {
        params.push(safeQuery.sourceKey);
        where.push('source_key = $' + params.length);
      }
      if (safeQuery.authorId) {
        params.push(safeQuery.authorId);
        where.push('snapshot @> jsonb_build_object(\'posts\', jsonb_build_array(jsonb_build_object(\'author\', jsonb_build_object(\'sourceAuthorId\', $' + params.length + '))))');
      }
      if (safeQuery.limit) {
        params.push(Number(safeQuery.limit));
      }
      const sql = 'select snapshot from thread_snapshots' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by source_thread_id asc' +
        (safeQuery.limit ? ' limit $' + params.length : '');
      const result = await client.query(sql, params);
      return result.rows.map(function (row) {
        return row.snapshot;
      });
    }
  };

  return assertThreadRepository(repository);
}

function lastSnapshotPost(snapshot) {
  const posts = snapshot.posts || [];
  if (posts.length === 0) return undefined;
  return posts[posts.length - 1];
}

module.exports = {
  createPostgresThreadRepository
};
