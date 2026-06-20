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
  assert.ok(report.newImplicitReferences.length >= 1);
  assert.ok(report.contextChainMatches.length >= 1);
  assert.ok(report.contextChainMatches.some(function (match) {
    return match.chain && match.chain.entity && match.chain.entity.displayName === '科技';
  }));
  assert.equal(report.interpretationSummary.status, 'matched');
  assert.equal(report.interpretationSummary.evidenceLevel, 'explicit');
  assert.equal(report.interpretationSummary.topEntity, '科技');
  assert.equal(report.interpretationSummary.signals.contextChainMatchCount, report.contextChainMatches.length);
  assert.equal(report.contextChainMatches[0].relationType, 'explicit_entity_attitude_candidate');
  assert.equal(report.contextChainMatches[0].relationEvidenceLevel, 'mixed');
  assert.ok(report.contextChainMatches[0].relationFamily);
  assert.equal(report.contextMatchSummary.status, 'review-required');
  assert.equal(report.contextMatchSummary.total, report.contextChainMatches.length);
  assert.equal(report.contextMatchSummary.topEntity, '科技');
  assert.ok(report.relatedEvidence.length >= 1);
  assert.ok(report.relatedEvidence[0].reasons.length >= 1);
});

test('context restoration uses implicit references when a new post omits entities', function () {
  const snapshot = parseSavedThreadDirectory({
    adapter: getForumAdapter('nga'),
    inputDir: path.resolve(__dirname, '..', 'example')
  });
  const report = restoreContextForNewPost(snapshot, {
    authorId: '150058',
    author: '-阿狼-',
    contentText: '前面说的方向先别追，后面看量确认'
  });

  assert.equal(report.newEntities.length, 0);
  assert.ok(report.newImplicitReferences.length >= 2);
  assert.ok(report.contextChainMatches.length >= 1);
  assert.ok(report.contextChainMatches[0].reasons.includes('implicit_reference_to_author_chain'));
  assert.equal(report.interpretationSummary.status, 'matched');
  assert.equal(report.interpretationSummary.evidenceLevel, 'inferred');
  assert.equal(report.interpretationSummary.topEntity, '科技');
  assert.ok(report.interpretationSummary.summary.includes('隐晦表达'));
  assert.equal(report.contextChainMatches[0].relationEvidenceLevel, 'mixed');
  assert.equal(report.contextChainMatches[0].reviewRequired, true);
  assert.equal(report.contextMatchSummary.reviewRequiredCount >= 1, true);
  assert.equal(report.contextMatchSummary.topEntity, '科技');
  assert.ok(report.relatedEvidence.length >= 1);
  assert.ok(report.relatedEvidence[0].reasons.some(function (reason) {
    return reason.indexOf('implicit_reference_context:') === 0;
  }));
});
