'use strict';

const { assertSourceRepository } = require('../../application/ports/sourceRepository');
const { assertPostgresClient } = require('./postgresConnection');
const { optionalJson, pushLimit, toIso } = require('./postgresRows');
const { DEFAULT_SOURCE_RUN_STALE_AFTER_MS } = require('../../domain/models/trackedSource');

function createPostgresSourceRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveSource(source) {
      await client.query(
        [
          'insert into tracked_sources (',
          'id, source_key, source_type, display_name, location, enabled, tags, schedule, cursor, run_state, created_at, updated_at',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          'on conflict (id) do update set',
          'source_key = excluded.source_key,',
          'source_type = excluded.source_type,',
          'display_name = excluded.display_name,',
          'location = excluded.location,',
          'enabled = excluded.enabled,',
          'tags = excluded.tags,',
          'schedule = excluded.schedule,',
          'cursor = excluded.cursor,',
          'run_state = excluded.run_state,',
          'updated_at = excluded.updated_at'
        ].join(' '),
        [
          source.id,
          source.sourceKey,
          source.sourceType,
          source.displayName,
          source.location || {},
          source.enabled !== false,
          source.tags || [],
          source.schedule || null,
          source.cursor || null,
          source.runState || { status: 'never-run', failureCount: 0 },
          source.createdAt,
          source.updatedAt
        ]
      );
    },

    async findSource(id) {
      const result = await client.query('select * from tracked_sources where id = $1', [id]);
      return result.rows[0] ? rowToSource(result.rows[0]) : undefined;
    },

    async listSources(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.sourceKey) {
        params.push(safeQuery.sourceKey);
        where.push('source_key = $' + params.length);
      }
      if (typeof safeQuery.enabled === 'boolean') {
        params.push(safeQuery.enabled);
        where.push('enabled = $' + params.length);
      }
      const sql = 'select * from tracked_sources' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by display_name asc, id asc' +
        pushLimit(params, safeQuery.limit);
      const result = await client.query(sql, params);
      return result.rows.map(rowToSource);
    },

    async acquireSourceRun(request) {
      const safeRequest = request || {};
      const now = resolveIsoTimestamp(safeRequest.now);
      const staleAfterMs = safeRequest.staleAfterMs === undefined
        ? DEFAULT_SOURCE_RUN_STALE_AFTER_MS
        : Number(safeRequest.staleAfterMs);
      const staleBefore = new Date(Date.parse(now) - staleAfterMs).toISOString();
      const runStatePatch = {
        status: 'running',
        lastStartedAt: now
      };
      const result = await client.query(
        [
          'update tracked_sources set',
          'run_state = coalesce(run_state, \'{}\'::jsonb) || $2::jsonb,',
          'updated_at = $3',
          'where id = $1 and (',
          'run_state ->> \'status\' is distinct from \'running\'',
          'or run_state ->> \'lastStartedAt\' is null',
          'or run_state ->> \'lastStartedAt\' !~ $5',
          'or run_state ->> \'lastStartedAt\' < $4',
          ')',
          'returning *'
        ].join(' '),
        [
          safeRequest.sourceId,
          runStatePatch,
          now,
          staleBefore,
          '^\\d{4}-\\d{2}-\\d{2}T'
        ]
      );
      if (result.rows[0]) {
        return {
          acquired: true,
          source: rowToSource(result.rows[0])
        };
      }
      const existing = await repository.findSource(safeRequest.sourceId);
      return {
        acquired: false,
        source: existing
      };
    }
  };

  return assertSourceRepository(repository);
}

function rowToSource(row) {
  return {
    id: row.id,
    sourceKey: row.source_key,
    sourceType: row.source_type,
    displayName: row.display_name,
    location: optionalJson(row.location, {}),
    enabled: row.enabled !== false,
    tags: optionalJson(row.tags, []),
    schedule: optionalJson(row.schedule, undefined),
    cursor: optionalJson(row.cursor, undefined),
    runState: optionalJson(row.run_state, { status: 'never-run', failureCount: 0 }),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function resolveIsoTimestamp(value) {
  if (value) {
    const time = Date.parse(value);
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return new Date().toISOString();
}

module.exports = {
  createPostgresSourceRepository,
  rowToSource
};
