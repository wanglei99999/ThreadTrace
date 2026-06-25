'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSourceTypeReadiness } = require('../src/application/use-cases/getSourceTypeReadiness');
const { createDefaultSourceIngestHandlerRegistry } = require('../src/application/source-ingest/standardSourceIngestHandlers');
const { createDefaultForumAdapterRegistry } = require('../src/infrastructure/forum-adapters/registry');

test('source type readiness summarizes catalog coverage and unknown source types', async function () {
  const forumAdapterRegistry = createDefaultForumAdapterRegistry();
  const sourceIngestHandlerRegistry = createDefaultSourceIngestHandlerRegistry();
  const readiness = await getSourceTypeReadiness({
    now: '2026-06-25T10:00:00.000Z',
    forumAdapterRegistry,
    sourceIngestHandlerRegistry,
    getAdapter: forumAdapterRegistry.get,
    sourceRepository: fakeSourceRepository([
      {
        id: 'source-1',
        sourceKey: 'nga',
        sourceType: 'saved-html-directory',
        displayName: 'NGA sample archive',
        enabled: true,
        location: {
          inputDir: 'example'
        }
      },
      {
        id: 'source-2',
        sourceKey: 'external',
        sourceType: 'external-feed',
        displayName: 'External feed',
        enabled: true,
        location: {
          feedUrl: 'https://example.test/feed'
        }
      }
    ])
  });

  const savedHtml = readiness.sourceTypes.find(function (item) {
    return item.sourceType === 'saved-html-directory';
  });
  const normalizedJson = readiness.sourceTypes.find(function (item) {
    return item.sourceType === 'normalized-thread-json';
  });
  const unknown = readiness.unknownSourceTypes.find(function (item) {
    return item.sourceType === 'external-feed';
  });

  assert.equal(readiness.status, 'fail');
  assert.equal(readiness.summary.sourceTypeCount, 3);
  assert.equal(readiness.summary.readySourceTypeCount, 1);
  assert.equal(readiness.summary.warnSourceTypeCount, 2);
  assert.equal(readiness.summary.failSourceTypeCount, 0);
  assert.equal(readiness.summary.unknownSourceTypeCount, 1);
  assert.equal(savedHtml.status, 'ok');
  assert.equal(savedHtml.sourceCount, 1);
  assert.equal(savedHtml.enabledSourceCount, 1);
  assert.equal(normalizedJson.status, 'warn');
  assert.equal(normalizedJson.sourceCount, 0);
  assert.equal(unknown.status, 'fail');
  assert.equal(unknown.sourceCount, 1);
  assert.match(unknown.nextActions[0].summary, /not in the catalog/);
});

function fakeSourceRepository(sources) {
  return {
    async saveSource() {},
    async findSource(id) {
      return sources.find(function (source) {
        return source.id === id;
      });
    },
    async listSources(query) {
      const safeQuery = query || {};
      return sources.filter(function (source) {
        if (safeQuery.sourceKey && source.sourceKey !== safeQuery.sourceKey) return false;
        if (safeQuery.enabled !== undefined && (source.enabled !== false) !== safeQuery.enabled) return false;
        return true;
      }).slice(0, safeQuery.limit || sources.length);
    }
  };
}
