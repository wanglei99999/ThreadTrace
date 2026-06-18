'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');

async function listTrackedSources(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  return sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey,
    enabled: safeOptions.enabled,
    limit: safeOptions.limit
  });
}

module.exports = {
  listTrackedSources
};
