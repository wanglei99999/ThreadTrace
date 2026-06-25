'use strict';

const {
  defineConnectorModule,
  defineLocationSchema,
  defineSourceIngestHandler
} = require('../../src/connectors/connectorSdk');
const { runIngestNormalizedThreadJsonTask } = require('../../src/application/use-cases/runIngestNormalizedThreadJsonTask');
const { assertAnalysisReportRepository } = require('../../src/application/ports/analysisReportRepository');
const { assertTaskRepository } = require('../../src/application/ports/taskRepository');
const { assertThreadRepository } = require('../../src/application/ports/threadRepository');

module.exports = defineConnectorModule({
  sourceIngestHandlers: [
    defineSourceIngestHandler({
      sourceType: 'external-normalized-feed',
      requiresAdapter: false,
      description: 'Example external connector that ingests a canonical ThreadTrace ThreadSnapshot JSON file.',
      locationSchema: defineLocationSchema({
        required: ['inputFile'],
        properties: {
          inputFile: {
            type: 'string',
            format: 'path',
            description: 'Path to a normalized ThreadSnapshot JSON file produced by an external collector.'
          }
        }
      }),
      capabilities: {
        readsLocalFiles: true,
        fetchesRemote: false,
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
    })
  ]
});
