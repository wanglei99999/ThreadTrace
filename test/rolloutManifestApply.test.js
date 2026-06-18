'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getRolloutManifestApplyReport } = require('../src/application/use-cases/getRolloutManifestApplyReport');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('rollout manifest apply report stays dry-run by default', function () {
  const report = getRolloutManifestApplyReport({
    now: '2026-06-19T10:00:00.000Z',
    manifest: {
      name: 'dry-run'
    },
    sourceDraft: {
      sourceKey: 'nga',
      sourceType: 'saved-html-directory'
    },
    deploymentGate: {
      status: 'ok',
      gateCount: 4,
      nextActions: []
    }
  });

  assert.equal(report.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(report.status, 'ok');
  assert.equal(report.dryRun, true);
  assert.equal(report.applied, false);
  assert.equal(report.steps.find(function (step) {
    return step.key === 'source.registration';
  }).summary, 'Source registration is ready; dry-run mode did not write to the source repository.');
});

test('rollout manifest apply report blocks failing gates', function () {
  const report = getRolloutManifestApplyReport({
    execute: true,
    sourceDraft: {
      sourceKey: 'nga',
      sourceType: 'saved-html-directory'
    },
    deploymentGate: {
      status: 'fail',
      gateCount: 4,
      nextActions: [
        {
          commands: ['node src/presentation/cli/threadtrace.js runtime-diagnostics']
        }
      ]
    }
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.applied, false);
  assert.equal(report.nextActions.some(function (action) {
    return action.key === 'deployment.gate.actions';
  }), true);
});

test('runtime rollout manifest apply dry-run does not register source', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-rollout-apply-dry-run-'));
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: path.join(tempDir, 'store')
  });
  const manifest = sampleManifest();
  const report = await runtime.applyRolloutManifest({
    manifest,
    now: '2026-06-19T10:00:00.000Z',
    storeDir: path.join(tempDir, 'store')
  });
  const sources = await runtime.listSources({
    storeDir: path.join(tempDir, 'store')
  });

  assert.equal(report.status, 'warn');
  assert.equal(report.dryRun, true);
  assert.equal(report.applied, false);
  assert.equal(sources.length, 0);
});

test('runtime rollout manifest apply execute registers source', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-rollout-apply-execute-'));
  const storeDir = path.join(tempDir, 'store');
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir
  });
  const report = await runtime.applyRolloutManifest({
    manifest: sampleManifest(),
    execute: true,
    now: '2026-06-19T10:00:00.000Z',
    storeDir
  });
  const sources = await runtime.listSources({
    storeDir
  });

  assert.equal(report.status, 'warn');
  assert.equal(report.dryRun, false);
  assert.equal(report.applied, true);
  assert.equal(report.registration.created, true);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].displayName, 'Apply sample archive');
});

function sampleManifest() {
  return {
    version: '1.0',
    name: 'apply-rollout',
    source: {
      sourceKey: 'nga',
      sourceType: 'saved-html-directory',
      displayName: 'Apply sample archive',
      inputDir: path.resolve(__dirname, '..', 'example')
    },
    ingest: {
      dryRun: true
    },
    workers: {
      topology: 'operations-worker',
      sourceTaskMode: 'ingest'
    }
  };
}
