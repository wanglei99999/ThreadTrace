'use strict';

const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { assertRetrievalIndex } = require('../ports/retrievalIndex');
const { parseSavedThreadDirectory } = require('./parseSavedThreadDirectory');
const { mapThreadSnapshotToDocuments } = require('../../domain/retrieval/threadPostDocumentMapper');

async function indexSavedThreadDirectory(options) {
  const adapter = assertForumAdapter(options.adapter);
  const retrievalIndex = assertRetrievalIndex(options.retrievalIndex);
  const threadSnapshot = parseSavedThreadDirectory({
    adapter,
    inputDir: options.inputDir
  });
  const documents = mapThreadSnapshotToDocuments(threadSnapshot);
  await retrievalIndex.upsertDocuments(documents);

  return {
    threadSnapshot,
    indexedDocumentCount: documents.length
  };
}

module.exports = {
  indexSavedThreadDirectory
};
