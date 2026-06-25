'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { executeNotificationEventAction } = require('../src/application/use-cases/executeNotificationEventAction');
const { prepareNotificationEventActionIntent } = require('../src/application/use-cases/prepareNotificationEventActionIntent');

test('notification event action intent builds dry-run acknowledge plan', async function () {
  const savedRecords = [];
  const intent = await prepareNotificationEventActionIntent({
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    actor: 'operator-1',
    reason: 'reviewed',
    now: '2026-06-25T11:00:00.000Z',
    notificationEventRepository: eventRepository([notificationEvent({
      id: 'event-1',
      sourceId: 'source-1',
      sourceKey: 'nga',
      taskId: 'task-1'
    })]),
    notificationEventActionIntentRepository: intentRepository(savedRecords),
    taskRepository: taskRepository([{
      id: 'task-1',
      type: 'source-ingest',
      status: 'completed',
      createdAt: '2026-06-25T10:00:00.000Z'
    }])
  });

  assert.equal(intent.generatedAt, '2026-06-25T11:00:00.000Z');
  assert.equal(intent.mode, 'dry-run');
  assert.equal(intent.dryRun, true);
  assert.equal(intent.executed, false);
  assert.equal(intent.status, 'ok');
  assert.equal(intent.event.id, 'event-1');
  assert.equal(intent.action.key, 'event.acknowledge');
  assert.equal(intent.intent.id, 'event-action-intent:event-1:event.acknowledge');
  assert.equal(intent.intent.actor, 'operator-1');
  assert.equal(intent.intent.reason, 'reviewed');
  assert.equal(intent.intent.api.method, 'POST');
  assert.equal(intent.intent.api.path, '/api/events/event-1/ack');
  assert.equal(intent.intent.audit.required, true);
  assert.equal(intent.intent.audit.dryRunOnly, true);
  assert.equal(intent.readinessGate.key, 'event.acknowledge');
  assert.equal(intent.ledger.recorded, true);
  assert.equal(intent.ledger.recordId, savedRecords[0].id);
  assert.equal(savedRecords.length, 1);
  assert.equal(savedRecords[0].eventId, 'event-1');
  assert.equal(savedRecords[0].actionKey, 'event.acknowledge');
});

test('notification event action intent rejects unavailable actions', async function () {
  await assert.rejects(function () {
    return prepareNotificationEventActionIntent({
      eventId: 'event-1',
      actionKey: 'event.archive',
      notificationEventRepository: eventRepository([notificationEvent({
        id: 'event-1',
        deliveryStatus: 'pending'
      })])
    });
  }, function (error) {
    assert.equal(error.code, 'event_action_not_available');
    assert.equal(error.statusCode, 409);
    assert.deepEqual(error.details.availableActionKeys, ['event.acknowledge', 'event.dispatch']);
    return true;
  });
});

test('notification event action execution defaults to dry-run preview', async function () {
  const savedIntents = [];
  const executions = executionRepository();
  const result = await executeNotificationEventAction({
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    actor: 'operator-1',
    now: '2026-06-25T11:00:00.000Z',
    notificationEventRepository: eventRepository([notificationEvent({
      id: 'event-1'
    })]),
    notificationEventActionIntentRepository: intentRepository(savedIntents),
    notificationEventActionExecutionRepository: executions
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.executed, false);
  assert.equal(result.executionLedger.recorded, false);
  assert.equal(savedIntents.length, 1);
  assert.equal((await executions.listExecutions()).length, 0);
});

test('notification event action execution acknowledges event and replays completed ledger', async function () {
  const events = [notificationEvent({
    id: 'event-1',
    sourceId: 'source-1',
    sourceKey: 'nga'
  })];
  const repository = eventRepository(events);
  const executions = executionRepository();

  const result = await executeNotificationEventAction({
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    actor: 'operator-1',
    note: 'handled',
    execute: true,
    now: '2026-06-25T11:00:00.000Z',
    notificationEventRepository: repository,
    notificationEventActionIntentRepository: intentRepository([]),
    notificationEventActionExecutionRepository: executions
  });
  const replay = await executeNotificationEventAction({
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    actor: 'operator-1',
    note: 'handled',
    execute: true,
    now: '2026-06-25T11:01:00.000Z',
    notificationEventRepository: repository,
    notificationEventActionIntentRepository: intentRepository([]),
    notificationEventActionExecutionRepository: executions
  });

  assert.equal(result.mode, 'execute');
  assert.equal(result.dryRun, false);
  assert.equal(result.executed, true);
  assert.equal(result.event.acknowledgedAt, '2026-06-25T11:00:00.000Z');
  assert.equal(result.event.acknowledgedBy, 'operator-1');
  assert.equal(result.event.acknowledgementNote, 'handled');
  assert.equal(result.executionLedger.recorded, true);
  assert.equal(result.executionLedger.replayed, false);
  assert.equal(replay.executionLedger.replayed, true);
  assert.equal((await executions.listExecutions({ status: 'completed' })).length, 1);
});

test('notification event action execution rejects unsupported execute actions', async function () {
  await assert.rejects(function () {
    return executeNotificationEventAction({
      eventId: 'event-1',
      actionKey: 'event.dispatch',
      execute: true,
      notificationEventRepository: eventRepository([notificationEvent({
        id: 'event-1',
        deliveryStatus: 'pending'
      })]),
      notificationEventActionIntentRepository: intentRepository([]),
      notificationEventActionExecutionRepository: executionRepository()
    });
  }, function (error) {
    assert.equal(error.code, 'event_action_execution_unsupported');
    assert.equal(error.statusCode, 409);
    return true;
  });
});

function eventRepository(events) {
  return {
    async saveEvent(event) {
      const index = events.findIndex(function (candidate) {
        return candidate.id === event.id;
      });
      if (index >= 0) events[index] = event;
      else events.push(event);
    },
    async findEvent(id) {
      return events.find(function (event) {
        return event.id === id;
      });
    },
    async listEvents() {
      return events;
    }
  };
}

function executionRepository() {
  const records = [];
  return {
    async claimExecution(record) {
      const existing = records.find(function (item) {
        return item.key === record.key;
      });
      if (existing && (existing.status === 'completed' || existing.status === 'running')) {
        return {
          claimed: false,
          record: existing
        };
      }
      const saved = Object.assign({}, existing || {}, record, {
        status: 'running',
        createdAt: record.now || '2026-06-25T10:00:00.000Z',
        updatedAt: record.now || '2026-06-25T10:00:00.000Z'
      });
      const index = records.findIndex(function (item) {
        return item.key === record.key;
      });
      if (index >= 0) records[index] = saved;
      else records.push(saved);
      return {
        claimed: true,
        record: saved
      };
    },
    async completeExecution(key, result, metadata) {
      const index = records.findIndex(function (item) {
        return item.key === key;
      });
      const saved = Object.assign({}, records[index] || { key }, metadata || {}, {
        status: 'completed',
        result,
        updatedAt: metadata && metadata.now || '2026-06-25T10:00:00.000Z'
      });
      if (index >= 0) records[index] = saved;
      else records.push(saved);
      return saved;
    },
    async failExecution(key, error, metadata) {
      const index = records.findIndex(function (item) {
        return item.key === key;
      });
      const saved = Object.assign({}, records[index] || { key }, metadata || {}, {
        status: 'failed',
        error: {
          message: error.message
        },
        updatedAt: metadata && metadata.now || '2026-06-25T10:00:00.000Z'
      });
      if (index >= 0) records[index] = saved;
      else records.push(saved);
      return saved;
    },
    async findExecution(key) {
      return records.find(function (record) {
        return record.key === key;
      });
    },
    async listExecutions(query) {
      const safeQuery = query || {};
      return records.filter(function (record) {
        return (!safeQuery.status || record.status === safeQuery.status) &&
          (!safeQuery.eventId || record.eventId === safeQuery.eventId) &&
          (!safeQuery.actionKey || record.actionKey === safeQuery.actionKey);
      });
    }
  };
}

function taskRepository(tasks) {
  return {
    async saveTask() {},
    async findTask(id) {
      return tasks.find(function (task) {
        return task.id === id;
      });
    },
    async listTasks() {
      return tasks;
    }
  };
}

function intentRepository(savedRecords) {
  return {
    async saveIntent(record) {
      const savedRecord = Object.assign({
        id: 'intent-record-1'
      }, record);
      savedRecords.push(savedRecord);
      return savedRecord;
    },
    async findIntent(id) {
      return savedRecords.find(function (record) {
        return record.id === id;
      });
    },
    async listIntents() {
      return savedRecords;
    }
  };
}

function notificationEvent(overrides) {
  return Object.assign({
    id: 'event-1',
    type: 'source-changed',
    severity: 'info',
    createdAt: '2026-06-25T10:00:00.000Z',
    title: 'Source changed',
    summary: 'Source cursor changed.',
    payload: {},
    deliveryStatus: 'pending',
    deliveryAttempts: 0,
    nextDeliveryAt: '2026-06-25T10:00:00.000Z'
  }, overrides || {});
}
