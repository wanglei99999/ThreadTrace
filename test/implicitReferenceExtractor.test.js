'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { extractImplicitReferenceCandidates } = require('../src/domain/analysis/implicitReferenceExtractor');

test('implicit reference extractor finds vague phrases and nearby entity support', function () {
  const candidates = extractImplicitReferenceCandidates([
    post(8, 'author-1', '阿狼', 'AI 这条主线今天走出来了。'),
    post(9, 'author-1', '阿狼', '前面说的方向先别追，后面看量确认。')
  ], {
    entityCandidates: [
      {
        type: 'topic_keyword',
        normalized: 'ai',
        displayName: 'AI',
        mentions: [
          {
            floor: 8,
            authorId: 'author-1',
            author: '阿狼',
            excerpt: 'AI 这条主线今天走出来了。'
          }
        ]
      }
    ],
    opinionCandidates: [
      {
        floor: 9,
        attitude: 'risk',
        confidence: 0.68,
        matchedKeywords: ['别追'],
        conditionSignals: ['看量确认']
      }
    ]
  });

  assert.ok(candidates.length >= 3);
  assert.ok(candidates.some(function (candidate) {
    return candidate.category === 'historical_continuity' && candidate.phrase.indexOf('前面说') >= 0;
  }));
  assert.ok(candidates.some(function (candidate) {
    return candidate.category === 'condition' && candidate.nearbyEntities[0].displayName === 'AI';
  }));
  assert.ok(candidates.some(function (candidate) {
    return candidate.category === 'risk_control' && candidate.sameFloorOpinions.length === 1;
  }));
});

function post(floor, authorId, author, contentText) {
  return {
    floor,
    sourcePostId: String(floor),
    author: {
      sourceAuthorId: authorId,
      displayName: author
    },
    publishedAt: '2026-06-20 10:' + floor,
    contentText,
    links: [],
    relations: []
  };
}
