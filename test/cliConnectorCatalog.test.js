'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

test('CLI prints connector catalog onboarding recipes', async function () {
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'connector-catalog',
    '--source-type',
    'normalized-thread-json',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });

  assert.match(result.stdout, /Connector catalog: sourceTypes=1, adapters=1/);
  assert.match(result.stdout, /normalized-thread-json\tadapter=false\trequired=inputFile\tcompatible=none/);
  assert.match(result.stdout, /recipe\tfields=inputFile\tflow=catalog>preflight>dry-run>rollout-plan>apply/);
  assert.equal(result.stderr, '');
});

test('CLI prints connector catalog as JSON with external module recipes', async function () {
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'connector-catalog',
    '--module-path',
    'docs/examples/external-connector-package/index.cjs',
    '--source-type',
    'package-normalized-feed',
    '--json',
    'true',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });
  const catalog = JSON.parse(result.stdout);
  const sourceType = catalog.sourceTypes[0];

  assert.equal(catalog.generatedAt, '2026-06-25T10:00:00.000Z');
  assert.equal(catalog.sourceTypes.length, 1);
  assert.equal(catalog.packages.length, 1);
  assert.equal(catalog.packages[0].packageName, '@threadtrace/example-external-connector-package');
  assert.deepEqual(catalog.packages[0].categories, ['api', 'archive', 'json-package']);
  assert.equal(sourceType.sourceType, 'package-normalized-feed');
  assert.equal(sourceType.package.packageName, '@threadtrace/example-external-connector-package');
  assert.equal(sourceType.package.sourceType.rolloutManifestExample, '../external-package-rollout-manifest.sample.json');
  assert.deepEqual(sourceType.onboardingRecipe.requiredLocationFields, ['inputFile']);
  assert.equal(sourceType.onboardingRecipe.rolloutManifestTemplate.source.sourceType, 'package-normalized-feed');
  assert.ok(sourceType.onboardingRecipe.recommendedFlow.some(function (step) {
    return step.key === 'preflight' && step.api === 'POST /api/sources/onboarding/preflight';
  }));
  assert.equal(result.stderr, '');
});

test('CLI prints connector package recommended manifest JSON', async function () {
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'connector-package-manifest',
    '--module-path',
    'docs/examples/rss-archive-connector-package/index.cjs',
    '--package-name',
    '@threadtrace/example-rss-archive-connector-package',
    '--source-type',
    'rss-archive-normalized-feed'
  ], {
    cwd: root,
    timeout: 20000
  });
  const manifest = JSON.parse(result.stdout);

  assert.equal(manifest.name, 'rss-archive-normalized-feed-rollout');
  assert.equal(manifest.source.sourceKey, 'rss-archive');
  assert.equal(manifest.source.sourceType, 'rss-archive-normalized-feed');
  assert.equal(manifest.source.location.inputFile, 'docs/examples/external-thread.sample.json');
  assert.equal(manifest.connector.modulePath, 'docs/examples/rss-archive-connector-package/index.cjs');
  assert.equal(result.stderr, '');
});

test('CLI prints connector package recommended manifest envelope as JSON', async function () {
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'connector-package-manifest',
    '--module-path',
    'docs/examples/rss-archive-connector-package/index.cjs',
    '--source-type',
    'rss-archive-normalized-feed',
    '--json',
    'true',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });
  const envelope = JSON.parse(result.stdout);

  assert.equal(envelope.generatedAt, '2026-06-25T10:00:00.000Z');
  assert.equal(envelope.status, 'ok');
  assert.equal(envelope.packageName, '@threadtrace/example-rss-archive-connector-package');
  assert.equal(envelope.sourceType, 'rss-archive-normalized-feed');
  assert.equal(envelope.recommendedManifest, '../rss-archive-rollout-manifest.sample.json');
  assert.equal(envelope.manifest.source.sourceType, 'rss-archive-normalized-feed');
  assert.match(envelope.manifestPath, /rss-archive-rollout-manifest\.sample\.json$/);
  assert.equal(result.stderr, '');
});
