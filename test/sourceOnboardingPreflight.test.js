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
