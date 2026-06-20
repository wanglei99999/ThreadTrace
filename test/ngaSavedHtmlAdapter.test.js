'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { parseSavedThread } = require('../src/application/use-cases/parseSavedThread');
const { parseSavedThreadDirectory } = require('../src/application/use-cases/parseSavedThreadDirectory');
const { analyzeThreadHistory } = require('../src/domain/analysis/basicHistoricalAnalyzer');

function samplePath() {
  return path.resolve(__dirname, '..', 'example', '自立自强，科学技术打头阵 NGA玩家社区.html');
}

test('NGA saved HTML adapter parses the provided sample into canonical posts', function () {
  const adapter = getForumAdapter('nga');
  const snapshot = parseSavedThread({
    adapter,
    inputPath: samplePath()
  });

  assert.equal(snapshot.sourceKey, 'nga');
  assert.equal(snapshot.sourceThreadId, '45974302');
  assert.equal(snapshot.title, '自立自强，科学技术打头阵');
  assert.equal(snapshot.totalPages, 7676);
  assert.equal(snapshot.posts.length, 20);

  const first = snapshot.posts[0];
  assert.equal(first.floor, 0);
  assert.equal(first.author.displayName, '-阿狼-');
  assert.equal(first.author.sourceAuthorId, '150058');
  assert.match(first.contentText, /我唯一就在这里开帖子聊/);
  assert.equal(first.links.length, 2);

  const quotedPost = snapshot.posts.find(function (post) {
    return post.relations.length > 0;
  });
  assert.ok(quotedPost);
});

test('basic historical analyzer identifies primary author and evidence candidates', function () {
  const adapter = getForumAdapter('nga');
  const snapshot = parseSavedThread({
    adapter,
    inputPath: samplePath()
  });
  const report = analyzeThreadHistory(snapshot);

  assert.equal(report.primaryAuthor.displayName, '-阿狼-');
  assert.ok(report.authorStats.length >= 10);
  assert.equal(report.primaryAuthorProfile.author.displayName, '-阿狼-');
  assert.ok(report.primaryAuthorProfile.focusEntities.length >= 1);
  assert.ok(report.evidenceReliability);
  assert.ok(report.evidenceReliability.explicitCount >= 1);
  assert.ok(['well-supported', 'mixed', 'inference-heavy'].includes(report.evidenceReliability.status));
  assert.ok(report.entityCandidates.length >= 1);
  assert.ok(report.relationCandidates.length >= 1);
  assert.ok(report.opinionCandidates.length >= 1);
  assert.ok(report.opinionChains.length >= 1);
  assert.equal(report.opinionChains[0].timeline.length >= 1, true);
  assert.equal(Array.isArray(report.implicitReferenceCandidates), true);
  assert.ok(report.evidenceCandidates.highSignalPosts.length >= 1);
  assert.ok(report.evidenceCandidates.lowSignalPosts.length >= 1);
});

test('directory parser merges saved html pages into one thread snapshot', function () {
  const adapter = getForumAdapter('nga');
  const snapshot = parseSavedThreadDirectory({
    adapter,
    inputDir: path.resolve(__dirname, '..', 'example')
  });

  assert.equal(snapshot.sourceThreadId, '45974302');
  assert.equal(snapshot.posts.length, 20);
  assert.equal(snapshot.metadata.mergedSnapshotCount, 1);
  assert.ok(snapshot.metadata.sourceFiles.length >= 1);
});
