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

test('CLI prints source cockpit action plan as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-cockpit-plan-json-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-cockpit-action-plan',
    '--store-dir',
    tempDir,
    '--rank',
    '1',
    '--json',
    'true',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });

  const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, 'actionable');
  assert.equal(plan.selectedItem.rank, 1);
  assert.ok(plan.actions.length > 0);
  assert.ok(plan.actions[0].api || plan.actions[0].command);
  assert.equal(result.stderr, '');
});

test('CLI prints source cockpit action plan summary', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-cockpit-plan-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-cockpit-action-plan',
    '--store-dir',
    tempDir,
    '--rank',
    '1',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });

  assert.match(result.stdout, /Source cockpit action plan: actionable/);
  assert.match(result.stdout, /Selected: #1/);
  assert.match(result.stdout, /Actions: total=/);
  assert.match(result.stdout, /\n  api: |\n  command: /);
  assert.equal(result.stderr, '');
});

test('CLI prints llm readiness profile as JSON', async function () {
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await assert.rejects(execFileAsync(process.execPath, [
    scriptPath,
    'llm-readiness',
    '--provider',
    'mock',
    '--llm-readiness-mode',
    'configuration',
    '--json',
    'true',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  }), function (error) {
    const profile = JSON.parse(error.stdout);
    assert.equal(error.code, 1);
    assert.equal(profile.status, 'warn');
    assert.equal(profile.provider, 'mock');
    assert.equal(profile.mode, 'configuration');
    assert.equal(profile.readiness.mockMode, true);
    assert.equal(error.stderr, '');
    return true;
  });
});

test('CLI prints llm readiness profile summary', async function () {
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await assert.rejects(execFileAsync(process.execPath, [
    scriptPath,
    'llm-readiness',
    '--provider',
    'mock',
    '--llm-readiness-mode',
    'evaluation',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  }), function (error) {
    assert.equal(error.code, 1);
    assert.match(error.stdout, /LLM readiness: warn/);
    assert.match(error.stdout, /Mode: evaluation/);
    assert.match(error.stdout, /Ready: realProvider=false, preflight=true, evaluation=true/);
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

test('CLI prints source operations drilldown as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-drilldown-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-drilldown',
    '--source-key',
    'missing-source',
    '--store-dir',
    tempDir,
    '--json',
    'true',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });

  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'warn');
  assert.equal(report.scope.sourceKey, 'missing-source');
  assert.equal(report.sourceFound, false);
  assert.ok(report.nextActions.some(function (action) {
    return action.key === 'source.resolve';
  }));
  assert.equal(result.stderr, '');
});

test('CLI prints source collection health profile as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-collection-health-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await assert.rejects(execFileAsync(process.execPath, [
    scriptPath,
    'source-collection-health',
    '--store-dir',
    tempDir,
    '--source-key',
    'missing',
    '--json',
    'true',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  }), function (error) {
    const profile = JSON.parse(error.stdout);
    assert.equal(error.code, 2);
    assert.equal(profile.status, 'fail');
    assert.equal(profile.scope.sourceKey, 'missing');
    assert.equal(profile.sourceFound, false);
    assert.equal(profile.checks.find(function (item) {
      return item.key === 'source.resolved';
    }).status, 'fail');
    assert.equal(error.stderr, '');
    return true;
  });
});

test('CLI prints automation readiness plan as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-automation-readiness-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await assert.rejects(execFileAsync(process.execPath, [
    scriptPath,
    'automation-readiness',
    '--store-dir',
    tempDir,
    '--source-task-mode',
    'insight-pipeline',
    '--json',
    'true',
    '--now',
    '2026-06-26T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  }), function (error) {
    const plan = JSON.parse(error.stdout);
    assert.equal(error.code, 2);
    assert.equal(plan.status, 'fail');
    assert.equal(plan.readyForUnattendedRun, false);
    assert.equal(plan.summary.sources.total, 0);
    assert.equal(plan.summary.workers.sourceTaskMode, 'insight-pipeline');
    assert.ok(plan.checks.find(function (item) {
      return item.key === 'automation.sources.registered' && item.status === 'fail';
    }));
    assert.equal(error.stderr, '');
    return true;
  });
});
