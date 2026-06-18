'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime exposes source connector catalog', function () {
  const runtime = createThreadTraceRuntime({});
  const catalog = runtime.getSourceConnectorCatalog({
    now: '2026-06-19T10:00:00.000Z'
  });
  const byType = Object.fromEntries(catalog.sourceTypes.map(function (item) {
    return [item.sourceType, item];
  }));

  assert.equal(catalog.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.ok(catalog.adapters.some(function (adapter) {
    return adapter.sourceKey === 'nga';
  }));
  assert.deepEqual(byType['saved-html-directory'].locationSchema.required, ['inputDir']);
  assert.deepEqual(byType['thread-url'].locationSchema.required, ['url']);
  assert.ok(byType['thread-url'].compatibleSourceKeys.includes('nga'));
  assert.deepEqual(byType['normalized-thread-json'].locationSchema.required, ['inputFile']);
  assert.equal(byType['normalized-thread-json'].requiresAdapter, false);
  assert.deepEqual(byType['normalized-thread-json'].compatibleSourceKeys, []);
});
