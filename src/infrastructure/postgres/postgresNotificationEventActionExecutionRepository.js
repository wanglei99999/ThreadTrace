'use strict';

const {
  assertNotificationEventActionExecutionRepository
} = require('../../application/ports/notificationEventActionExecutionRepository');
const { assertPostgresClient } = require('./postgresConnection');
const { optionalJson, pushLimit, toIso } = require('./postgresRows');

function createPostgresNotificationEventActionExecutionRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async claimExecution(record) {
      const safeRecord = record || {};
      if (!safeRecord.key) throw new Error('Notification event action execution record requires key.');
      const sourceScope = safeRecord.sourceScope || {};
      const createdAt = safeRecord.createdAt || safeRecord.now || new Date().toISOString();
      const updatedAt = safeRecord.updatedAt || safeRecord.now || createdAt;
      const insertResult = await client.query(
        [
          'insert into notification_event_action_executions (',
          'execution_key, action_key, status, event_id, actor, source_id, source_key, source_scope, request_hash, intent, attempt_count, created_at, updated_at',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
          'on conflict (execution_key) do nothing',
          'returning *'
        ].join(' '),
        [
          safeRecord.key,
          safeRecord.actionKey,
          'running',
          safeRecord.eventId,
          safeRecord.actor || null,
          safeRecord.sourceId || sourceScope.sourceId || null,
          safeRecord.sourceKey || sourceScope.sourceKey || null,
          sourceScope,
          safeRecord.requestHash,
          safeRecord.intent || {},
          1,
          createdAt,
          updatedAt
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
          'update notification_event_action_executions set',
          'status = $2,',
          'action_key = $3,',
          'event_id = $4,',
          'actor = $5,',
          'source_id = $6,',
          'source_key = $7,',
          'source_scope = $8,',
          'request_hash = $9,',
          'intent = $10,',
          'attempt_count = attempt_count + 1,',
          'updated_at = $11,',
          'completed_at = null,',
          'failed_at = null',
          'where execution_key = $1 and status = $12',
          'returning *'
        ].join(' '),
        [
          safeRecord.key,
          'running',
          safeRecord.actionKey,
          safeRecord.eventId,
          safeRecord.actor || null,
          safeRecord.sourceId || sourceScope.sourceId || null,
          safeRecord.sourceKey || sourceScope.sourceKey || null,
          sourceScope,
          safeRecord.requestHash,
          safeRecord.intent || {},
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
      const sourceScope = safeMetadata.sourceScope || {};
      const updatedAt = safeMetadata.updatedAt || safeMetadata.now || new Date().toISOString();
      const queryResult = await client.query(
        [
          'update notification_event_action_executions set',
          'status = $2,',
          'result = $3,',
          'error = null,',
          'event_id = coalesce($4, event_id),',
          'action_key = coalesce($5, action_key),',
          'actor = coalesce($6, actor),',
          'source_id = coalesce($7, source_id),',
          'source_key = coalesce($8, source_key),',
          'source_scope = case when $9::jsonb = \'{}\'::jsonb then source_scope else $9::jsonb end,',
          'updated_at = $10,',
          'completed_at = $11',
          'where execution_key = $1',
          'returning *'
        ].join(' '),
        [
          key,
          'completed',
          result || {},
          safeMetadata.eventId || null,
          safeMetadata.actionKey || null,
          safeMetadata.actor || null,
          safeMetadata.sourceId || sourceScope.sourceId || null,
          safeMetadata.sourceKey || sourceScope.sourceKey || null,
          sourceScope,
          updatedAt,
          safeMetadata.completedAt || safeMetadata.now || updatedAt
        ]
      );
      return queryResult.rows[0] ? rowToExecution(queryResult.rows[0]) : undefined;
    },

    async failExecution(key, error, metadata) {
      const safeMetadata = metadata || {};
      const sourceScope = safeMetadata.sourceScope || {};
      const updatedAt = safeMetadata.updatedAt || safeMetadata.now || new Date().toISOString();
      const queryResult = await client.query(
        [
          'update notification_event_action_executions set',
          'status = $2,',
          'error = $3,',
          'event_id = coalesce($4, event_id),',
          'action_key = coalesce($5, action_key),',
          'actor = coalesce($6, actor),',
          'source_id = coalesce($7, source_id),',
          'source_key = coalesce($8, source_key),',
          'source_scope = case when $9::jsonb = \'{}\'::jsonb then source_scope else $9::jsonb end,',
          'updated_at = $10,',
          'failed_at = $11',
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
          safeMetadata.eventId || null,
          safeMetadata.actionKey || null,
          safeMetadata.actor || null,
          safeMetadata.sourceId || sourceScope.sourceId || null,
          safeMetadata.sourceKey || sourceScope.sourceKey || null,
          sourceScope,
          updatedAt,
          safeMetadata.failedAt || safeMetadata.now || updatedAt
        ]
      );
      return queryResult.rows[0] ? rowToExecution(queryResult.rows[0]) : undefined;
    },

    async findExecution(key) {
      const queryResult = await client.query('select * from notification_event_action_executions where execution_key = $1', [key]);
      return queryResult.rows[0] ? rowToExecution(queryResult.rows[0]) : undefined;
    },

    async listExecutions(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.eventId) {
        params.push(safeQuery.eventId);
        where.push('event_id = $' + params.length);
      }
      if (safeQuery.actionKey) {
        params.push(safeQuery.actionKey);
        where.push('action_key = $' + params.length);
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
      if (safeQuery.actor) {
        params.push(safeQuery.actor);
        where.push('actor = $' + params.length);
      }
      const sql = 'select * from notification_event_action_executions' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by updated_at desc' +
        pushLimit(params, safeQuery.limit);
      const queryResult = await client.query(sql, params);
      return queryResult.rows.map(rowToExecution);
    }
  };

  return assertNotificationEventActionExecutionRepository(repository);
}

function rowToExecution(row) {
  return {
    key: row.execution_key,
    type: 'notification-event-action-execution',
    actionKey: row.action_key,
    status: row.status,
    eventId: row.event_id,
    actor: row.actor || undefined,
    sourceId: row.source_id || undefined,
    sourceKey: row.source_key || undefined,
    sourceScope: optionalJson(row.source_scope, {}),
    requestHash: row.request_hash,
    intent: optionalJson(row.intent, {}),
    result: optionalJson(row.result, undefined),
    error: optionalJson(row.error, undefined),
    attemptCount: row.attempt_count || 0,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    completedAt: toIso(row.completed_at),
    failedAt: toIso(row.failed_at)
  };
}

module.exports = {
  createPostgresNotificationEventActionExecutionRepository,
  rowToExecution
};
