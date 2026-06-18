'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { diagnoseTrackedSources } = require('../src/application/use-cases/diagnoseTrackedSources');
const { createDefaultSourceIngestHandlerRegistry } = require('../src/application/source-ingest/standardSourceIngestHandlers');

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
  assert.equal(byId['source-missing-handler'].status, 'fail');
  assert.equal(byId['source-missing-handler'].checks.find(function (check) {
    return check.key === 'source.handler';
  }).status, 'fail');
  assert.equal(byId['source-missing-handler'].checks.find(function (check) {
    return check.key === 'source.location';
  }).status, 'fail');
});
