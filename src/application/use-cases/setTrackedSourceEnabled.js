'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertSourceRepository } = require('../ports/sourceRepository');

async function setTrackedSourceEnabled(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const sourceId = safeOptions.sourceId;
  if (!sourceId) {
    throw createApplicationError('source_id_required', 'Source lifecycle update requires sourceId.', {
      statusCode: 400
    });
  }
  if (typeof safeOptions.enabled !== 'boolean') {
    throw createApplicationError('source_enabled_required', 'Source lifecycle update requires enabled.', {
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
  const updatedSource = Object.assign({}, source, {
    enabled: safeOptions.enabled,
    updatedAt: safeOptions.now || new Date().toISOString()
  });
  const changed = (source.enabled !== false) !== safeOptions.enabled;
  if (execute && changed) {
    await sourceRepository.saveSource(updatedSource);
  }

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: 'ok',
    dryRun,
    executed: execute,
    changed,
    sourceBefore: sourceSummary(source),
    sourceAfter: sourceSummary(updatedSource)
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
  setTrackedSourceEnabled,
  sourceSummary
};
