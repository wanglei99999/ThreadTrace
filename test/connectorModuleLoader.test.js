'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const { createThreadTraceConfig } = require('../src/runtime/threadTraceConfig');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');
const { makeWorkspaceTempDir } = require('./helpers/workspaceTempDir');

test('runtime loads external connector modules from configuration', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-connector-module-');
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
  assert.equal(readiness.modules.count, 1);
  assert.equal(readiness.modules.modules[0].forumAdapters[0], 'external-forum');
  assert.equal(readiness.modules.modules[0].sourceIngestHandlers[0], 'external-feed');
  assert.equal(readiness.modules.modules[0].contractSummary.sourceIngestHandlerCount, 1);
  assert.equal(readiness.modules.modules[0].contractSummary.sourceIngestHandlers[0].sourceType, 'external-feed');
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

test('runtime validates connector module files before startup configuration', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-connector-module-validation-');
  const goodModulePath = path.join(tempDir, 'goodConnector.cjs');
  const emptyModulePath = path.join(tempDir, 'emptyConnector.cjs');
  const brokenModulePath = path.join(tempDir, 'brokenConnector.cjs');
  await fs.writeFile(goodModulePath, [
    "'use strict';",
    "module.exports = {",
    "  sourceIngestHandlers: [{",
    "    sourceType: 'external-validate-feed',",
    "    requiresAdapter: false,",
    "    description: 'External validation feed.',",
    "    locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "    async run() { throw new Error('not used in this test'); }",
    "  }]",
    "};",
    ""
  ].join('\n'), 'utf8');
  await fs.writeFile(emptyModulePath, [
    "'use strict';",
    "module.exports = {};",
    ""
  ].join('\n'), 'utf8');
  await fs.writeFile(brokenModulePath, [
    "'use strict';",
    "throw new Error('validation boom');",
    ""
  ].join('\n'), 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const good = runtime.validateConnectorModule({
    modulePath: goodModulePath,
    now: '2026-06-19T10:00:00.000Z'
  });
  const empty = runtime.validateConnectorModule({
    modulePath: emptyModulePath,
    now: '2026-06-19T10:00:00.000Z'
  });
  const broken = runtime.validateConnectorModule({
    modulePath: brokenModulePath,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(good.valid, true);
  assert.equal(good.status, 'ok');
  assert.equal(good.modules[0].sourceIngestHandlers[0], 'external-validate-feed');
  assert.equal(empty.valid, false);
  assert.equal(empty.checks.find(function (check) {
    return check.key === 'connectorModule.registrations';
  }).status, 'fail');
  assert.equal(broken.valid, false);
  assert.match(broken.errors[0].message, /validation boom/);
});

test('connector module validation reports contract and duplicate registration failures', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-connector-module-contract-fail-');
  const modulePath = path.join(tempDir, 'contractFailConnector.cjs');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "module.exports = {",
    "  forumAdapters: [{",
    "    sourceKey: 'missing-display-name',",
    "    parseSavedHtml() {",
    "      return { sourceKey: 'missing-display-name', sourceThreadId: 'thread-1', title: 'Thread', posts: [] };",
    "    }",
    "  }],",
    "  sourceIngestHandlers: [",
    "    {",
    "      sourceType: 'duplicate-feed',",
    "      requiresAdapter: false,",
    "      description: 'Duplicate feed A.',",
    "      locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "      async run() { throw new Error('not used in this test'); }",
    "    },",
    "    {",
    "      sourceType: 'duplicate-feed',",
    "      requiresAdapter: false,",
    "      description: 'Duplicate feed B.',",
    "      locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "      async run() { throw new Error('not used in this test'); }",
    "    },",
    "    {",
    "      sourceType: 'missing-description-feed',",
    "      requiresAdapter: false,",
    "      locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "      async run() { throw new Error('not used in this test'); }",
    "    }",
    "  ]",
    "};",
    ""
  ].join('\n'), 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const result = runtime.validateConnectorModule({
    modulePath,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(result.valid, false);
  assert.equal(result.status, 'fail');
  assert.deepEqual(result.checks.find(function (check) {
    return check.key === 'connectorModule.uniqueRegistrations';
  }).value.duplicateSourceIngestHandlers, ['duplicate-feed']);
  assert.deepEqual(result.checks.find(function (check) {
    return check.key === 'connectorModule.adapterContracts';
  }).value.failures[0].missing, ['displayName']);
  assert.deepEqual(result.checks.find(function (check) {
    return check.key === 'connectorModule.handlerContracts';
  }).value.failures[0].missing, ['description']);
  assert.equal(result.contractSummary.forumAdapterCount, 1);
  assert.equal(result.contractSummary.sourceIngestHandlerCount, 3);
});

test('documented external normalized connector validates and dry-runs sample JSON', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-docs-connector-example-');
  const cwd = path.resolve(__dirname, '..');
  const modulePath = path.join(cwd, 'docs', 'examples', 'external-normalized-feed-connector.cjs');
  const inputFile = path.join(cwd, 'docs', 'examples', 'external-thread.sample.json');
  const runtime = createThreadTraceRuntime({
    cwd,
    storeDir: path.join(tempDir, 'store')
  });

  const validation = runtime.validateConnectorModule({
    modulePath,
    now: '2026-06-19T10:00:00.000Z'
  });
  const dryRun = await runtime.dryRunSourceIngest({
    modulePath,
    forum: 'external',
    sourceType: 'external-normalized-feed',
    displayName: 'External normalized docs sample',
    inputFile,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.contractSummary.sourceIngestHandlers[0].sourceType, 'external-normalized-feed');
  assert.equal(dryRun.status, 'ok');
  assert.equal(dryRun.thread.sourceThreadId, 'external-thread-1');
  assert.equal(dryRun.repositoryWrites.threadSnapshots, 1);
  assert.equal(dryRun.repositoryWrites.reports, 1);
});

test('documented external connector package validates and dry-runs sample JSON', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-docs-connector-package-');
  const cwd = path.resolve(__dirname, '..');
  const modulePath = path.join(cwd, 'docs', 'examples', 'external-connector-package', 'index.cjs');
  const inputFile = path.join(cwd, 'docs', 'examples', 'external-thread.sample.json');
  const runtime = createThreadTraceRuntime({
    cwd,
    storeDir: path.join(tempDir, 'store')
  });

  const validation = runtime.validateConnectorModule({
    modulePath,
    now: '2026-06-19T10:00:00.000Z'
  });
  const dryRun = await runtime.dryRunSourceIngest({
    modulePath,
    forum: 'external-package',
    sourceType: 'package-normalized-feed',
    displayName: 'External connector package docs sample',
    inputFile,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.contractSummary.sourceIngestHandlers[0].sourceType, 'package-normalized-feed');
  assert.equal(validation.contractSummary.sourceIngestHandlers[0].capabilities.packageTemplate, true);
  assert.equal(validation.packageManifests[0].status, 'ok');
  assert.equal(validation.packageManifests[0].packageName, '@threadtrace/example-external-connector-package');
  assert.deepEqual(validation.packageManifests[0].declaredSourceTypes, ['package-normalized-feed']);
  assert.equal(validation.packageManifests[0].capabilities.acceptsCanonicalSnapshot, true);
  assert.equal(dryRun.status, 'ok');
  assert.equal(dryRun.thread.sourceThreadId, 'external-thread-1');
  assert.equal(dryRun.repositoryWrites.threadSnapshots, 1);
  assert.equal(dryRun.repositoryWrites.reports, 1);
});

test('documented rss archive connector package validates and dry-runs sample JSON', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-docs-rss-archive-connector-package-');
  const cwd = path.resolve(__dirname, '..');
  const modulePath = path.join(cwd, 'docs', 'examples', 'rss-archive-connector-package', 'index.cjs');
  const inputFile = path.join(cwd, 'docs', 'examples', 'external-thread.sample.json');
  const runtime = createThreadTraceRuntime({
    cwd,
    storeDir: path.join(tempDir, 'store')
  });

  const validation = runtime.validateConnectorModule({
    modulePath,
    now: '2026-06-25T10:00:00.000Z'
  });
  const dryRun = await runtime.dryRunSourceIngest({
    modulePath,
    forum: 'rss-archive',
    sourceType: 'rss-archive-normalized-feed',
    displayName: 'RSS/API archive docs sample',
    location: {
      inputFile,
      feedUrl: 'https://example.test/rss.xml',
      archiveLabel: 'example-rss-archive'
    },
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.packageManifests[0].packageName, '@threadtrace/example-rss-archive-connector-package');
  assert.deepEqual(validation.packageManifests[0].declaredSourceTypes, ['rss-archive-normalized-feed']);
  assert.equal(validation.packageManifests[0].capabilities.rssTemplate, true);
  assert.equal(validation.contractSummary.sourceIngestHandlers[0].sourceType, 'rss-archive-normalized-feed');
  assert.equal(validation.contractSummary.sourceIngestHandlers[0].capabilities.archiveTemplate, true);
  assert.equal(dryRun.status, 'ok');
  assert.equal(dryRun.thread.sourceThreadId, 'external-thread-1');
  assert.equal(dryRun.repositoryWrites.threadSnapshots, 1);
  assert.equal(dryRun.repositoryWrites.reports, 1);
});

test('connector module validation fails when package manifest does not match registrations', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-connector-package-manifest-mismatch-');
  const packageDir = path.join(tempDir, 'connector-package');
  await fs.mkdir(packageDir, { recursive: true });
  const modulePath = path.join(packageDir, 'index.cjs');
  await fs.writeFile(path.join(packageDir, 'package.json'), JSON.stringify({
    name: '@threadtrace/mismatch-connector',
    version: '0.1.0',
    main: 'index.cjs',
    threadtraceConnector: {
      version: '1.0',
      displayName: 'Mismatch Connector',
      packageType: 'normalized-thread-json',
      sourceTypes: [
        {
          sourceType: 'declared-feed',
          displayName: 'Declared Feed'
        }
      ]
    }
  }, null, 2), 'utf8');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "module.exports = {",
    "  sourceIngestHandlers: [{",
    "    sourceType: 'registered-feed',",
    "    requiresAdapter: false,",
    "    description: 'Registered feed not declared by package manifest.',",
    "    locationSchema: { required: ['inputFile'], properties: { inputFile: { type: 'string' } } },",
    "    async run() { throw new Error('not used in this test'); }",
    "  }]",
    "};",
    ""
  ].join('\n'), 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const validation = runtime.validateConnectorModule({
    modulePath,
    now: '2026-06-25T10:00:00.000Z'
  });
  const manifestCheck = validation.checks.find(function (check) {
    return check.key === 'connectorPackage.manifest';
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.status, 'fail');
  assert.equal(manifestCheck.status, 'fail');
  assert.deepEqual(validation.packageManifests[0].missingSourceTypes, ['declared-feed']);
  assert.deepEqual(validation.packageManifests[0].undeclaredSourceTypes, ['registered-feed']);
});

test('connector module validation reloads changed module files', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-connector-module-reload-');
  const modulePath = path.join(tempDir, 'reloadConnector.cjs');
  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });

  await fs.writeFile(modulePath, connectorModuleSource('reload-feed-v1'), 'utf8');
  const first = runtime.validateConnectorModule({
    modulePath,
    now: '2026-06-19T10:00:00.000Z'
  });
  await fs.writeFile(modulePath, connectorModuleSource('reload-feed-v2'), 'utf8');
  const second = runtime.validateConnectorModule({
    modulePath,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(first.modules[0].sourceIngestHandlers[0], 'reload-feed-v1');
  assert.equal(second.modules[0].sourceIngestHandlers[0], 'reload-feed-v2');
});

test('runtime reports connector module load failures without blocking startup', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-broken-connector-module-');
  const modulePath = path.join(tempDir, 'brokenConnector.cjs');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "throw new Error('connector boom');",
    ""
  ].join('\n'), 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store'),
    connectorModules: [modulePath]
  });
  const diagnostics = await runtime.getRuntimeDiagnostics({
    now: '2026-06-19T10:00:00.000Z'
  });
  const readiness = await runtime.getConnectorReadiness({
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(runtime.connectorModules.length, 0);
  assert.equal(runtime.connectorModuleErrors.length, 1);
  assert.equal(diagnostics.status, 'fail');
  assert.equal(diagnostics.configuration.connectors.errorCount, 1);
  assert.match(diagnostics.configuration.connectors.errors[0].message, /connector boom/);
  assert.equal(diagnostics.checks.find(function (check) {
    return check.key === 'config.connectorModules';
  }).status, 'fail');
  assert.equal(readiness.status, 'fail');
  assert.equal(readiness.modules.errorCount, 1);
});

function connectorModuleSource(sourceType) {
  return [
    "'use strict';",
    "module.exports = {",
    "  sourceIngestHandlers: [{",
    "    sourceType: '" + sourceType + "',",
    "    requiresAdapter: false,",
    "    description: 'Reload validation feed.',",
    "    locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "    async run() { throw new Error('not used in this test'); }",
    "  }]",
    "};",
    ""
  ].join('\n');
}
