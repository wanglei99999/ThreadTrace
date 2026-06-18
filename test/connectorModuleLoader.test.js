'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createThreadTraceConfig } = require('../src/runtime/threadTraceConfig');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime loads external connector modules from configuration', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-connector-module-'));
  const modulePath = path.join(tempDir, 'externalConnector.cjs');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "module.exports = {",
    "  forumAdapters: [{",
    "    sourceKey: 'external-forum',",
    "    displayName: 'External Forum',",
    "    parseSavedHtml() {",
    "      return { sourceKey: 'external-forum', sourceThreadId: 'thread-1', title: 'External thread', posts: [] };",
    "    }",
    "  }],",
    "  sourceIngestHandlers: [{",
    "    sourceType: 'external-feed',",
    "    requiresAdapter: false,",
    "    description: 'External feed connector supplied by a module.',",
    "    locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "    capabilities: { fetchesRemote: true },",
    "    async run() { throw new Error('not used in this test'); }",
    "  }]",
    "};",
    ""
  ].join('\n'), 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store'),
    connectorModules: [modulePath]
  });
  const registered = await runtime.registerSource({
    sourceKey: 'external-forum',
    sourceType: 'external-feed',
    displayName: 'External feed',
    location: {
      feedUrl: 'https://example.test/feed'
    }
  });
  const readiness = await runtime.getConnectorReadiness({
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(runtime.connectorModules.length, 1);
  assert.equal(runtime.connectorModules[0].forumAdapters[0], 'external-forum');
  assert.equal(runtime.connectorModules[0].sourceIngestHandlers[0], 'external-feed');
  assert.ok(runtime.listAdapters().some(function (adapter) {
    return adapter.sourceKey === 'external-forum';
  }));
  assert.ok(runtime.listSourceIngestHandlers().some(function (handler) {
    return handler.sourceType === 'external-feed';
  }));
  assert.equal(registered.source.sourceType, 'external-feed');
  assert.equal(readiness.connectors.some(function (connector) {
    return connector.sourceType === 'external-feed' && connector.sourceCount === 1;
  }), true);
});

test('threadtrace config parses connector module paths', function () {
  const cwd = path.resolve(__dirname, '..');
  const config = createThreadTraceConfig({
    cwd,
    env: {
      THREADTRACE_CONNECTOR_MODULES: ['connectors/a.cjs', 'connectors/b.cjs'].join(path.delimiter)
    }
  });

  assert.deepEqual(config.connectors.modules, [
    path.join(cwd, 'connectors', 'a.cjs'),
    path.join(cwd, 'connectors', 'b.cjs')
  ]);
});
