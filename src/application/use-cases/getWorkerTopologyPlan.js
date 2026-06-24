'use strict';

const { buildWorkerLeaseKey } = require('../../domain/models/workerLeaseKey');

function getWorkerTopologyPlan(options) {
  const safeOptions = options || {};
  const config = safeOptions.config || {};
  const workersConfig = config.workers || {};
  const storageMode = safeOptions.storageMode || config.storageMode || 'file';
  const sourceTaskMode = safeOptions.sourceTaskMode || workersConfig.sourceTaskMode || 'ingest';
  const sourceScope = normalizeSourceScope(safeOptions);
  const topology = normalizeTopology(safeOptions.topology || safeOptions.deploymentTopology || defaultTopology(storageMode));
  const checks = [
    storageModeCheck(storageMode, topology),
    sourceTaskModeCheck(sourceTaskMode),
    leaseTtlCheck(workersConfig.leaseTtlMs),
    topologyCheck(storageMode, topology),
    deploymentChecklistCheck(safeOptions.deploymentChecklist),
    workerHealthCheck(safeOptions.operationalOverview)
  ];
  const workers = topology === 'split-workers'
    ? splitWorkerPlan(workersConfig, sourceTaskMode, sourceScope)
    : operationsWorkerPlan(workersConfig, sourceTaskMode, sourceScope);

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateStatus(checks.map(function (check) { return check.status; })),
    topology,
    storageMode,
    sourceTaskMode,
    sourceId: sourceScope.sourceId,
    sourceKey: sourceScope.sourceKey,
    scope: sourceScope,
    workers,
    checks,
    nextActions: nextActions(checks),
    runtime: {
      leaseTtlMs: workersConfig.leaseTtlMs,
      sourceRunStaleAfterMs: workersConfig.sourceRunStaleAfterMs,
      dueSourceIntervalMs: workersConfig.dueSourceIntervalMs,
      eventIntervalMs: workersConfig.eventIntervalMs,
      operationsIntervalMs: workersConfig.operationsIntervalMs
    }
  };
}

function defaultTopology(storageMode) {
  return storageMode === 'postgres' ? 'split-workers' : 'operations-worker';
}

function normalizeTopology(value) {
  const normalized = String(value || 'operations-worker').trim().toLowerCase();
  if (normalized === 'single' || normalized === 'single-process' || normalized === 'operations') return 'operations-worker';
  if (normalized === 'split' || normalized === 'separate' || normalized === 'separate-workers') return 'split-workers';
  if (normalized === 'operations-worker' || normalized === 'split-workers') return normalized;
  return normalized;
}

function operationsWorkerPlan(workersConfig, sourceTaskMode, sourceScope) {
  return [
    {
      key: 'worker.operations',
      workerType: 'operations',
      role: 'Runs due source work, notification dispatch, and operational overview in one non-overlapping loop.',
      required: true,
      scale: 'single-active',
      leaseKey: buildWorkerLeaseKey('operations', sourceScope),
      intervalMs: workersConfig.operationsIntervalMs,
      scope: sourceScope,
      command: buildCommand('node src/presentation/worker/operationsWorkerMain.js', [
        '--loop',
        '--source-task-mode',
        sourceTaskMode
      ], sourceScope)
    }
  ];
}

function splitWorkerPlan(workersConfig, sourceTaskMode, sourceScope) {
  return [
    {
      key: 'worker.dueSource',
      workerType: 'due-source',
      role: 'Runs due tracked source ingest or insight pipeline work.',
      required: true,
      scale: 'single-active-per-lease',
      leaseKey: buildWorkerLeaseKey('due-source', sourceScope),
      intervalMs: workersConfig.dueSourceIntervalMs,
      scope: sourceScope,
      command: buildCommand('node src/presentation/worker/dueSourceWorkerMain.js', [
        '--loop',
        '--source-task-mode',
        sourceTaskMode
      ], sourceScope)
    },
    {
      key: 'worker.notificationEvent',
      workerType: 'notification-event',
      role: 'Dispatches pending notification events.',
      required: true,
      scale: 'single-active-per-lease',
      leaseKey: buildWorkerLeaseKey('notification-event', sourceScope),
      intervalMs: workersConfig.eventIntervalMs,
      scope: sourceScope,
      command: buildCommand('node src/presentation/worker/notificationEventWorkerMain.js', [
        '--loop'
      ], sourceScope)
    }
  ];
}

function normalizeSourceScope(options) {
  const sourceId = normalizeOptionalText(options.sourceId);
  const sourceKey = normalizeOptionalText(options.sourceKey || options.forum);
  const scope = {};
  if (sourceId) scope.sourceId = sourceId;
  if (sourceKey) scope.sourceKey = sourceKey;
  return scope;
}

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function buildCommand(executable, args, sourceScope) {
  const commandArgs = args.slice();
  if (sourceScope && sourceScope.sourceKey) {
    commandArgs.push('--source-key', sourceScope.sourceKey);
  }
  if (sourceScope && sourceScope.sourceId) {
    commandArgs.push('--source-id', sourceScope.sourceId);
  }
  return [executable].concat(commandArgs.map(quoteCommandValue)).join(' ');
}

function quoteCommandValue(value) {
  const text = String(value);
  if (/^[A-Za-z0-9._/:=-]+$/.test(text)) return text;
  return '"' + text.replace(/"/g, '\\"') + '"';
}

function storageModeCheck(storageMode, topology) {
  if (storageMode === 'postgres') {
    return check('workers.storageMode', 'ok', 'PostgreSQL storage can coordinate workers across processes and hosts.', {
      storageMode,
      topology
    });
  }
  if (storageMode === 'file') {
    return check('workers.storageMode', topology === 'split-workers' ? 'warn' : 'ok', 'File storage is best suited to local or single-node workers.', {
      storageMode,
      topology
    });
  }
  return check('workers.storageMode', 'fail', 'Worker topology cannot verify the configured storage mode.', {
    storageMode,
    topology
  });
}

function sourceTaskModeCheck(sourceTaskMode) {
  if (sourceTaskMode === 'ingest' || sourceTaskMode === 'insight-pipeline') {
    return check('workers.sourceTaskMode', 'ok', 'Source worker task mode is supported.', {
      sourceTaskMode
    });
  }
  return check('workers.sourceTaskMode', 'fail', 'Source worker task mode is not supported.', {
    sourceTaskMode
  });
}

function leaseTtlCheck(leaseTtlMs) {
  if (!leaseTtlMs || leaseTtlMs < 30000) {
    return check('workers.leaseTtl', 'warn', 'Worker lease TTL is short; use a production TTL long enough for transient pauses.', {
      leaseTtlMs
    });
  }
  return check('workers.leaseTtl', 'ok', 'Worker lease TTL is configured.', {
    leaseTtlMs
  });
}

function topologyCheck(storageMode, topology) {
  if (topology === 'operations-worker') {
    return check('workers.topology', 'ok', 'Combined operations worker is suitable for local and simple deployments.', {
      topology
    });
  }
  if (topology === 'split-workers') {
    return check('workers.topology', storageMode === 'postgres' ? 'ok' : 'warn', 'Split workers separate source ingest from notification dispatch.', {
      topology,
      storageMode
    });
  }
  return check('workers.topology', 'fail', 'Unknown worker topology requested.', {
    topology
  });
}

function deploymentChecklistCheck(deploymentChecklist) {
  if (!deploymentChecklist) {
    return check('deployment.checklist', 'warn', 'Deployment checklist was not supplied to the worker topology plan.', {});
  }
  return check('deployment.checklist', deploymentChecklist.status || 'warn', 'Deployment checklist is available for worker rollout gating.', {
    status: deploymentChecklist.status,
    itemCount: Array.isArray(deploymentChecklist.items) ? deploymentChecklist.items.length : undefined
  });
}

function workerHealthCheck(overview) {
  if (!overview || !overview.workers) {
    return check('workers.currentHealth', 'warn', 'Operational worker health was not supplied to the topology plan.', {});
  }
  if (overview.workers.failed > 0 || overview.workers.stale > 0) {
    return check('workers.currentHealth', 'fail', 'Current worker history has failed or stale runs.', {
      failed: overview.workers.failed,
      stale: overview.workers.stale
    });
  }
  return check('workers.currentHealth', 'ok', 'Current worker history has no failed or stale runs.', {
    running: overview.workers.running,
    failed: overview.workers.failed,
    stale: overview.workers.stale
  });
}

function nextActions(checks) {
  return checks.filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    return {
      key: item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      command: commandForCheck(item.key),
      summary: item.summary
    };
  });
}

function commandForCheck(key) {
  const commands = {
    'workers.storageMode': 'node src/presentation/cli/threadtrace.js runtime-diagnostics',
    'workers.sourceTaskMode': 'node src/presentation/cli/threadtrace.js worker-topology-plan --source-task-mode ingest',
    'workers.leaseTtl': 'node src/presentation/cli/threadtrace.js worker-topology-plan --lease-ttl-ms 300000',
    'workers.topology': 'node src/presentation/cli/threadtrace.js worker-topology-plan --topology operations-worker',
    'deployment.checklist': 'node src/presentation/cli/threadtrace.js deployment-checklist',
    'workers.currentHealth': 'node src/presentation/cli/threadtrace.js operations-overview'
  };
  return commands[key];
}

function check(key, status, summary, evidence) {
  return {
    key,
    status,
    summary,
    evidence: evidence || {}
  };
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getWorkerTopologyPlan
};
