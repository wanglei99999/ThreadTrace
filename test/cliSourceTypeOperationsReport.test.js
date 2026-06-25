'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

test('CLI prints source type operations report as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-type-operations-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await assert.rejects(execFileAsync(process.execPath, [
    scriptPath,
    'source-type-operations-report',
    '--store-dir',
    tempDir,
    '--json',
    'true',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  }), function (error) {
    const report = JSON.parse(error.stdout);
    assert.equal(error.code, 1);
    assert.equal(report.status, 'warn');
    assert.equal(report.summary.sourceTypeCount, 3);
    assert.equal(report.summary.warnSourceTypeCount, 3);
    assert.equal(report.summary.sourceCount, 0);
    assert.equal(report.sourceTypes[0].readiness.status, 'warn');
    assert.equal(error.stderr, '');
    return true;
  });
});

test('CLI can dry-run source type operations notification synthesis', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-type-operations-events-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'synthesize-source-type-operations-events',
    '--store-dir',
    tempDir,
    '--now',
    '2026-06-25T10:00:00.000Z',
    '--priority-score-threshold',
    '80'
  ], {
    cwd: root,
    timeout: 20000
  });

  assert.match(result.stdout, /Source type operations events: ok/);
  assert.match(result.stdout, /Mode: dry-run/);
  assert.match(result.stdout, /Source types: 3/);
  assert.match(result.stdout, /threshold=80/);
  assert.equal(result.stderr, '');
});

test('CLI prints source type operations drilldown as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-type-drilldown-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await assert.rejects(execFileAsync(process.execPath, [
    scriptPath,
    'source-type-drilldown',
    '--source-type',
    'saved-html-directory',
    '--store-dir',
    tempDir,
    '--json',
    'true',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  }), function (error) {
    const report = JSON.parse(error.stdout);
    assert.equal(error.code, 1);
    assert.equal(report.status, 'warn');
    assert.equal(report.sourceType, 'saved-html-directory');
    assert.equal(report.sourceFound, false);
    assert.equal(report.health.sources.total, 0);
    assert.ok(report.nextActions.some(function (action) {
      return action.key === 'sourceType.onboarding';
    }));
    assert.equal(error.stderr, '');
    return true;
  });
});
