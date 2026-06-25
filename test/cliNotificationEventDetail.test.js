'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const test = require('node:test');

const execFileAsync = promisify(execFile);

test('CLI prints notification event detail as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-event-detail-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await fs.mkdir(path.join(tempDir, 'events'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'tasks'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'events', 'event-1.json'), JSON.stringify({
    id: 'event-1',
    type: 'source-changed',
    severity: 'warning',
    createdAt: '2026-06-25T09:00:00.000Z',
    title: 'Source changed',
    summary: 'Source cursor changed.',
    payload: {},
    sourceId: 'source-1',
    sourceKey: 'nga',
    taskId: 'task-1',
    deliveryStatus: 'failed',
    deliveryAttempts: 2,
    nextDeliveryAt: '2026-06-25T09:05:00.000Z'
  }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(tempDir, 'tasks', 'task-1.json'), JSON.stringify({
    id: 'task-1',
    type: 'source-ingest',
    status: 'completed',
    createdAt: '2026-06-25T08:59:00.000Z',
    updatedAt: '2026-06-25T09:00:00.000Z'
  }, null, 2) + '\n', 'utf8');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'event-detail',
    '--event-id',
    'event-1',
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

  const detail = JSON.parse(result.stdout);
  assert.equal(detail.event.id, 'event-1');
  assert.equal(detail.sourceScope.sourceKey, 'nga');
  assert.equal(detail.sourceScope.sourceId, 'source-1');
  assert.equal(detail.relatedTask.id, 'task-1');
  assert.equal(detail.actionReadiness.status, 'warn');
  assert.ok(detail.actionReadiness.executableActionKeys.includes('event.dispatch'));
  assert.ok(detail.links.some(function (link) {
    return link.rel === 'source-drilldown';
  }));
  assert.ok(detail.nextActions.some(function (action) {
    return action.key === 'event.dispatch';
  }));
  assert.equal(result.stderr, '');
});

test('CLI prints notification event action intent as JSON', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-event-action-intent-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await fs.mkdir(path.join(tempDir, 'events'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'events', 'event-1.json'), JSON.stringify({
    id: 'event-1',
    type: 'source-changed',
    severity: 'info',
    createdAt: '2026-06-25T09:00:00.000Z',
    title: 'Source changed',
    summary: 'Source cursor changed.',
    payload: {},
    sourceId: 'source-1',
    sourceKey: 'nga',
    deliveryStatus: 'pending',
    deliveryAttempts: 0,
    nextDeliveryAt: '2026-06-25T09:05:00.000Z'
  }, null, 2) + '\n', 'utf8');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'event-action-intent',
    '--event-id',
    'event-1',
    '--action-key',
    'event.acknowledge',
    '--by',
    'cli-test',
    '--reason',
    'reviewed',
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

  const intent = JSON.parse(result.stdout);
  const listResult = await execFileAsync(process.execPath, [
    scriptPath,
    'event-action-intents',
    '--event-id',
    'event-1',
    '--store-dir',
    tempDir,
    '--json',
    'true'
  ], {
    cwd: root,
    timeout: 20000
  });
  const intentList = JSON.parse(listResult.stdout);

  assert.equal(intent.mode, 'dry-run');
  assert.equal(intent.dryRun, true);
  assert.equal(intent.executed, false);
  assert.equal(intent.action.key, 'event.acknowledge');
  assert.equal(intent.intent.actor, 'cli-test');
  assert.equal(intent.intent.reason, 'reviewed');
  assert.equal(intent.intent.api.path, '/api/events/event-1/ack');
  assert.equal(intent.ledger.recorded, true);
  assert.equal(intentList.count, 1);
  assert.equal(intentList.intents[0].id, intent.ledger.recordId);
  assert.equal(intentList.intents[0].actor, 'cli-test');
  assert.equal(result.stderr, '');
  assert.equal(listResult.stderr, '');
});

test('CLI executes notification event action through execution ledger', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-event-action-execute-'));
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  await fs.mkdir(path.join(tempDir, 'events'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'events', 'event-1.json'), JSON.stringify({
    id: 'event-1',
    type: 'source-changed',
    severity: 'info',
    createdAt: '2026-06-25T09:00:00.000Z',
    title: 'Source changed',
    summary: 'Source cursor changed.',
    payload: {},
    sourceId: 'source-1',
    sourceKey: 'nga',
    deliveryStatus: 'pending',
    deliveryAttempts: 0,
    nextDeliveryAt: '2026-06-25T09:05:00.000Z'
  }, null, 2) + '\n', 'utf8');

  const previewResult = await execFileAsync(process.execPath, [
    scriptPath,
    'event-action-execute',
    '--event-id',
    'event-1',
    '--action-key',
    'event.acknowledge',
    '--by',
    'cli-test',
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
  const executeResult = await execFileAsync(process.execPath, [
    scriptPath,
    'event-action-execute',
    '--event-id',
    'event-1',
    '--action-key',
    'event.acknowledge',
    '--by',
    'cli-test',
    '--note',
    'handled',
    '--execute',
    'true',
    '--store-dir',
    tempDir,
    '--json',
    'true',
    '--now',
    '2026-06-25T10:01:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });
  const replayResult = await execFileAsync(process.execPath, [
    scriptPath,
    'event-action-execute',
    '--event-id',
    'event-1',
    '--action-key',
    'event.acknowledge',
    '--by',
    'cli-test',
    '--execute',
    'true',
    '--store-dir',
    tempDir,
    '--json',
    'true',
    '--now',
    '2026-06-25T10:02:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });
  const listResult = await execFileAsync(process.execPath, [
    scriptPath,
    'event-action-executions',
    '--event-id',
    'event-1',
    '--store-dir',
    tempDir,
    '--json',
    'true'
  ], {
    cwd: root,
    timeout: 20000
  });

  const preview = JSON.parse(previewResult.stdout);
  const executed = JSON.parse(executeResult.stdout);
  const replay = JSON.parse(replayResult.stdout);
  const list = JSON.parse(listResult.stdout);

  assert.equal(preview.dryRun, true);
  assert.equal(preview.executed, false);
  assert.equal(preview.executionLedger.recorded, false);
  assert.equal(executed.mode, 'execute');
  assert.equal(executed.executed, true);
  assert.equal(executed.event.acknowledgedAt, '2026-06-25T10:01:00.000Z');
  assert.equal(executed.event.acknowledgedBy, 'cli-test');
  assert.equal(executed.event.acknowledgementNote, 'handled');
  assert.equal(executed.executionLedger.replayed, false);
  assert.equal(replay.executionLedger.replayed, true);
  assert.equal(list.count, 1);
  assert.equal(list.executions[0].status, 'completed');
  assert.equal(list.executions[0].eventId, 'event-1');
  assert.equal(previewResult.stderr, '');
  assert.equal(executeResult.stderr, '');
  assert.equal(replayResult.stderr, '');
  assert.equal(listResult.stderr, '');
});
