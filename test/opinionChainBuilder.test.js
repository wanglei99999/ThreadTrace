'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildOpinionChains } = require('../src/domain/analysis/opinionChainBuilder');

test('opinion chain builder links entity mentions to explicit and inferred opinions', function () {
  const chains = buildOpinionChains({
    posts: [
      post(10, 'author-1', '阿狼', 'AI 今天走强，后续看量确认。'),
      post(12, 'author-1', '阿狼', '后面不要追，等确认。'),
      post(20, 'author-2', '路人', 'AI 如果缩量就要小心。')
    ],
    primaryAuthor: {
      sourceAuthorId: 'author-1',
      displayName: '阿狼'
    },
    entityCandidates: [
      {
        type: 'topic_keyword',
        normalized: 'ai',
        displayName: 'AI',
        mentions: [
          mention(10, 'author-1', '阿狼', 'AI', 'AI 今天走强，后续看量确认。'),
          mention(20, 'author-2', '路人', 'AI', 'AI 如果缩量就要小心。')
        ]
      }
    ],
    opinionCandidates: [
      opinion(10, 'author-1', '阿狼', 'bullish', 0.7, 'AI 今天走强，后续看量确认。'),
      opinion(12, 'author-1', '阿狼', 'risk', 0.66, '后面不要追，等确认。'),
      opinion(20, 'author-2', '路人', 'risk', 0.72, 'AI 如果缩量就要小心。')
    ]
  });

  assert.equal(chains.length, 1);
  assert.equal(chains[0].key, 'topic_keyword:ai');
  assert.equal(chains[0].opinionCount, 3);
  assert.equal(chains[0].primaryAuthorOpinionCount, 2);
  assert.equal(chains[0].evidenceLevels.explicit, 2);
  assert.equal(chains[0].evidenceLevels.inferred, 1);
  assert.equal(chains[0].latestAttitude, 'risk');
  assert.equal(chains[0].timeline.some(function (event) {
    return event.floor === 12 && event.evidenceLevel === 'inferred';
  }), true);
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

function mention(floor, authorId, author, evidenceText, excerpt) {
  return {
    floor,
    authorId,
    author,
    publishedAt: '2026-06-20 10:' + floor,
    evidenceText,
    excerpt
  };
}

function opinion(floor, authorId, author, attitude, confidence, text) {
  return {
    floor,
    sourcePostId: String(floor),
    authorId,
    author,
    publishedAt: '2026-06-20 10:' + floor,
    attitude,
    confidence,
    matchedKeywords: [],
    conditionSignals: [],
    evidence: {
      text
    }
  };
}
