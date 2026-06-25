'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { prepareNotificationEventActionIntent } = require('../src/application/use-cases/prepareNotificationEventActionIntent');

test('notification event action intent builds dry-run acknowledge plan', async function () {
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

function eventRepository(events) {
  return {
    async saveEvent() {},
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
