'use strict';

const { assertRawThreadPageRepository } = require('../../application/ports/rawThreadPageRepository');
const { assertPostgresClient } = require('./postgresConnection');
const { optionalJson, pushLimit, toIso } = require('./postgresRows');

function createPostgresRawThreadPageRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveRawThreadPage(page) {
      await client.query(
        [
          'insert into raw_thread_pages (',
          'source_key, source_thread_id, source_url, page_number, content_encoding, content_sha1, content_text, fetched_at, metadata',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          'on conflict (source_key, content_sha1) do update set',
          'source_thread_id = excluded.source_thread_id,',
          'source_url = excluded.source_url,',
          'page_number = excluded.page_number,',
          'content_encoding = excluded.content_encoding,',
          'content_text = excluded.content_text,',
          'fetched_at = excluded.fetched_at,',
          'metadata = excluded.metadata'
        ].join(' '),
        [
          page.sourceKey,
          page.sourceThreadId || null,
          page.sourceUrl || null,
          page.pageNumber || null,
          page.contentEncoding || null,
          page.contentSha1,
          page.contentText,
          page.fetchedAt,
          page.metadata || {}
        ]
      );
    },

    async findRawThreadPageByHash(query) {
      const result = await client.query(
        'select * from raw_thread_pages where source_key = $1 and content_sha1 = $2',
        [query.sourceKey, query.contentSha1]
      );
      return result.rows[0] ? rowToRawThreadPage(result.rows[0]) : undefined;
    },

    async listRawThreadPages(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.sourceKey) {
        params.push(safeQuery.sourceKey);
        where.push('source_key = $' + params.length);
      }
      if (safeQuery.sourceThreadId) {
        params.push(safeQuery.sourceThreadId);
        where.push('source_thread_id = $' + params.length);
      }
      if (safeQuery.sourceUrl) {
        params.push(safeQuery.sourceUrl);
        where.push('source_url = $' + params.length);
      }
      const sql = 'select * from raw_thread_pages' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by fetched_at desc' +
        pushLimit(params, safeQuery.limit);
      const result = await client.query(sql, params);
      return result.rows.map(rowToRawThreadPage);
    }
  };

  return assertRawThreadPageRepository(repository);
}

function rowToRawThreadPage(row) {
  return {
    id: row.id,
    sourceKey: row.source_key,
    sourceThreadId: row.source_thread_id || undefined,
    sourceUrl: row.source_url || undefined,
    pageNumber: row.page_number || undefined,
    contentEncoding: row.content_encoding || undefined,
    contentSha1: row.content_sha1,
    contentText: row.content_text,
    fetchedAt: toIso(row.fetched_at),
    metadata: optionalJson(row.metadata, {})
  };
}

module.exports = {
  createPostgresRawThreadPageRepository,
  rowToRawThreadPage
};
