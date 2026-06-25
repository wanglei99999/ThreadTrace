'use strict';

const {
  defineConnectorModule,
  defineNormalizedThreadJsonHandler
} = require('../../src/connectors/connectorSdk');

module.exports = defineConnectorModule({
  sourceIngestHandlers: [
    defineNormalizedThreadJsonHandler({
      sourceType: 'external-normalized-feed',
      description: 'Example external connector that ingests a canonical ThreadTrace ThreadSnapshot JSON file.',
      locationProperties: {
        inputFile: {
          type: 'string',
          format: 'path',
          description: 'Path to a normalized ThreadSnapshot JSON file produced by an external collector.'
        }
      },
      capabilities: {
        exampleTemplate: true
      }
    })
  ]
});
