'use strict';

function getResourceProvisioningPlan(options) {
  const safeOptions = options || {};
  const config = safeOptions.config || {};
  const diagnostics = safeOptions.runtimeDiagnostics || {};
  const checklist = safeOptions.deploymentChecklist || {};
  const manifestPlan = safeOptions.rolloutManifestPlan;
  const manifest = safeOptions.manifest || (manifestPlan && manifestPlan.manifest) || {};
  const resources = [
    storageResource(config, diagnostics),
    sourceInputResource(manifest),
    connectorModuleResource(config, diagnostics, manifestPlan),
    workerResource(config, checklist, manifestPlan),
    reviewActionExecutorResource(config, checklist),
    notificationResource(config, checklist),
    llmResource(config, checklist),
    httpResource(config)
  ];

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateResources(resources),
    environment: {
      storageMode: config.storageMode || 'file',
      sourceTaskMode: config.workers && config.workers.sourceTaskMode,
      notificationChannel: notificationChannel(config),
      reviewActionExecutor: reviewActionExecutor(config),
      llmProvider: config.llm && config.llm.provider,
      manifestName: manifest.name,
      sourceKey: manifest.source && (manifest.source.sourceKey || manifest.source.forum),
      sourceType: manifest.source && manifest.source.sourceType
    },
    resources,
    nextActions: nextActions(resources),
    runtimeDiagnostics: diagnostics,
    deploymentChecklist: checklist,
    rolloutManifestPlan: manifestPlan
  };
}

function storageResource(config, diagnostics) {
  const storageMode = config.storageMode || 'file';
  const checks = diagnostics.checks || [];
  if (storageMode === 'postgres') {
    const status = aggregateStatuses(selectedStatuses(checks, /^resources\.postgres/));
    return resource({
      key: 'storage.postgres',
      area: 'storage',
      required: true,
      status,
      summary: 'Provision PostgreSQL primary storage and apply the ThreadTrace schema.',
      evidence: selectedChecks(checks, /^resources\.postgres/),
      env: ['THREADTRACE_STORAGE=postgres', 'THREADTRACE_DATABASE_URL or DATABASE_URL'],
      commands: ['psql "$env:THREADTRACE_DATABASE_URL" -f docs/postgresql-schema.sql'],
      provisioning: [
        'Create a PostgreSQL database reachable by the API and workers.',
        'Apply docs/postgresql-schema.sql before production traffic.',
        'Use the same database URL for every worker process.'
      ]
    });
  }
  const status = aggregateStatuses(selectedStatuses(checks, /^resources\.storeDir/));
  return resource({
    key: 'storage.file',
    area: 'storage',
    required: true,
    status,
    summary: 'Provision a writable local file store for development or single-node deployments.',
    evidence: selectedChecks(checks, /^resources\.storeDir/),
    env: ['THREADTRACE_STORAGE=file', 'THREADTRACE_STORE_DIR'],
    commands: ['node src/presentation/cli/threadtrace.js runtime-diagnostics'],
    provisioning: [
      'Use a durable disk path for THREADTRACE_STORE_DIR.',
      'Prefer PostgreSQL before scaling across multiple hosts.'
    ]
  });
}

function sourceInputResource(manifest) {
  if (!manifest.source) {
    return resource({
      key: 'source.input',
      area: 'sources',
      required: false,
      status: 'warn',
      summary: 'No rollout manifest source was supplied, so source-specific input resources were not planned.',
      evidence: {},
      env: [],
      commands: ['node src/presentation/cli/threadtrace.js resource-provisioning-plan --manifest-file <file>'],
      provisioning: ['Provide a rollout manifest when planning a specific source onboarding.']
    });
  }
  const source = manifest.source || {};
  const sourceType = source.sourceType;
  if (!sourceType) {
    return resource({
      key: 'source.input',
      area: 'sources',
      required: true,
      status: 'fail',
      summary: 'Source input cannot be planned until source.sourceType is provided.',
      evidence: {},
      env: [],
      commands: ['node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file <file>'],
      provisioning: ['Add source.sourceType and source.sourceKey to the rollout manifest.']
    });
  }
  if (sourceType === 'saved-html-directory') {
    return resource({
      key: 'source.inputDirectory',
      area: 'sources',
      required: true,
      status: source.inputDir || (source.location && source.location.inputDir) ? 'ok' : 'fail',
      summary: 'Provision a readable saved-HTML directory for the source.',
      evidence: { inputDir: source.inputDir || (source.location && source.location.inputDir) },
      env: [],
      commands: ['node src/presentation/cli/threadtrace.js source-onboarding-preflight --source-type saved-html-directory --input <dir>'],
      provisioning: ['Place archived forum HTML pages on local disk or mount a shared read-only path.']
    });
  }
  if (sourceType === 'normalized-thread-json') {
    return resource({
      key: 'source.threadJson',
      area: 'sources',
      required: true,
      status: source.inputFile || (source.location && source.location.inputFile) ? 'ok' : 'fail',
      summary: 'Provision a normalized ThreadSnapshot JSON file for dry-run and replay.',
      evidence: { inputFile: source.inputFile || (source.location && source.location.inputFile) },
      env: [],
      commands: ['node src/presentation/cli/threadtrace.js validate-thread-json --input-file <file>'],
      provisioning: ['Generate or export JSON that satisfies the ThreadSnapshot JSON contract.']
    });
  }
  return resource({
    key: 'source.externalLocation',
    area: 'sources',
    required: true,
    status: source.url || source.location ? 'ok' : 'warn',
    summary: 'Provision source-specific location settings for the connector handler.',
    evidence: { hasUrl: Boolean(source.url), hasLocation: Boolean(source.location) },
    env: [],
    commands: ['node src/presentation/cli/threadtrace.js source-onboarding-preflight --location-file <file>'],
    provisioning: ['Provide the location object required by the selected source ingest handler.']
  });
}

function connectorModuleResource(config, diagnostics, manifestPlan) {
  const connectors = config.connectors || {};
  const configuredModules = connectors.modules || [];
  const manifestModulePath = manifestPlan && manifestPlan.modulePath;
  const diagnosticsConnectors = diagnostics.configuration && diagnostics.configuration.connectors;
  const errorCount = diagnosticsConnectors ? diagnosticsConnectors.errorCount || 0 : 0;
  const hasModule = configuredModules.length > 0 || Boolean(manifestModulePath);
  return resource({
    key: 'connectors.modules',
    area: 'connectors',
    required: Boolean(manifestModulePath),
    status: errorCount > 0 ? 'fail' : (hasModule ? 'ok' : 'warn'),
    summary: hasModule ? 'External connector modules are configured or simulated by the manifest.' : 'No external connector modules are configured.',
    evidence: {
      configuredModules,
      manifestModulePath,
      errorCount
    },
    env: ['THREADTRACE_CONNECTOR_MODULES'],
    commands: ['node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'],
    provisioning: [
      'Package custom forum adapters or source ingest handlers as connector modules.',
      'Set THREADTRACE_CONNECTOR_MODULES with path-delimited module files in production.'
    ]
  });
}

function workerResource(config, checklist, manifestPlan) {
  const workers = config.workers || {};
  const topologyPlan = manifestPlan && manifestPlan.workerTopologyPlan;
  const checklistItem = findChecklistItem(checklist, 'workers.readiness');
  return resource({
    key: 'workers.runtime',
    area: 'workers',
    required: true,
    status: topologyPlan ? topologyPlan.status : (checklistItem ? checklistItem.status : 'warn'),
    summary: 'Provision background workers, leases, and intervals for scheduled source work.',
    evidence: {
      topology: topologyPlan && topologyPlan.topology,
      workers: topologyPlan && topologyPlan.workers,
      checklist: checklistItem && checklistItem.status
    },
    env: ['THREADTRACE_SOURCE_TASK_MODE', 'THREADTRACE_WORKER_LEASE_TTL_MS', 'THREADTRACE_WORKER_INTERVAL_MS'],
    commands: topologyPlan && Array.isArray(topologyPlan.workers)
      ? topologyPlan.workers.map(function (worker) { return worker.command; })
      : ['node src/presentation/cli/threadtrace.js worker-topology-plan'],
    provisioning: [
      'Run exactly one active lease holder per worker type.',
      'Use PostgreSQL storage for split workers across hosts.',
      'Set source task mode to ' + (workers.sourceTaskMode || 'ingest') + ' unless the rollout requires full insight pipelines.'
    ]
  });
}

function reviewActionExecutorResource(config, checklist) {
  const executor = reviewActionExecutor(config);
  const checklistItem = findChecklistItem(checklist, 'reviewActions.executor');
  const status = checklistItem ? checklistItem.status : (executor === 'none' ? 'warn' : 'ok');
  const dryRunOnly = checklistItem && checklistItem.evidence
    ? checklistItem.evidence.dryRunOnly
    : executor === 'none';
  return resource({
    key: 'reviewActions.executor',
    area: 'review-actions',
    required: false,
    status,
    summary: dryRunOnly
      ? 'Review action execution is dry-run-only unless an executor is injected at runtime.'
      : 'Review action execution has a configured executor adapter.',
    evidence: {
      executor,
      checklist: checklistItem && checklistItem.status,
      diagnostics: checklistItem && checklistItem.evidence
    },
    env: ['THREADTRACE_REVIEW_ACTION_EXECUTOR'],
    commands: [
      'node src/presentation/cli/threadtrace.js review-action-executor-diagnostics',
      'node src/presentation/cli/threadtrace.js review-action-apply --execute true'
    ],
    provisioning: executor === 'file-audit'
      ? ['File audit executor writes closure and merge requests under THREADTRACE_STORE_DIR/review-action-audits without changing source truth.']
      : [
          'Use THREADTRACE_REVIEW_ACTION_EXECUTOR=file-audit for local execution rehearsals.',
          'Inject a real ContextReviewActionExecutor before mutating task trackers or context stores.'
        ]
  });
}

function notificationResource(config, checklist) {
  const notifications = config.notifications || {};
  const checklistItem = findChecklistItem(checklist, 'notifications.channel');
  const channel = notificationChannel(config);
  return resource({
    key: 'notifications.channel',
    area: 'notifications',
    required: false,
    status: checklistItem ? checklistItem.status : 'warn',
    summary: 'Provision notification delivery for source-change and operational events.',
    evidence: {
      channel,
      webhookConfigured: Boolean(notifications.webhookUrl),
      checklist: checklistItem && checklistItem.status
    },
    env: channel === 'webhook' ? ['THREADTRACE_WEBHOOK_URL'] : ['THREADTRACE_STORE_DIR'],
    commands: ['node src/presentation/cli/threadtrace.js notification-diagnostics --channel ' + channel],
    provisioning: channel === 'webhook'
      ? ['Create an HTTPS webhook endpoint and configure THREADTRACE_WEBHOOK_URL.']
      : ['Use file notification delivery locally; switch to webhook for external alerting.']
  });
}

function llmResource(config, checklist) {
  const llm = config.llm || {};
  const checklistItem = findChecklistItem(checklist, 'llm.configuration');
  const remote = llm.provider === 'openai-compatible' || llm.provider === 'openai';
  return resource({
    key: 'llm.provider',
    area: 'llm',
    required: remote,
    status: checklistItem ? checklistItem.status : (remote ? 'warn' : 'ok'),
    summary: 'Provision the LLM provider used for semantic enrichment and context restoration.',
    evidence: {
      provider: llm.provider || 'mock',
      baseUrlConfigured: Boolean(llm.baseUrl),
      modelConfigured: Boolean(llm.model),
      apiKeyConfigured: Boolean(llm.apiKeyConfigured)
    },
    env: remote
      ? ['THREADTRACE_LLM_PROVIDER', 'THREADTRACE_LLM_BASE_URL', 'THREADTRACE_LLM_MODEL', 'THREADTRACE_LLM_API_KEY']
      : ['THREADTRACE_LLM_PROVIDER=mock'],
    commands: ['node src/presentation/cli/threadtrace.js runtime-diagnostics'],
    provisioning: remote
      ? ['Prepare model endpoint, model name, API key, and timeout policy.']
      : ['Mock LLM is suitable for local development; remote provider is needed for production semantic quality.']
  });
}

function httpResource(config) {
  const http = config.http || {};
  return resource({
    key: 'http.service',
    area: 'runtime',
    required: true,
    status: http.host && http.port ? 'ok' : 'warn',
    summary: 'Provision the HTTP API service entrypoint.',
    evidence: {
      host: http.host,
      port: http.port
    },
    env: ['THREADTRACE_HTTP_HOST', 'THREADTRACE_HTTP_PORT'],
    commands: ['npm run serve'],
    provisioning: ['Expose the API behind a process manager or reverse proxy when leaving local development.']
  });
}

function resource(input) {
  return {
    key: input.key,
    area: input.area,
    required: input.required,
    status: input.status || 'warn',
    summary: input.summary,
    evidence: input.evidence || {},
    env: input.env || [],
    commands: input.commands || [],
    provisioning: input.provisioning || []
  };
}

function nextActions(resources) {
  return resources.filter(function (item) {
    return item.required && item.status !== 'ok';
  }).map(function (item) {
    return {
      key: item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      summary: item.summary,
      env: item.env,
      commands: item.commands
    };
  });
}

function aggregateResources(resources) {
  const requiredStatuses = resources.filter(function (item) {
    return item.required;
  }).map(function (item) {
    return item.status;
  });
  return aggregateStatuses(requiredStatuses);
}

function selectedChecks(checks, pattern) {
  return (checks || []).filter(function (check) {
    return pattern.test(check.key);
  }).map(function (check) {
    return {
      key: check.key,
      status: check.status,
      value: check.value,
      summary: check.summary
    };
  });
}

function selectedStatuses(checks, pattern) {
  return selectedChecks(checks, pattern).map(function (check) {
    return check.status;
  });
}

function aggregateStatuses(statuses) {
  if (!statuses || statuses.length === 0) return 'warn';
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

function findChecklistItem(checklist, key) {
  return ((checklist && checklist.items) || []).find(function (item) {
    return item.key === key;
  });
}

function notificationChannel(config) {
  return config && config.notifications && config.notifications.webhookUrl ? 'webhook' : 'file';
}

function reviewActionExecutor(config) {
  return (config && config.reviewActions && config.reviewActions.executor) || 'none';
}

module.exports = {
  getResourceProvisioningPlan
};
