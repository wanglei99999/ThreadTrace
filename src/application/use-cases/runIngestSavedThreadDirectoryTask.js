'use strict';

const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const { ingestSavedThreadDirectory } = require('./ingestSavedThreadDirectory');
const { buildThreadSnapshotCursor } = require('../../domain/sources/threadSnapshotCursor');
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

async function runIngestSavedThreadDirectoryTask(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const threadRepository = assertThreadRepository(safeOptions.threadRepository);
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  let task = createTaskRecord('ingest-saved-thread-directory', {
    forum: safeOptions.forum || 'nga',
    inputDir: safeOptions.inputDir
  }, safeOptions);
  const reusableTask = await findReusableCompletedTask(taskRepository, task);
  if (reusableTask) {
    return buildReplayResult({
      task: reusableTask,
      threadRepository,
      reportRepository
    });
  }

  await taskRepository.saveTask(task);

  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const result = await ingestSavedThreadDirectory({
      adapter: safeOptions.adapter,
      inputDir: safeOptions.inputDir,
      threadRepository,
      reportRepository
    });
    const cursor = buildThreadSnapshotCursor(result.threadSnapshot);

    task = markTaskCompleted(task, {
      sourceKey: result.threadSnapshot.sourceKey,
      sourceThreadId: result.threadSnapshot.sourceThreadId,
      title: result.threadSnapshot.title,
      parsedPostCount: result.threadSnapshot.posts.length,
      cursor,
      reportType: result.report.reportType
    });
    await taskRepository.saveTask(task);

    return {
      task,
      threadSnapshot: result.threadSnapshot,
      report: result.report
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

async function buildReplayResult(options) {
  const task = options.task;
  const output = task.output || {};
  const threadSnapshot = output.sourceKey && output.sourceThreadId
    ? await options.threadRepository.findSnapshot({
      sourceKey: output.sourceKey,
      sourceThreadId: output.sourceThreadId
    })
    : undefined;
  const reports = output.sourceKey && output.sourceThreadId
    ? await options.reportRepository.findReports({
      sourceKey: output.sourceKey,
      sourceThreadId: output.sourceThreadId,
      reportType: output.reportType || 'basic-history'
    })
    : [];

  return {
    task,
    threadSnapshot,
    report: reports[0],
    idempotency: buildIdempotentReplay(task)
  };
}

module.exports = {
  runIngestSavedThreadDirectoryTask
};
