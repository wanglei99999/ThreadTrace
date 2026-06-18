'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createThreadSnapshot } = require('../src/domain/models/threadSnapshot');
const { diagnoseForumAdapters } = require('../src/application/use-cases/diagnoseForumAdapters');

test('adapter diagnostics validates registry metadata and sample parsing', async function () {
  const diagnostics = await diagnoseForumAdapters({
    now: '2026-06-19T10:00:00.000Z',
    forumAdapterRegistry: {
      list() {
        return [
          { sourceKey: 'custom', displayName: 'Custom Forum' },
          { sourceKey: 'missing', displayName: 'Missing Adapter' }
        ];
      },
      get(sourceKey) {
        if (sourceKey === 'custom') {
          return {
            sourceKey: 'custom',
            displayName: 'Custom Forum',
            parseSavedHtml() {
              return createThreadSnapshot({
                forum: { sourceKey: 'custom', displayName: 'Custom Forum' },
                sourceKey: 'custom',
                sourceThreadId: 'thread-1',
                title: 'Thread 1',
                posts: []
              });
            }
          };
        }
        throw new Error('Unknown forum adapter: ' + sourceKey);
      }
    },
    samples: {
      custom: {
        html: '<html>custom</html>'
      }
    }
  });

  const bySourceKey = Object.fromEntries(diagnostics.adapters.map(function (adapter) {
    return [adapter.sourceKey, adapter];
  }));

  assert.equal(diagnostics.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(diagnostics.status, 'fail');
  assert.equal(bySourceKey.custom.status, 'ok');
  assert.equal(bySourceKey.custom.checks.find(function (check) {
    return check.key === 'adapter.sampleParse';
  }).status, 'ok');
  assert.equal(bySourceKey.missing.status, 'fail');
  assert.equal(bySourceKey.missing.checks.find(function (check) {
    return check.key === 'adapter.registryLookup';
  }).status, 'fail');
});
