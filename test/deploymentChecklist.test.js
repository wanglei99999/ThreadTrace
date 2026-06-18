'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getDeploymentChecklist } = require('../src/application/use-cases/getDeploymentChecklist');

test('deployment checklist aggregates runtime, source, readiness, notification, and llm checks', function () {
  const checklist = getDeploymentChecklist({
    now: '2026-06-19T10:00:00.000Z',
    diagnostics: {
      status: 'warn',
      generatedAt: '2026-06-19T10:00:00.000Z',
      configuration: {
        storageMode: 'file',
        llm: {
          provider: 'openai-compatible'
        }
      },
      checks: [
        { key: 'resources.storeDir', status: 'ok', summary: 'Store directory is writable.' },
        { key: 'config.llm.apiKey', status: 'warn', summary: 'Remote LLM provider has an API key configured.' }
      ]
    },
    sourceDiagnostics: {
      status: 'fail',
      sourceCount: 2,
      sources: [
        {
          sourceId: 'source-ok',
          sourceKey: 'nga',
          sourceType: 'saved-html-directory',
          displayName: 'NGA archive',
          status: 'ok',
          checks: []
        },
        {
          sourceId: 'source-fail',
          sourceKey: 'missing',
          sourceType: 'external-feed',
          displayName: 'External feed',
          status: 'fail',
          checks: [
            {
              key: 'source.handler',
              status: 'fail',
              value: 'external-feed',
              summary: 'Tracked source type has an ingest handler.'
            }
          ]
        }
      ]
    },
    adapterDiagnostics: {
      status: 'ok',
      adapterCount: 1
    },
    notificationDiagnostics: {
      channel: 'file',
      checks: [
        { key: 'notifications.channel', status: 'ok', summary: 'Notification channel is supported.' },
        { key: 'notifications.fileDeliveryDir', status: 'ok', summary: 'File notification delivery directory is writable.' }
      ]
    },
    readiness: {
      status: 'fail',
      checks: [
        { key: 'workers.stale', status: 'fail', summary: 'Worker runs are stale.' },
        { key: 'events.failed', status: 'warn', summary: 'Notification events failed delivery.' }
      ]
    }
  });

  assert.equal(checklist.status, 'fail');
  assert.equal(checklist.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'resources.storage';
  }).status, 'ok');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'workers.readiness';
  }).status, 'fail');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'adapters.contract';
  }).status, 'ok');
  const sourceItem = checklist.items.find(function (item) {
    return item.key === 'sources.ingestConfiguration';
  });
  assert.equal(sourceItem.status, 'fail');
  assert.equal(sourceItem.evidence.summary.sourceCount, 2);
  assert.equal(sourceItem.evidence.summary.fail, 1);
  assert.equal(sourceItem.evidence.summary.failedSources[0].sourceId, 'source-fail');
  assert.equal(sourceItem.evidence.summary.failedSources[0].failedChecks[0].key, 'source.handler');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'notifications.outbox';
  }).status, 'warn');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'notifications.channel';
  }).status, 'ok');
  assert.equal(checklist.items.find(function (item) {
    return item.key === 'llm.configuration';
  }).status, 'warn');
});
