'use strict';

/**
 * Retrieval port for full-text, vector, or hybrid search over posts and
 * evidence snippets.
 *
 * @typedef {Object} RetrievalIndex
 * @property {(documents: Array<{ id: string, text: string, metadata: Object }>) => Promise<void>} upsertDocuments
 * @property {(query: { text: string, filter?: Object, limit?: number }) => Promise<Array<{ id: string, score: number, text: string, metadata: Object }>>} search
 */

function assertRetrievalIndex(index) {
  if (!index || typeof index.upsertDocuments !== 'function') {
    throw new Error('RetrievalIndex must implement upsertDocuments(documents).');
  }
  if (typeof index.search !== 'function') {
    throw new Error('RetrievalIndex must implement search(query).');
  }
  return index;
}

module.exports = {
  assertRetrievalIndex
};
