'use strict';

const { createMockLlmProvider } = require('./mockLlmProvider');
const { createOpenAiCompatibleLlmProvider } = require('./openAiCompatibleLlmProvider');

function createLlmProvider(options) {
  const safeOptions = options || {};
  const env = safeOptions.env || process.env;
  const provider = normalizeProviderKey(safeOptions.provider || env.THREADTRACE_LLM_PROVIDER || 'mock');

  if (provider === 'mock') {
    return createMockLlmProvider(safeOptions.mock);
  }
  if (provider === 'openai-compatible' || provider === 'openai') {
    return createOpenAiCompatibleLlmProvider(Object.assign({}, safeOptions.openAiCompatible || {}, {
      env,
      fetch: safeOptions.fetch
    }));
  }
  throw new Error('Unknown LLM provider: ' + provider);
}

function normalizeProviderKey(value) {
  return String(value || 'mock').trim().toLowerCase();
}

module.exports = {
  createLlmProvider,
  normalizeProviderKey
};
