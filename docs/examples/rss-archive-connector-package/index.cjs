'use strict';

function register(context) {
  context.registerSourceIngestHandler(createRssArchiveHandler());
}

function createRssArchiveHandler() {
  const {
    defineNormalizedThreadJsonHandler
  } = requireThreadTraceModule('src/connectors/connectorSdk');

  return defineNormalizedThreadJsonHandler({
    sourceType: 'rss-archive-normalized-feed',
    description: 'Ingest canonical ThreadTrace snapshots produced by an RSS/API/archive collector.',
    locationProperties: {
      inputFile: {
        type: 'string',
        format: 'path',
        description: 'Path to a normalized ThreadSnapshot JSON file produced by the RSS/API/archive collector.'
      },
      feedUrl: {
        type: 'string',
        format: 'uri',
        description: 'Optional upstream RSS or API URL used by the external collector.'
      },
      archiveLabel: {
        type: 'string',
        description: 'Optional archive batch, channel, or collection label.'
      }
    },
    capabilities: {
      acceptsCanonicalSnapshot: true,
      rssTemplate: true,
      apiTemplate: true,
      archiveTemplate: true
    }
  });
}

function requireThreadTraceModule(relativePath) {
  const path = require('path');
  const root = process.env.THREADTRACE_ROOT
    ? path.resolve(process.env.THREADTRACE_ROOT)
    : path.resolve(__dirname, '..', '..', '..');
  return require(path.join(root, relativePath));
}

module.exports = {
  register,
  createRssArchiveHandler
};
