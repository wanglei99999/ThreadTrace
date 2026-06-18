'use strict';

function getRuntimeDiagnostics(options) {
  const safeOptions = options || {};
  const config = safeOptions.config || {};
  const llm = config.llm || {};
  const workers = config.workers || {};
  const notifications = config.notifications || {};
  const checks = buildRuntimeDiagnosticChecks(config);

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateStatus(checks),
    configuration: {
      defaultForum: config.defaultForum,
      defaultInputDir: config.defaultInputDir,
      storeDir: config.storeDir,
      storageMode: config.storageMode,
      http: config.http,
      llm: {
        provider: llm.provider,
        baseUrlConfigured: Boolean(llm.baseUrl),
        modelConfigured: Boolean(llm.model),
        apiKeyConfigured: Boolean(llm.apiKeyConfigured),
        timeoutMs: llm.timeoutMs
      },
      workers: {
        sourceTaskMode: workers.sourceTaskMode,
        dueSourceIntervalMs: workers.dueSourceIntervalMs,
        operationsIntervalMs: workers.operationsIntervalMs,
        eventIntervalMs: workers.eventIntervalMs,
        leaseTtlMs: workers.leaseTtlMs
      },
      notifications: {
        webhookConfigured: Boolean(notifications.webhookUrl)
      }
    },
    checks
  };
}

function buildRuntimeDiagnosticChecks(config) {
  const safeConfig = config || {};
  const llm = safeConfig.llm || {};
  const workers = safeConfig.workers || {};
  const checks = [
    check('config.storageMode', safeConfig.storageMode ? 'ok' : 'fail', safeConfig.storageMode || 'missing', 'Storage mode is configured.'),
    check('config.storeDir', safeConfig.storeDir ? 'ok' : 'fail', safeConfig.storeDir || 'missing', 'Store directory is configured.'),
    check('config.sourceTaskMode', workers.sourceTaskMode ? 'ok' : 'fail', workers.sourceTaskMode || 'missing', 'Worker source task mode is configured.')
  ];

  if (isRemoteLlmProvider(llm.provider)) {
    checks.push(check('config.llm.apiKey', llm.apiKeyConfigured ? 'ok' : 'warn', llm.apiKeyConfigured ? 1 : 0, 'Remote LLM provider has an API key configured.'));
    checks.push(check('config.llm.model', llm.model ? 'ok' : 'warn', llm.model || 'missing', 'Remote LLM provider has a model configured.'));
  } else {
    checks.push(check('config.llm.provider', 'ok', llm.provider || 'mock', 'LLM provider is configured.'));
  }

  return checks;
}

function isRemoteLlmProvider(provider) {
  return provider === 'openai-compatible' || provider === 'openai';
}

function check(key, status, value, summary) {
  return {
    key,
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

module.exports = {
  getRuntimeDiagnostics,
  buildRuntimeDiagnosticChecks
};
