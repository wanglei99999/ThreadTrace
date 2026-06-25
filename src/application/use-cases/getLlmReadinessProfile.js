'use strict';

function getLlmReadinessProfile(options) {
  const safeOptions = options || {};
  const config = safeOptions.config || {};
  const llm = config.llm || {};
  const provider = safeOptions.provider || llm.provider || 'mock';
  const mode = normalizeLlmReadinessMode(safeOptions.llmReadinessMode);
  const preflight = safeOptions.preflight;
  const evaluation = safeOptions.evaluation;
  const checks = buildChecks({
    provider,
    mode,
    llm,
    preflight,
    evaluation
  });
  const status = aggregateStatus(checks);

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status,
    provider,
    mode,
    configuration: {
      provider: llm.provider || provider,
      selectedProvider: provider,
      remoteProvider: isRemoteLlmProvider(provider),
      baseUrlConfigured: Boolean(llm.baseUrl),
      modelConfigured: Boolean(llm.model),
      apiKeyConfigured: Boolean(llm.apiKeyConfigured),
      timeoutMs: llm.timeoutMs
    },
    readiness: {
      mockMode: provider === 'mock',
      realProviderCandidate: provider !== 'mock' && checks.filter(function (item) {
        return item.area === 'configuration' && item.status !== 'ok';
      }).length === 0,
      preflightPassed: preflight && preflight.status === 'ok',
      evaluationPassed: evaluation && evaluation.status === 'ok'
    },
    checks,
    preflight,
    evaluation,
    nextActions: buildNextActions(status, provider, mode, checks)
  };
}

function buildChecks(options) {
  const checks = [];
  const provider = options.provider;
  const llm = options.llm || {};
  const mode = options.mode;
  const preflight = options.preflight;
  const evaluation = options.evaluation;

  checks.push(check('llm.provider.selected', 'configuration', provider ? 'ok' : 'fail', provider || 'missing', 'LLM provider selection is available.'));
  if (provider === 'mock') {
    checks.push(check('llm.provider.mockMode', 'configuration', 'warn', 'mock', 'Mock provider is deterministic and safe for tests, but not production semantic quality.'));
  }

  if (isRemoteLlmProvider(provider)) {
    checks.push(check('llm.provider.apiKey', 'configuration', llm.apiKeyConfigured ? 'ok' : 'warn', llm.apiKeyConfigured ? 'configured' : 'missing', 'Remote provider API key is configured.'));
    checks.push(check('llm.provider.model', 'configuration', llm.model ? 'ok' : 'warn', llm.model || 'missing', 'Remote provider model is configured.'));
    checks.push(check('llm.provider.baseUrl', 'configuration', provider === 'openai-compatible' && !llm.baseUrl ? 'warn' : 'ok', llm.baseUrl ? 'configured' : 'default', 'Remote provider base URL is configured or will use the OpenAI-compatible default.'));
  }

  if (mode === 'preflight' || mode === 'evaluation') {
    checks.push(check('llm.preflight', 'preflight', preflight && preflight.status === 'ok' ? 'ok' : 'fail', preflight && preflight.status || 'not-run', 'Provider preflight returns valid semantic JSON.'));
  }
  if (mode === 'evaluation') {
    checks.push(check('llm.evaluation', 'evaluation', evaluation && evaluation.status === 'ok' ? 'ok' : (evaluation && evaluation.status === 'warn' ? 'warn' : 'fail'), evaluation && evaluation.status || 'not-run', 'Provider semantic evaluation samples pass quality checks.'));
  }

  return checks;
}

function buildNextActions(status, provider, mode, checks) {
  if (status === 'ok') {
    return [{
      key: 'llm.readiness.ready',
      severity: 'info',
      summary: 'LLM provider readiness is green for the selected mode.',
      commands: [
        'node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id <source-id> --provider ' + provider
      ]
    }];
  }

  const actions = [];
  if (checks.some(function (item) { return item.key === 'llm.provider.mockMode'; })) {
    actions.push({
      key: 'llm.readiness.realProvider',
      severity: 'warning',
      summary: 'Configure a real provider before relying on semantic quality in production.',
      env: ['THREADTRACE_LLM_PROVIDER', 'THREADTRACE_LLM_API_KEY', 'THREADTRACE_LLM_MODEL', 'THREADTRACE_LLM_BASE_URL']
    });
  }
  if (mode === 'configuration') {
    actions.push({
      key: 'llm.readiness.preflight',
      severity: 'info',
      summary: 'Run preflight when provider configuration is ready.',
      commands: ['node src/presentation/cli/threadtrace.js llm-readiness --llm-readiness-mode preflight --provider ' + provider]
    });
  } else {
    actions.push({
      key: 'llm.readiness.fix',
      severity: status === 'fail' ? 'warning' : 'info',
      summary: 'Fix configuration or model output quality, then rerun readiness.',
      commands: [
        'node src/presentation/cli/threadtrace.js llm-preflight --provider ' + provider,
        'node src/presentation/cli/threadtrace.js llm-evaluate --provider ' + provider
      ]
    });
  }
  return actions;
}

function check(key, area, status, value, summary) {
  return {
    key,
    area,
    status,
    value,
    summary
  };
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

function isRemoteLlmProvider(provider) {
  return provider === 'openai-compatible' || provider === 'openai';
}

function normalizeLlmReadinessMode(mode) {
  if (!mode || mode === 'configuration') return 'configuration';
  if (mode === 'preflight' || mode === 'evaluation') return mode;
  throw new Error('Unknown LLM readiness mode: ' + mode);
}

module.exports = {
  getLlmReadinessProfile,
  normalizeLlmReadinessMode
};
