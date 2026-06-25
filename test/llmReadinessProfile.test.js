'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getLlmReadinessProfile } = require('../src/application/use-cases/getLlmReadinessProfile');
const { createThreadTraceConfig } = require('../src/runtime/threadTraceConfig');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('llm readiness profile marks mock provider as non-production warning', function () {
  const config = createThreadTraceConfig({
    env: {},
    cwd: process.cwd()
  });

  const profile = getLlmReadinessProfile({
    config,
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(profile.status, 'warn');
  assert.equal(profile.provider, 'mock');
  assert.equal(profile.mode, 'configuration');
  assert.equal(profile.configuration.apiKeyConfigured, false);
  assert.equal(profile.readiness.mockMode, true);
  assert.equal(profile.checks.find(function (item) {
    return item.key === 'llm.provider.mockMode';
  }).status, 'warn');
  assert.equal(profile.nextActions[0].key, 'llm.readiness.realProvider');
});

test('llm readiness profile passes when real provider configuration and evaluation pass', function () {
  const config = createThreadTraceConfig({
    env: {
      THREADTRACE_LLM_PROVIDER: 'openai-compatible',
      THREADTRACE_LLM_API_KEY: 'secret-key',
      THREADTRACE_LLM_MODEL: 'model-a',
      THREADTRACE_LLM_BASE_URL: 'https://llm.example.test'
    },
    cwd: process.cwd()
  });

  const profile = getLlmReadinessProfile({
    config,
    provider: 'openai-compatible',
    llmReadinessMode: 'evaluation',
    preflight: {
      status: 'ok',
      provider: 'openai-compatible'
    },
    evaluation: {
      status: 'ok',
      provider: 'openai-compatible',
      sampleCount: 2,
      summary: { ok: 2, warn: 0, fail: 0 }
    }
  });

  assert.equal(profile.status, 'ok');
  assert.equal(profile.readiness.realProviderCandidate, true);
  assert.equal(profile.readiness.preflightPassed, true);
  assert.equal(profile.readiness.evaluationPassed, true);
  assert.equal(profile.nextActions[0].key, 'llm.readiness.ready');
  assert.equal(JSON.stringify(profile).includes('secret-key'), false);
});

test('llm readiness profile reports incomplete remote provider configuration', function () {
  const config = createThreadTraceConfig({
    env: {
      THREADTRACE_LLM_PROVIDER: 'openai-compatible'
    },
    cwd: process.cwd()
  });

  const profile = getLlmReadinessProfile({
    config,
    provider: 'openai-compatible'
  });

  assert.equal(profile.status, 'warn');
  assert.equal(profile.readiness.realProviderCandidate, false);
  assert.equal(profile.checks.find(function (item) {
    return item.key === 'llm.provider.apiKey';
  }).status, 'warn');
  assert.equal(profile.checks.find(function (item) {
    return item.key === 'llm.provider.model';
  }).status, 'warn');
});

test('runtime llm readiness profile can include preflight and evaluation evidence', async function () {
  const runtime = createThreadTraceRuntime({});

  const profile = await runtime.getLlmReadinessProfile({
    provider: 'mock',
    llmReadinessMode: 'evaluation',
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(profile.status, 'warn');
  assert.equal(profile.preflight.status, 'ok');
  assert.equal(profile.evaluation.status, 'ok');
  assert.equal(profile.readiness.preflightPassed, true);
  assert.equal(profile.readiness.evaluationPassed, true);
  assert.equal(profile.checks.find(function (item) {
    return item.key === 'llm.evaluation';
  }).status, 'ok');
});
