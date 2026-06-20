'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPrimaryAuthorProfile } = require('../src/domain/analysis/authorHistoricalProfile');

test('primary author profile summarizes focus entities stances and evidence gaps', function () {
  const profile = buildPrimaryAuthorProfile({
    primaryAuthor: {
      sourceAuthorId: 'author-1',
      displayName: '阿狼'
    },
    authorStats: [
      {
        author: {
          sourceAuthorId: 'author-1',
          displayName: '阿狼'
        },
        postCount: 3,
        floors: [0, 8, 12],
        firstFloor: 0,
        lastFloor: 12
      }
    ],
    entityCandidates: [
      entity('AI', 'topic_keyword', 'ai', [
        mention(0, 'author-1', '阿狼'),
        mention(8, 'author-1', '阿狼')
      ]),
      entity('芯片', 'topic_keyword', '芯片', [
        mention(12, 'author-1', '阿狼')
      ])
    ],
    opinionCandidates: [
      opinion(0, 'author-1', '阿狼', 'bullish'),
      opinion(12, 'author-1', '阿狼', 'watch'),
      opinion(20, 'author-2', '路人', 'risk')
    ],
    opinionChains: [
      {
        key: 'topic_keyword:ai',
        primaryAuthorOpinionCount: 1,
        latestAttitude: 'bullish',
        confidence: 0.81,
        evidenceLevels: { explicit: 1, inferred: 0 }
      },
      {
        key: 'topic_keyword:芯片',
        primaryAuthorOpinionCount: 0,
        latestAttitude: 'unknown',
        confidence: 0,
        evidenceLevels: { explicit: 0, inferred: 0 }
      }
    ]
  });

  assert.equal(profile.postCount, 3);
  assert.equal(profile.opinionCount, 2);
  assert.equal(profile.stanceSummary.bullish, 1);
  assert.equal(profile.stanceSummary.watch, 1);
  assert.equal(profile.focusEntities.length, 2);
  assert.equal(profile.focusEntities[0].entity.displayName, 'AI');
  assert.equal(profile.evidenceGaps[0].key, 'topic_keyword:芯片');
});

function entity(displayName, type, normalized, mentions) {
  return {
    displayName,
    type,
    normalized,
    metadata: {},
    mentions
  };
}

function mention(floor, authorId, author) {
  return {
    floor,
    authorId,
    author,
    publishedAt: '2026-06-20 10:' + floor,
    excerpt: author + ' mention #' + floor
  };
}

function opinion(floor, authorId, author, attitude) {
  return {
    floor,
    authorId,
    author,
    attitude,
    confidence: 0.7
  };
}
