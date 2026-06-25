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

async function runSetTrackedSourceScheduleTask(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  if (typeof safeOptions.setTrackedSourceSchedule !== 'function') {
    throw new Error('runSetTrackedSourceScheduleTask requires setTrackedSourceSchedule(request).');
  }
  let task = createTaskRecord('configure-source-schedule', {
    sourceId: safeOptions.sourceId,
    intervalMinutes: safeOptions.intervalMinutes,
    nextRunAt: safeOptions.nextRunAt,
    scheduleEnabled: safeOptions.scheduleEnabled,
    runNow: safeOptions.runNow === true,
    clearSchedule: safeOptions.clearSchedule === true,
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
    const result = await safeOptions.setTrackedSourceSchedule({
      sourceId: safeOptions.sourceId,
      intervalMinutes: safeOptions.intervalMinutes,
      nextRunAt: safeOptions.nextRunAt,
      scheduleEnabled: safeOptions.scheduleEnabled,
      runNow: safeOptions.runNow,
      clearSchedule: safeOptions.clearSchedule,
      execute: safeOptions.execute,
      now: safeOptions.now,
      storeDir: safeOptions.storeDir
    });
    task = markTaskCompleted(task, {
      status: result.status,
      dryRun: result.dryRun,
      executed: result.executed,
      changed: result.changed,
      clearSchedule: result.clearSchedule,
      runNow: result.runNow,
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
  runSetTrackedSourceScheduleTask
};
