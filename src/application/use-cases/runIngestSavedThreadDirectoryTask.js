'use strict';

const { assertTaskRepository } = require('../ports/taskRepository');
const { ingestSavedThreadDirectory } = require('./ingestSavedThreadDirectory');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');

async function runIngestSavedThreadDirectoryTask(options) {
  const taskRepository = assertTaskRepository(options.taskRepository);
  let task = createTaskRecord('ingest-saved-thread-directory', {
    forum: options.forum || 'nga',
    inputDir: options.inputDir
  });
  await taskRepository.saveTask(task);

  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const result = await ingestSavedThreadDirectory({
      adapter: options.adapter,
      inputDir: options.inputDir,
      threadRepository: options.threadRepository,
      reportRepository: options.reportRepository
    });

    task = markTaskCompleted(task, {
      sourceKey: result.threadSnapshot.sourceKey,
      sourceThreadId: result.threadSnapshot.sourceThreadId,
      title: result.threadSnapshot.title,
      parsedPostCount: result.threadSnapshot.posts.length,
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

module.exports = {
  runIngestSavedThreadDirectoryTask
};
