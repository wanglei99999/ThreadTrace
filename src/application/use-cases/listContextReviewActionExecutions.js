'use strict';

const {
  assertContextReviewActionExecutionRepository
} = require('../ports/contextReviewActionExecutionRepository');

async function listContextReviewActionExecutions(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewActionExecutionRepository(safeOptions.contextReviewActionExecutionRepository);
  const executions = await repository.listExecutions({
    action: safeOptions.action,
    status: safeOptions.status,
    taskId: safeOptions.taskId,
    limit: safeOptions.limit || 50
  });

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: 'ok',
    count: executions.length,
    executions
  };
}

module.exports = {
  listContextReviewActionExecutions
};
