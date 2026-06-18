'use strict';

const {
  SOURCE_TYPES,
  markTrackedSourceRunCompleted,
  markTrackedSourceRunFailed,
  markTrackedSourceRunStarted
} = require('../../domain/models/trackedSource');
const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { runIngestSavedThreadDirectoryTask } = require('./runIngestSavedThreadDirectoryTask');

async function runTrackedSourceIngestTask(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const adapter = assertForumAdapter(safeOptions.adapter);
  const source = await sourceRepository.findSource(safeOptions.sourceId);

  if (!source) {
    throw new Error('Unknown tracked source: ' + safeOptions.sourceId);
  }
  if (source.enabled === false) {
    throw new Error('Tracked source is disabled: ' + source.id);
  }
  if (source.sourceType !== SOURCE_TYPES.SAVED_HTML_DIRECTORY) {
    throw new Error('Tracked source type is not ingestible yet: ' + source.sourceType);
  }

  let runningSource = markTrackedSourceRunStarted(source);
  await sourceRepository.saveSource(runningSource);

  try {
    const result = await runIngestSavedThreadDirectoryTask({
      forum: source.sourceKey,
      adapter,
      inputDir: source.location.inputDir,
      threadRepository: assertThreadRepository(safeOptions.threadRepository),
      reportRepository: assertAnalysisReportRepository(safeOptions.reportRepository),
      taskRepository: assertTaskRepository(safeOptions.taskRepository)
    });
    runningSource = markTrackedSourceRunCompleted(runningSource, result.task);
    await sourceRepository.saveSource(runningSource);
    return Object.assign({}, result, {
      source: runningSource
    });
  } catch (error) {
    runningSource = markTrackedSourceRunFailed(runningSource, error);
    await sourceRepository.saveSource(runningSource);
    throw error;
  }
}

module.exports = {
  runTrackedSourceIngestTask
};
