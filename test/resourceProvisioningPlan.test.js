'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getResourceProvisioningPlan } = require('../src/application/use-cases/getResourceProvisioningPlan');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('resource provisioning plan lists required postgres resources and actions', function () {
  const plan = getResourceProvisioningPlan({
    now: '2026-06-19T10:00:00.000Z',
    config: {
      storageMode: 'postgres',
      http: {
        host: '127.0.0.1',
        port: 3017
      },
      workers: {
        sourceTaskMode: 'ingest'
      },
      llm: {
        provider: 'mock'
      },
      notifications: {},
      connectors: {
        modules: []
      }
    },
    runtimeDiagnostics: {
      checks: [
        {
          key: 'resources.postgres',
          status: 'fail',
          value: 'missing',
          summary: 'PostgreSQL ping failed.'
        }
      ],
      configuration: {
        connectors: {
          errorCount: 0
        }
      }
    },
    deploymentChecklist: {
      items: [
        {
          key: 'workers.readiness',
          status: 'ok'
        },
        {
          key: 'notifications.channel',
          status: 'warn'
        },
        {
          key: 'llm.configuration',
          status: 'ok'
        }
      ]
    }
  });

  assert.equal(plan.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(plan.status, 'fail');
  const storage = plan.resources.find(function (item) {
    return item.key === 'storage.postgres';
  });
  assert.equal(storage.required, true);
  assert.equal(storage.status, 'fail');
  assert.ok(storage.env.includes('THREADTRACE_DATABASE_URL or DATABASE_URL'));
  const reviewActions = plan.resources.find(function (item) {
    return item.key === 'reviewActions.executor';
  });
  assert.equal(reviewActions.required, false);
  assert.equal(reviewActions.status, 'warn');
  assert.ok(reviewActions.env.includes('THREADTRACE_REVIEW_ACTION_EXECUTOR'));
  assert.match(reviewActions.commands[0], /review-action-executor-diagnostics/);
  assert.equal(plan.nextActions[0].key, 'storage.postgres');
});

test('resource provisioning plan includes source and connector requirements from manifest', function () {
  const plan = getResourceProvisioningPlan({
    config: {
      storageMode: 'file',
      http: {
        host: '127.0.0.1',
        port: 3017
      },
      workers: {
        sourceTaskMode: 'ingest'
      },
      llm: {
        provider: 'mock'
      },
      notifications: {},
      reviewActions: {
        executor: 'file-audit'
      },
      connectors: {
        modules: []
      }
    },
    runtimeDiagnostics: {
      checks: [
        {
          key: 'resources.storeDir',
          status: 'ok',
          value: 'data/store',
          summary: 'Store directory is writable.'
        }
      ],
      configuration: {
        connectors: {
          errorCount: 0
        }
      }
    },
    manifest: {
      source: {
        sourceKey: 'external',
        sourceType: 'saved-html-directory',
        inputDir: 'example'
      }
    },
    rolloutManifestPlan: {
      modulePath: 'D:/connectors/external.cjs',
      workerTopologyPlan: {
        status: 'ok',
        topology: 'operations-worker',
        workers: [
          {
            command: 'node src/presentation/worker/operationsWorkerMain.js --loop'
          }
        ]
      }
    },
    deploymentChecklist: {
      items: [
        {
          key: 'notifications.channel',
          status: 'ok'
        },
        {
          key: 'llm.configuration',
          status: 'ok'
        },
        {
          key: 'reviewActions.executor',
          status: 'ok',
          evidence: {
            mode: 'file-audit',
            ready: true,
            dryRunOnly: false
          }
        }
      ]
    }
  });

  assert.equal(plan.status, 'ok');
  assert.equal(plan.environment.sourceKey, 'external');
  assert.equal(plan.resources.find(function (item) {
    return item.key === 'source.inputDirectory';
  }).status, 'ok');
  const connector = plan.resources.find(function (item) {
    return item.key === 'connectors.modules';
  });
  assert.equal(connector.required, true);
  assert.equal(connector.status, 'ok');
  assert.equal(plan.environment.reviewActionExecutor, 'file-audit');
  const reviewActions = plan.resources.find(function (item) {
    return item.key === 'reviewActions.executor';
  });
  assert.equal(reviewActions.status, 'ok');
  assert.equal(reviewActions.evidence.checklist, 'ok');
  assert.equal(reviewActions.evidence.diagnostics.mode, 'file-audit');
});

test('runtime resource provisioning plan composes diagnostics and manifest planning', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-resource-plan-'));
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: path.join(tempDir, 'store')
  });
  const plan = await runtime.getResourceProvisioningPlan({
    now: '2026-06-19T10:00:00.000Z',
    storeDir: path.join(tempDir, 'store'),
    manifest: {
      version: '1.0',
      name: 'resource-rollout',
      source: {
        sourceKey: 'nga',
        sourceType: 'saved-html-directory',
        displayName: 'NGA sample archive',
        inputDir: path.resolve(__dirname, '..', 'example')
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
  assert.equal(plan.environment.manifestName, 'resource-rollout');
  assert.equal(plan.resources.find(function (item) {
    return item.key === 'storage.file';
  }).status, 'ok');
  assert.equal(plan.rolloutManifestPlan.connectorRolloutPlan.sourceIngestDryRun.status, 'ok');
});
