'use strict';

/**
 * Port for applying reviewed context decisions to external systems. Production
 * adapters can close tracker tasks, merge context records, or call downstream
 * workflow APIs without coupling those details to the review action use case.
 *
 * @typedef {Object} ContextReviewActionExecutor
 * @property {(request: { closeTaskIds: string[], actionGate: Object, now?: string, storeDir?: string }) => Promise<Object>} closeTasks
 * @property {(request: { mergeCandidates: Object[], actionGate: Object, now?: string, storeDir?: string }) => Promise<Object>} mergeContext
 */

function normalizeContextReviewActionExecutor(candidate) {
  if (!candidate) return undefined;
  if (typeof candidate.closeTasks === 'function' || typeof candidate.mergeContext === 'function') {
    return candidate;
  }
  if (typeof candidate.taskClosureExecutor === 'function' || typeof candidate.contextMergeExecutor === 'function') {
    return {
      closeTasks: candidate.taskClosureExecutor,
      mergeContext: candidate.contextMergeExecutor
    };
  }
  return candidate;
}

function getContextReviewActionExecutorReadiness(candidate) {
  const executor = normalizeContextReviewActionExecutor(candidate);
  const hasCloseTasks = Boolean(executor && typeof executor.closeTasks === 'function');
  const hasMergeContext = Boolean(executor && typeof executor.mergeContext === 'function');
  const missing = [];
  if (!hasCloseTasks) missing.push('closeTasks');
  if (!hasMergeContext) missing.push('mergeContext');
  return {
    executor,
    hasCloseTasks,
    hasMergeContext,
    ready: hasCloseTasks && hasMergeContext,
    missing
  };
}

function assertContextReviewActionExecutor(candidate) {
  const readiness = getContextReviewActionExecutorReadiness(candidate);
  if (!readiness.ready) {
    throw new Error('ContextReviewActionExecutor must implement closeTasks(request) and mergeContext(request).');
  }
  return readiness.executor;
}

module.exports = {
  assertContextReviewActionExecutor,
  getContextReviewActionExecutorReadiness,
  normalizeContextReviewActionExecutor
};
