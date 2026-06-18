'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getOperationalOverview } = require('../src/application/use-cases/getOperationalOverview');

test('operational overview summarizes sources, tasks, events, and raw pages', async function () {
  const overview = await getOperationalOverview({
    now: '2026-06-18T10:00:00.000Z',
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources() {
        return [
          {
            id: 'source-1',
            sourceKey: 'nga',
            sourceType: 'thread-url',
            displayName: 'due source',
            enabled: true,
            schedule: { intervalMinutes: 60 },
            runState: { status: 'completed', lastFinishedAt: '2026-06-18T08:00:00.000Z' }
          },
          {
            id: 'source-2',
            sourceKey: 'nga',
            sourceType: 'saved-html-directory',
            displayName: 'failed source',
            enabled: true,
            runState: { status: 'failed' }
          }
        ];
      }
    },
    taskRepository: {
      async saveTask() {},
      async findTask() {},
      async listTasks() {
        return [
          { id: 'task-1', status: 'completed', type: 'ingest-thread-url', createdAt: '2026-06-18T09:00:00.000Z' },
          { id: 'task-2', status: 'failed', type: 'ingest-thread-url', createdAt: '2026-06-18T09:30:00.000Z' }
        ];
      }
    },
    notificationEventRepository: {
      async saveEvent() {},
      async findEvent() {},
      async listEvents(query) {
        if (query.deliveryStatus === 'pending') {
          return [{ id: 'event-1', deliveryStatus: 'pending', nextDeliveryAt: '2026-06-18T09:59:00.000Z' }];
        }
        if (query.deliveryStatus === 'failed') {
          return [{ id: 'event-2', deliveryStatus: 'failed', nextDeliveryAt: '2026-06-18T11:00:00.000Z' }];
        }
        if (query.acknowledged === false) {
          return [{ id: 'event-1' }, { id: 'event-2' }];
        }
        return [];
      }
    },
    rawThreadPageRepository: {
      async saveRawThreadPage() {},
      async findRawThreadPageByHash() {},
      async listRawThreadPages() {
        return [
          { contentSha1: 'raw-1', fetchedAt: '2026-06-18T09:50:00.000Z' }
        ];
      }
    },
    workerRunRepository: {
      async saveWorkerRun() {},
      async findWorkerRun() {},
      async listWorkerRuns() {
        return [
          {
            id: 'worker-run-1',
            workerType: 'operations',
            workerId: 'worker-a',
            status: 'running',
            startedAt: '2026-06-18T09:00:00.000Z',
            updatedAt: '2026-06-18T09:00:00.000Z',
            heartbeatAt: '2026-06-18T09:00:00.000Z'
          },
          {
            id: 'worker-run-2',
            workerType: 'notification-event',
            workerId: 'worker-b',
            status: 'completed',
            startedAt: '2026-06-18T09:55:00.000Z',
            updatedAt: '2026-06-18T09:56:00.000Z',
            heartbeatAt: '2026-06-18T09:56:00.000Z',
            finishedAt: '2026-06-18T09:56:00.000Z'
          }
        ];
      }
    }
  });

  assert.equal(overview.sources.total, 2);
  assert.equal(overview.sources.due, 1);
  assert.equal(overview.sources.failed, 1);
  assert.equal(overview.tasks.failed, 1);
  assert.equal(overview.events.pending, 1);
  assert.equal(overview.events.failed, 1);
  assert.equal(overview.events.unacknowledged, 2);
  assert.equal(overview.events.dueForDelivery, 1);
  assert.equal(overview.workers.running, 1);
  assert.equal(overview.workers.stale, 1);
  assert.equal(overview.workers.completed, 1);
  assert.equal(overview.workers.latestHeartbeatAt, '2026-06-18T09:56:00.000Z');
  assert.equal(overview.rawPages.total, 1);
  assert.equal(overview.rawPages.latestFetchedAt, '2026-06-18T09:50:00.000Z');
});
