'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getAutomationCockpitSnapshot } = require('../src/application/use-cases/getAutomationCockpitSnapshot');

test('automation cockpit snapshot aggregates readiness and operating pressure', function () {
  const snapshot = getAutomationCockpitSnapshot({
    now: '2026-06-26T12:00:00.000Z',
    plan: {
      status: 'ok',
      readyForUnattendedRun: true
    },
    notificationOverview: {
      status: 'ok',
      openCount: 2,
      pendingDeliveryCount: 1
    },
    reviewActionAuditOverview: {
      status: 'warn',
      count: 3
    },
    reviewActionExecutions: {
      status: 'ok',
      count: 4
    },
    notificationDiagnostics: {
      status: 'ok'
    }
  });

  assert.equal(snapshot.schemaVersion, 'automation-cockpit-snapshot.v1');
  assert.equal(snapshot.generatedAt, '2026-06-26T12:00:00.000Z');
  assert.equal(snapshot.status, 'warn');
  assert.equal(snapshot.readyForUnattendedRun, false);
  assert.equal(snapshot.summary.readinessStatus, 'ok');
  assert.equal(snapshot.summary.auditStatus, 'warn');
  assert.equal(snapshot.summary.openNotificationCount, 2);
  assert.equal(snapshot.summary.pendingNotificationCount, 1);
  assert.equal(snapshot.summary.auditCount, 3);
  assert.equal(snapshot.summary.executionCount, 4);
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
});
