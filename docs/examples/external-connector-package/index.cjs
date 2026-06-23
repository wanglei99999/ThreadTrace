'use strict';

const path = require('path');

function register(context) {
  context.registerSourceIngestHandler(createNormalizedPackageHandler());
}

function createNormalizedPackageHandler() {
  const { runIngestNormalizedThreadJsonTask } = requireThreadTraceModule('src/application/use-cases/runIngestNormalizedThreadJsonTask');
  const { assertAnalysisReportRepository } = requireThreadTraceModule('src/application/ports/analysisReportRepository');
  const { assertTaskRepository } = requireThreadTraceModule('src/application/ports/taskRepository');
  const { assertThreadRepository } = requireThreadTraceModule('src/application/ports/threadRepository');

  return {
    sourceType: 'package-normalized-feed',
    requiresAdapter: false,
    description: 'Package-style connector template for ingesting canonical ThreadTrace ThreadSnapshot JSON files.',
    locationSchema: {
      required: ['inputFile'],
      properties: {
        inputFile: {
          type: 'string',
          format: 'path',
          description: 'Path to a normalized ThreadSnapshot JSON file produced by an external collector.'
        },
        sourceLabel: {
          type: 'string',
          description: 'Optional human label for the upstream collector or channel.'
        }
      }
    },
    capabilities: {
      readsLocalFiles: true,
      fetchesRemote: false,
      acceptsCanonicalSnapshot: true,
      packageTemplate: true
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

function requireThreadTraceModule(relativePath) {
  return require(path.join(threadTraceRoot(), relativePath));
}

function threadTraceRoot() {
  return process.env.THREADTRACE_ROOT
    ? path.resolve(process.env.THREADTRACE_ROOT)
    : path.resolve(__dirname, '..', '..', '..');
}

module.exports = {
  register,
  createNormalizedPackageHandler
};
