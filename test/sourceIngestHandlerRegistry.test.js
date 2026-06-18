'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createSourceIngestHandlerRegistry } = require('../src/application/source-ingest/sourceIngestHandlerRegistry');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('source ingest handler registry registers and lists handlers', function () {
  const registry = createSourceIngestHandlerRegistry();
  registry.register({
    sourceType: 'custom-feed',
    description: 'Custom feed ingest',
    async run() {}
  });

  const handler = registry.findHandler('custom-feed');
  const handlers = registry.listHandlers();

  assert.equal(handler.sourceType, 'custom-feed');
  assert.deepEqual(handlers, [
    { sourceType: 'custom-feed', description: 'Custom feed ingest' }
  ]);
});

test('runtime can ingest a custom source type through injected handler registry', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-custom-source-'));
  const registry = createSourceIngestHandlerRegistry([
    {
      sourceType: 'custom-feed',
      requiresAdapter: false,
      async run(context) {
        return {
          task: {
            id: 'task-custom-feed',
            type: 'ingest-custom-feed',
            status: 'completed'
          },
          threadSnapshot: {
            sourceKey: context.source.sourceKey,
            sourceThreadId: 'custom-thread-1',
            title: 'Custom thread',
            url: context.source.location.url,
            posts: [
              {
                id: 'post-1',
                floor: 0,
                author: 'custom',
                contentText: 'hello custom source',
                publishedAt: '2026-06-18T10:00:00.000Z'
              }
            ]
          },
          report: {
            reportType: 'custom-report'
          }
        };
      }
    }
  ]);
  const runtime = createThreadTraceRuntime({
    storeDir: tempDir,
    sourceIngestHandlerRegistry: registry
  });

  const registered = await runtime.registerSource({
    sourceKey: 'custom',
    sourceType: 'custom-feed',
    displayName: 'Custom feed',
    location: {
      url: 'https://example.test/custom'
    }
  });
  const result = await runtime.runSourceIngestTask({
    sourceId: registered.source.id
  });
  const sources = await runtime.listSources({});

  assert.equal(result.task.type, 'ingest-custom-feed');
  assert.equal(result.cursor.sourceThreadId, 'custom-thread-1');
  assert.equal(result.cursor.postCount, 1);
  assert.equal(sources[0].runState.status, 'completed');
  assert.equal(sources[0].cursor.sourceThreadId, 'custom-thread-1');
});

test('runtime rejects custom source types without a registered ingest handler', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-missing-handler-'));
  const runtime = createThreadTraceRuntime({
    storeDir: tempDir
  });
  const registered = await runtime.registerSource({
    sourceKey: 'custom',
    sourceType: 'custom-feed',
    displayName: 'Custom feed',
    location: {
      url: 'https://example.test/custom'
    }
  });

  await assert.rejects(function () {
    return runtime.runSourceIngestTask({
      sourceId: registered.source.id
    });
  }, /not ingestible yet: custom-feed/);
});
