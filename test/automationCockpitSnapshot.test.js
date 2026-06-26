'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getAutomationCockpitSnapshot } = require('../src/application/use-cases/getAutomationCockpitSnapshot');

test('automation cockpit snapshot aggregates readiness and operating pressure', function () {
  const snapshot = getAutomationCockpitSnapshot({
    now: '2026-06-26T12:00:00.000Z',
    plan: {
      generatedAt: '2026-06-26T11:59:00.000Z',
      status: 'ok',
      readyForUnattendedRun: true,
      inputs: {
        scheduleGeneratedAt: '2026-06-26T11:59:05.000Z',
        cockpitGeneratedAt: '2026-06-26T11:59:10.000Z',
        collectionHealthGeneratedAt: '2026-06-26T11:59:15.000Z',
        workerTopologyGeneratedAt: '2026-06-26T11:59:20.000Z',
        llmReadinessGeneratedAt: '2026-06-26T11:59:25.000Z'
      },
      summary: {
        workers: { status: 'ok' }
      },
      automation: {
        workerCommands: [
          {
            key: 'worker.operations',
            workerType: 'operations',
            leaseKey: 'worker:operations',
            intervalMs: 60000,
            command: 'node src/presentation/worker/operationsWorkerMain.js --loop'
          }
        ]
      },
      remediation: {
        actions: [
          {
            key: 'schedule.source-1',
            severity: 'warning',
            scope: { sourceId: 'source-1', sourceKey: 'nga' },
            command: 'node src/presentation/cli/threadtrace.js configure-source-schedule --source-id source-1',
            executeCommand: 'node src/presentation/cli/threadtrace.js configure-source-schedule --source-id source-1 --execute true'
          }
        ],
        manualActions: [
          {
            key: 'llm.readiness',
            checkKey: 'automation.llm.readiness',
            command: 'node src/presentation/cli/threadtrace.js llm-readiness --json true'
          }
        ]
      }
    },
    notificationOverview: {
      generatedAt: '2026-06-26T11:59:30.000Z',
      status: 'ok',
      openCount: 2,
      pendingDeliveryCount: 1
    },
    reviewActionAuditOverview: {
      generatedAt: '2026-06-26T11:59:35.000Z',
      status: 'warn',
      count: 3
    },
    reviewActionExecutions: {
      generatedAt: '2026-06-26T11:59:40.000Z',
      status: 'ok',
      count: 4
    },
    notificationDiagnostics: {
      generatedAt: '2026-06-26T11:59:45.000Z',
      checks: [
        { key: 'notifications.channel', status: 'ok' }
      ]
    }
  });

  assert.equal(snapshot.schemaVersion, 'automation-cockpit-snapshot.v1');
  assert.equal(snapshot.generatedAt, '2026-06-26T12:00:00.000Z');
  assert.equal(snapshot.status, 'warn');
  assert.equal(snapshot.readyForUnattendedRun, false);
  assert.equal(snapshot.summary.readinessStatus, 'ok');
  assert.equal(snapshot.summary.auditStatus, 'warn');
  assert.equal(snapshot.summary.diagnosticsStatus, 'ok');
  assert.equal(snapshot.summary.openNotificationCount, 2);
  assert.equal(snapshot.summary.pendingNotificationCount, 1);
  assert.equal(snapshot.summary.auditCount, 3);
  assert.equal(snapshot.summary.executionCount, 4);
  assert.equal(snapshot.operatingPressure.status, 'warn');
  assert.equal(snapshot.operatingPressure.outbox.status, 'warn');
  assert.equal(snapshot.operatingPressure.outbox.openCount, 2);
  assert.equal(snapshot.operatingPressure.outbox.pendingCount, 1);
  assert.equal(snapshot.operatingPressure.audit.status, 'warn');
  assert.equal(snapshot.operatingPressure.audit.auditCount, 3);
  assert.equal(snapshot.operatingPressure.executions.status, 'ok');
  assert.equal(snapshot.operatingPressure.executions.count, 4);
  assert.equal(snapshot.operatingPressure.channel.status, 'ok');
  assert.equal(snapshot.freshness.status, 'warn');
  assert.equal(snapshot.freshness.sourceCount, 12);
  assert.equal(snapshot.freshness.presentSourceCount, 11);
  assert.equal(snapshot.freshness.missingSourceCount, 1);
  assert.deepEqual(snapshot.freshness.missingSources, ['demoCycle']);
  assert.equal(snapshot.freshness.oldestGeneratedAt, '2026-06-26T11:59:00.000Z');
  assert.equal(snapshot.freshness.newestGeneratedAt, '2026-06-26T12:00:00.000Z');
  assert.equal(snapshot.freshness.spanMs, 60000);
  assert.equal(snapshot.operatorRunbook.commandCount, 6);
  assert.equal(snapshot.operatorRunbook.actionableCommandCount, 2);
  assert.equal(snapshot.operatorRunbook.dryRunCommandCount, 1);
  assert.equal(snapshot.operatorRunbook.executeCommandCount, 1);
  assert.equal(snapshot.operatorRunbook.copyOnlyCommandCount, 4);
  assert.equal(snapshot.attentionQueue.status, 'warn');
  assert.equal(snapshot.attentionQueue.itemCount, 4);
  assert.equal(snapshot.attentionQueue.warningCount, 4);
  assert.equal(snapshot.attentionQueue.criticalCount, 0);
  assert.equal(snapshot.attentionQueue.highestSeverity, 'warning');
  assert.equal(snapshot.attentionQueue.nextItem.rank, 1);
  assert.equal(snapshot.attentionQueue.items[0].id, 'freshness');
  assert.equal(snapshot.attentionQueue.items[0].targetPanel, 'automation-freshness');
  assert.equal(snapshot.attentionQueue.items[0].actionLabel, 'Open freshness');
  assert.equal(snapshot.attentionQueue.items[0].nextActionKey, 'refresh-automation-readiness');
  assert.equal(snapshot.attentionQueue.items[0].nextActionLabel, 'Refresh now');
  assert.ok(snapshot.attentionQueue.items.some(function (item) {
    return item.id === 'pressure.outbox' && item.area === 'notifications' && item.targetPanel === 'automation-pressure';
  }));
  assert.ok(snapshot.attentionQueue.items.some(function (item) {
    return item.id === 'pressure.audit' && item.area === 'review-audit';
  }));
  assert.ok(snapshot.attentionQueue.items.some(function (item) {
    return item.id === 'runbook.actionable' && item.targetPanel === 'automation-runbook' && item.nextActionKey === 'preview-runbook-command' && /actionable=2/.test(item.summary);
  }));
  assert.equal(snapshot.operatorRunbook.nextCommand.key, 'schedule.preview.schedule.source-1');
  assert.equal(snapshot.operatorRunbook.sections.find(function (section) {
    return section.key === 'workers';
  }).commands[0].command, 'node src/presentation/worker/operationsWorkerMain.js --loop');
  assert.ok(snapshot.operatorRunbook.sections.find(function (section) {
    return section.key === 'schedule';
  }).commands.some(function (command) {
    return /--execute true/.test(command.command);
  }));
  assert.deepEqual(snapshot.operatorRunbook.sections.find(function (section) {
    return section.key === 'schedule';
  }).commands.map(function (command) {
    return {
      type: command.intent && command.intent.type,
      sourceId: command.intent && command.intent.sourceId,
      execute: command.intent && command.intent.execute,
      intervalMinutes: command.intent && command.intent.intervalMinutes,
      runNow: command.intent && command.intent.runNow
    };
  }), [
    { type: 'set-source-schedule', sourceId: 'source-1', execute: false, intervalMinutes: 60, runNow: true },
    { type: 'set-source-schedule', sourceId: 'source-1', execute: true, intervalMinutes: 60, runNow: true }
  ]);
  assert.ok(snapshot.operatorRunbook.sections.find(function (section) {
    return section.key === 'verification';
  }).commands.some(function (command) {
    return command.command === 'npm run verify:web:automation-cockpit';
  }));
});

test('automation cockpit snapshot fails when any component fails', function () {
  const snapshot = getAutomationCockpitSnapshot({
    plan: {
      generatedAt: '2026-06-26T12:00:00.000Z',
      status: 'ok',
      readyForUnattendedRun: true
    },
    notificationOverview: { status: 'fail' },
    reviewActionAuditOverview: { status: 'ok' },
    reviewActionExecutions: { status: 'ok' },
    notificationDiagnostics: { status: 'ok' }
  });

  assert.equal(snapshot.status, 'fail');
  assert.equal(snapshot.readyForUnattendedRun, false);
  assert.equal(snapshot.operatingPressure.status, 'fail');
  assert.equal(snapshot.operatingPressure.outbox.status, 'fail');
  assert.equal(snapshot.attentionQueue.status, 'fail');
  assert.equal(snapshot.attentionQueue.criticalCount, 1);
  assert.equal(snapshot.attentionQueue.items[0].id, 'pressure.outbox');
});
