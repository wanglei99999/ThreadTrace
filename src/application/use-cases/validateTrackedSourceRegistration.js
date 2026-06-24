'use strict';

const { createTrackedSource } = require('../../domain/models/trackedSource');
const { createApplicationError, isApplicationError } = require('../errors/applicationError');
const { validateSourceRegistration } = require('./registerTrackedSource');
const { diagnoseSource } = require('./diagnoseTrackedSources');

function validateTrackedSourceRegistration(options) {
  const safeOptions = options || {};
  const sourceInput = safeOptions.source || {};
  let source;

  try {
    source = createTrackedSource(sourceInput);
  } catch (error) {
    const validationError = sourceDraftError(sourceInput, error);
    return validationResult({
      now: safeOptions.now,
      valid: false,
      status: 'fail',
      checks: [
        check('source.location', 'fail', validationError.message, 'Tracked source location can be normalized.')
      ],
      error: validationError,
      nextActions: [
        action('source.location', 'critical', 'Provide the source location required by this source type before saving the draft.', [
          'node src/presentation/cli/threadtrace.js validate-source --source-type ' + (sourceInput.sourceType || 'saved-html-directory') + ' --location-file <file>'
        ], draftErrorEvidence(sourceInput, validationError))
      ]
    });
  }

  let validationError;
  try {
    validateSourceRegistration(source, {
      sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
      allowUnknownSourceType: safeOptions.allowUnknownSourceType
    });
  } catch (error) {
    validationError = error;
  }

  const diagnostics = diagnoseSource(source, {
    handlerRegistry: safeOptions.sourceIngestHandlerRegistry,
    getAdapter: safeOptions.getAdapter
  });

  return validationResult({
    now: safeOptions.now,
    source,
    valid: !validationError,
    status: diagnostics.status,
    checks: diagnostics.checks,
    error: validationError,
    nextActions: sourceNextActions({
      source,
      checks: diagnostics.checks,
      error: validationError,
      sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry
    })
  });
}

function validationResult(options) {
  const safeOptions = options || {};
  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    valid: safeOptions.valid === true,
    status: safeOptions.status || 'fail',
    source: safeOptions.source,
    checks: safeOptions.checks || [],
    error: publicError(safeOptions.error),
    nextActions: safeOptions.nextActions || []
  };
}

function sourceDraftError(sourceInput, error) {
  if (isApplicationError(error)) return error;
  const safeInput = sourceInput || {};
  const sourceType = safeInput.sourceType || 'saved-html-directory';
  return createApplicationError('source_location_invalid', error && error.message ? error.message : String(error), {
    statusCode: 400,
    details: {
      sourceType
    }
  });
}

function publicError(error) {
  if (!error) return undefined;
  return {
    message: error.message,
    code: error.code,
    details: error.details
  };
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function sourceNextActions(options) {
  const safeOptions = options || {};
  const checks = safeOptions.checks || [];
  return checks.filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    const evidence = checkEvidence(item, safeOptions);
    return action(item.key, item.status === 'fail' ? 'critical' : 'warning', actionSummary(item), commandsForCheck(item.key), evidence);
  });
}

function actionSummary(checkItem) {
  const summaries = {
    'source.location': 'Provide the required source location fields before saving or running this source.',
    'source.handler': 'Register a source ingest handler for this source type, usually through a connector module.',
    'source.adapter': 'Register a forum adapter for this source key, or use a source ingest handler that does not require one.',
    'source.enabled': 'Enable the source when it should participate in scheduled ingestion.'
  };
  return summaries[checkItem.key] || checkItem.summary || 'Resolve this source registration check.';
}

function commandsForCheck(key) {
  const commands = {
    'source.location': [
      'node src/presentation/cli/threadtrace.js validate-source --source-type <type> --location-file <file>',
      'node src/presentation/cli/threadtrace.js source-onboarding-preflight --source-type <type> --location-file <file>'
    ],
    'source.handler': [
      'node src/presentation/cli/threadtrace.js connector-catalog',
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'
    ],
    'source.adapter': [
      'node src/presentation/cli/threadtrace.js adapter-diagnostics',
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'
    ],
    'source.enabled': [
      'node src/presentation/cli/threadtrace.js enable-source --source-id <id> --execute true'
    ]
  };
  return commands[key] || ['node src/presentation/cli/threadtrace.js validate-source --source-type <type> --location-file <file>'];
}

function checkEvidence(checkItem, options) {
  const source = options.source || {};
  const evidence = {
    sourceType: source.sourceType,
    sourceKey: source.sourceKey,
    checkValue: checkItem.value
  };
  if (checkItem.key === 'source.location') {
    const contract = locationContract(source, options.sourceIngestHandlerRegistry);
    evidence.requiredFields = contract.requiredFields;
    evidence.providedFields = Object.keys(source.location || {}).sort();
    evidence.missingRequiredFields = missingRequiredFields(source.location, contract.requiredFields);
    if (options.error && options.error.details && Array.isArray(options.error.details.missingFields)) {
      evidence.missingRequiredFields = options.error.details.missingFields;
    }
  }
  if (checkItem.key === 'source.handler') {
    evidence.registeredHandler = false;
  }
  if (checkItem.key === 'source.adapter') {
    evidence.sourceKey = source.sourceKey || checkItem.value;
  }
  return evidence;
}

function draftErrorEvidence(sourceInput, error) {
  const details = error && error.details ? error.details : {};
  return {
    sourceType: details.sourceType || sourceInput.sourceType || 'saved-html-directory',
    providedFields: Object.keys(sourceInput.location || {}).sort(),
    missingRequiredFields: Array.isArray(details.missingFields) ? details.missingFields : []
  };
}

function locationContract(source, registry) {
  if (!registry || typeof registry.findHandler !== 'function') {
    return {
      requiredFields: []
    };
  }
  const handler = registry.findHandler(source);
  const schema = handler && handler.locationSchema;
  return {
    requiredFields: schema && Array.isArray(schema.required) ? schema.required : []
  };
}

function missingRequiredFields(location, requiredFields) {
  const safeLocation = location || {};
  return (requiredFields || []).filter(function (field) {
    const value = safeLocation[field];
    return value === undefined || value === null || value === '';
  });
}

function action(key, severity, summary, commands, evidence) {
  return {
    key,
    severity,
    summary,
    commands,
    evidence: evidence || {},
    evidenceSummary: evidenceSummary(evidence)
  };
}

function evidenceSummary(evidence) {
  const safeEvidence = evidence || {};
  const parts = [];
  if ((safeEvidence.missingRequiredFields || []).length > 0) {
    parts.push('missingRequiredFields=' + safeEvidence.missingRequiredFields.join(','));
  }
  if ((safeEvidence.requiredFields || []).length > 0) {
    parts.push('requiredFields=' + safeEvidence.requiredFields.join(','));
  }
  if ((safeEvidence.providedFields || []).length > 0) {
    parts.push('providedFields=' + safeEvidence.providedFields.join(','));
  }
  if (safeEvidence.sourceType) {
    parts.push('sourceType=' + safeEvidence.sourceType);
  }
  if (safeEvidence.sourceKey) {
    parts.push('sourceKey=' + safeEvidence.sourceKey);
  }
  return parts.join(' ');
}

module.exports = {
  validateTrackedSourceRegistration
};
