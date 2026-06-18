'use strict';

/**
 * LLM port for semantic extraction. The first implementation can be OpenAI
 * compatible; tests and local development can use a deterministic mock.
 *
 * @typedef {Object} LlmProvider
 * @property {(request: { task: string, input: Object, schema?: Object, traceId?: string }) => Promise<{ output: Object, usage?: Object, raw?: unknown }>} completeStructured
 */

function assertLlmProvider(provider) {
  if (!provider || typeof provider.completeStructured !== 'function') {
    throw new Error('LlmProvider must implement completeStructured(request).');
  }
  return provider;
}

module.exports = {
  assertLlmProvider
};
