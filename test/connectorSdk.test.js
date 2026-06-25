'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const {
  defineConnectorModule,
  defineForumAdapter,
  defineLocationSchema,
  defineSourceIngestHandler
} = require('../src/connectors/connectorSdk');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');
const { makeWorkspaceTempDir } = require('./helpers/workspaceTempDir');

test('connector sdk defines normalized source handlers and adapters', function () {
  const handler = defineSourceIngestHandler({
    sourceType: 'sdk-feed',
    description: 'SDK feed.',
    requiresAdapter: false,
    locationSchema: defineLocationSchema({
      required: ['endpoint'],
      properties: {
        endpoint: { type: 'string', format: 'uri' }
      }
    }),
    capabilities: {
      fetchesRemote: true
    },
    async run() {}
  });
  const adapter = defineForumAdapter({
    sourceKey: 'sdk-forum',
    displayName: 'SDK Forum',
    parseSavedHtml() {
      return {
        sourceKey: 'sdk-forum',
        sourceThreadId: 'thread-1',
        title: 'SDK thread',
        posts: []
      };
    }
  });
  const connectorModule = defineConnectorModule({
    forumAdapters: [adapter],
    sourceIngestHandlers: [handler],
    metadata: {
      packageName: 'threadtrace-sdk-test'
    }
  });

  assert.equal(handler.requiresAdapter, false);
  assert.deepEqual(handler.locationSchema.required, ['endpoint']);
  assert.equal(handler.capabilities.fetchesRemote, true);
  assert.deepEqual(adapter.capabilities, {});
  assert.equal(connectorModule.forumAdapters[0].sourceKey, 'sdk-forum');
  assert.equal(connectorModule.sourceIngestHandlers[0].sourceType, 'sdk-feed');
  assert.equal(connectorModule.metadata.packageName, 'threadtrace-sdk-test');
});

test('connector sdk fails fast on incomplete connector definitions', function () {
  assert.throws(function () {
    defineSourceIngestHandler({
      sourceType: 'missing-description',
      async run() {}
    });
  }, /description/);
  assert.throws(function () {
    defineForumAdapter({
      sourceKey: 'missing-parser',
      displayName: 'Missing parser'
    });
  }, /parseSavedHtml/);
  assert.throws(function () {
    defineLocationSchema({
      required: 'endpoint',
      properties: {}
    });
  }, /required/);
});

test('runtime validates connector modules authored with connector sdk', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-connector-sdk-');
  const modulePath = path.join(tempDir, 'sdkConnector.cjs');
  const sdkPath = path.resolve(__dirname, '..', 'src', 'connectors', 'connectorSdk.js');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "const { defineConnectorModule, defineSourceIngestHandler, defineLocationSchema } = require(" + JSON.stringify(sdkPath) + ");",
    "module.exports = defineConnectorModule({",
    "  sourceIngestHandlers: [defineSourceIngestHandler({",
    "    sourceType: 'sdk-normalized-feed',",
    "    requiresAdapter: false,",
    "    description: 'SDK-authored normalized feed connector.',",
    "    locationSchema: defineLocationSchema({",
    "      required: ['inputFile'],",
    "      properties: { inputFile: { type: 'string', format: 'path' } }",
    "    }),",
    "    capabilities: { acceptsCanonicalSnapshot: true, sdkAuthored: true },",
    "    async run() { throw new Error('not used in this test'); }",
    "  })]",
    "});",
    ""
  ].join('\n'), 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const validation = runtime.validateConnectorModule({
    modulePath,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.contractSummary.sourceIngestHandlers[0].sourceType, 'sdk-normalized-feed');
  assert.equal(validation.contractSummary.sourceIngestHandlers[0].capabilities.sdkAuthored, true);
  assert.deepEqual(validation.contractSummary.sourceIngestHandlers[0].requiredLocationFields, ['inputFile']);
});
