'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getConnectorReadiness } = require('../src/application/use-cases/getConnectorReadiness');
const { createDefaultSourceIngestHandlerRegistry } = require('../src/application/source-ingest/standardSourceIngestHandlers');
const { createDefaultForumAdapterRegistry } = require('../src/infrastructure/forum-adapters/registry');

test('connector readiness summarizes handlers, adapter coverage, and configured sources', async function () {
  const forumAdapterRegistry = createDefaultForumAdapterRegistry();
  const sourceIngestHandlerRegistry = createDefaultSourceIngestHandlerRegistry();
  const readiness = await getConnectorReadiness({
    now: '2026-06-19T10:00:00.000Z',
    forumAdapterRegistry,
    sourceIngestHandlerRegistry,
    getAdapter: forumAdapterRegistry.get,
    connectorModules: [
      {
        modulePath: 'D:/connectors/example.cjs',
        forumAdapters: ['external'],
        sourceIngestHandlers: ['external-feed']
      }
    ],
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
      }
    ])
  });

  const savedHtml = readiness.connectors.find(function (connector) {
    return connector.sourceType === 'saved-html-directory';
  });

  assert.equal(readiness.status, 'ok');
  assert.equal(readiness.connectorCount, 3);
  assert.equal(readiness.sourceCount, 1);
  assert.equal(readiness.modules.count, 1);
  assert.equal(readiness.modules.modules[0].sourceIngestHandlers[0], 'external-feed');
  assert.equal(savedHtml.status, 'ok');
  assert.equal(savedHtml.sourceCount, 1);
  assert.equal(savedHtml.enabledSourceCount, 1);
  assert.deepEqual(savedHtml.statusCounts, {
    ok: 1,
    warn: 0,
    fail: 0
  });
  assert.deepEqual(savedHtml.compatibleSourceKeys, ['nga']);
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
