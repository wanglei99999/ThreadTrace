'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { diagnoseTrackedSources } = require('../src/application/use-cases/diagnoseTrackedSources');
const { createDefaultSourceIngestHandlerRegistry } = require('../src/application/source-ingest/standardSourceIngestHandlers');
const { createSourceIngestHandlerRegistry } = require('../src/application/source-ingest/sourceIngestHandlerRegistry');

test('source diagnostics reports handler, adapter, and location health', async function () {
  const diagnostics = await diagnoseTrackedSources({
    now: '2026-06-19T10:00:00.000Z',
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources() {
        return [
          {
            id: 'source-ok',
            sourceKey: 'nga',
            sourceType: 'saved-html-directory',
            displayName: 'NGA archive',
            enabled: true,
            location: { inputDir: 'example' }
          },
          {
            id: 'source-missing-adapter',
            sourceKey: 'missing-forum',
            sourceType: 'saved-html-directory',
            displayName: 'Missing adapter',
            enabled: true,
            location: { inputDir: 'example' }
          },
          {
            id: 'source-missing-handler',
            sourceKey: 'nga',
            sourceType: 'external-feed',
            displayName: 'Missing handler',
            enabled: true,
            location: {}
          }
        ];
      }
    },
    sourceIngestHandlerRegistry: createDefaultSourceIngestHandlerRegistry(),
    getAdapter(sourceKey) {
      if (sourceKey === 'nga') return { sourceKey: 'nga' };
      throw new Error('Unknown forum adapter: ' + sourceKey);
    }
  });

  const byId = Object.fromEntries(diagnostics.sources.map(function (source) {
    return [source.sourceId, source];
  }));

  assert.equal(diagnostics.status, 'fail');
  assert.equal(diagnostics.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(byId['source-ok'].status, 'ok');
  assert.equal(byId['source-missing-adapter'].status, 'fail');
  assert.equal(byId['source-missing-adapter'].checks.find(function (check) {
    return check.key === 'source.adapter';
  }).status, 'fail');
  assert.equal(byId['source-missing-adapter'].nextActions[0].key, 'source.adapter');
  assert.match(byId['source-missing-adapter'].nextActions[0].evidenceSummary, /sourceKey=missing-forum/);
  assert.equal(byId['source-missing-handler'].status, 'fail');
  assert.equal(byId['source-missing-handler'].checks.find(function (check) {
    return check.key === 'source.handler';
  }).status, 'fail');
  assert.equal(byId['source-missing-handler'].checks.find(function (check) {
    return check.key === 'source.location';
  }).status, 'fail');
  assert.equal(diagnostics.nextActions.length, 3);
  assert.ok(diagnostics.nextActions.some(function (action) {
    return action.sourceId === 'source-missing-handler' && action.key === 'source.handler';
  }));
});

test('source diagnostics uses handler location schema for custom source types', async function () {
  const registry = createSourceIngestHandlerRegistry([
    {
      sourceType: 'external-feed',
      requiresAdapter: false,
      locationSchema: {
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string', format: 'uri' }
        }
      },
      async run() {}
    }
  ]);
  const diagnostics = await diagnoseTrackedSources({
    sourceRepository: {
      async saveSource() {},
      async findSource() {},
      async listSources() {
        return [
          {
            id: 'source-missing-endpoint',
            sourceKey: 'external',
            sourceType: 'external-feed',
            displayName: 'Missing endpoint',
            enabled: true,
            location: { url: 'https://example.test/feed' }
          }
        ];
      }
    },
    sourceIngestHandlerRegistry: registry
  });
  const locationCheck = diagnostics.sources[0].checks.find(function (check) {
    return check.key === 'source.location';
  });

  assert.equal(diagnostics.status, 'fail');
  assert.equal(locationCheck.status, 'fail');
  assert.equal(locationCheck.value, 'missing: endpoint');
  assert.equal(diagnostics.sources[0].nextActions[0].key, 'source.location');
  assert.match(diagnostics.sources[0].nextActions[0].evidenceSummary, /missingRequiredFields=endpoint/);
  assert.deepEqual(diagnostics.sources[0].nextActions[0].evidence.missingRequiredFields, ['endpoint']);
});
