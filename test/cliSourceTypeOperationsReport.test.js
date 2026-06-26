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

test('CLI configures a source schedule as an audited JSON task', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-schedule-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const registerResult = await execFileAsync(process.execPath, [
    scriptPath,
    'register-source',
    '--source-id',
    'cli-source-1',
    '--forum',
    'nga',
    '--name',
    'CLI schedule source',
    '--input',
    path.join(root, 'example'),
    '--store-dir',
    tempDir
  ], {
    cwd: root,
    timeout: 20000
  });
  const scheduleResult = await execFileAsync(process.execPath, [
    scriptPath,
    'configure-source-schedule',
    '--source-id',
    'cli-source-1',
    '--interval-minutes',
    '20',
    '--run-now',
    'true',
    '--execute',
    'true',
    '--json',
    'true',
    '--now',
    '2026-06-26T10:00:00.000Z',
    '--store-dir',
    tempDir
  ], {
    cwd: root,
    timeout: 20000
  });

  const task = JSON.parse(scheduleResult.stdout);
  assert.match(registerResult.stdout, /Created source: cli-source-1/);
  assert.equal(registerResult.stderr, '');
  assert.equal(task.task.type, 'configure-source-schedule');
  assert.equal(task.task.status, 'completed');
  assert.equal(task.result.executed, true);
  assert.equal(task.result.changed, true);
  assert.equal(task.result.sourceAfter.schedule.intervalMinutes, 20);
  assert.equal(task.result.sourceAfter.schedule.nextRunAt, '2026-06-26T10:00:00.000Z');
  assert.equal(scheduleResult.stderr, '');
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
    assert.equal(plan.remediation.status, 'manual');
    assert.equal(plan.remediation.actionCount, 0);
    assert.ok(plan.remediation.manualActions.some(function (action) {
      return action.checkKey === 'automation.sources.registered';
    }));
    assert.ok(plan.checks.find(function (item) {
      return item.key === 'automation.sources.registered' && item.status === 'fail';
    }));
    assert.equal(error.stderr, '');
    return true;
  });
});

test('CLI prints automation cockpit snapshot as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-automation-cockpit-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await assert.rejects(execFileAsync(process.execPath, [
    scriptPath,
    'automation-cockpit',
    '--store-dir',
    tempDir,
    '--source-task-mode',
    'insight-pipeline',
    '--notification-limit',
    '7',
    '--audit-limit',
    '8',
    '--execution-limit',
    '9',
    '--json',
    'true',
    '--now',
    '2026-06-26T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  }), function (error) {
    const snapshot = JSON.parse(error.stdout);
    assert.equal(error.code, 2);
    assert.equal(snapshot.schemaVersion, 'automation-cockpit-snapshot.v1');
    assert.equal(snapshot.generatedAt, '2026-06-26T10:00:00.000Z');
    assert.equal(snapshot.status, 'fail');
    assert.equal(snapshot.readyForUnattendedRun, false);
    assert.equal(snapshot.plan.status, 'fail');
    assert.equal(snapshot.plan.summary.sources.total, 0);
    assert.equal(snapshot.plan.summary.workers.sourceTaskMode, 'insight-pipeline');
    assert.equal(snapshot.notificationOverview.windowLimit, 7);
    assert.equal(snapshot.reviewActionAuditOverview.query.limit, 8);
    assert.equal(snapshot.reviewActionExecutions.count, 0);
    assert.equal(snapshot.summary.readinessStatus, 'fail');
    assert.equal(snapshot.summary.diagnosticsStatus, 'ok');
    assert.ok(snapshot.operatingPressure);
    assert.ok(snapshot.operatingPressure.outbox);
    assert.ok(snapshot.operatingPressure.audit);
    assert.ok(snapshot.operatingPressure.executions);
    assert.ok(snapshot.operatingPressure.channel);
    assert.ok(snapshot.freshness);
    assert.ok(snapshot.freshness.sourceCount >= snapshot.freshness.presentSourceCount);
    assert.ok(Array.isArray(snapshot.freshness.sources));
    assert.ok(snapshot.attentionQueue);
    assert.ok(Array.isArray(snapshot.attentionQueue.items));
    assert.equal(snapshot.attentionQueue.itemCount, snapshot.attentionQueue.items.length);
    assert.ok(snapshot.attentionQueue.items.some(function (item) {
      return item.id === 'readiness' || item.id === 'freshness';
    }));
    assert.ok(snapshot.operatorRunbook.commandCount >= 3);
    assert.ok(snapshot.operatorRunbook.actionableCommandCount >= 0);
    assert.equal(snapshot.operatorRunbook.commandCount, snapshot.operatorRunbook.actionableCommandCount + snapshot.operatorRunbook.copyOnlyCommandCount);
    assert.ok(snapshot.operatorRunbook.sections.find(function (section) {
      return section.key === 'workers';
    }));
    assert.ok(snapshot.operatorRunbook.sections.find(function (section) {
      return section.key === 'verification';
    }).commands.some(function (command) {
      return command.command === 'npm run verify:web:automation-cockpit';
    }));
    assert.equal(error.stderr, '');
    return true;
  });
});
