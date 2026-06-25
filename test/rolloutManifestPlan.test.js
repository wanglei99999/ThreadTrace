'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getRolloutManifestPlan } = require('../src/application/use-cases/getRolloutManifestPlan');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('rollout manifest plan aggregates connector and worker plans', function () {
  const plan = getRolloutManifestPlan({
    now: '2026-06-19T10:00:00.000Z',
    manifest: {
      version: '1.0',
      name: 'external-rollout',
      source: {
        sourceKey: 'external',
        sourceType: 'external-feed'
      },
      connector: {
        modulePath: 'D:/connectors/external.cjs'
      }
    },
    connectorRolloutPlan: {
      status: 'warn',
      sourceKey: 'external',
      sourceType: 'external-feed',
      modulePath: 'D:/connectors/external.cjs',
      steps: [],
      nextActions: [
        {
          command: 'node src/presentation/cli/threadtrace.js source-ingest-dry-run'
        }
      ]
    },
    workerTopologyPlan: {
      status: 'ok',
      topology: 'operations-worker',
      storageMode: 'file',
      sourceTaskMode: 'ingest',
      workers: [{}],
      nextActions: []
    }
  });

  assert.equal(plan.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(plan.status, 'warn');
  assert.equal(plan.name, 'external-rollout');
  assert.equal(plan.sourceKey, 'external');
  assert.equal(plan.sourceType, 'external-feed');
  assert.equal(plan.modulePath, 'D:/connectors/external.cjs');
  assert.deepEqual(plan.steps.map(function (step) { return step.key; }), [
    'manifest.structure',
    'connector.rollout',
    'workers.topology'
  ]);
  assert.equal(plan.nextActions.length, 1);
  assert.equal(plan.nextActions[0].key, 'connector.rollout');
  assert.deepEqual(plan.nextActions[0].relatedCommands, [
    'node src/presentation/cli/threadtrace.js source-ingest-dry-run'
  ]);
});

test('rollout manifest plan fails invalid manifest structure', function () {
  const plan = getRolloutManifestPlan({
    manifest: {
      source: {
        sourceKey: 'external'
      }
    }
  });

  assert.equal(plan.status, 'fail');
  assert.equal(plan.steps[0].status, 'fail');
  assert.ok(plan.steps[0].evidence.errors.includes('source.sourceType is required'));
  assert.equal(plan.nextActions[0].key, 'manifest.structure');
});

test('runtime rollout manifest plan composes rollout and worker planning', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-rollout-manifest-'));
  const inputFile = path.join(tempDir, 'thread.json');
  await fs.writeFile(inputFile, JSON.stringify({
    sourceKey: 'external',
    sourceThreadId: 'manifest-thread-1',
    title: 'Manifest thread',
    posts: []
  }, null, 2) + '\n', 'utf8');

  const runtime = createThreadTraceRuntime({
    env: {
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    },
    storeDir: path.join(tempDir, 'store')
  });
  const plan = await runtime.getRolloutManifestPlan({
    now: '2026-06-19T10:00:00.000Z',
    manifest: {
      version: '1.0',
      name: 'json-rollout',
      source: {
        sourceKey: 'external',
        sourceType: 'normalized-thread-json',
        displayName: 'External JSON',
        inputFile
      },
      ingest: {
        dryRun: true
      },
      workers: {
        topology: 'operations-worker',
        sourceTaskMode: 'ingest'
      }
    }
  });

  assert.equal(plan.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(plan.status, 'warn');
  assert.equal(plan.connectorRolloutPlan.sourceIngestDryRun.status, 'ok');
  assert.equal(plan.connectorRolloutPlan.sourceIngestDryRun.thread.sourceThreadId, 'manifest-thread-1');
  assert.equal(plan.workerTopologyPlan.status, 'ok');
  assert.equal(plan.workerTopologyPlan.topology, 'operations-worker');
});

test('runtime rollout manifest plan scopes worker commands when source id is known', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-rollout-manifest-source-scope-'));
  const inputFile = path.join(tempDir, 'thread.json');
  await fs.writeFile(inputFile, JSON.stringify({
    sourceKey: 'external',
    sourceThreadId: 'manifest-thread-1',
    title: 'Manifest thread',
    posts: []
  }, null, 2) + '\n', 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const plan = await runtime.getRolloutManifestPlan({
    now: '2026-06-19T10:00:00.000Z',
    manifest: {
      version: '1.0',
      name: 'json-rollout',
      source: {
        sourceId: 'source-external-1',
        sourceKey: 'external',
        sourceType: 'normalized-thread-json',
        displayName: 'External JSON',
        inputFile
      },
      ingest: {
        dryRun: true
      },
      workers: {
        topology: 'split-workers',
        sourceTaskMode: 'ingest'
      }
    }
  });

  assert.equal(plan.workerTopologyPlan.sourceId, 'source-external-1');
  assert.equal(plan.workerTopologyPlan.sourceKey, 'external');
  assert.match(plan.workerTopologyPlan.workers[0].command, /--source-key external/);
  assert.match(plan.workerTopologyPlan.workers[0].command, /--source-id source-external-1/);
  assert.match(plan.workerTopologyPlan.workers[1].command, /--source-id source-external-1/);
});

test('documented external rollout manifest composes connector dry-run', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-external-rollout-manifest-'));
  const cwd = path.resolve(__dirname, '..');
  const manifest = JSON.parse(await fs.readFile(path.join(cwd, 'docs', 'examples', 'external-rollout-manifest.sample.json'), 'utf8'));
  const runtime = createThreadTraceRuntime({
    cwd,
    env: {
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    },
    storeDir: path.join(tempDir, 'store')
  });

  const plan = await runtime.getRolloutManifestPlan({
    now: '2026-06-19T10:00:00.000Z',
    manifest
  });

  assert.equal(plan.sourceType, 'external-normalized-feed');
  assert.equal(plan.connectorRolloutPlan.connectorModuleValidation.valid, true);
  assert.equal(plan.connectorRolloutPlan.sourceIngestDryRun.status, 'ok');
  assert.equal(plan.connectorRolloutPlan.sourceIngestDryRun.thread.sourceThreadId, 'external-thread-1');
  assert.equal(plan.workerTopologyPlan.status, 'ok');
});

test('documented external package rollout manifest composes connector dry-run', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-external-package-rollout-manifest-'));
  const cwd = path.resolve(__dirname, '..');
  const manifest = JSON.parse(await fs.readFile(path.join(cwd, 'docs', 'examples', 'external-package-rollout-manifest.sample.json'), 'utf8'));
  const runtime = createThreadTraceRuntime({
    cwd,
    env: {
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    },
    storeDir: path.join(tempDir, 'store')
  });

  const plan = await runtime.getRolloutManifestPlan({
    now: '2026-06-19T10:00:00.000Z',
    manifest
  });

  assert.equal(plan.sourceKey, 'external-package');
  assert.equal(plan.sourceType, 'package-normalized-feed');
  assert.equal(plan.modulePath, 'docs/examples/external-connector-package/index.cjs');
  assert.equal(plan.connectorRolloutPlan.connectorModuleValidation.valid, true);
  assert.equal(plan.connectorRolloutPlan.connectorModuleValidation.contractSummary.sourceIngestHandlers[0].capabilities.packageTemplate, true);
  assert.equal(plan.connectorRolloutPlan.sourceIngestDryRun.status, 'ok');
  assert.equal(plan.connectorRolloutPlan.sourceIngestDryRun.thread.sourceThreadId, 'external-thread-1');
  assert.equal(plan.workerTopologyPlan.status, 'ok');
});

test('documented rss archive package rollout manifest composes connector dry-run', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-rss-archive-rollout-manifest-'));
  const cwd = path.resolve(__dirname, '..');
  const manifest = JSON.parse(await fs.readFile(path.join(cwd, 'docs', 'examples', 'rss-archive-rollout-manifest.sample.json'), 'utf8'));
  const runtime = createThreadTraceRuntime({
    cwd,
    env: {
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    },
    storeDir: path.join(tempDir, 'store')
  });

  const plan = await runtime.getRolloutManifestPlan({
    now: '2026-06-25T10:00:00.000Z',
    manifest
  });

  assert.equal(plan.sourceKey, 'rss-archive');
  assert.equal(plan.sourceType, 'rss-archive-normalized-feed');
  assert.equal(plan.modulePath, 'docs/examples/rss-archive-connector-package/index.cjs');
  assert.equal(plan.connectorRolloutPlan.connectorModuleValidation.valid, true);
  assert.equal(
    plan.connectorRolloutPlan.connectorModuleValidation.packageManifests[0].packageName,
    '@threadtrace/example-rss-archive-connector-package'
  );
  assert.equal(
    plan.connectorRolloutPlan.connectorModuleValidation.contractSummary.sourceIngestHandlers[0].capabilities.rssTemplate,
    true
  );
  assert.equal(
    plan.connectorRolloutPlan.connectorModuleValidation.contractSummary.sourceIngestHandlers[0].capabilities.archiveTemplate,
    true
  );
  assert.equal(plan.connectorRolloutPlan.sourceIngestDryRun.status, 'ok');
  assert.equal(plan.connectorRolloutPlan.sourceIngestDryRun.thread.sourceThreadId, 'external-thread-1');
  assert.equal(plan.workerTopologyPlan.status, 'ok');
});
