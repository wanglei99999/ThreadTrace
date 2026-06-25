'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getNotificationEventDetail,
  eventSourceScope
} = require('../src/application/use-cases/getNotificationEventDetail');

test('notification event detail returns source scope related task links and actions', async function () {
  const event = notificationEvent({
    id: 'event-1',
    deliveryStatus: 'failed',
    taskId: 'task-1',
    sourceId: 'source-1',
    sourceKey: 'nga'
  });
  const detail = await getNotificationEventDetail({
    eventId: 'event-1',
    now: '2026-06-25T10:00:00.000Z',
    notificationEventRepository: eventRepository([event]),
    taskRepository: taskRepository([{
      id: 'task-1',
      type: 'source-ingest',
      status: 'completed',
      createdAt: '2026-06-25T09:00:00.000Z',
      updatedAt: '2026-06-25T09:01:00.000Z'
    }])
  });

  assert.equal(detail.generatedAt, '2026-06-25T10:00:00.000Z');
  assert.equal(detail.event.id, 'event-1');
  assert.equal(detail.sourceScope.sourceId, 'source-1');
  assert.equal(detail.sourceScope.sourceKey, 'nga');
  assert.equal(detail.relatedTask.id, 'task-1');
  assert.equal(detail.relatedTask.status, 'completed');
  assert.ok(detail.links.find(function (link) {
    return link.rel === 'source-drilldown' && /sourceId=source-1/.test(link.href);
  }));
  assert.ok(detail.links.find(function (link) {
    return link.rel === 'task-detail' && /task-1/.test(link.href);
  }));
  assert.ok(detail.nextActions.find(function (action) {
    return action.key === 'event.acknowledge';
  }));
  assert.ok(detail.nextActions.find(function (action) {
    return action.key === 'event.dispatch' && action.severity === 'warning';
  }));
  assert.ok(detail.nextActions.find(function (action) {
    return action.key === 'event.task-detail';
  }));
});

test('notification event detail reports missing events', async function () {
  await assert.rejects(function () {
    return getNotificationEventDetail({
      eventId: 'missing-event',
      notificationEventRepository: eventRepository([])
    });
  }, function (error) {
    assert.equal(error.code, 'event_not_found');
    assert.equal(error.statusCode, 404);
    assert.deepEqual(error.details, { eventId: 'missing-event' });
    return true;
  });
});

test('notification event source scope falls back to payload action evidence', function () {
  assert.deepEqual(eventSourceScope({
    payload: {
      action: {
        evidence: {
          sourceId: 'source-from-action',
          sourceKey: 'forum-a',
          sourceType: 'thread-url',
          sourceThreadId: 'thread-1'
        }
      }
    }
  }), {
    sourceId: 'source-from-action',
    sourceKey: 'forum-a',
    sourceType: 'thread-url',
    sourceThreadId: 'thread-1'
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
    severity: 'warning',
    createdAt: '2026-06-25T09:00:00.000Z',
    title: 'Source changed',
    summary: 'Source cursor changed.',
    payload: {},
    deliveryStatus: 'pending',
    deliveryAttempts: 0,
    nextDeliveryAt: '2026-06-25T09:00:00.000Z'
  }, overrides || {});
}
