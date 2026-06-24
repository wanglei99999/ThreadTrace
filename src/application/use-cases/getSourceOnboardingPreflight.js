'use strict';

function getSourceOnboardingPreflight(options) {
  const safeOptions = options || {};
  const catalog = safeOptions.catalog || {};
  const connectorReadiness = safeOptions.connectorReadiness || {};
  const sourceType = safeOptions.sourceType || (safeOptions.sourceValidation && safeOptions.sourceValidation.source && safeOptions.sourceValidation.source.sourceType);
  const sourceKey = safeOptions.sourceKey || safeOptions.forum ||
    (safeOptions.sourceValidation && safeOptions.sourceValidation.source && safeOptions.sourceValidation.source.sourceKey);
  const catalogSourceType = findCatalogSourceType(catalog, sourceType);
  const connector = findConnector(connectorReadiness, sourceType);
  const contractSummary = summarizeContract(safeOptions.threadSnapshotContract);
  const steps = [
    step('catalog.sourceType', catalogSourceType ? 'ok' : 'fail', 'Requested source type is registered in the connector catalog.', {
      sourceType,
      supported: Boolean(catalogSourceType),
      compatibleSourceKeys: catalogSourceType ? catalogSourceType.compatibleSourceKeys || [] : []
    }),
    step('connectors.readiness', connectorReadinessStatus(connector, connectorReadiness), 'Connector readiness is acceptable for the requested source type.', {
      sourceType,
      connectorStatus: connector && connector.status,
      moduleErrorCount: connectorReadiness.modules ? connectorReadiness.modules.errorCount || 0 : 0
    }),
    step('threadSnapshot.contract', contractSummary.version ? 'ok' : 'fail', 'ThreadSnapshot JSON contract is available for external sources.', contractSummary)
  ];

  if (safeOptions.connectorModuleValidation) {
    steps.push(step('connectorModule.validation', connectorModuleValidationStatus(safeOptions.connectorModuleValidation), 'External connector module can be loaded for this onboarding preflight.', {
      valid: safeOptions.connectorModuleValidation.valid,
      modulePath: safeOptions.connectorModuleValidation.modulePath,
      checks: safeOptions.connectorModuleValidation.checks || [],
      errors: safeOptions.connectorModuleValidation.errors || []
    }));
  }

  if (safeOptions.sourceValidation) {
    steps.push(step('source.registrationDraft', sourceValidationStatus(safeOptions.sourceValidation), 'Tracked source draft can be registered.', {
      valid: safeOptions.sourceValidation.valid,
      sourceId: safeOptions.sourceValidation.source && safeOptions.sourceValidation.source.id,
      error: safeOptions.sourceValidation.error,
      checks: safeOptions.sourceValidation.checks || []
    }));
  }

  if (safeOptions.threadJsonValidation) {
    steps.push(step('threadJson.contractValidation', threadJsonValidationStatus(safeOptions.threadJsonValidation), 'Normalized thread JSON input satisfies the ThreadSnapshot contract.', {
      valid: safeOptions.threadJsonValidation.valid,
      thread: safeOptions.threadJsonValidation.thread,
      error: safeOptions.threadJsonValidation.error,
      checks: safeOptions.threadJsonValidation.checks || []
    }));
  }

  const status = aggregateStatus(steps.map(function (item) { return item.status; }));
  return {
    generatedAt: safeOptions.now || catalog.generatedAt || connectorReadiness.generatedAt || new Date().toISOString(),
    status,
    sourceKey,
    sourceType,
    steps,
    nextActions: nextActions(steps, {
      sourceValidation: safeOptions.sourceValidation,
      connectorModuleValidation: safeOptions.connectorModuleValidation,
      threadJsonValidation: safeOptions.threadJsonValidation
    }),
    catalog: {
      sourceType: catalogSourceType,
      sourceTypeCount: (catalog.sourceTypes || []).length,
      adapterCount: (catalog.adapters || []).length
    },
    connectorReadiness,
    sourceValidation: safeOptions.sourceValidation,
    connectorModuleValidation: safeOptions.connectorModuleValidation,
    threadJsonValidation: safeOptions.threadJsonValidation,
    threadSnapshotContract: contractSummary
  };
}

function findCatalogSourceType(catalog, sourceType) {
  return (catalog.sourceTypes || []).find(function (item) {
    return item.sourceType === sourceType;
  });
}

function findConnector(readiness, sourceType) {
  return (readiness.connectors || []).find(function (item) {
    return item.sourceType === sourceType;
  });
}

function connectorReadinessStatus(connector, readiness) {
  const moduleErrorCount = readiness && readiness.modules ? readiness.modules.errorCount || 0 : 0;
  if (!connector || moduleErrorCount > 0) return 'fail';
  return connector.status || 'fail';
}

function sourceValidationStatus(sourceValidation) {
  if (!sourceValidation.valid) return 'fail';
  return sourceValidation.status || 'ok';
}

function threadJsonValidationStatus(threadJsonValidation) {
  if (!threadJsonValidation.valid) return 'fail';
  return threadJsonValidation.status || 'ok';
}

function connectorModuleValidationStatus(connectorModuleValidation) {
  if (!connectorModuleValidation.valid) return 'fail';
  return connectorModuleValidation.status || 'ok';
}

function summarizeContract(contract) {
  const schema = contract && contract.schema ? contract.schema : {};
  return {
    version: contract && contract.version,
    required: Array.isArray(schema.required) ? schema.required : [],
    schemaType: schema.type
  };
}

function step(key, status, summary, evidence) {
  return {
    key,
    status,
    summary,
    evidence: evidence || {}
  };
}

function nextActions(steps, reports) {
  return steps.filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    return {
      key: item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      summary: item.summary,
      commands: commandsForStep(item.key),
      evidence: item.evidence || {},
      evidenceSummary: evidenceSummary(item.evidence),
      details: detailsForStep(item.key, reports)
    };
  });
}

function detailsForStep(key, reports) {
  const safeReports = reports || {};
  if (key === 'source.registrationDraft' && safeReports.sourceValidation) {
    return (safeReports.sourceValidation.nextActions || []).map(compactAction);
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
  if (key === 'threadJson.contractValidation' && safeReports.threadJsonValidation) {
    return (safeReports.threadJsonValidation.checks || []).filter(function (check) {
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
    evidenceSummary: action.evidenceSummary
  };
}

function commandsForStep(key) {
  const commands = {
    'catalog.sourceType': [
      'node src/presentation/cli/threadtrace.js connector-catalog',
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'
    ],
    'connectors.readiness': [
      'node src/presentation/cli/threadtrace.js connector-readiness',
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'
    ],
    'threadSnapshot.contract': [
      'node src/presentation/cli/threadtrace.js thread-snapshot-contract'
    ],
    'connectorModule.validation': [
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'
    ],
    'source.registrationDraft': [
      'node src/presentation/cli/threadtrace.js validate-source --source-type <type> --location-file <file>'
    ],
    'threadJson.contractValidation': [
      'node src/presentation/cli/threadtrace.js validate-thread-json --input-file <file>'
    ]
  };
  return commands[key] || [];
}

function evidenceSummary(evidence) {
  const safeEvidence = evidence || {};
  const parts = [];
  if (safeEvidence.sourceType) parts.push('sourceType=' + safeEvidence.sourceType);
  if (safeEvidence.connectorStatus) parts.push('connectorStatus=' + safeEvidence.connectorStatus);
  if (safeEvidence.moduleErrorCount !== undefined) parts.push('moduleErrorCount=' + safeEvidence.moduleErrorCount);
  if (safeEvidence.valid !== undefined) parts.push('valid=' + safeEvidence.valid);
  if (safeEvidence.error && safeEvidence.error.code) parts.push('error=' + safeEvidence.error.code);
  if (safeEvidence.thread && safeEvidence.thread.sourceThreadId) parts.push('thread=' + safeEvidence.thread.sourceThreadId);
  if ((safeEvidence.checks || []).length > 0) {
    const failingChecks = safeEvidence.checks.filter(function (check) {
      return check.status !== 'ok';
    }).map(function (check) {
      return check.key;
    });
    if (failingChecks.length > 0) parts.push('checks=' + failingChecks.join(','));
  }
  return parts.join(' ');
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getSourceOnboardingPreflight
};
