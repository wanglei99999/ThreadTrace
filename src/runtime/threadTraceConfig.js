'use strict';

const path = require('path');

const SOURCE_TASK_MODES = {
  INGEST: 'ingest',
  INSIGHT_PIPELINE: 'insight-pipeline'
};

const STORAGE_MODES = {
  FILE: 'file',
  POSTGRES: 'postgres'
};

function createThreadTraceConfig(options) {
  const safeOptions = options || {};
  const env = safeOptions.env || process.env;
  const cwd = safeOptions.cwd || process.cwd();
  const storageMode = normalizeStorageMode(firstValue(
    safeOptions.storageMode,
    env.THREADTRACE_STORAGE,
    STORAGE_MODES.FILE
  ));
  const sourceTaskMode = normalizeSourceTaskMode(firstValue(
    safeOptions.sourceTaskMode,
    env.THREADTRACE_SOURCE_TASK_MODE,
    SOURCE_TASK_MODES.INGEST
  ));

  return {
    defaultForum: firstValue(safeOptions.defaultForum, env.THREADTRACE_DEFAULT_FORUM, 'nga'),
    defaultInputDir: resolvePath(cwd, firstValue(
      safeOptions.defaultInputDir,
      env.THREADTRACE_EXAMPLE_DIR,
      path.join(cwd, 'example')
    )),
    storeDir: resolvePath(cwd, firstValue(
      safeOptions.storeDir,
      env.THREADTRACE_STORE_DIR,
      path.join(cwd, 'data', 'store')
    )),
    storageMode,
    http: {
      port: numberWithDefault(firstValue(safeOptions.httpPort, safeOptions.port, env.THREADTRACE_HTTP_PORT, env.PORT), 3017),
      host: firstValue(safeOptions.httpHost, env.THREADTRACE_HTTP_HOST, '127.0.0.1')
    },
    llm: {
      provider: firstValue(safeOptions.llmProvider, env.THREADTRACE_LLM_PROVIDER, 'mock'),
      baseUrl: firstValue(safeOptions.llmBaseUrl, env.THREADTRACE_LLM_BASE_URL, undefined),
      model: firstValue(safeOptions.llmModel, env.THREADTRACE_LLM_MODEL, undefined),
      apiKeyConfigured: Boolean(firstValue(safeOptions.llmApiKey, env.THREADTRACE_LLM_API_KEY, env.OPENAI_API_KEY, undefined)),
      timeoutMs: numberOrUndefined(firstValue(safeOptions.llmTimeoutMs, env.THREADTRACE_LLM_TIMEOUT_MS, undefined))
    },
    workers: {
      sourceTaskMode,
      sourceRunStaleAfterMs: numberWithDefault(firstValue(safeOptions.sourceRunStaleAfterMs, env.THREADTRACE_SOURCE_RUN_STALE_AFTER_MS), 10 * 60 * 1000),
      leaseTtlMs: numberWithDefault(firstValue(safeOptions.workerLeaseTtlMs, env.THREADTRACE_WORKER_LEASE_TTL_MS), 5 * 60 * 1000),
      dueSourceIntervalMs: numberWithDefault(firstValue(safeOptions.workerIntervalMs, env.THREADTRACE_WORKER_INTERVAL_MS), 5 * 60 * 1000),
      operationsIntervalMs: numberWithDefault(firstValue(safeOptions.operationsWorkerIntervalMs, env.THREADTRACE_OPERATIONS_WORKER_INTERVAL_MS), 60 * 1000),
      eventIntervalMs: numberWithDefault(firstValue(safeOptions.eventWorkerIntervalMs, env.THREADTRACE_EVENT_WORKER_INTERVAL_MS), 60 * 1000)
    },
    notifications: {
      webhookUrl: firstValue(safeOptions.webhookUrl, env.THREADTRACE_WEBHOOK_URL, undefined)
    },
    connectors: {
      modules: connectorModules(cwd, firstValue(safeOptions.connectorModules, env.THREADTRACE_CONNECTOR_MODULES, undefined))
    }
  };
}

function normalizeStorageMode(value) {
  const normalized = String(value || STORAGE_MODES.FILE).trim().toLowerCase();
  if (normalized === STORAGE_MODES.FILE || normalized === STORAGE_MODES.POSTGRES) return normalized;
  throw new Error('Unknown ThreadTrace storage mode: ' + value);
}

function normalizeSourceTaskMode(value) {
  const normalized = String(value || SOURCE_TASK_MODES.INGEST).trim().toLowerCase();
  if (normalized === SOURCE_TASK_MODES.INGEST || normalized === SOURCE_TASK_MODES.INSIGHT_PIPELINE) return normalized;
  throw new Error('Unknown ThreadTrace source task mode: ' + value);
}

function firstValue() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function resolvePath(cwd, value) {
  if (!value) return value;
  return path.resolve(cwd, String(value));
}

function connectorModules(cwd, value) {
  if (!value) return [];
  const items = Array.isArray(value)
    ? value
    : String(value).split(path.delimiter);
  return items
    .map(function (item) { return String(item || '').trim(); })
    .filter(Boolean)
    .map(function (item) { return resolvePath(cwd, item); });
}

function numberWithDefault(value, defaultValue) {
  const parsed = numberOrUndefined(value);
  return parsed === undefined ? defaultValue : parsed;
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Expected numeric ThreadTrace config value, got: ' + value);
  }
  return parsed;
}

module.exports = {
  SOURCE_TASK_MODES,
  STORAGE_MODES,
  createThreadTraceConfig,
  connectorModules,
  normalizeSourceTaskMode,
  normalizeStorageMode
};
