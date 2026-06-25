'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createFileNotificationEventActionIntentRepository
} = require('../src/infrastructure/storage/fileNotificationEventActionIntentRepository');

test('file notification event action intent repository persists and filters records', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-event-action-intents-'));
  const repository = createFileNotificationEventActionIntentRepository({
    baseDir: tempDir
  });

  const first = await repository.saveIntent(intentRecord({
    generatedAt: '2026-06-25T10:00:00.000Z',
    eventId: 'event-1',
    actionKey: 'event.acknowledge',
    actor: 'operator-a',
    sourceScope: {
      sourceId: 'source-1',
      sourceKey: 'nga'
    }
  }));
  await repository.saveIntent(intentRecord({
    generatedAt: '2026-06-25T11:00:00.000Z',
    eventId: 'event-2',
    actionKey: 'event.dispatch',
    actor: 'operator-b',
    sourceScope: {
      sourceId: 'source-2',
      sourceKey: 'rss'
    }
  }));

  const found = await repository.findIntent(first.id);
  const ngaRecords = await repository.listIntents({
    sourceKey: 'nga'
  });
  const acknowledgeRecords = await repository.listIntents({
    actionKey: 'event.acknowledge'
  });
  const limitedRecords = await repository.listIntents({
    limit: 1
  });

  assert.equal(found.eventId, 'event-1');
  assert.equal(found.sourceKey, undefined);
  assert.ok(found.filePath);
  assert.equal(ngaRecords.length, 1);
  assert.equal(ngaRecords[0].sourceKey, 'nga');
  assert.equal(acknowledgeRecords.length, 1);
  assert.equal(acknowledgeRecords[0].actionKey, 'event.acknowledge');
  assert.equal(limitedRecords.length, 1);
  assert.equal(limitedRecords[0].eventId, 'event-2');
});

function intentRecord(overrides) {
  return Object.assign({
    mode: 'dry-run',
    dryRun: true,
    executed: false,
    status: 'ok',
    event: {
      id: 'event-1'
    },
    action: {
      key: 'event.acknowledge'
    },
    intent: {
      id: 'intent-1',
      eventId: 'event-1',
      actionKey: 'event.acknowledge',
      actor: 'operator-a',
      evidence: {
        sourceScope: {
          sourceKey: 'nga'
        }
      }
    }
  }, overrides || {});
}
