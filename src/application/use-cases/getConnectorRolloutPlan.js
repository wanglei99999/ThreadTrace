'use strict';

function getConnectorRolloutPlan(options) {
  const safeOptions = options || {};
  const generatedAt = safeOptions.now || new Date().toISOString();
  const moduleValidation = safeOptions.connectorModuleValidation;
  const onboarding = safeOptions.sourceOnboardingPreflight;
  const dryRun = safeOptions.sourceIngestDryRun;
  const readiness = safeOptions.connectorReadiness || {};
  const checklist = safeOptions.deploymentChecklist || {};
  const sourceKey = safeOptions.sourceKey || safeOptions.forum || (onboarding && onboarding.sourceKey);
  const sourceType = safeOptions.sourceType || (onboarding && onboarding.sourceType);
  const modulePath = safeOptions.modulePath || (moduleValidation && moduleValidation.modulePath);
  const steps = [
    step('contract.connectorModule', contractStatus(safeOptions.connectorModuleContract), 'Connector module contract is available.', {
      version: safeOptions.connectorModuleContract && safeOptions.connectorModuleContract.version
    }),
    step('connectorModule.validation', optionalReportStatus(moduleValidation), moduleValidation ? 'Connector module file validates.' : 'Connector module validation is not requested.', moduleValidationSummary(moduleValidation)),
    step('source.onboardingPreflight', optionalReportStatus(onboarding), onboarding ? 'Source onboarding preflight validates the source draft.' : 'Source onboarding preflight is not requested.', onboardingSummary(onboarding)),
    step('source.ingestDryRun', optionalReportStatus(dryRun), dryRun ? 'Source ingest dry-run executes the handler with isolated repositories.' : 'Source ingest dry-run is not requested.', dryRunSummary(dryRun)),
    step('connectors.readiness', readiness.status || 'warn', 'Current connector readiness is visible.', {
      connectorCount: readiness.connectorCount,
      sourceCount: readiness.sourceCount,
      moduleErrorCount: readiness.modules ? readiness.modules.errorCount || 0 : undefined
    }),
    step('deployment.checklist', checklist.status || 'warn', 'Current deployment checklist is visible.', {
      status: checklist.status,
      itemCount: Array.isArray(checklist.items) ? checklist.items.length : undefined
    })
  ];

  return {
    generatedAt,
    status: aggregateStatus(steps.map(function (item) { return item.status; })),
    sourceKey,
    sourceType,
    modulePath,
    steps,
    nextActions: nextActions(steps, {
      sourceOnboardingPreflight: onboarding,
      sourceIngestDryRun: dryRun,
      connectorModuleValidation: moduleValidation
    }),
    connectorModuleValidation: moduleValidation,
    sourceOnboardingPreflight: onboarding,
    sourceIngestDryRun: dryRun,
    connectorReadiness: readiness,
    deploymentChecklist: checklist
  };
}

function contractStatus(contract) {
  return contract && contract.version ? 'ok' : 'fail';
}

function optionalReportStatus(report) {
  if (!report) return 'warn';
  return report.status || (report.valid ? 'ok' : 'fail');
}

function moduleValidationSummary(report) {
  if (!report) return {};
  return {
    valid: report.valid,
    modulePath: report.modulePath,
    errorCount: (report.errors || []).length,
    modules: (report.modules || []).map(function (item) {
      return {
        modulePath: item.modulePath,
        forumAdapters: item.forumAdapters || [],
        sourceIngestHandlers: item.sourceIngestHandlers || []
      };
    })
  };
}

function onboardingSummary(report) {
  if (!report) return {};
  return {
    status: report.status,
    sourceKey: report.sourceKey,
    sourceType: report.sourceType,
    stepCount: (report.steps || []).length
  };
}

function dryRunSummary(report) {
  if (!report) return {};
  return {
    status: report.status,
    dryRun: report.dryRun,
    thread: report.thread,
    repositoryWrites: report.repositoryWrites,
    error: report.error
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
      commands: [commandForStep(item.key)].filter(Boolean),
      summary: item.summary,
      evidence: item.evidence || {},
      evidenceSummary: evidenceSummary(item.evidence),
      details: detailsForStep(item.key, reports)
    };
  });
}

function detailsForStep(key, reports) {
  const safeReports = reports || {};
  if (key === 'source.onboardingPreflight' && safeReports.sourceOnboardingPreflight) {
    return (safeReports.sourceOnboardingPreflight.nextActions || []).map(compactAction);
  }
  if (key === 'source.ingestDryRun' && safeReports.sourceIngestDryRun) {
    return (safeReports.sourceIngestDryRun.nextActions || []).map(compactAction);
  }
  if (key === 'connectorModule.validation' && safeReports.connectorModuleValidation) {
    return (safeReports.connectorModuleValidation.checks || []).filter(function (check) {
      return check.status !== 'ok';
    }).map(function (check) {
      return {
        key: check.key,
        severity: check.status === 'fail' ? 'critical' : 'warning',
        summary: check.summary,
        evidence: {
          value: check.value
        }
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
    evidenceSummary: action.evidenceSummary,
    details: (action.details || []).map(compactAction)
  };
}

function evidenceSummary(evidence) {
  const safeEvidence = evidence || {};
  const parts = [];
  if (safeEvidence.status) parts.push('status=' + safeEvidence.status);
  if (safeEvidence.sourceType) parts.push('sourceType=' + safeEvidence.sourceType);
  if (safeEvidence.sourceKey) parts.push('sourceKey=' + safeEvidence.sourceKey);
  if (safeEvidence.stepCount !== undefined) parts.push('stepCount=' + safeEvidence.stepCount);
  if (safeEvidence.errorCount !== undefined) parts.push('errorCount=' + safeEvidence.errorCount);
  if (safeEvidence.moduleErrorCount !== undefined) parts.push('moduleErrorCount=' + safeEvidence.moduleErrorCount);
  if (safeEvidence.itemCount !== undefined) parts.push('itemCount=' + safeEvidence.itemCount);
  return parts.join(' ');
}

function commandForStep(key) {
  const commands = {
    'contract.connectorModule': 'node src/presentation/cli/threadtrace.js connector-module-contract',
    'connectorModule.validation': 'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>',
    'source.onboardingPreflight': 'node src/presentation/cli/threadtrace.js source-onboarding-preflight --module-path <file> --location-file <file>',
    'source.ingestDryRun': 'node src/presentation/cli/threadtrace.js source-ingest-dry-run --module-path <file> --location-file <file>',
    'connectors.readiness': 'node src/presentation/cli/threadtrace.js connector-readiness',
    'deployment.checklist': 'node src/presentation/cli/threadtrace.js deployment-checklist'
  };
  return commands[key];
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
  getConnectorRolloutPlan
};
