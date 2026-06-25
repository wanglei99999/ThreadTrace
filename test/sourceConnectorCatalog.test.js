'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
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
  assert.ok(byType['thread-url'].locationSchema.properties.startPage);
  assert.ok(byType['thread-url'].locationSchema.properties.pageCount);
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

test('runtime connector catalog includes connector package manifest metadata', function () {
  const cwd = path.resolve(__dirname, '..');
  const runtime = createThreadTraceRuntime({
    cwd
  });
  const catalog = runtime.getSourceConnectorCatalog({
    modulePath: 'docs/examples/rss-archive-connector-package/index.cjs',
    now: '2026-06-25T10:00:00.000Z'
  });
  const sourceType = catalog.sourceTypes.find(function (item) {
    return item.sourceType === 'rss-archive-normalized-feed';
  });

  assert.equal(catalog.generatedAt, '2026-06-25T10:00:00.000Z');
  assert.equal(catalog.packages.length, 1);
  assert.equal(catalog.packages[0].packageName, '@threadtrace/example-rss-archive-connector-package');
  assert.deepEqual(catalog.packages[0].categories, ['rss', 'api', 'archive', 'json-package']);
  assert.equal(catalog.packages[0].rollout.recommendedManifest, '../rss-archive-rollout-manifest.sample.json');
  assert.equal(catalog.packages[0].sourceTypes[0].sourceType, 'rss-archive-normalized-feed');
  assert.equal(sourceType.package.packageName, '@threadtrace/example-rss-archive-connector-package');
  assert.equal(sourceType.package.sourceType.locationExample, 'sample-location.json');
  assert.equal(sourceType.package.capabilities.rssTemplate, true);
  assert.deepEqual(catalog.moduleErrors, []);
});

test('runtime loads connector package recommended manifest', function () {
  const cwd = path.resolve(__dirname, '..');
  const runtime = createThreadTraceRuntime({
    cwd
  });
  const result = runtime.getConnectorPackageRecommendedManifest({
    modulePath: 'docs/examples/rss-archive-connector-package/index.cjs',
    packageName: '@threadtrace/example-rss-archive-connector-package',
    sourceType: 'rss-archive-normalized-feed',
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(result.generatedAt, '2026-06-25T10:00:00.000Z');
  assert.equal(result.status, 'ok');
  assert.equal(result.packageName, '@threadtrace/example-rss-archive-connector-package');
  assert.equal(result.sourceType, 'rss-archive-normalized-feed');
  assert.equal(result.recommendedManifest, '../rss-archive-rollout-manifest.sample.json');
  assert.equal(result.manifest.source.sourceType, 'rss-archive-normalized-feed');
  assert.equal(result.manifest.connector.modulePath, 'docs/examples/rss-archive-connector-package/index.cjs');
});
