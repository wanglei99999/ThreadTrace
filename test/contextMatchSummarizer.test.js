'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { summarizeContextMatches } = require('../src/domain/analysis/contextMatchSummarizer');

test('context match summarizer groups relation families and review reasons', function () {
  const summary = summarizeContextMatches([
    match('科技', 'candidate', 'mixed', true, ['relation_uses_inference']),
    match('AI', 'continuity', 'explicit', false, [])
  ]);

  assert.equal(summary.status, 'review-required');
  assert.equal(summary.total, 2);
  assert.equal(summary.reviewRequiredCount, 1);
  assert.equal(summary.topEntity, '科技');
  assert.equal(summary.relationFamilyCounts.candidate, 1);
  assert.equal(summary.relationFamilyCounts.continuity, 1);
  assert.equal(summary.evidenceLevelCounts.mixed, 1);
  assert.equal(summary.reviewReasons[0].reason, 'relation_uses_inference');
});

test('context match summarizer marks empty matches as unmatched', function () {
  const summary = summarizeContextMatches([]);

  assert.equal(summary.status, 'unmatched');
  assert.equal(summary.total, 0);
  assert.equal(summary.reviewReasons.length, 0);
});

function match(entityName, relationFamily, evidenceLevel, reviewRequired, reviewReasons) {
  return {
    chain: {
      entity: {
        displayName: entityName
      }
    },
    relationType: relationFamily + '_type',
    relationFamily,
    relationEvidenceLevel: evidenceLevel,
    reviewRequired,
    reviewReasons
  };
}
