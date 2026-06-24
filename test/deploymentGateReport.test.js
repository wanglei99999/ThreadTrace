'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getDeploymentGateReport } = require('../src/application/use-cases/getDeploymentGateReport');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('deployment gate aggregates rollout resources checklist and runbook', function () {
  const report = getDeploymentGateReport({
    now: '2026-06-19T10:00:00.000Z',
    rolloutManifestPlan: {
      status: 'ok',
      sourceKey: 'nga',
      sourceType: 'saved-html-directory',
      steps: [],
      nextActions: []
    },
    resourceProvisioningPlan: {
      status: 'fail',
      environment: {
        storageMode: 'postgres'
      },
      resources: [
        {
          key: 'source.externalLocation',
          area: 'sources',
          required: true,
          status: 'fail',
          summary: 'Provision source-specific location settings for the connector handler.',
          evidenceSummary: 'missingRequiredFields=tenantId'
        }
      ],
      nextActions: [
        {
          key: 'source.externalLocation',
          severity: 'critical',
          summary: 'Provision source-specific location settings for the connector handler.',
          commands: ['node src/presentation/cli/threadtrace.js runtime-diagnostics'],
          evidence: {
            missingRequiredFields: ['tenantId']
          },
          evidenceSummary: 'missingRequiredFields=tenantId'
        }
      ]
    },
    deploymentChecklist: {
      status: 'ok',
      items: []
    },
    operationsRunbook: {
      status: 'warn',
      actionCount: 1,
      actions: [
        {
          key: 'checklist.workers.readiness',
          severity: 'warning',
          recommendedCommand: 'node src/presentation/cli/threadtrace.js worker-topology-plan'
        }
      ]
    }
  });

  assert.equal(report.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(report.status, 'fail');
  assert.equal(report.gateCount, 4);
  assert.deepEqual(report.gates.map(function (gate) { return gate.key; }), [
    'rollout.manifest',
    'resources.provisioning',
    'deployment.checklist',
    'operations.runbook'
  ]);
  assert.equal(report.nextActions[0].key, 'resources.provisioning');
  assert.ok(report.nextActions[0].commands.includes('node src/presentation/cli/threadtrace.js runtime-diagnostics'));
  const resourceGate = report.gates.find(function (gate) {
    return gate.key === 'resources.provisioning';
  });
  assert.equal(resourceGate.evidence.failingResources[0].key, 'source.externalLocation');
  assert.equal(resourceGate.evidence.failingResources[0].evidenceSummary, 'missingRequiredFields=tenantId');
  assert.equal(resourceGate.evidence.actionDetails[0].evidenceSummary, 'missingRequiredFields=tenantId');
  assert.equal(report.nextActions[0].details[0].key, 'source.externalLocation');
  assert.deepEqual(report.nextActions[0].details[0].evidence.missingRequiredFields, ['tenantId']);
});

test('deployment gate carries source diagnostics actions from deployment checklist', function () {
  const report = getDeploymentGateReport({
    now: '2026-06-19T10:00:00.000Z',
    rolloutManifestPlan: {
      status: 'ok',
      steps: [],
      nextActions: []
    },
    resourceProvisioningPlan: {
      status: 'ok',
      resources: [],
      nextActions: []
    },
    deploymentChecklist: {
      status: 'fail',
      items: [
        {
          key: 'sources.ingestConfiguration',
          status: 'fail',
          summary: 'Tracked sources have usable locations, handlers, and adapters.',
          evidence: {
            sourceCount: 1,
            summary: {
              nextActionCount: 1
            }
          }
        }
      ],
      sourceDiagnostics: {
        status: 'fail',
        sourceCount: 1,
        nextActions: [
          {
            key: 'source.handler',
            sourceId: 'source-broken',
            severity: 'critical',
            summary: 'Register a source ingest handler for Broken feed through the connector catalog or a connector module.',
            commands: [
              'node src/presentation/cli/threadtrace.js connector-catalog',
              'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'
            ],
            evidence: {
              sourceId: 'source-broken',
              sourceType: 'external-feed',
              registeredHandler: false
            },
            evidenceSummary: 'sourceId=source-broken sourceType=external-feed registeredHandler=false'
          }
        ],
        sources: []
      }
    },
    operationsRunbook: {
      status: 'ok',
      actionCount: 0,
      actions: []
    }
  });

  const action = report.nextActions.find(function (item) {
    return item.key === 'deployment.checklist';
  });
  const gate = report.gates.find(function (item) {
    return item.key === 'deployment.checklist';
  });

  assert.equal(report.status, 'fail');
  assert.equal(gate.evidence.sourceActionCount, 1);
  assert.equal(gate.evidence.sourceActionDetails[0].key, 'source.handler');
  assert.ok(action.commands.includes('node src/presentation/cli/threadtrace.js connector-catalog'));
  assert.equal(action.details[0].key, 'source.handler');
  assert.equal(action.details[0].sourceId, 'source-broken');
  assert.match(action.details[0].evidenceSummary, /registeredHandler=false/);
});

test('runtime deployment gate composes rollout and resource reports', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-deployment-gate-'));
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    env: {
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    },
    storeDir: path.join(tempDir, 'store')
  });
  const report = await runtime.getDeploymentGateReport({
    now: '2026-06-19T10:00:00.000Z',
    storeDir: path.join(tempDir, 'store'),
    manifest: {
      version: '1.0',
      name: 'gate-rollout',
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

  assert.equal(report.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(report.status, 'warn');
  assert.equal(report.rolloutManifestPlan.status, 'warn');
  assert.equal(report.resourceProvisioningPlan.status, 'ok');
  assert.equal(report.operationsRunbook.status, 'ok');
  assert.equal(report.gates.find(function (gate) {
    return gate.key === 'resources.provisioning';
  }).status, 'ok');
});
