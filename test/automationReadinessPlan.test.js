'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getAutomationReadinessPlan } = require('../src/application/use-cases/getAutomationReadinessPlan');

test('automation readiness plan highlights missing schedule, mock LLM, and demo closure', function () {
  const plan = getAutomationReadinessPlan({
    now: '2026-06-26T10:00:00.000Z',
    sourceKey: 'nga',
    sourceScheduleReport: {
      generatedAt: '2026-06-26T09:59:00.000Z',
      summary: {
        total: 1,
        due: 0,
        skipped: 1,
        byReason: { 'no-schedule': 1 },
        byCollectionStatus: { unscheduled: 1 }
      },
      unfilteredSummary: {
        total: 1,
        due: 0,
        skipped: 1,
        byCollectionStatus: { unscheduled: 1 }
      },
      skippedSources: [
        {
          id: 'source-1',
          sourceKey: 'nga',
          sourceType: 'saved-html-directory',
          displayName: 'NGA sample',
          decision: { due: false, reason: 'no-schedule' },
          collectionPlan: { status: 'unscheduled' }
        }
      ]
    },
    sourceOperationsCockpit: {
      status: 'ok',
      summary: { total: 0, runnable: 0, highestPriorityScore: 0 }
    },
    sourceCollectionHealthProfile: {
      generatedAt: '2026-06-26T09:59:20.000Z',
      status: 'warn',
      sourceFound: true,
      source: { id: 'source-1', sourceKey: 'nga', sourceType: 'saved-html-directory' },
      automation: { status: 'unscheduled' },
      replay: { available: true }
    },
    workerTopologyPlan: {
      status: 'ok',
      topology: 'operations-worker',
      sourceTaskMode: 'insight-pipeline',
      workers: [
        {
          key: 'worker.operations',
          workerType: 'operations',
          leaseKey: 'operations:global',
          intervalMs: 60000,
          command: 'node src/presentation/worker/operationsWorkerMain.js --loop --source-task-mode insight-pipeline'
        }
      ]
    },
    llmReadinessProfile: {
      status: 'warn',
      provider: 'mock',
      mode: 'configuration',
      readiness: { mockMode: true }
    }
  });

  assert.equal(plan.status, 'warn');
  assert.equal(plan.readyForUnattendedRun, false);
  assert.equal(plan.summary.sources.total, 1);
  assert.equal(plan.summary.sources.byCollectionStatus.unscheduled, 1);
  assert.equal(plan.summary.representativeSource.status, 'warn');
  assert.equal(plan.automation.workerCommands[0].workerType, 'operations');
  assert.equal(plan.remediation.status, 'actionable');
  assert.equal(plan.remediation.actionCount, 1);
  assert.equal(plan.remediation.safeToAutoApply, true);
  assert.equal(plan.remediation.actions[0].type, 'configure-source-schedule');
  assert.equal(plan.remediation.actions[0].dryRun.path, '/api/sources/source-1/schedule');
  assert.equal(plan.remediation.actions[0].dryRun.body.execute, false);
  assert.equal(plan.remediation.actions[0].execute.body.execute, true);
  assert.match(plan.remediation.actions[0].executeCommand, /configure-source-schedule --source-id source-1/);
  assert.equal(plan.checks.find(function (item) {
    return item.key === 'automation.sources.scheduled';
  }).status, 'warn');
  assert.equal(plan.checks.find(function (item) {
    return item.key === 'automation.demo.closure';
  }).value, 'not-run');
  assert.ok(plan.nextActions.some(function (action) {
    return action.key === 'automationReadiness.automation.demo.closure' && /run-demo-cycle/.test(action.recommendedCommand);
  }));
});

test('automation readiness plan reports unattended ready when all gates are green', function () {
  const plan = getAutomationReadinessPlan({
    now: '2026-06-26T10:00:00.000Z',
    sourceId: 'source-1',
    sourceScheduleReport: {
      summary: {
        total: 1,
        due: 1,
        skipped: 0,
        byReason: { 'interval-elapsed': 1 },
        byCollectionStatus: { due: 1 }
      },
      unfilteredSummary: {
        total: 1,
        due: 1,
        skipped: 0,
        byCollectionStatus: { due: 1 }
      },
      dueSources: [
        {
          id: 'source-1',
          sourceKey: 'nga',
          sourceType: 'thread-url',
          displayName: 'NGA online',
          decision: { due: true, reason: 'interval-elapsed' },
          collectionPlan: { status: 'due' }
        }
      ]
    },
    sourceOperationsCockpit: {
      status: 'ok',
      summary: { total: 1, runnable: 1, highestPriorityScore: 46 }
    },
    sourceCollectionHealthProfile: {
      status: 'ok',
      sourceFound: true,
      source: { id: 'source-1', sourceKey: 'nga', sourceType: 'thread-url' },
      automation: { status: 'due' },
      replay: { available: true }
    },
    workerTopologyPlan: {
      status: 'ok',
      topology: 'split-workers',
      sourceTaskMode: 'insight-pipeline',
      workers: [
        {
          key: 'worker.dueSource',
          workerType: 'due-source',
          leaseKey: 'due-source:source-1',
          intervalMs: 60000,
          command: 'node src/presentation/worker/dueSourceWorkerMain.js --loop --source-task-mode insight-pipeline --source-id source-1'
        }
      ]
    },
    llmReadinessProfile: {
      status: 'ok',
      provider: 'openai-compatible',
      mode: 'evaluation',
      readiness: { mockMode: false, evaluationPassed: true }
    },
    demoCycle: {
      status: 'ok',
      closure: {
        status: 'ok',
        readyForDailyUse: true
      }
    }
  });

  assert.equal(plan.status, 'ok');
  assert.equal(plan.readyForUnattendedRun, true);
  assert.equal(plan.automation.dueSources[0].id, 'source-1');
  assert.equal(plan.remediation.status, 'none');
  assert.equal(plan.remediation.actionCount, 0);
  assert.equal(plan.summary.llm.provider, 'openai-compatible');
  assert.equal(plan.nextActions[0].key, 'automationReadiness.ready');
  assert.match(plan.nextActions[0].recommendedCommand, /dueSourceWorkerMain/);
});
