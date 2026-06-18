'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { indexSavedThreadDirectory } = require('../src/application/use-cases/indexSavedThreadDirectory');
const { searchEvidence } = require('../src/application/use-cases/searchEvidence');
const { createFileTextRetrievalIndex } = require('../src/infrastructure/retrieval/fileTextRetrievalIndex');

test('file text retrieval index searches indexed thread posts', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-retrieval-'));
  const retrievalIndex = createFileTextRetrievalIndex({
    indexFile: path.join(tempDir, 'documents.json')
  });

  const indexResult = await indexSavedThreadDirectory({
    adapter: getForumAdapter('nga'),
    inputDir: path.resolve(__dirname, '..', 'example'),
    retrievalIndex
  });
  const results = await searchEvidence({
    text: '科技',
    limit: 5,
    retrievalIndex
  });

  assert.equal(indexResult.indexedDocumentCount, 20);
  assert.ok(results.length >= 1);
  assert.equal(results[0].metadata.sourceThreadId, '45974302');
});
