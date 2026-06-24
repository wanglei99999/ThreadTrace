'use strict';

const {
  assertContextReviewActionExecutionRepository
} = require('../../application/ports/contextReviewActionExecutionRepository');
const { assertPostgresClient } = require('./postgresConnection');
const { optionalJson, pushLimit, toIso } = require('./postgresRows');

function createPostgresContextReviewActionExecutionRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async claimExecution(record) {
      const safeRecord = record || {};
      if (!safeRecord.key) throw new Error('Context review action execution record requires key.');
      const createdAt = safeRecord.createdAt || safeRecord.now || new Date().toISOString();
      const insertResult = await client.query(
        [
          'insert into context_review_action_executions (',
          'execution_key, action, status, task_id, request_hash, request, attempt_count, created_at, updated_at',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          'on conflict (execution_key) do nothing',
          'returning *'
        ].join(' '),
        [
          safeRecord.key,
          safeRecord.action,
          'running',
          safeRecord.taskId || null,
          safeRecord.requestHash,
          safeRecord.request || {},
          1,
          createdAt,
          safeRecord.updatedAt || safeRecord.now || createdAt
        ]
      );
      if (insertResult.rows[0]) {
        return {
          claimed: true,
          record: rowToExecution(insertResult.rows[0])
        };
      }

      const existing = await repository.findExecution(safeRecord.key);
      if (existing && (existing.status === 'completed' || existing.status === 'running')) {
        return {
          claimed: false,
          record: existing
        };
      }

      const retryResult = await client.query(
        [
          'update context_review_action_executions set',
          'status = $2,',
          'task_id = $3,',
          'request_hash = $4,',
          'request = $5,',
          'attempt_count = attempt_count + 1,',
          'updated_at = $6,',
          'completed_at = null,',
          'failed_at = null',
          'where execution_key = $1 and status = $7',
          'returning *'
        ].join(' '),
        [
          safeRecord.key,
          'running',
          safeRecord.taskId || null,
          safeRecord.requestHash,
          safeRecord.request || {},
          safeRecord.updatedAt || safeRecord.now || new Date().toISOString(),
          'failed'
        ]
      );
      if (retryResult.rows[0]) {
        return {
          claimed: true,
          record: rowToExecution(retryResult.rows[0])
        };
      }
      return {
        claimed: false,
        record: await repository.findExecution(safeRecord.key)
      };
    },

    async completeExecution(key, result, metadata) {
      const safeMetadata = metadata || {};
      const updatedAt = safeMetadata.updatedAt || safeMetadata.now || new Date().toISOString();
      const queryResult = await client.query(
        [
          'update context_review_action_executions set',
          'status = $2,',
          'result = $3,',
          'error = null,',
          'task_id = coalesce($4, task_id),',
          'updated_at = $5,',
          'completed_at = $6',
          'where execution_key = $1',
          'returning *'
        ].join(' '),
        [
          key,
          'completed',
          result || {},
          safeMetadata.taskId || null,
          updatedAt,
          safeMetadata.completedAt || safeMetadata.now || updatedAt
        ]
      );
      return queryResult.rows[0] ? rowToExecution(queryResult.rows[0]) : undefined;
    },

    async failExecution(key, error, metadata) {
      const safeMetadata = metadata || {};
      const updatedAt = safeMetadata.updatedAt || safeMetadata.now || new Date().toISOString();
      const queryResult = await client.query(
        [
          'update context_review_action_executions set',
          'status = $2,',
          'error = $3,',
          'task_id = coalesce($4, task_id),',
          'updated_at = $5,',
          'failed_at = $6',
          'where execution_key = $1',
          'returning *'
        ].join(' '),
        [
          key,
          'failed',
          {
            message: error && error.message ? error.message : String(error || 'Unknown error'),
            stack: error && error.stack
          },
          safeMetadata.taskId || null,
          updatedAt,
          safeMetadata.failedAt || safeMetadata.now || updatedAt
        ]
      );
      return queryResult.rows[0] ? rowToExecution(queryResult.rows[0]) : undefined;
    },

    async findExecution(key) {
      const queryResult = await client.query('select * from context_review_action_executions where execution_key = $1', [key]);
      return queryResult.rows[0] ? rowToExecution(queryResult.rows[0]) : undefined;
    },

    async listExecutions(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.action) {
        params.push(safeQuery.action);
        where.push('action = $' + params.length);
      }
      if (safeQuery.status) {
        params.push(safeQuery.status);
        where.push('status = $' + params.length);
      }
      if (safeQuery.taskId) {
        params.push(safeQuery.taskId);
        where.push('task_id = $' + params.length);
      }
      if (safeQuery.sourceId) {
        params.push(safeQuery.sourceId);
        where.push(sourceIdSql() + ' = $' + params.length);
      }
      if (safeQuery.sourceKey) {
        params.push(safeQuery.sourceKey);
        where.push(sourceKeySql() + ' = $' + params.length);
      }
      const sql = 'select * from context_review_action_executions' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by updated_at desc' +
        pushLimit(params, safeQuery.limit);
      const queryResult = await client.query(sql, params);
      return queryResult.rows.map(rowToExecution);
    }
  };

  return assertContextReviewActionExecutionRepository(repository);
}

function rowToExecution(row) {
  return {
    key: row.execution_key,
    action: row.action,
    status: row.status,
    taskId: row.task_id || undefined,
    requestHash: row.request_hash,
    request: optionalJson(row.request, {}),
    result: optionalJson(row.result, undefined),
    error: optionalJson(row.error, undefined),
    attemptCount: row.attempt_count || 0,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    completedAt: toIso(row.completed_at),
    failedAt: toIso(row.failed_at)
  };
}

function sourceIdSql() {
  return "coalesce(request->>'sourceId', request->'actionGate'->>'sourceId', request->'actionGate'->'actionPlan'->>'sourceId')";
}

function sourceKeySql() {
  return "coalesce(request->>'sourceKey', request->'actionGate'->>'sourceKey', request->'actionGate'->'actionPlan'->>'sourceKey')";
}

module.exports = {
  createPostgresContextReviewActionExecutionRepository,
  rowToExecution
};
