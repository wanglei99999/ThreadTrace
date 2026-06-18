'use strict';

const { createTrackedSource } = require('../../domain/models/trackedSource');
const { createApplicationError } = require('../errors/applicationError');
const { assertSourceRepository } = require('../ports/sourceRepository');

async function registerTrackedSource(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const sourceInput = safeOptions.source || {};
  const draft = createTrackedSource(sourceInput);
  validateSourceRegistration(draft, {
    sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
    allowUnknownSourceType: safeOptions.allowUnknownSourceType
  });
  const existing = await sourceRepository.findSource(draft.id);
  const source = createTrackedSource(Object.assign({}, draft, {
    createdAt: existing ? existing.createdAt : draft.createdAt,
    runState: existing && !sourceInput.runState ? existing.runState : draft.runState
  }));

  await sourceRepository.saveSource(source);
  return {
    source,
    created: !existing
  };
}

function validateSourceRegistration(source, options) {
  const safeOptions = options || {};
  const registry = safeOptions.sourceIngestHandlerRegistry;
  if (!registry || typeof registry.findHandler !== 'function') return;
  const handler = registry.findHandler(source);

  if (!handler) {
    if (safeOptions.allowUnknownSourceType === true) return;
    throw createApplicationError('source_type_unregistered', 'Tracked source type is not registered: ' + source.sourceType, {
      statusCode: 400,
      details: {
        sourceType: source.sourceType
      }
    });
  }

  const required = handler.locationSchema && Array.isArray(handler.locationSchema.required)
    ? handler.locationSchema.required
    : [];
  const missing = required.filter(function (field) {
    const value = source.location && source.location[field];
    return value === undefined || value === null || value === '';
  });
  if (missing.length > 0) {
    throw createApplicationError('source_location_invalid', 'Tracked source location for ' + source.sourceType + ' is missing required field(s): ' + missing.join(', '), {
      statusCode: 400,
      details: {
        sourceType: source.sourceType,
        missingFields: missing
      }
    });
  }
}

module.exports = {
  registerTrackedSource,
  validateSourceRegistration
};
