'use strict';

const { assertWorkerRunRepository } = require('../../application/ports/workerRunRepository');
const { deriveWorkerRunSourceScope } = require('../../domain/models/workerRun');
const { assertPostgresClient } = require('./postgresConnection');
const { optionalJson, pushLimit, toIso } = require('./postgresRows');

function createPostgresWorkerRunRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveWorkerRun(run) {
      const scope = deriveWorkerRunSourceScope(run);
      await client.query(
        [
          'insert into worker_runs (',
          'id, worker_type, worker_id, status, source_id, source_key, input, progress, output, error, started_at, updated_at, heartbeat_at, finished_at',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
          'on conflict (id) do update set',
          'worker_type = excluded.worker_type,',
          'worker_id = excluded.worker_id,',
          'status = excluded.status,',
          'source_id = excluded.source_id,',
          'source_key = excluded.source_key,',
          'input = excluded.input,',
          'progress = excluded.progress,',
          'output = excluded.output,',
          'error = excluded.error,',
          'updated_at = excluded.updated_at,',
          'heartbeat_at = excluded.heartbeat_at,',
          'finished_at = excluded.finished_at'
        ].join(' '),
        [
          run.id,
          run.workerType,
          run.workerId,
          run.status,
          scope.sourceId || null,
          scope.sourceKey || null,
          run.input || {},
          run.progress || {},
          run.output || null,
          run.error || null,
          run.startedAt,
          run.updatedAt,
          run.heartbeatAt,
          run.finishedAt || null
        ]
      );
    },

    async findWorkerRun(id) {
      const result = await client.query('select * from worker_runs where id = $1', [id]);
      return result.rows[0] ? rowToWorkerRun(result.rows[0]) : undefined;
    },

    async listWorkerRuns(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.workerType) {
        params.push(safeQuery.workerType);
        where.push('worker_type = $' + params.length);
      }
      if (safeQuery.status) {
        params.push(safeQuery.status);
        where.push('status = $' + params.length);
      }
      if (safeQuery.sourceId) {
        params.push(safeQuery.sourceId);
        where.push('source_id = $' + params.length);
      }
      if (safeQuery.sourceKey) {
        params.push(safeQuery.sourceKey);
        where.push('source_key = $' + params.length);
      }
      const sql = 'select * from worker_runs' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by started_at desc' +
        pushLimit(params, safeQuery.limit);
      const result = await client.query(sql, params);
      return result.rows.map(rowToWorkerRun);
    }
  };

  return assertWorkerRunRepository(repository);
}

function rowToWorkerRun(row) {
  return {
    id: row.id,
    workerType: row.worker_type,
    workerId: row.worker_id,
    status: row.status,
    scope: deriveWorkerRunSourceScope({
      sourceId: row.source_id,
      sourceKey: row.source_key,
      input: optionalJson(row.input, {})
    }),
    input: optionalJson(row.input, {}),
    progress: optionalJson(row.progress, {}),
    output: optionalJson(row.output, undefined),
    error: optionalJson(row.error, undefined),
    startedAt: toIso(row.started_at),
    updatedAt: toIso(row.updated_at),
    heartbeatAt: toIso(row.heartbeat_at),
    finishedAt: toIso(row.finished_at)
  };
}

module.exports = {
  createPostgresWorkerRunRepository,
  rowToWorkerRun
};
