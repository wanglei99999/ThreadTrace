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
const { runIngestNormalizedThreadJsonTask } = require('../use-cases/runIngestNormalizedThreadJsonTask');

function createDefaultSourceIngestHandlerRegistry() {
  return createSourceIngestHandlerRegistry([
    createSavedHtmlDirectoryIngestHandler(),
    createThreadUrlIngestHandler(),
    createNormalizedThreadJsonIngestHandler()
  ]);
}

function createSavedHtmlDirectoryIngestHandler() {
  return {
    sourceType: SOURCE_TYPES.SAVED_HTML_DIRECTORY,
    requiresAdapter: true,
    description: 'Ingest a saved forum HTML directory from local disk.',
    locationSchema: {
      required: ['inputDir'],
      properties: {
        inputDir: {
          type: 'string',
          format: 'path',
          description: 'Directory containing saved forum HTML pages.'
        }
      }
    },
    capabilities: {
      readsLocalFiles: true,
      fetchesRemote: false,
      storesRawPages: false
    },
    async run(context) {
      const source = context.source;
      return runIngestSavedThreadDirectoryTask({
        forum: source.sourceKey,
        adapter: assertForumAdapter(context.adapter),
        inputDir: source.location.inputDir,
        threadRepository: assertThreadRepository(context.threadRepository),
        reportRepository: assertAnalysisReportRepository(context.reportRepository),
        taskRepository: assertTaskRepository(context.taskRepository),
        requestId: context.requestId,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey
      });
    }
  };
}

function createThreadUrlIngestHandler() {
  return {
    sourceType: SOURCE_TYPES.THREAD_URL,
    requiresAdapter: true,
    description: 'Fetch and ingest an online forum thread URL.',
    locationSchema: {
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'Forum thread URL to fetch and ingest.'
        }
      }
    },
    capabilities: {
      readsLocalFiles: false,
      fetchesRemote: true,
      storesRawPages: true
    },
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
        taskRepository: assertTaskRepository(context.taskRepository),
        requestId: context.requestId,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey
      });
    }
  };
}

function createNormalizedThreadJsonIngestHandler() {
  return {
    sourceType: SOURCE_TYPES.NORMALIZED_THREAD_JSON,
    requiresAdapter: false,
    description: 'Ingest a canonical ThreadTrace ThreadSnapshot JSON file.',
    locationSchema: {
      required: ['inputFile'],
      properties: {
        inputFile: {
          type: 'string',
          format: 'path',
          description: 'JSON file containing a canonical ThreadSnapshot.'
        }
      }
    },
    capabilities: {
      readsLocalFiles: true,
      fetchesRemote: false,
      storesRawPages: false,
      acceptsCanonicalSnapshot: true
    },
    async run(context) {
      const source = context.source;
      return runIngestNormalizedThreadJsonTask({
        sourceKey: source.sourceKey,
        source,
        inputFile: source.location.inputFile,
        threadRepository: assertThreadRepository(context.threadRepository),
        reportRepository: assertAnalysisReportRepository(context.reportRepository),
        taskRepository: assertTaskRepository(context.taskRepository),
        requestId: context.requestId,
        traceId: context.traceId,
        idempotencyKey: context.idempotencyKey
      });
    }
  };
}

module.exports = {
  createDefaultSourceIngestHandlerRegistry,
  createSavedHtmlDirectoryIngestHandler,
  createThreadUrlIngestHandler,
  createNormalizedThreadJsonIngestHandler
};
