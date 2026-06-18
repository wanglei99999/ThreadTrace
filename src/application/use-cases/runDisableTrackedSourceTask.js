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

async function runDisableTrackedSourceTask(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  if (typeof safeOptions.disableTrackedSource !== 'function') {
    throw new Error('runDisableTrackedSourceTask requires disableTrackedSource(request).');
  }

  let task = createTaskRecord('disable-tracked-source', {
    sourceId: safeOptions.sourceId,
    execute: safeOptions.execute === true,
    dryRun: safeOptions.execute !== true,
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
    const result = await safeOptions.disableTrackedSource({
      sourceId: safeOptions.sourceId,
      execute: safeOptions.execute,
      now: safeOptions.now,
      storeDir: safeOptions.storeDir
    });
    task = markTaskCompleted(task, {
      status: result.status,
      dryRun: result.dryRun,
      executed: result.executed,
      changed: result.changed,
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
  runDisableTrackedSourceTask
};
