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
      error: validationError
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
    error: validationError
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
    error: publicError(safeOptions.error)
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

module.exports = {
  validateTrackedSourceRegistration
};
