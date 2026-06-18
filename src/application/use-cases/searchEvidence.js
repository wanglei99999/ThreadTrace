'use strict';

const { assertRetrievalIndex } = require('../ports/retrievalIndex');

async function searchEvidence(options) {
  const retrievalIndex = assertRetrievalIndex(options.retrievalIndex);
  return retrievalIndex.search({
    text: options.text,
    filter: options.filter,
    limit: options.limit
  });
}

module.exports = {
  searchEvidence
};
