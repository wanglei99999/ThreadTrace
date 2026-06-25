'use strict';

const path = require('path');

function register(context) {
  context.registerSourceIngestHandler(createNormalizedPackageHandler());
}

function createNormalizedPackageHandler() {
  const {
    defineNormalizedThreadJsonHandler
  } = requireThreadTraceModule('src/connectors/connectorSdk');

  return defineNormalizedThreadJsonHandler({
    sourceType: 'package-normalized-feed',
    description: 'Package-style connector template for ingesting canonical ThreadTrace ThreadSnapshot JSON files.',
    locationProperties: {
      inputFile: {
        type: 'string',
        format: 'path',
        description: 'Path to a normalized ThreadSnapshot JSON file produced by an external collector.'
      },
      sourceLabel: {
        type: 'string',
        description: 'Optional human label for the upstream collector or channel.'
      }
    },
    capabilities: {
      packageTemplate: true
    }
  });
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
