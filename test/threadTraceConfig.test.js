'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createThreadTraceConfig,
  normalizeReviewActionExecutor,
  normalizeSourceTaskMode,
  normalizeStorageMode
} = require('../src/runtime/threadTraceConfig');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('threadtrace config resolves defaults and environment overrides', function () {
  const cwd = path.resolve(__dirname, '..');
  const config = createThreadTraceConfig({
    cwd,
    env: {
      THREADTRACE_DEFAULT_FORUM: 'custom',
      THREADTRACE_EXAMPLE_DIR: 'fixtures/input',
      THREADTRACE_STORE_DIR: 'runtime-store',
      THREADTRACE_STORAGE: 'postgres',
      THREADTRACE_HTTP_PORT: '4100',
      THREADTRACE_HTTP_HOST: '0.0.0.0',
      THREADTRACE_LLM_PROVIDER: 'openai-compatible',
      THREADTRACE_LLM_API_KEY: 'test-key',
      THREADTRACE_LLM_MODEL: 'model-a',
      THREADTRACE_SOURCE_TASK_MODE: 'insight-pipeline',
      THREADTRACE_WORKER_INTERVAL_MS: '1000',
      THREADTRACE_OPERATIONS_WORKER_INTERVAL_MS: '2000',
      THREADTRACE_EVENT_WORKER_INTERVAL_MS: '3000',
      THREADTRACE_WORKER_LEASE_TTL_MS: '4000',
      THREADTRACE_SOURCE_RUN_STALE_AFTER_MS: '5000',
      THREADTRACE_SOURCE_FAILURE_RETRY_BACKOFF_MS: '6000',
      THREADTRACE_SOURCE_FAILURE_MAX_RETRY_BACKOFF_MS: '7000',
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit',
      THREADTRACE_WEBHOOK_URL: 'https://example.test/hook',
      THREADTRACE_CONNECTOR_MODULES: ['connectors/a.cjs', 'connectors/b.cjs'].join(path.delimiter)
    }
  });

  assert.equal(config.defaultForum, 'custom');
  assert.equal(config.defaultInputDir, path.join(cwd, 'fixtures', 'input'));
  assert.equal(config.storeDir, path.join(cwd, 'runtime-store'));
  assert.equal(config.storageMode, 'postgres');
  assert.equal(config.http.port, 4100);
  assert.equal(config.http.host, '0.0.0.0');
  assert.equal(config.llm.provider, 'openai-compatible');
  assert.equal(config.llm.model, 'model-a');
  assert.equal(config.llm.apiKeyConfigured, true);
  assert.equal(config.workers.sourceTaskMode, 'insight-pipeline');
  assert.equal(config.workers.dueSourceIntervalMs, 1000);
  assert.equal(config.workers.operationsIntervalMs, 2000);
  assert.equal(config.workers.eventIntervalMs, 3000);
  assert.equal(config.workers.leaseTtlMs, 4000);
  assert.equal(config.workers.sourceRunStaleAfterMs, 5000);
  assert.equal(config.workers.sourceFailureRetryBackoffMs, 6000);
  assert.equal(config.workers.sourceFailureMaxRetryBackoffMs, 7000);
  assert.equal(config.reviewActions.executor, 'file-audit');
  assert.equal(config.notifications.webhookUrl, 'https://example.test/hook');
  assert.deepEqual(config.connectors.modules, [
    path.join(cwd, 'connectors', 'a.cjs'),
    path.join(cwd, 'connectors', 'b.cjs')
  ]);
});

test('threadtrace config validates known modes', function () {
  assert.equal(normalizeStorageMode('FILE'), 'file');
  assert.equal(normalizeStorageMode('postgres'), 'postgres');
  assert.equal(normalizeSourceTaskMode('INGEST'), 'ingest');
  assert.equal(normalizeSourceTaskMode('insight-pipeline'), 'insight-pipeline');
  assert.equal(normalizeReviewActionExecutor('NONE'), 'none');
  assert.equal(normalizeReviewActionExecutor('file-audit'), 'file-audit');
  assert.throws(function () {
    normalizeStorageMode('sqlite');
  }, /Unknown ThreadTrace storage mode/);
  assert.throws(function () {
    normalizeSourceTaskMode('unknown');
  }, /Unknown ThreadTrace source task mode/);
  assert.throws(function () {
    normalizeReviewActionExecutor('webhook');
  }, /Unknown ThreadTrace review action executor/);
});

test('runtime consumes threadtrace config defaults', function () {
  const cwd = path.resolve(__dirname, '..');
  const config = createThreadTraceConfig({
    cwd,
    env: {
      THREADTRACE_DEFAULT_FORUM: 'nga',
      THREADTRACE_EXAMPLE_DIR: 'example',
      THREADTRACE_STORE_DIR: 'configured-store',
      THREADTRACE_STORAGE: 'file'
    }
  });
  const runtime = createThreadTraceRuntime({
    config
  });

  assert.equal(runtime.defaults.defaultForum, 'nga');
  assert.equal(runtime.defaults.defaultInputDir, path.join(cwd, 'example'));
  assert.equal(runtime.defaults.storeDir, path.join(cwd, 'configured-store'));
  assert.equal(runtime.defaults.storageMode, 'file');
});

test('runtime can compose file-audit review action executor from config', async function () {
  const cwd = path.resolve(__dirname, '..');
  const storeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-review-action-runtime-'));
  const config = createThreadTraceConfig({
    cwd,
    env: {
      THREADTRACE_STORE_DIR: storeDir,
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    }
  });
  const runtime = createThreadTraceRuntime({
    config
  });
  const contract = runtime.getContextReviewResultContract();

  await runtime.submitContextReviewResult({
    id: 'review-action-runtime-result-1',
    result: contract.example,
    storeDir,
    now: '2026-06-21T10:00:00.000Z'
  });
  const result = await runtime.runContextReviewActionTask({
    execute: true,
    storeDir,
    now: '2026-06-21T11:00:00.000Z'
  });
  const auditFiles = await fs.readdir(path.join(storeDir, 'review-action-audits'));

  assert.equal(result.report.executed, true);
  assert.equal(result.report.applied, true);
  assert.equal(result.report.executorReadiness.ready, true);
  assert.equal(result.report.executorResults.taskClosure.adapter, 'file-audit');
  assert.equal(result.report.executorResults.contextMerge.adapter, 'file-audit');
  assert.equal(auditFiles.length, 2);
});
