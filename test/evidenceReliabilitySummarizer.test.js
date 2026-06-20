'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { summarizeEvidenceReliability } = require('../src/domain/analysis/evidenceReliabilitySummarizer');

test('evidence reliability summarizer separates explicit and inferred support', function () {
  const summary = summarizeEvidenceReliability({
    opinionChains: [
      { evidenceLevels: { explicit: 3, inferred: 0 } },
      { evidenceLevels: { explicit: 1, inferred: 2 } }
    ],
    implicitReferenceCandidates: [{}, {}]
  });

  assert.equal(summary.explicitCount, 4);
  assert.equal(summary.inferredCount, 2);
  assert.equal(summary.implicitReferenceCount, 2);
  assert.equal(summary.explicitRatio, 0.67);
  assert.equal(summary.status, 'mixed');
  assert.ok(summary.cautions.some(function (item) {
    return item.includes('推断关联');
  }));
});

test('evidence reliability summarizer marks missing chain evidence as insufficient', function () {
  const summary = summarizeEvidenceReliability({
    opinionChains: [],
    implicitReferenceCandidates: []
  });

  assert.equal(summary.status, 'insufficient');
  assert.equal(summary.explicitRatio, 0);
  assert.ok(summary.cautions.length >= 1);
});
