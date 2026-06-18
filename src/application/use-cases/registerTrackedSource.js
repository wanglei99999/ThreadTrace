'use strict';

const { createTrackedSource } = require('../../domain/models/trackedSource');
const { assertSourceRepository } = require('../ports/sourceRepository');

async function registerTrackedSource(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const sourceInput = safeOptions.source || {};
  const draft = createTrackedSource(sourceInput);
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

module.exports = {
  registerTrackedSource
};
