'use strict';

function getRolloutManifestPlan(options) {
  const safeOptions = options || {};
  const manifest = safeOptions.manifest || {};
  const validation = validateManifest(manifest);
  const connectorRolloutPlan = safeOptions.connectorRolloutPlan;
  const workerTopologyPlan = safeOptions.workerTopologyPlan;
  const steps = [
    step('manifest.structure', validation.status, validation.summary, {
      errors: validation.errors
    }),
    step(
      'connector.rollout',
      reportStatus(connectorRolloutPlan),
      connectorRolloutPlan ? 'Connector rollout plan was evaluated from the manifest.' : 'Connector rollout plan was not evaluated.',
      connectorRolloutSummary(connectorRolloutPlan)
    ),
    step(
      'workers.topology',
      reportStatus(workerTopologyPlan),
      workerTopologyPlan ? 'Worker topology plan was evaluated from the manifest.' : 'Worker topology plan was not evaluated.',
      workerTopologySummary(workerTopologyPlan)
    )
  ];

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateStatus(steps.map(function (item) { return item.status; })),
    manifestVersion: manifest.version || '1.0',
    name: manifest.name,
    sourceKey: sourceKeyFromManifest(manifest),
    sourceType: manifest.source && manifest.source.sourceType,
    modulePath: manifest.connector && manifest.connector.modulePath,
    steps,
    nextActions: nextActions(steps, {
      connectorRolloutPlan,
      workerTopologyPlan
    }),
    manifest,
    connectorRolloutPlan,
    workerTopologyPlan
  };
}

function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {
      status: 'fail',
      summary: 'Rollout manifest must be a JSON object.',
      errors: ['manifest must be an object']
    };
  }
  if (!manifest.source || typeof manifest.source !== 'object' || Array.isArray(manifest.source)) {
    errors.push('source must be an object');
  } else {
    if (!manifest.source.sourceKey && !manifest.source.forum) {
      errors.push('source.sourceKey or source.forum is required');
    }
    if (!manifest.source.sourceType) {
      errors.push('source.sourceType is required');
    }
  }
  if (manifest.connector !== undefined && (!manifest.connector || typeof manifest.connector !== 'object' || Array.isArray(manifest.connector))) {
    errors.push('connector must be an object when provided');
  }
  if (manifest.ingest !== undefined && (!manifest.ingest || typeof manifest.ingest !== 'object' || Array.isArray(manifest.ingest))) {
    errors.push('ingest must be an object when provided');
  }
  if (manifest.workers !== undefined && (!manifest.workers || typeof manifest.workers !== 'object' || Array.isArray(manifest.workers))) {
    errors.push('workers must be an object when provided');
  }
  if (manifest.deployment !== undefined && (!manifest.deployment || typeof manifest.deployment !== 'object' || Array.isArray(manifest.deployment))) {
    errors.push('deployment must be an object when provided');
  }
  return {
    status: errors.length > 0 ? 'fail' : 'ok',
    summary: errors.length > 0 ? 'Rollout manifest is missing required structure.' : 'Rollout manifest structure is valid.',
    errors
  };
}

function reportStatus(report) {
  if (!report) return 'warn';
  return report.status || 'warn';
}

function connectorRolloutSummary(plan) {
  if (!plan) return {};
  return {
    status: plan.status,
    sourceKey: plan.sourceKey,
    sourceType: plan.sourceType,
    modulePath: plan.modulePath,
    stepCount: (plan.steps || []).length,
    nextActionCount: (plan.nextActions || []).length
  };
}

function workerTopologySummary(plan) {
  if (!plan) return {};
  return {
    status: plan.status,
    topology: plan.topology,
    storageMode: plan.storageMode,
    sourceTaskMode: plan.sourceTaskMode,
    workerCount: (plan.workers || []).length,
    nextActionCount: (plan.nextActions || []).length
  };
}

function nextActions(steps, reports) {
  return steps.filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    return {
      key: item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      command: commandForStep(item.key),
      relatedCommands: relatedCommandsForStep(item.key, reports),
      summary: item.summary
    };
  });
}

function relatedCommandsForStep(key, reports) {
  if (key === 'connector.rollout' && reports.connectorRolloutPlan) {
    return (reports.connectorRolloutPlan.nextActions || []).map(function (action) {
      return action.command;
    }).filter(Boolean);
  }
  if (key === 'workers.topology' && reports.workerTopologyPlan) {
    return (reports.workerTopologyPlan.nextActions || []).map(function (action) {
      return action.command;
    }).filter(Boolean);
  }
  return [];
}

function commandForStep(key) {
  const commands = {
    'manifest.structure': 'node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file <file>',
    'connector.rollout': 'node src/presentation/cli/threadtrace.js connector-rollout-plan --module-path <file> --location-file <file> --dry-run-ingest true',
    'workers.topology': 'node src/presentation/cli/threadtrace.js worker-topology-plan --topology operations-worker'
  };
  return commands[key];
}

function sourceKeyFromManifest(manifest) {
  return manifest.source && (manifest.source.sourceKey || manifest.source.forum);
}

function step(key, status, summary, evidence) {
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
  getRolloutManifestPlan
};
