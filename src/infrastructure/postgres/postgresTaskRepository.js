'use strict';

const { assertTaskRepository } = require('../../application/ports/taskRepository');
const { assertPostgresClient } = require('./postgresConnection');
const { optionalJson, pushLimit, toIso } = require('./postgresRows');

function createPostgresTaskRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveTask(task) {
      await client.query(
        [
          'insert into task_records (',
          'id, type, status, input, output, error, created_at, updated_at, started_at, finished_at',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          'on conflict (id) do update set',
          'type = excluded.type,',
          'status = excluded.status,',
          'input = excluded.input,',
          'output = excluded.output,',
          'error = excluded.error,',
          'updated_at = excluded.updated_at,',
          'started_at = excluded.started_at,',
          'finished_at = excluded.finished_at'
        ].join(' '),
        [
          task.id,
          task.type,
          task.status,
          task.input || {},
          task.output || null,
          task.error || null,
          task.createdAt,
          task.updatedAt,
          task.startedAt || null,
          task.finishedAt || null
        ]
      );
    },

    async findTask(id) {
      const result = await client.query('select * from task_records where id = $1', [id]);
      return result.rows[0] ? rowToTask(result.rows[0]) : undefined;
    },

    async listTasks(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.status) {
        params.push(safeQuery.status);
        where.push('status = $' + params.length);
      }
      if (safeQuery.type) {
        params.push(safeQuery.type);
        where.push('type = $' + params.length);
      }
      const sql = 'select * from task_records' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by created_at desc' +
        pushLimit(params, safeQuery.limit);
      const result = await client.query(sql, params);
      return result.rows.map(rowToTask);
    }
  };

  return assertTaskRepository(repository);
}

function rowToTask(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    input: optionalJson(row.input, {}),
    output: optionalJson(row.output, undefined),
    error: optionalJson(row.error, undefined),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at)
  };
}

module.exports = {
  createPostgresTaskRepository,
  rowToTask
};
