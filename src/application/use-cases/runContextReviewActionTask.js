'use strict';

const crypto = require('crypto');
const { assertTaskRepository } = require('../ports/taskRepository');
const {
  assertContextReviewActionExecutionRepository
} = require('../ports/contextReviewActionExecutionRepository');
const {
  getContextReviewActionExecutorReadiness
} = require('../ports/contextReviewActionExecutor');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');
const {
  buildIdempotentReplay,
  findReusableCompletedTask
} = require('../jobs/taskIdempotency');

async function runContextReviewActionTask(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const executionRepository = assertContextReviewActionExecutionRepository(safeOptions.contextReviewActionExecutionRepository);
  if (typeof safeOptions.getContextReviewResultActionGate !== 'function') {
    throw new Error('runContextReviewActionTask requires getContextReviewResultActionGate(request).');
  }
  const executorReadiness = getContextReviewActionExecutorReadiness(resolveExecutorCandidate(safeOptions));

  const execute = safeOptions.execute === true;
  let task = createTaskRecord('context-review-action-apply', {
    execute,
    dryRun: !execute,
    handoffId: safeOptions.handoffId,
    status: safeOptions.status,
    reviewerId: safeOptions.reviewerId,
    limit: safeOptions.limit || 100,
    storeDir: safeOptions.storeDir,
    now: safeOptions.now
  }, safeOptions);
  const reusableTask = await findReusableCompletedTask(taskRepository, task);
  if (reusableTask) {
    return {
      task: reusableTask,
      report: reusableTask.output && reusableTask.output.report,
      idempotency: buildIdempotentReplay(reusableTask)
    };
  }

  await taskRepository.saveTask(task);
  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const actionGate = await safeOptions.getContextReviewResultActionGate({
      handoffId: safeOptions.handoffId,
      status: safeOptions.status,
      reviewerId: safeOptions.reviewerId,
      limit: safeOptions.limit || 100,
      now: safeOptions.now,
      storeDir: safeOptions.storeDir
    });
    const executorResults = await runExecutors({
      actionGate,
      execute,
      executor: executorReadiness.executor,
      executorReady: executorReadiness.ready,
      executionRepository,
      taskId: task.id,
      now: safeOptions.now,
      storeDir: safeOptions.storeDir
    });
    const report = buildContextReviewActionTaskReport({
      actionGate,
      execute,
      now: safeOptions.now,
      executorReadiness,
      executorResults
    });

    task = markTaskCompleted(task, {
      status: report.status,
      dryRun: report.dryRun,
      executed: report.executed,
      applied: report.applied,
      closeTaskCount: report.closeTaskCount,
      mergeCandidateCount: report.mergeCandidateCount,
      report
    });
    await taskRepository.saveTask(task);

    return {
      task,
      report
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

function buildContextReviewActionTaskReport(options) {
  const safeOptions = options || {};
  const actionGate = safeOptions.actionGate || {};
  const actionPlan = actionGate.actionPlan || {};
  const execute = safeOptions.execute === true;
  const executorResults = safeOptions.executorResults || {};
  const closeTaskIds = actionPlan.closeTaskIds || [];
  const mergeCandidates = actionPlan.mergeCandidates || [];
  const gateFailed = actionGate.status === 'fail';
  const executorReadiness = reportExecutorReadiness(safeOptions);
  const missingExecutors = execute && !executorReadiness.ready;
  const steps = [
    step('review.actionGate', gateFailed ? 'fail' : (actionGate.status || 'warn'), 'Review action gate was evaluated before task closure or context merge.', {
      gateStatus: actionGate.status,
      gateCount: actionGate.gateCount,
      nextActionCount: (actionGate.nextActions || []).length
    }),
    step('tasks.closure', closureStepStatus({ gateFailed, closeTaskIds, execute, hasExecutor: executorReadiness.hasCloseTasks }), closureStepSummary({ gateFailed, closeTaskIds, execute, hasExecutor: executorReadiness.hasCloseTasks }), {
      closeTaskIds
    }),
    step('context.merge', mergeStepStatus({ gateFailed, mergeCandidates, execute, hasExecutor: executorReadiness.hasMergeContext }), mergeStepSummary({ gateFailed, mergeCandidates, execute, hasExecutor: executorReadiness.hasMergeContext }), {
      mergeCandidateCount: mergeCandidates.length,
      mergeTaskIds: mergeCandidates.map(function (candidate) { return candidate.taskId; }).filter(Boolean)
    })
  ];

  return {
    generatedAt: safeOptions.now || actionGate.generatedAt || new Date().toISOString(),
    status: aggregateStatus(steps.map(function (item) { return item.status; })),
    dryRun: !execute,
    executed: execute && !gateFailed && !missingExecutors,
    applied: Boolean(executorResults.taskClosure || executorResults.contextMerge),
    closeTaskCount: closeTaskIds.length,
    mergeCandidateCount: mergeCandidates.length,
    executorReadiness: {
      ready: executorReadiness.ready,
      missing: executorReadiness.missing
    },
    executorResults,
    steps,
    nextActions: nextActions({
      actionGate,
      execute,
      gateFailed,
      missingExecutors,
      closeTaskIds,
      mergeCandidates
    }),
    actionGate: compactActionGate(actionGate)
  };
}

async function runExecutors(options) {
  const safeOptions = options || {};
  const actionGate = safeOptions.actionGate || {};
  const actionPlan = actionGate.actionPlan || {};
  if (safeOptions.execute !== true) return {};
  if (actionGate.status === 'fail') return {};
  if (!safeOptions.executorReady) return {};

  const taskClosureRequest = {
    taskId: safeOptions.taskId,
    closeTaskIds: actionPlan.closeTaskIds || [],
    actionGate,
    now: safeOptions.now,
    storeDir: safeOptions.storeDir
  };
  const contextMergeRequest = {
    taskId: safeOptions.taskId,
    mergeCandidates: actionPlan.mergeCandidates || [],
    actionGate,
    now: safeOptions.now,
    storeDir: safeOptions.storeDir
  };
  const taskClosure = await runExecutorAction({
    executionRepository: safeOptions.executionRepository,
    action: 'tasks.closure',
    request: taskClosureRequest,
    logicalInput: {
      closeTaskIds: taskClosureRequest.closeTaskIds,
      actionPlan: compactActionPlanForLedger(actionPlan)
    },
    taskId: safeOptions.taskId,
    now: safeOptions.now,
    execute: function () {
      return safeOptions.executor.closeTasks(taskClosureRequest);
    }
  });
  const contextMerge = await runExecutorAction({
    executionRepository: safeOptions.executionRepository,
    action: 'context.merge',
    request: contextMergeRequest,
    logicalInput: {
      mergeCandidates: contextMergeRequest.mergeCandidates,
      actionPlan: compactActionPlanForLedger(actionPlan)
    },
    taskId: safeOptions.taskId,
    now: safeOptions.now,
    execute: function () {
      return safeOptions.executor.mergeContext(contextMergeRequest);
    }
  });
  return {
    taskClosure,
    contextMerge
  };
}

async function runExecutorAction(options) {
  const safeOptions = options || {};
  const repository = safeOptions.executionRepository;
  if (!repository) {
    return safeOptions.execute();
  }

  const key = buildExecutionKey(safeOptions.action, safeOptions.logicalInput);
  const claimed = await repository.claimExecution({
    key,
    action: safeOptions.action,
    taskId: safeOptions.taskId,
    requestHash: hashStable(safeOptions.logicalInput),
    request: safeOptions.request,
    now: safeOptions.now
  });

  if (!claimed.claimed) {
    if (claimed.record && claimed.record.status === 'completed') {
      return withExecutionLedger(claimed.record.result, {
        key,
        status: 'completed',
        replayed: true,
        originalTaskId: claimed.record.taskId
      });
    }
    const error = new Error('Context review action execution is already running: ' + key);
    error.code = 'CONTEXT_REVIEW_ACTION_EXECUTION_RUNNING';
    throw error;
  }

  try {
    const result = await safeOptions.execute();
    await repository.completeExecution(key, result, {
      taskId: safeOptions.taskId,
      now: safeOptions.now
    });
    return withExecutionLedger(result, {
      key,
      status: 'completed',
      replayed: false
    });
  } catch (error) {
    await repository.failExecution(key, error, {
      taskId: safeOptions.taskId,
      now: safeOptions.now
    });
    throw error;
  }
}

function resolveExecutorCandidate(options) {
  const safeOptions = options || {};
  return safeOptions.contextReviewActionExecutor || safeOptions.contextReviewActionExecutors || {
    taskClosureExecutor: safeOptions.taskClosureExecutor,
    contextMergeExecutor: safeOptions.contextMergeExecutor
  };
}

function reportExecutorReadiness(options) {
  const safeOptions = options || {};
  if (safeOptions.executorReadiness) return safeOptions.executorReadiness;
  if (safeOptions.hasTaskClosureExecutor !== undefined || safeOptions.hasContextMergeExecutor !== undefined) {
    const hasCloseTasks = safeOptions.hasTaskClosureExecutor === true;
    const hasMergeContext = safeOptions.hasContextMergeExecutor === true;
    const missing = [];
    if (!hasCloseTasks) missing.push('closeTasks');
    if (!hasMergeContext) missing.push('mergeContext');
    return {
      hasCloseTasks,
      hasMergeContext,
      ready: hasCloseTasks && hasMergeContext,
      missing
    };
  }
  return getContextReviewActionExecutorReadiness();
}

function closureStepStatus(input) {
  if (input.gateFailed) return 'fail';
  if (input.closeTaskIds.length === 0) return 'warn';
  if (input.execute && !input.hasExecutor) return 'fail';
  return 'ok';
}

function closureStepSummary(input) {
  if (input.gateFailed) return 'Task closure is blocked by a failing review action gate.';
  if (input.closeTaskIds.length === 0) return 'No task ids are ready for closure in the current review window.';
  if (input.execute && !input.hasExecutor) return 'Task closure execution was requested but no task closure executor is configured.';
  if (input.execute) return 'Task closure executor is ready for execution.';
  return 'Task closure is ready for dry-run review.';
}

function mergeStepStatus(input) {
  if (input.gateFailed) return 'fail';
  if (input.mergeCandidates.length === 0) return 'warn';
  if (input.execute && !input.hasExecutor) return 'fail';
  return 'ok';
}

function mergeStepSummary(input) {
  if (input.gateFailed) return 'Context merge is blocked by a failing review action gate.';
  if (input.mergeCandidates.length === 0) return 'No context merge candidates are available in the current review window.';
  if (input.execute && !input.hasExecutor) return 'Context merge execution was requested but no context merge executor is configured.';
  if (input.execute) return 'Context merge executor is ready for execution.';
  return 'Context merge is ready for dry-run review.';
}

function nextActions(input) {
  if (input.gateFailed) {
    return [action('review.actionGate', 'critical', 'Resolve the failing review action gate before execution.', 'node src/presentation/cli/threadtrace.js review-action-gate')];
  }
  const actions = [];
  if (input.missingExecutors) {
    actions.push(action('executors.configure', 'critical', 'Configure task closure and context merge executors before running with execute=true.', 'node src/presentation/cli/threadtrace.js review-action-gate'));
  }
  if (!input.execute && (input.closeTaskIds.length > 0 || input.mergeCandidates.length > 0)) {
    actions.push(action('review.apply.dryRun', 'info', 'Review the dry-run output before enabling executor-backed execution.', 'node src/presentation/cli/threadtrace.js review-action-apply'));
  }
  return actions.concat((input.actionGate.nextActions || []).map(function (item) {
    return action(item.key, item.severity, item.summary, 'node src/presentation/cli/threadtrace.js review-action-gate');
  }));
}

function compactActionGate(actionGate) {
  if (!actionGate) return undefined;
  return {
    generatedAt: actionGate.generatedAt,
    status: actionGate.status,
    gateCount: actionGate.gateCount,
    gates: actionGate.gates,
    executable: actionGate.executable,
    recommendedNextAction: actionGate.recommendedNextAction,
    actionPlan: actionGate.actionPlan ? {
      count: actionGate.actionPlan.count,
      status: actionGate.actionPlan.status,
      closeTaskIds: actionGate.actionPlan.closeTaskIds,
      keepOpenTaskIds: actionGate.actionPlan.keepOpenTaskIds,
      mergeCandidates: actionGate.actionPlan.mergeCandidates,
      blockedTasks: actionGate.actionPlan.blockedTasks,
      attention: actionGate.actionPlan.attention,
      risk: actionGate.actionPlan.risk,
      recommendedNextAction: actionGate.actionPlan.recommendedNextAction
    } : undefined
  };
}

function compactActionPlanForLedger(actionPlan) {
  const safeActionPlan = actionPlan || {};
  return {
    closeTaskIds: safeActionPlan.closeTaskIds || [],
    mergeCandidates: (safeActionPlan.mergeCandidates || []).map(function (candidate) {
      return {
        taskId: candidate.taskId,
        decision: candidate.decision,
        confidence: candidate.confidence,
        recordId: candidate.recordId,
        handoffId: candidate.handoffId
      };
    })
  };
}

function buildExecutionKey(action, logicalInput) {
  return 'context-review-action:v1:' + action + ':' + hashStable(logicalInput);
}

function hashStable(value) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(value))
    .digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + stableStringify(value[key]);
    }).join(',') + '}';
  }
  return JSON.stringify(value);
}

function withExecutionLedger(result, ledger) {
  return Object.assign({}, result || {}, {
    executionLedger: ledger
  });
}

function step(key, status, summary, evidence) {
  return {
    key,
    status,
    summary,
    evidence: evidence || {}
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

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  runContextReviewActionTask,
  buildContextReviewActionTaskReport
};
