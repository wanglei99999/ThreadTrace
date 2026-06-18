'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  createThreadTraceConfig,
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
      THREADTRACE_LLM_MODEL: 'model-a',
      THREADTRACE_SOURCE_TASK_MODE: 'insight-pipeline',
      THREADTRACE_WORKER_INTERVAL_MS: '1000',
      THREADTRACE_OPERATIONS_WORKER_INTERVAL_MS: '2000',
      THREADTRACE_EVENT_WORKER_INTERVAL_MS: '3000',
      THREADTRACE_WORKER_LEASE_TTL_MS: '4000',
      THREADTRACE_WEBHOOK_URL: 'https://example.test/hook'
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
  assert.equal(config.workers.sourceTaskMode, 'insight-pipeline');
  assert.equal(config.workers.dueSourceIntervalMs, 1000);
  assert.equal(config.workers.operationsIntervalMs, 2000);
  assert.equal(config.workers.eventIntervalMs, 3000);
  assert.equal(config.workers.leaseTtlMs, 4000);
  assert.equal(config.notifications.webhookUrl, 'https://example.test/hook');
});

test('threadtrace config validates known modes', function () {
  assert.equal(normalizeStorageMode('FILE'), 'file');
  assert.equal(normalizeStorageMode('postgres'), 'postgres');
  assert.equal(normalizeSourceTaskMode('INGEST'), 'ingest');
  assert.equal(normalizeSourceTaskMode('insight-pipeline'), 'insight-pipeline');
  assert.throws(function () {
    normalizeStorageMode('sqlite');
  }, /Unknown ThreadTrace storage mode/);
  assert.throws(function () {
    normalizeSourceTaskMode('unknown');
  }, /Unknown ThreadTrace source task mode/);
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
