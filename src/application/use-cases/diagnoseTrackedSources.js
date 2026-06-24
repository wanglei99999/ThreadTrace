'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');

async function diagnoseTrackedSources(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const handlerRegistry = safeOptions.sourceIngestHandlerRegistry;
  const getAdapter = safeOptions.getAdapter;
  const sources = await sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey,
    enabled: safeOptions.enabled,
    limit: safeOptions.limit || 100
  });
  const sourceDiagnostics = sources.map(function (source) {
    return diagnoseSource(source, {
      handlerRegistry,
      getAdapter
    });
  });

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateStatus(sourceDiagnostics.map(function (item) { return item.status; })),
    sourceCount: sourceDiagnostics.length,
    sources: sourceDiagnostics,
    nextActions: sourceDiagnostics.flatMap(function (source) {
      return source.nextActions || [];
    })
  };
}

function diagnoseSource(source, context) {
  const handler = findHandler(context.handlerRegistry, source);
  const checks = [
    check('source.enabled', source.enabled === false ? 'warn' : 'ok', source.enabled !== false, 'Tracked source is enabled.'),
    check('source.location', hasUsableLocation(source, handler) ? 'ok' : 'fail', locationValue(source, handler), 'Tracked source has a usable location.'),
    check('source.handler', handler ? 'ok' : 'fail', source.sourceType || 'missing', 'Tracked source type has an ingest handler.')
  ];

  if (handler && handler.requiresAdapter !== false) {
    checks.push(resolveAdapterCheck(context.getAdapter, source));
  }

  const status = aggregateStatus(checks.map(function (item) { return item.status; }));
  return {
    sourceId: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName,
    enabled: source.enabled !== false,
    status,
    checks,
    nextActions: nextActions(source, checks, handler)
  };
}

function findHandler(handlerRegistry, source) {
  if (!handlerRegistry || typeof handlerRegistry.findHandler !== 'function') return undefined;
  return handlerRegistry.findHandler(source);
}

function resolveAdapterCheck(getAdapter, source) {
  if (typeof getAdapter !== 'function') {
    return check('source.adapter', 'fail', source.sourceKey || 'missing', 'Adapter resolver is not configured.');
  }
  try {
    const adapter = getAdapter(source.sourceKey);
    return check('source.adapter', adapter ? 'ok' : 'fail', source.sourceKey || 'missing', 'Forum adapter is registered.');
  } catch (error) {
    return check('source.adapter', 'fail', error && error.message ? error.message : String(error), 'Forum adapter is registered.');
  }
}

function hasUsableLocation(source, handler) {
  const location = source.location || {};
  const required = locationRequiredFields(handler);
  if (required.length > 0) {
    return required.every(function (field) {
      return location[field] !== undefined && location[field] !== null && location[field] !== '';
    });
  }
  return Object.keys(location).length > 0;
}

function locationValue(source, handler) {
  const location = source.location || {};
  const required = locationRequiredFields(handler);
  const missing = required.filter(function (field) {
    return location[field] === undefined || location[field] === null || location[field] === '';
  });
  if (missing.length > 0) return 'missing: ' + missing.join(',');
  return location.inputDir || location.url || JSON.stringify(location);
}

function locationRequiredFields(handler) {
  const schema = handler && handler.locationSchema;
  return schema && Array.isArray(schema.required) ? schema.required : [];
}

function nextActions(source, checks, handler) {
  return (checks || []).filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    const evidence = actionEvidence(source, item, handler);
    return {
      key: item.key,
      sourceId: source.id,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      summary: actionSummary(source, item),
      commands: actionCommands(source, item.key),
      evidence,
      evidenceSummary: evidenceSummary(evidence)
    };
  });
}

function actionSummary(source, checkItem) {
  const name = source.displayName || source.id || source.sourceType || 'tracked source';
  const summaries = {
    'source.enabled': 'Enable ' + name + ' when it should participate in scheduled ingestion.',
    'source.location': 'Repair the stored location for ' + name + ' before running ingestion.',
    'source.handler': 'Register a source ingest handler for ' + name + ' through the connector catalog or a connector module.',
    'source.adapter': 'Register or load a forum adapter for ' + name + ', or use a handler that does not require one.'
  };
  return summaries[checkItem.key] || checkItem.summary || 'Resolve this tracked source diagnostic check.';
}

function actionCommands(source, key) {
  const sourceId = source.id || '<id>';
  const sourceKey = source.sourceKey || '<sourceKey>';
  const sourceType = source.sourceType || '<type>';
  const commands = {
    'source.enabled': [
      'node src/presentation/cli/threadtrace.js enable-source --source-id ' + sourceId + ' --execute true'
    ],
    'source.location': [
      'node src/presentation/cli/threadtrace.js source-onboarding-preflight --forum ' + sourceKey + ' --source-type ' + sourceType + ' --location-file <file>',
      'node src/presentation/cli/threadtrace.js register-source --source-id ' + sourceId + ' --forum ' + sourceKey + ' --source-type ' + sourceType + ' --location-file <file>'
    ],
    'source.handler': [
      'node src/presentation/cli/threadtrace.js connector-catalog',
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>',
      'node src/presentation/cli/threadtrace.js connector-rollout-plan --forum ' + sourceKey + ' --source-type ' + sourceType + ' --module-path <file>'
    ],
    'source.adapter': [
      'node src/presentation/cli/threadtrace.js adapter-diagnostics',
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>',
      'node src/presentation/cli/threadtrace.js connector-rollout-plan --forum ' + sourceKey + ' --source-type ' + sourceType + ' --module-path <file>'
    ]
  };
  return commands[key] || ['node src/presentation/cli/threadtrace.js source-diagnostics'];
}

function actionEvidence(source, checkItem, handler) {
  const evidence = {
    sourceId: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    checkValue: checkItem.value
  };
  if (checkItem.key === 'source.location') {
    const requiredFields = locationRequiredFields(handler);
    evidence.requiredFields = requiredFields;
    evidence.providedFields = Object.keys(source.location || {}).sort();
    evidence.missingRequiredFields = missingRequiredFields(source.location, requiredFields);
  }
  if (checkItem.key === 'source.handler') {
    evidence.registeredHandler = false;
  }
  if (checkItem.key === 'source.enabled') {
    evidence.enabled = source.enabled !== false;
  }
  return evidence;
}

function missingRequiredFields(location, requiredFields) {
  const safeLocation = location || {};
  return (requiredFields || []).filter(function (field) {
    const value = safeLocation[field];
    return value === undefined || value === null || value === '';
  });
}

function evidenceSummary(evidence) {
  const safeEvidence = evidence || {};
  const parts = [];
  if (safeEvidence.sourceId) parts.push('sourceId=' + safeEvidence.sourceId);
  if (safeEvidence.sourceType) parts.push('sourceType=' + safeEvidence.sourceType);
  if (safeEvidence.sourceKey) parts.push('sourceKey=' + safeEvidence.sourceKey);
  if ((safeEvidence.missingRequiredFields || []).length > 0) {
    parts.push('missingRequiredFields=' + safeEvidence.missingRequiredFields.join(','));
  }
  if ((safeEvidence.requiredFields || []).length > 0) {
    parts.push('requiredFields=' + safeEvidence.requiredFields.join(','));
  }
  if ((safeEvidence.providedFields || []).length > 0) {
    parts.push('providedFields=' + safeEvidence.providedFields.join(','));
  }
  if (safeEvidence.registeredHandler === false) parts.push('registeredHandler=false');
  if (safeEvidence.enabled === false) parts.push('enabled=false');
  return parts.join(' ');
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  diagnoseTrackedSources,
  diagnoseSource
};
