'use strict';

const { assertLlmProvider } = require('../../application/ports/llmProvider');

function createOpenAiCompatibleLlmProvider(options) {
  const safeOptions = options || {};
  const env = safeOptions.env || process.env;
  const fetchImpl = safeOptions.fetch || globalThis.fetch;
  const baseUrl = trimTrailingSlash(safeOptions.baseUrl || env.THREADTRACE_LLM_BASE_URL || 'https://api.openai.com');
  const apiKey = safeOptions.apiKey || env.THREADTRACE_LLM_API_KEY || env.OPENAI_API_KEY;
  const model = safeOptions.model || env.THREADTRACE_LLM_MODEL;
  const timeoutMs = safeOptions.timeoutMs ? Number(safeOptions.timeoutMs) : Number(env.THREADTRACE_LLM_TIMEOUT_MS || 30000);

  if (typeof fetchImpl !== 'function') {
    throw new Error('OpenAI-compatible LLM provider requires fetch. Use Node.js 20+ or pass fetch.');
  }
  if (!apiKey) {
    throw new Error('OpenAI-compatible LLM provider requires THREADTRACE_LLM_API_KEY or OPENAI_API_KEY.');
  }
  if (!model) {
    throw new Error('OpenAI-compatible LLM provider requires THREADTRACE_LLM_MODEL.');
  }

  const provider = {
    providerKey: 'openai-compatible',
    async completeStructured(request) {
      const controller = new AbortController();
      const timeout = setTimeout(function () {
        controller.abort();
      }, timeoutMs);
      try {
        const response = await fetchImpl(baseUrl + '/v1/chat/completions', {
          method: 'POST',
          headers: {
            authorization: 'Bearer ' + apiKey,
            'content-type': 'application/json'
          },
          signal: controller.signal,
          body: JSON.stringify(buildRequestBody(model, request))
        });
        const body = await response.json().catch(function () {
          return {};
        });
        if (!response.ok) {
          throw new Error('LLM request failed with HTTP ' + response.status + ': ' + (body.error && body.error.message ? body.error.message : response.statusText));
        }
        return {
          provider: 'openai-compatible',
          output: parseStructuredContent(body),
          usage: body.usage,
          raw: safeOptions.includeRaw ? body : undefined
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };

  return assertLlmProvider(provider);
}

function buildRequestBody(model, request) {
  return {
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are a ThreadTrace semantic extraction component.',
          'Return only valid JSON matching the requested schema.',
          'Every claim must cite evidenceRefs when possible.',
          'Use limitations for uncertain or unsupported conclusions.',
          'Write every natural-language field (summary, rationale, question, limitations, and any prose) in Simplified Chinese; keep JSON keys, enum values, and identifiers unchanged.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: request.task,
          traceId: request.traceId,
          schema: request.schema,
          input: request.input
        })
      }
    ]
  };
}

function parseStructuredContent(body) {
  const content = body
    && body.choices
    && body.choices[0]
    && body.choices[0].message
    && body.choices[0].message.content;
  if (!content) {
    throw new Error('LLM response did not include message content.');
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error('LLM response content was not valid JSON: ' + error.message);
  }
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

module.exports = {
  createOpenAiCompatibleLlmProvider
};
