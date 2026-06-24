'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

test('CLI prints notification synthesis policy report', async function () {
  const scriptPath = path.resolve(__dirname, '..', 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'notification-synthesis-policy',
    '--now',
    '2026-06-25T10:00:00.000Z',
    '--priority-score-threshold',
    '85'
  ], {
    cwd: path.resolve(__dirname, '..'),
    timeout: 20000
  });

  assert.match(result.stdout, /Notification synthesis policy: ok/);
  assert.match(result.stdout, /Dry run default: true/);
  assert.match(result.stdout, /Source attention threshold: 85/);
  assert.match(result.stdout, /source-attention\t/);
  assert.match(result.stdout, /priority-score-threshold=85/);
  assert.equal(result.stderr, '');
});

test('CLI prints notification synthesis policy report as JSON', async function () {
  const scriptPath = path.resolve(__dirname, '..', 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'notification-synthesis-policy',
    '--now',
    '2026-06-25T10:00:00.000Z',
    '--priority-score-threshold',
    '85',
    '--json',
    'true'
  ], {
    cwd: path.resolve(__dirname, '..'),
    timeout: 20000
  });
  const report = JSON.parse(result.stdout);

  assert.equal(report.status, 'ok');
  assert.equal(report.defaults.sourceAttentionPriorityScoreThreshold, 85);
  assert.ok(report.eventTypes.find(function (item) {
    return item.type === 'source-attention';
  }));
  assert.equal(result.stderr, '');
});
