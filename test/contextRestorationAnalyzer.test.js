'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { parseSavedThreadDirectory } = require('../src/application/use-cases/parseSavedThreadDirectory');
const { restoreContextForNewPost } = require('../src/domain/analysis/contextRestorationAnalyzer');

test('context restoration finds historical evidence for a new post', function () {
  const snapshot = parseSavedThreadDirectory({
    adapter: getForumAdapter('nga'),
    inputDir: path.resolve(__dirname, '..', 'example')
  });
  const report = restoreContextForNewPost(snapshot, {
    authorId: '150058',
    author: '-阿狼-',
    contentText: '科技后面看量确认'
  });

  assert.equal(report.reportType, 'new-post-context');
  assert.ok(report.newEntities.length >= 1);
  assert.ok(report.newOpinions.length >= 1);
  assert.ok(report.relatedEvidence.length >= 1);
  assert.ok(report.relatedEvidence[0].reasons.length >= 1);
});
