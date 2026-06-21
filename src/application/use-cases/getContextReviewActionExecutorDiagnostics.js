'use strict';

const {
  getContextReviewActionExecutorReadiness
} = require('../ports/contextReviewActionExecutor');

function getContextReviewActionExecutorDiagnostics(options) {
  const safeOptions = options || {};
  const readiness = getContextReviewActionExecutorReadiness(safeOptions.executor);
  const mode = safeOptions.mode || 'none';
  const auditOverview = safeOptions.auditOverview || {};
  const status = diagnosticStatus({
    mode,
    readiness
  });

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status,
    mode,
    source: safeOptions.source || mode,
    ready: readiness.ready,
    dryRunOnly: !readiness.ready,
    mutatesSourceTruth: Boolean(safeOptions.mutatesSourceTruth),
    methods: {
      closeTasks: readiness.hasCloseTasks,
      mergeContext: readiness.hasMergeContext,
      missing: readiness.missing
    },
    audit: {
      status: auditOverview.status || 'unknown',
      count: auditOverview.count || 0,
      taskCount: auditOverview.taskCount || 0,
      latestGeneratedAt: auditOverview.latestGeneratedAt,
      plannedClosureCount: auditOverview.plannedClosureCount || 0,
      plannedMergeCandidateCount: auditOverview.plannedMergeCandidateCount || 0
    },
    checks: [
      check('reviewActionExecutor.configured', mode === 'none' ? 'warn' : 'ok', mode, mode === 'none'
        ? 'No review action executor is configured; execute=true remains disabled.'
        : 'Review action executor mode is configured.'),
      check('reviewActionExecutor.closeTasks', readiness.hasCloseTasks ? 'ok' : 'fail', readiness.hasCloseTasks ? 'available' : 'missing', 'Executor closeTasks(request) method is required for execute=true.'),
      check('reviewActionExecutor.mergeContext', readiness.hasMergeContext ? 'ok' : 'fail', readiness.hasMergeContext ? 'available' : 'missing', 'Executor mergeContext(request) method is required for execute=true.'),
      check('reviewActionExecutor.audit', auditOverview.count > 0 ? 'ok' : 'warn', auditOverview.count || 0, auditOverview.count > 0
        ? 'Recent review action executor audit records are available.'
        : 'No review action executor audit records were found in the current window.')
    ],
    nextActions: nextActions({
      mode,
      readiness,
      auditOverview,
      mutatesSourceTruth: safeOptions.mutatesSourceTruth
    })
  };
}

function diagnosticStatus(input) {
  if (input.mode !== 'none' && !input.readiness.ready) return 'fail';
  if (!input.readiness.ready) return 'warn';
  return 'ok';
}

function nextActions(input) {
  const actions = [];
  if (!input.readiness.ready) {
    actions.push(action('reviewActionExecutor.configure', 'warning', 'Configure a ContextReviewActionExecutor before running review-action-apply with execute=true.', 'node src/presentation/cli/threadtrace.js review-action-executor-diagnostics'));
  }
  if (input.mode === 'file-audit' && !input.mutatesSourceTruth) {
    actions.push(action('reviewActionExecutor.fileAudit', 'info', 'Use file-audit to rehearse execution, then inject a mutating executor when downstream task and context stores are ready.', 'node src/presentation/cli/threadtrace.js review-action-audit-overview'));
  }
  if (!input.auditOverview || !input.auditOverview.count) {
    actions.push(action('reviewActionExecutor.audit', 'info', 'Run an executor-backed review-action-apply to create audit evidence.', 'node src/presentation/cli/threadtrace.js review-action-apply --execute true'));
  }
  return actions;
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function action(key, severity, summary, command) {
  return {
    key,
    severity,
    summary,
    command
  };
}

module.exports = {
  getContextReviewActionExecutorDiagnostics
};
