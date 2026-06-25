'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

test('CLI prints source type readiness summary', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-type-readiness-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-type-readiness',
    '--store-dir',
    tempDir,
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });

  assert.match(result.stdout, /Source type readiness: warn/);
  assert.match(result.stdout, /Source types: total=3, ready=0, warn=3, fail=0, unknown=0/);
  assert.match(result.stdout, /warn\tsaved-html-directory\tsources=0\tenabled=0\tcompatible=nga/);
  assert.match(result.stdout, /warn\tnormalized-thread-json\tsources=0\tenabled=0\tcompatible=none/);
  assert.equal(result.stderr, '');
});

test('CLI prints source type readiness as JSON for external modules', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-type-readiness-json-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-type-readiness',
    '--module-path',
    'docs/examples/external-connector-package/index.cjs',
    '--store-dir',
    tempDir,
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
  const report = JSON.parse(result.stdout);

  assert.equal(report.summary.sourceTypeCount, 1);
  assert.equal(report.sourceTypes[0].sourceType, 'package-normalized-feed');
  assert.equal(report.sourceTypes[0].status, 'warn');
  assert.equal(report.sourceTypes[0].onboardingRecipe.rolloutManifestTemplate.source.sourceType, 'package-normalized-feed');
  assert.equal(result.stderr, '');
});

test('CLI reports source type readiness module load errors', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-type-readiness-module-error-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await assert.rejects(execFileAsync(process.execPath, [
    scriptPath,
    'source-type-readiness',
    '--module-path',
    'docs/examples/missing-connector.cjs',
    '--store-dir',
    tempDir,
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  }), function (error) {
    assert.equal(error.code, 2);
    assert.match(error.stdout, /Source type readiness: fail/);
    assert.match(error.stdout, /Modules: 0, errors=1/);
    assert.match(error.stdout, /module-error/);
    assert.equal(error.stderr, '');
    return true;
  });
});
