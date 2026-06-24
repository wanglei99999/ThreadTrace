'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getSourceOnboardingPreflight } = require('../src/application/use-cases/getSourceOnboardingPreflight');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('source onboarding preflight aggregates catalog, connector, and source validation steps', function () {
  const preflight = getSourceOnboardingPreflight({
    now: '2026-06-19T10:00:00.000Z',
    sourceKey: 'external',
    sourceType: 'external-feed',
    catalog: {
      sourceTypes: [
        {
          sourceType: 'external-feed',
          compatibleSourceKeys: ['external']
        }
      ],
      adapters: [
        {
          sourceKey: 'external'
        }
      ]
    },
    connectorReadiness: {
      modules: {
        errorCount: 1
      },
      connectors: [
        {
          sourceType: 'external-feed',
          status: 'ok'
        }
      ]
    },
    sourceValidation: {
      valid: true,
      status: 'ok',
      source: {
        id: 'source-1',
        sourceKey: 'external',
        sourceType: 'external-feed'
      },
      checks: []
    },
    threadSnapshotContract: {
      version: '1.0.0',
      schema: {
        type: 'object',
        required: ['sourceKey', 'sourceThreadId', 'title', 'posts']
      }
    }
  });

  assert.equal(preflight.status, 'fail');
  assert.equal(preflight.steps.length, 4);
  assert.equal(preflight.steps.find(function (step) {
    return step.key === 'connectors.readiness';
  }).status, 'fail');
  assert.equal(preflight.steps.find(function (step) {
    return step.key === 'source.registrationDraft';
  }).status, 'ok');
  assert.equal(preflight.nextActions.length, 1);
  assert.equal(preflight.nextActions[0].key, 'connectors.readiness');
});

test('runtime source onboarding preflight validates normalized thread JSON input', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-onboarding-'));
  const inputFile = path.join(tempDir, 'thread.json');
  await fs.writeFile(inputFile, JSON.stringify({
    sourceKey: 'external',
    sourceThreadId: 'external-thread-1',
    title: 'External normalized thread',
    posts: []
  }, null, 2) + '\n', 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const preflight = await runtime.getSourceOnboardingPreflight({
    sourceKey: 'external',
    sourceType: 'normalized-thread-json',
    location: {
      inputFile
    },
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(preflight.status, 'ok');
  assert.equal(preflight.sourceKey, 'external');
  assert.equal(preflight.sourceType, 'normalized-thread-json');
  assert.equal(preflight.threadJsonValidation.valid, true);
  assert.equal(preflight.steps.find(function (step) {
    return step.key === 'threadJson.contractValidation';
  }).status, 'ok');
  assert.deepEqual(preflight.threadSnapshotContract.required, ['sourceKey', 'sourceThreadId', 'title', 'posts']);
});

test('runtime source onboarding preflight can simulate an external connector module', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-onboarding-module-'));
  const modulePath = path.join(tempDir, 'externalConnector.cjs');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "module.exports = {",
    "  sourceIngestHandlers: [{",
    "    sourceType: 'external-feed',",
    "    requiresAdapter: false,",
    "    description: 'External feed supplied by a module.',",
    "    locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "    capabilities: { fetchesRemote: true },",
    "    async run() { throw new Error('not used in this test'); }",
    "  }]",
    "};",
    ""
  ].join('\n'), 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const preflight = await runtime.getSourceOnboardingPreflight({
    sourceKey: 'external',
    sourceType: 'external-feed',
    modulePath,
    location: {
      feedUrl: 'https://example.test/feed'
    },
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(preflight.status, 'ok');
  assert.equal(preflight.connectorModuleValidation.valid, true);
  assert.equal(preflight.catalog.sourceType.sourceType, 'external-feed');
  assert.equal(preflight.sourceValidation.valid, true);
  assert.equal(preflight.steps.find(function (step) {
    return step.key === 'connectorModule.validation';
  }).status, 'ok');
  assert.equal(runtime.listSourceIngestHandlers().some(function (handler) {
    return handler.sourceType === 'external-feed';
  }), false);
});

test('source onboarding preflight surfaces source validation next-action details', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-onboarding-actions-'));
  const modulePath = path.join(tempDir, 'externalConnector.cjs');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "module.exports = {",
    "  sourceIngestHandlers: [{",
    "    sourceType: 'external-feed',",
    "    requiresAdapter: false,",
    "    description: 'External feed supplied by a module.',",
    "    locationSchema: { required: ['feedUrl', 'tenantId'], properties: { feedUrl: { type: 'string' }, tenantId: { type: 'string' } } },",
    "    async run() { throw new Error('not used in this test'); }",
    "  }]",
    "};",
    ""
  ].join('\n'), 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const preflight = await runtime.getSourceOnboardingPreflight({
    sourceKey: 'external',
    sourceType: 'external-feed',
    modulePath,
    location: {
      feedUrl: 'https://example.test/feed'
    },
    now: '2026-06-19T10:00:00.000Z'
  });

  const action = preflight.nextActions.find(function (item) {
    return item.key === 'source.registrationDraft';
  });

  assert.equal(preflight.status, 'fail');
  assert.ok(action);
  assert.equal(action.details[0].key, 'source.location');
  assert.match(action.details[0].evidenceSummary, /missingRequiredFields=tenantId/);
  assert.deepEqual(action.details[0].evidence.missingRequiredFields, ['tenantId']);
});
