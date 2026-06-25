'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createFileNotificationEventActionExecutionRepository
} = require('../src/infrastructure/storage/fileNotificationEventActionExecutionRepository');

test('file notification event action execution repository claims, completes, and filters records', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-event-action-executions-'));
  const repository = createFileNotificationEventActionExecutionRepository({
    baseDir: tempDir
  });

  const firstClaim = await repository.claimExecution(executionRecord({
    key: 'execution-1',
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    actor: 'operator-a',
    sourceScope: {
      sourceId: 'source-1',
      sourceKey: 'nga'
    },
    now: '2026-06-25T10:00:00.000Z'
  }));
  const duplicateClaim = await repository.claimExecution(executionRecord({
    key: 'execution-1',
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    now: '2026-06-25T10:01:00.000Z'
  }));
  const completed = await repository.completeExecution('execution-1', {
    status: 'ok'
  }, {
    now: '2026-06-25T10:02:00.000Z'
  });
  await repository.claimExecution(executionRecord({
    key: 'execution-2',
    eventId: 'event-2',
    actionKey: 'event.dispatch',
    actor: 'operator-b',
    sourceScope: {
      sourceId: 'source-2',
      sourceKey: 'rss'
    },
    now: '2026-06-25T11:00:00.000Z'
  }));
  await repository.failExecution('execution-2', new Error('boom'), {
    now: '2026-06-25T11:01:00.000Z'
  });

  const found = await repository.findExecution('execution-1');
  const ngaRecords = await repository.listExecutions({
    sourceKey: 'nga'
  });
  const failedRecords = await repository.listExecutions({
    status: 'failed'
  });
  const limitedRecords = await repository.listExecutions({
    limit: 1
  });

  assert.equal(firstClaim.claimed, true);
  assert.equal(duplicateClaim.claimed, false);
  assert.equal(completed.status, 'completed');
  assert.equal(found.result.status, 'ok');
  assert.ok(found.filePath);
  assert.equal(ngaRecords.length, 1);
  assert.equal(ngaRecords[0].sourceKey, 'nga');
  assert.equal(failedRecords.length, 1);
  assert.equal(failedRecords[0].error.message, 'boom');
  assert.equal(limitedRecords.length, 1);
  assert.equal(limitedRecords[0].eventId, 'event-2');
});

function executionRecord(overrides) {
  return Object.assign({
    key: 'execution-1',
    type: 'notification-event-action-execution',
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    actor: 'operator-a',
    requestHash: 'hash-1',
    sourceScope: {
      sourceKey: 'nga'
    }
  }, overrides || {});
}
