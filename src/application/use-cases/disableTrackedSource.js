'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertSourceRepository } = require('../ports/sourceRepository');

async function disableTrackedSource(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const sourceId = safeOptions.sourceId;
  if (!sourceId) {
    throw createApplicationError('source_id_required', 'Source disable requires sourceId.', {
      statusCode: 400
    });
  }
  const source = await sourceRepository.findSource(sourceId);
  if (!source) {
    throw createApplicationError('source_not_found', 'Unknown tracked source: ' + sourceId, {
      statusCode: 404,
      details: {
        sourceId
      }
    });
  }

  const execute = safeOptions.execute === true;
  const dryRun = !execute;
  const disabledSource = Object.assign({}, source, {
    enabled: false,
    updatedAt: safeOptions.now || new Date().toISOString()
  });
  if (execute && source.enabled !== false) {
    await sourceRepository.saveSource(disabledSource);
  }

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: 'ok',
    dryRun,
    executed: execute,
    changed: source.enabled !== false,
    sourceBefore: sourceSummary(source),
    sourceAfter: sourceSummary(disabledSource)
  };
}

function sourceSummary(source) {
  if (!source) return undefined;
  return {
    id: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName,
    enabled: source.enabled !== false,
    updatedAt: source.updatedAt
  };
}

module.exports = {
  disableTrackedSource
};
