'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

test('CLI prints source attention report for an empty store', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-attention-'));
  const scriptPath = path.resolve(__dirname, '..', 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-attention-report',
    '--store-dir',
    tempDir,
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: path.resolve(__dirname, '..'),
    timeout: 20000
  });

  assert.match(result.stdout, /Source attention: ok/);
  assert.match(result.stdout, /Sources: total=0/);
  assert.match(result.stdout, /actionable=0/);
  assert.match(result.stdout, /topPriority=0/);
  assert.match(result.stdout, /Signals: none/);
  assert.equal(result.stderr, '');
});

test('CLI can print source attention report as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-attention-json-'));
  const scriptPath = path.resolve(__dirname, '..', 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-attention-report',
    '--store-dir',
    tempDir,
    '--now',
    '2026-06-25T10:00:00.000Z',
    '--json',
    'true'
  ], {
    cwd: path.resolve(__dirname, '..'),
    timeout: 20000
  });
  const report = JSON.parse(result.stdout);

  assert.equal(report.status, 'ok');
  assert.equal(report.summary.total, 0);
  assert.equal(report.summary.actionable, 0);
  assert.equal(report.summary.highestPriorityScore, 0);
  assert.deepEqual(report.sources, []);
  assert.equal(result.stderr, '');
});

test('CLI can dry-run source attention notification synthesis', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-attention-events-'));
  const scriptPath = path.resolve(__dirname, '..', 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'synthesize-source-attention-events',
    '--store-dir',
    tempDir,
    '--now',
    '2026-06-25T10:00:00.000Z',
    '--priority-score-threshold',
    '80'
  ], {
    cwd: path.resolve(__dirname, '..'),
    timeout: 20000
  });

  assert.match(result.stdout, /Source attention events: ok/);
  assert.match(result.stdout, /Mode: dry-run/);
  assert.match(result.stdout, /threshold=80/);
  assert.equal(result.stderr, '');
});
