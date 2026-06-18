'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getConnectorRolloutPlan } = require('../src/application/use-cases/getConnectorRolloutPlan');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('connector rollout plan aggregates rollout steps and next actions', function () {
  const plan = getConnectorRolloutPlan({
    now: '2026-06-19T10:00:00.000Z',
    sourceKey: 'external',
    sourceType: 'external-feed',
    connectorModuleContract: {
      version: '1.0.0'
    },
    connectorModuleValidation: {
      valid: true,
      status: 'ok',
      modulePath: 'D:/connectors/external.cjs',
      errors: [],
      modules: [
        {
          modulePath: 'D:/connectors/external.cjs',
          sourceIngestHandlers: ['external-feed']
        }
      ]
    },
    sourceOnboardingPreflight: {
      status: 'fail',
      sourceKey: 'external',
      sourceType: 'external-feed',
      steps: [
        {
          key: 'source.registrationDraft',
          status: 'fail'
        }
      ]
    },
    sourceIngestDryRun: {
      status: 'ok',
      dryRun: true,
      thread: {
        sourceThreadId: 'external-thread-1',
        postCount: 1
      },
      repositoryWrites: {
        threadSnapshots: 1,
        reports: 1,
        tasks: 3,
        rawThreadPages: 0
      }
    },
    connectorReadiness: {
      status: 'ok',
      connectorCount: 1,
      sourceCount: 0,
      modules: {
        errorCount: 0
      }
    },
    deploymentChecklist: {
      status: 'ok',
      items: []
    }
  });

  assert.equal(plan.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(plan.status, 'fail');
  assert.equal(plan.sourceKey, 'external');
  assert.equal(plan.sourceType, 'external-feed');
  assert.equal(plan.modulePath, 'D:/connectors/external.cjs');
  assert.equal(plan.steps.length, 6);
  assert.equal(plan.steps.find(function (step) {
    return step.key === 'source.onboardingPreflight';
  }).status, 'fail');
  assert.deepEqual(plan.nextActions, [
    {
      key: 'source.onboardingPreflight',
      severity: 'critical',
      command: 'node src/presentation/cli/threadtrace.js source-onboarding-preflight --module-path <file> --location-file <file>',
      summary: 'Source onboarding preflight validates the source draft.'
    }
  ]);
});

test('runtime connector rollout plan can simulate an external connector module', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-connector-rollout-'));
  const modulePath = path.join(tempDir, 'externalConnector.cjs');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "module.exports = {",
    "  sourceIngestHandlers: [{",
    "    sourceType: 'rollout-feed',",
    "    requiresAdapter: false,",
    "    description: 'Rollout feed supplied by a module.',",
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
  const plan = await runtime.getConnectorRolloutPlan({
    sourceKey: 'external',
    sourceType: 'rollout-feed',
    modulePath,
    location: {
      feedUrl: 'https://example.test/feed'
    },
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(plan.status, 'warn');
  assert.equal(plan.connectorModuleValidation.valid, true);
  assert.equal(plan.sourceOnboardingPreflight.status, 'ok');
  assert.equal(plan.sourceOnboardingPreflight.catalog.sourceType.sourceType, 'rollout-feed');
  assert.equal(plan.nextActions.find(function (action) {
    return action.key === 'source.ingestDryRun';
  }).severity, 'warning');
  assert.equal(runtime.listSourceIngestHandlers().some(function (handler) {
    return handler.sourceType === 'rollout-feed';
  }), false);
});

test('runtime connector rollout plan can include source ingest dry-run', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-connector-rollout-dry-run-'));
  const inputFile = path.join(tempDir, 'thread.json');
  await fs.writeFile(inputFile, JSON.stringify({
    sourceKey: 'external',
    sourceThreadId: 'rollout-dry-run-thread',
    title: 'Rollout dry-run thread',
    posts: []
  }, null, 2) + '\n', 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const plan = await runtime.getConnectorRolloutPlan({
    sourceKey: 'external',
    sourceType: 'normalized-thread-json',
    inputFile,
    dryRunIngest: true,
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(plan.status, 'warn');
  assert.equal(plan.sourceIngestDryRun.status, 'ok');
  assert.equal(plan.sourceIngestDryRun.thread.sourceThreadId, 'rollout-dry-run-thread');
  assert.equal(plan.steps.find(function (step) {
    return step.key === 'source.ingestDryRun';
  }).status, 'ok');
});
