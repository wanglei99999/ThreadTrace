'use strict';

const { assertTaskRepository } = require('../ports/taskRepository');
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

async function runResetTrackedSourceFailureTask(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  if (typeof safeOptions.resetTrackedSourceFailure !== 'function') {
    throw new Error('runResetTrackedSourceFailureTask requires resetTrackedSourceFailure(request).');
  }

  let task = createTaskRecord('reset-tracked-source-failure', {
    sourceId: safeOptions.sourceId,
    execute: safeOptions.execute === true,
    dryRun: safeOptions.execute !== true,
    retryNow: safeOptions.retryNow === true,
    nextRunAt: safeOptions.nextRunAt,
    resetBy: safeOptions.resetBy,
    storeDir: safeOptions.storeDir,
    now: safeOptions.now
  }, safeOptions);
  const reusableTask = await findReusableCompletedTask(taskRepository, task);
  if (reusableTask) {
    return {
      task: reusableTask,
      result: reusableTask.output && reusableTask.output.result,
      idempotency: buildIdempotentReplay(reusableTask)
    };
  }

  await taskRepository.saveTask(task);
  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const result = await safeOptions.resetTrackedSourceFailure({
      sourceId: safeOptions.sourceId,
      execute: safeOptions.execute,
      retryNow: safeOptions.retryNow,
      nextRunAt: safeOptions.nextRunAt,
      resetBy: safeOptions.resetBy,
      now: safeOptions.now,
      storeDir: safeOptions.storeDir
    });
    task = markTaskCompleted(task, {
      status: result.status,
      dryRun: result.dryRun,
      executed: result.executed,
      changed: result.changed,
      reason: result.reason,
      retryNow: result.retryNow,
      nextRunAt: result.nextRunAt,
      sourceBefore: result.sourceBefore,
      sourceAfter: result.sourceAfter,
      result
    });
    await taskRepository.saveTask(task);

    return {
      task,
      result
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

module.exports = {
  runResetTrackedSourceFailureTask
};
