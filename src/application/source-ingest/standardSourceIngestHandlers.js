'use strict';

const { SOURCE_TYPES } = require('../../domain/models/trackedSource');
const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertRawThreadPageRepository } = require('../ports/rawThreadPageRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const { createSourceIngestHandlerRegistry } = require('./sourceIngestHandlerRegistry');
const { runIngestSavedThreadDirectoryTask } = require('../use-cases/runIngestSavedThreadDirectoryTask');
const { runIngestThreadUrlTask } = require('../use-cases/runIngestThreadUrlTask');

function createDefaultSourceIngestHandlerRegistry() {
  return createSourceIngestHandlerRegistry([
    createSavedHtmlDirectoryIngestHandler(),
    createThreadUrlIngestHandler()
  ]);
}

function createSavedHtmlDirectoryIngestHandler() {
  return {
    sourceType: SOURCE_TYPES.SAVED_HTML_DIRECTORY,
    requiresAdapter: true,
    description: 'Ingest a saved forum HTML directory from local disk.',
    async run(context) {
      const source = context.source;
      return runIngestSavedThreadDirectoryTask({
        forum: source.sourceKey,
        adapter: assertForumAdapter(context.adapter),
        inputDir: source.location.inputDir,
        threadRepository: assertThreadRepository(context.threadRepository),
        reportRepository: assertAnalysisReportRepository(context.reportRepository),
        taskRepository: assertTaskRepository(context.taskRepository)
      });
    }
  };
}

function createThreadUrlIngestHandler() {
  return {
    sourceType: SOURCE_TYPES.THREAD_URL,
    requiresAdapter: true,
    description: 'Fetch and ingest an online forum thread URL.',
    async run(context) {
      const source = context.source;
      return runIngestThreadUrlTask({
        forum: source.sourceKey,
        source,
        adapter: assertForumAdapter(context.adapter),
        crawler: context.crawler,
        rawThreadPageRepository: assertRawThreadPageRepository(context.rawThreadPageRepository),
        threadRepository: assertThreadRepository(context.threadRepository),
        reportRepository: assertAnalysisReportRepository(context.reportRepository),
        taskRepository: assertTaskRepository(context.taskRepository)
      });
    }
  };
}

module.exports = {
  createDefaultSourceIngestHandlerRegistry,
  createSavedHtmlDirectoryIngestHandler,
  createThreadUrlIngestHandler
};
