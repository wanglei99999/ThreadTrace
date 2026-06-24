'use strict';

function getDeploymentGateReport(options) {
  const safeOptions = options || {};
  const rolloutManifestPlan = safeOptions.rolloutManifestPlan;
  const resourceProvisioningPlan = safeOptions.resourceProvisioningPlan;
  const deploymentChecklist = safeOptions.deploymentChecklist;
  const operationsRunbook = safeOptions.operationsRunbook;
  const gates = [
    gate('rollout.manifest', 'rollout', reportStatus(rolloutManifestPlan), 'Rollout manifest, connector checks, ingest dry-run, and worker topology are ready.', rolloutEvidence(rolloutManifestPlan), [
      'node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file <file>'
    ]),
    gate('resources.provisioning', 'resources', reportStatus(resourceProvisioningPlan), 'Required storage, workers, source inputs, and runtime resources are provisioned.', resourceEvidence(resourceProvisioningPlan), [
      'node src/presentation/cli/threadtrace.js resource-provisioning-plan --manifest-file <file>'
    ]),
    gate('deployment.checklist', 'deployment', reportStatus(deploymentChecklist), 'Deployment checklist has no failing production readiness items.', checklistEvidence(deploymentChecklist), [
      'node src/presentation/cli/threadtrace.js deployment-checklist'
    ]),
    gate('operations.runbook', 'operations', reportStatus(operationsRunbook), 'Operations runbook has no critical follow-up actions.', runbookEvidence(operationsRunbook), [
      'node src/presentation/cli/threadtrace.js operations-runbook'
    ])
  ];

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateStatus(gates.map(function (item) { return item.status; })),
    gateCount: gates.length,
    gates,
    nextActions: nextActions(gates, {
      rolloutManifestPlan,
      resourceProvisioningPlan,
      operationsRunbook
    }),
    rolloutManifestPlan,
    resourceProvisioningPlan,
    deploymentChecklist,
    operationsRunbook
  };
}

function reportStatus(report) {
  if (!report) return 'warn';
  return report.status || 'warn';
}

function rolloutEvidence(plan) {
  if (!plan) return {};
  return {
    sourceKey: plan.sourceKey,
    sourceType: plan.sourceType,
    manifestVersion: plan.manifestVersion,
    stepCount: (plan.steps || []).length,
    nextActionCount: (plan.nextActions || []).length
  };
}

function resourceEvidence(plan) {
  if (!plan) return {};
  const resources = plan.resources || [];
  const actions = plan.nextActions || [];
  return {
    storageMode: plan.environment && plan.environment.storageMode,
    sourceTaskMode: plan.environment && plan.environment.sourceTaskMode,
    resourceCount: resources.length,
    nextActionCount: actions.length,
    failingResources: resources.filter(function (item) {
      return item.status === 'fail';
    }).map(compactResource),
    warningResources: resources.filter(function (item) {
      return item.status === 'warn';
    }).map(compactResource),
    actionDetails: actions.map(compactAction)
  };
}

function compactResource(resource) {
  return {
    key: resource.key,
    area: resource.area,
    required: resource.required,
    status: resource.status,
    summary: resource.summary,
    evidenceSummary: resource.evidenceSummary
  };
}

function checklistEvidence(checklist) {
  if (!checklist) return {};
  return {
    itemCount: (checklist.items || []).length,
    failingItems: (checklist.items || []).filter(function (item) {
      return item.status === 'fail';
    }).map(function (item) {
      return item.key;
    }),
    warningItems: (checklist.items || []).filter(function (item) {
      return item.status === 'warn';
    }).map(function (item) {
      return item.key;
    })
  };
}

function runbookEvidence(runbook) {
  if (!runbook) return {};
  return {
    actionCount: runbook.actionCount || 0,
    criticalActions: (runbook.actions || []).filter(function (action) {
      return action.severity === 'critical';
    }).map(function (action) {
      return action.key;
    }),
    warningActions: (runbook.actions || []).filter(function (action) {
      return action.severity === 'warning';
    }).map(function (action) {
      return action.key;
    })
  };
}

function nextActions(gates, reports) {
  return gates.filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    return {
      key: item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      summary: item.summary,
      commands: commandsForGate(item, reports),
      details: detailsForGate(item, reports)
    };
  });
}

function detailsForGate(item, reports) {
  if (item.key === 'rollout.manifest' && reports.rolloutManifestPlan) {
    return (reports.rolloutManifestPlan.nextActions || []).map(compactAction);
  }
  if (item.key === 'resources.provisioning' && reports.resourceProvisioningPlan) {
    return (reports.resourceProvisioningPlan.nextActions || []).map(compactAction);
  }
  if (item.key === 'operations.runbook' && reports.operationsRunbook) {
    return (reports.operationsRunbook.actions || []).map(function (action) {
      return {
        key: action.key,
        severity: action.severity,
        summary: action.title || action.summary,
        command: action.recommendedCommand,
        evidence: action.evidence || {}
      };
    });
  }
  return [];
}

function compactAction(action) {
  return {
    key: action.key,
    severity: action.severity,
    summary: action.summary,
    commands: action.commands || (action.command ? [action.command] : []),
    evidence: action.evidence || {},
    evidenceSummary: action.evidenceSummary
  };
}

function commandsForGate(item, reports) {
  if (item.key === 'rollout.manifest' && reports.rolloutManifestPlan) {
    return commandsFromActions(reports.rolloutManifestPlan.nextActions).concat(item.commands);
  }
  if (item.key === 'resources.provisioning' && reports.resourceProvisioningPlan) {
    return commandsFromActions(reports.resourceProvisioningPlan.nextActions).concat(item.commands);
  }
  if (item.key === 'operations.runbook' && reports.operationsRunbook) {
    return (reports.operationsRunbook.actions || []).map(function (action) {
      return action.recommendedCommand;
    }).filter(Boolean).concat(item.commands);
  }
  return item.commands;
}

function commandsFromActions(actions) {
  return (actions || []).flatMap(function (action) {
    return action.commands || (action.command ? [action.command] : []);
  }).filter(Boolean);
}

function gate(key, area, status, summary, evidence, commands) {
  return {
    key,
    area,
    status,
    summary,
    evidence: evidence || {},
    commands: commands || []
  };
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getDeploymentGateReport
};
