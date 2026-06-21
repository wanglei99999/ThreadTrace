'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getContextReviewActionExecutorDiagnostics
} = require('../src/application/use-cases/getContextReviewActionExecutorDiagnostics');

test('context review action executor diagnostics warns when executor is not configured', function () {
  const diagnostics = getContextReviewActionExecutorDiagnostics({
    mode: 'none',
    source: 'THREADTRACE_REVIEW_ACTION_EXECUTOR',
    auditOverview: {
      count: 0
    },
    now: '2026-06-21T12:00:00.000Z'
  });

  assert.equal(diagnostics.status, 'warn');
  assert.equal(diagnostics.ready, false);
  assert.equal(diagnostics.dryRunOnly, true);
  assert.deepEqual(diagnostics.methods.missing, ['closeTasks', 'mergeContext']);
  assert.equal(diagnostics.checks.find(function (check) {
    return check.key === 'reviewActionExecutor.configured';
  }).status, 'warn');
});

test('context review action executor diagnostics reports ready file-audit executor', function () {
  const diagnostics = getContextReviewActionExecutorDiagnostics({
    mode: 'file-audit',
    source: 'THREADTRACE_REVIEW_ACTION_EXECUTOR',
    executor: {
      async closeTasks() {},
      async mergeContext() {}
    },
    auditOverview: {
      status: 'ok',
      count: 2,
      taskCount: 1,
      plannedClosureCount: 1,
      plannedMergeCandidateCount: 1,
      latestGeneratedAt: '2026-06-21T11:00:00.000Z'
    },
    now: '2026-06-21T12:00:00.000Z'
  });

  assert.equal(diagnostics.status, 'ok');
  assert.equal(diagnostics.ready, true);
  assert.equal(diagnostics.dryRunOnly, false);
  assert.equal(diagnostics.mutatesSourceTruth, false);
  assert.equal(diagnostics.audit.count, 2);
  assert.equal(diagnostics.methods.closeTasks, true);
  assert.equal(diagnostics.methods.mergeContext, true);
  assert.equal(diagnostics.nextActions.some(function (action) {
    return action.key === 'reviewActionExecutor.fileAudit';
  }), true);
});

test('context review action executor diagnostics fails for partial configured executor', function () {
  const diagnostics = getContextReviewActionExecutorDiagnostics({
    mode: 'injected',
    source: 'runtime.contextReviewActionExecutor',
    executor: {
      async closeTasks() {}
    },
    auditOverview: {
      count: 0
    }
  });

  assert.equal(diagnostics.status, 'fail');
  assert.equal(diagnostics.ready, false);
  assert.deepEqual(diagnostics.methods.missing, ['mergeContext']);
});
