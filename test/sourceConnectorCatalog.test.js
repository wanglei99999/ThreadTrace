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
  assert.deepEqual(byType['normalized-thread-json'].onboardingRecipe.requiredLocationFields, ['inputFile']);
  assert.equal(byType['normalized-thread-json'].onboardingRecipe.requiresAdapter, false);
  assert.equal(byType['normalized-thread-json'].onboardingRecipe.adapterGuidance.required, false);
  assert.deepEqual(byType['normalized-thread-json'].onboardingRecipe.compatibleSourceKeys, []);
  assert.deepEqual(
    byType['normalized-thread-json'].onboardingRecipe.recommendedFlow.map(function (step) { return step.key; }),
    ['catalog', 'preflight', 'dry-run', 'rollout-plan', 'apply']
  );
  assert.equal(byType['normalized-thread-json'].onboardingRecipe.rolloutManifestTemplate.source.sourceType, 'normalized-thread-json');
  assert.equal(byType['normalized-thread-json'].onboardingRecipe.rolloutManifestTemplate.source.location.inputFile, 'D:/path/to/thread-snapshot.json');
  assert.equal(byType['thread-url'].onboardingRecipe.adapterGuidance.required, true);
  assert.ok(byType['thread-url'].onboardingRecipe.compatibleSourceKeys.includes('nga'));
  assert.match(byType['thread-url'].onboardingRecipe.recommendedFlow[1].cli, /source-onboarding-preflight/);
  assert.match(byType['thread-url'].onboardingRecipe.recommendedFlow[2].api, /\/api\/sources\/ingest\/dry-run/);
});
