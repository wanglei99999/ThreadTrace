'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createPostgresNotificationEventActionExecutionRepository,
  rowToExecution
} = require('../src/infrastructure/postgres/postgresNotificationEventActionExecutionRepository');
const { createPostgresRepositories } = require('../src/infrastructure/postgres/postgresRepositories');

test('postgres notification event action execution repository claims new executions', async function () {
  const queries = [];
  const repository = createPostgresNotificationEventActionExecutionRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        return {
          rows: [
            {
              execution_key: params[0],
              action_key: params[1],
              status: 'running',
              event_id: params[3],
              actor: params[4],
              source_id: params[5],
              source_key: params[6],
              source_scope: params[7],
              request_hash: params[8],
              intent: params[9],
              attempt_count: 1,
              created_at: params[11],
              updated_at: params[12]
            }
          ]
        };
      }
    }
  });

  const result = await repository.claimExecution({
    key: 'notification-event-action:v1:event-1:event.acknowledge',
    actionKey: 'event.acknowledge',
    eventId: 'event-1',
    actor: 'operator-a',
    sourceScope: {
      sourceId: 'source-1',
      sourceKey: 'nga'
    },
    requestHash: 'hash',
    intent: {
      intent: {
        id: 'intent-1'
      }
    },
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.claimed, true);
  assert.equal(result.record.key, 'notification-event-action:v1:event-1:event.acknowledge');
  assert.equal(result.record.status, 'running');
  assert.equal(result.record.sourceKey, 'nga');
  assert.match(queries[0].sql, /insert into notification_event_action_executions/);
  assert.match(queries[0].sql, /on conflict \(execution_key\) do nothing/);
});

test('postgres notification event action execution repository replays completed claims', async function () {
  const rowsByKey = new Map([
    ['notification-event-action:v1:event-1:event.acknowledge', {
      execution_key: 'notification-event-action:v1:event-1:event.acknowledge',
      action_key: 'event.acknowledge',
      status: 'completed',
      event_id: 'event-1',
      actor: 'operator-a',
      source_id: 'source-1',
      source_key: 'nga',
      source_scope: {
        sourceId: 'source-1',
        sourceKey: 'nga'
      },
      request_hash: 'hash',
      intent: {
        intent: {
          id: 'intent-1'
        }
      },
      result: {
        event: {
          id: 'event-1',
          acknowledgedAt: '2026-06-25T10:01:00.000Z'
        }
      },
      attempt_count: 1,
      created_at: '2026-06-25T10:00:00.000Z',
      updated_at: '2026-06-25T10:01:00.000Z',
      completed_at: '2026-06-25T10:01:00.000Z'
    }]
  ]);
  const repository = createPostgresNotificationEventActionExecutionRepository({
    client: {
      async query(sql, params) {
        if (/insert into notification_event_action_executions/.test(sql)) return { rows: [] };
        if (/select \* from notification_event_action_executions where execution_key/.test(sql)) {
          return { rows: [rowsByKey.get(params[0])] };
        }
        throw new Error('Unexpected SQL: ' + sql);
      }
    }
  });

  const result = await repository.claimExecution({
    key: 'notification-event-action:v1:event-1:event.acknowledge',
    actionKey: 'event.acknowledge',
    eventId: 'event-1',
    actor: 'operator-b',
    requestHash: 'hash',
    intent: {},
    now: '2026-06-25T10:05:00.000Z'
  });

  assert.equal(result.claimed, false);
  assert.equal(result.record.status, 'completed');
  assert.equal(result.record.result.event.acknowledgedAt, '2026-06-25T10:01:00.000Z');
});

test('postgres notification event action execution row mapper normalizes timestamps', function () {
  const execution = rowToExecution({
    execution_key: 'key-1',
    action_key: 'event.acknowledge',
    status: 'failed',
    event_id: 'event-1',
    actor: 'operator-a',
    source_id: 'source-1',
    source_key: 'nga',
    source_scope: {
      sourceId: 'source-1',
      sourceKey: 'nga'
    },
    request_hash: 'hash',
    intent: {},
    error: { message: 'boom' },
    attempt_count: 2,
    created_at: new Date('2026-06-25T10:00:00.000Z'),
    updated_at: new Date('2026-06-25T10:01:00.000Z'),
    failed_at: new Date('2026-06-25T10:01:00.000Z')
  });

  assert.equal(execution.key, 'key-1');
  assert.equal(execution.type, 'notification-event-action-execution');
  assert.equal(execution.actionKey, 'event.acknowledge');
  assert.equal(execution.sourceKey, 'nga');
  assert.equal(execution.attemptCount, 2);
  assert.equal(execution.createdAt, '2026-06-25T10:00:00.000Z');
  assert.equal(execution.failedAt, '2026-06-25T10:01:00.000Z');
});

test('postgres notification event action execution repository filters by event source and actor', async function () {
  const queries = [];
  const repository = createPostgresNotificationEventActionExecutionRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        return {
          rows: [
            {
              execution_key: 'notification-event-action:v1:event-1:event.acknowledge',
              action_key: 'event.acknowledge',
              status: 'completed',
              event_id: 'event-1',
              actor: 'operator-a',
              source_id: 'source-1',
              source_key: 'nga',
              source_scope: {
                sourceId: 'source-1',
                sourceKey: 'nga'
              },
              request_hash: 'hash',
              intent: {},
              attempt_count: 1,
              created_at: '2026-06-25T10:00:00.000Z',
              updated_at: '2026-06-25T10:01:00.000Z'
            }
          ]
        };
      }
    }
  });

  const executions = await repository.listExecutions({
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    status: 'completed',
    sourceId: 'source-1',
    sourceKey: 'nga',
    actor: 'operator-a',
    limit: 5
  });

  assert.match(queries[0].sql, /event_id = \$1/);
  assert.match(queries[0].sql, /action_key = \$2/);
  assert.match(queries[0].sql, /status = \$3/);
  assert.match(queries[0].sql, /source_id = \$4/);
  assert.match(queries[0].sql, /source_key = \$5/);
  assert.match(queries[0].sql, /actor = \$6/);
  assert.deepEqual(queries[0].params, ['event-1', 'event.acknowledge', 'completed', 'source-1', 'nga', 'operator-a', 5]);
  assert.equal(executions[0].sourceKey, 'nga');
});

test('postgres repository factory exposes notification event action execution repository', function () {
  const repositories = createPostgresRepositories({
    client: {
      async query() {
        return { rows: [] };
      }
    }
  });

  assert.equal(typeof repositories.notificationEventActionExecutionRepository.claimExecution, 'function');
  assert.equal(typeof repositories.notificationEventActionExecutionRepository.listExecutions, 'function');
});
