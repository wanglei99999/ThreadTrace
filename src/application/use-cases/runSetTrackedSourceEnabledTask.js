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

async function runSetTrackedSourceEnabledTask(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  if (typeof safeOptions.setTrackedSourceEnabled !== 'function') {
    throw new Error('runSetTrackedSourceEnabledTask requires setTrackedSourceEnabled(request).');
  }
  if (typeof safeOptions.enabled !== 'boolean') {
    throw new Error('runSetTrackedSourceEnabledTask requires enabled.');
  }
  const taskType = safeOptions.enabled ? 'enable-tracked-source' : 'disable-tracked-source';
  let task = createTaskRecord(taskType, {
    sourceId: safeOptions.sourceId,
    enabled: safeOptions.enabled,
    execute: safeOptions.execute === true,
    dryRun: safeOptions.execute !== true,
    force: safeOptions.force === true,
    sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
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
    const result = await safeOptions.setTrackedSourceEnabled({
      sourceId: safeOptions.sourceId,
      enabled: safeOptions.enabled,
      execute: safeOptions.execute,
      force: safeOptions.force === true,
      sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
      now: safeOptions.now,
      storeDir: safeOptions.storeDir
    });
    task = markTaskCompleted(task, {
      status: result.status,
      dryRun: result.dryRun,
      executed: result.executed,
      changed: result.changed,
      guard: result.guard,
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
  runSetTrackedSourceEnabledTask
};
