'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getRuntimeDiagnostics } = require('../src/application/use-cases/getRuntimeDiagnostics');
const { createThreadTraceConfig } = require('../src/runtime/threadTraceConfig');

test('runtime diagnostics redacts sensitive LLM configuration', async function () {
  const config = createThreadTraceConfig({
    env: {
      THREADTRACE_LLM_PROVIDER: 'openai-compatible',
      THREADTRACE_LLM_API_KEY: 'secret-key',
      THREADTRACE_LLM_MODEL: 'model-a'
    },
    cwd: process.cwd()
  });

  const diagnostics = await getRuntimeDiagnostics({
    config,
    now: '2026-06-18T10:00:00.000Z'
  });

  assert.equal(diagnostics.status, 'ok');
  assert.equal(diagnostics.generatedAt, '2026-06-18T10:00:00.000Z');
  assert.equal(diagnostics.configuration.llm.provider, 'openai-compatible');
  assert.equal(diagnostics.configuration.llm.apiKeyConfigured, true);
  assert.equal(JSON.stringify(diagnostics), JSON.stringify(diagnostics).replace('secret-key', ''));
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'config.llm.apiKey';
  }).status, 'ok');
});

test('runtime diagnostics warns when remote LLM provider is incomplete', async function () {
  const config = createThreadTraceConfig({
    env: {
      THREADTRACE_LLM_PROVIDER: 'openai-compatible'
    },
    cwd: process.cwd()
  });

  const diagnostics = await getRuntimeDiagnostics({
    config
  });

  assert.equal(diagnostics.status, 'warn');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'config.llm.apiKey';
  }).status, 'warn');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'config.llm.model';
  }).status, 'warn');
});

test('runtime diagnostics includes resource checks', async function () {
  const config = createThreadTraceConfig({
    env: {},
    cwd: process.cwd()
  });
  const diagnostics = await getRuntimeDiagnostics({
    config,
    inspectResources: async function () {
      return {
        storageMode: 'file',
        checks: [
          {
            key: 'resources.storeDir',
            status: 'ok',
            value: config.storeDir,
            summary: 'Store directory is writable.'
          }
        ]
      };
    }
  });

  assert.equal(diagnostics.resources.storageMode, 'file');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.storeDir';
  }).status, 'ok');
});
