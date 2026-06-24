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
  assert.equal(report.rollbackPlan.available, false);
  assert.match(report.rollbackPlan.commands[1], /disable-source --source-id <source-id> --execute true/);
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
          commands: ['node src/presentation/cli/threadtrace.js runtime-diagnostics'],
          details: [
            {
              key: 'source.externalLocation',
              severity: 'critical',
              summary: 'Provision source-specific location settings for the connector handler.',
              evidence: {
                missingRequiredFields: ['inputFile']
              },
              evidenceSummary: 'missingRequiredFields=inputFile'
            }
          ]
        }
      ]
    }
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.applied, false);
  const gateAction = report.nextActions.find(function (action) {
    return action.key === 'deployment.gate.actions';
  });
  assert.ok(gateAction);
  assert.equal(gateAction.details[0].key, 'source.externalLocation');
  assert.equal(gateAction.details[0].evidenceSummary, 'missingRequiredFields=inputFile');
  assert.deepEqual(gateAction.details[0].evidence.missingRequiredFields, ['inputFile']);
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
  assert.equal(report.rollbackPlan.available, true);
  assert.match(report.rollbackPlan.commands[0], new RegExp('disable-source --source-id ' + report.registration.source.id + ' --execute true'));
  assert.equal(sources.length, 1);
  assert.equal(sources[0].displayName, 'Apply sample archive');
});

test('runtime rollout manifest apply task records audit trail and replays idempotency', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-rollout-apply-task-'));
  const storeDir = path.join(tempDir, 'store');
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir
  });
  const first = await runtime.runRolloutManifestApplyTask({
    manifest: sampleManifest(),
    now: '2026-06-19T10:00:00.000Z',
    storeDir,
    requestId: 'rollout-request-1',
    traceId: 'rollout-trace-1',
    idempotencyKey: 'rollout-idem-1'
  });
  const replay = await runtime.runRolloutManifestApplyTask({
    manifest: sampleManifest(),
    now: '2026-06-19T10:00:00.000Z',
    storeDir,
    requestId: 'rollout-request-2',
    traceId: 'rollout-trace-2',
    idempotencyKey: 'rollout-idem-1'
  });
  const tasks = await runtime.listTasks({
    storeDir,
    type: 'rollout-manifest-apply'
  });

  assert.equal(first.task.type, 'rollout-manifest-apply');
  assert.equal(first.task.status, 'completed');
  assert.equal(first.task.output.report.status, 'warn');
  assert.equal(first.task.output.report.rollbackPlan.available, false);
  assert.equal(first.task.input._trace.requestId, 'rollout-request-1');
  assert.equal(replay.task.id, first.task.id);
  assert.equal(replay.idempotency.reused, true);
  assert.equal(tasks.length, 1);
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
