'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { renderAuthorIntelligenceMarkdown } = require('../src/domain/analysis/authorIntelligenceMarkdownRenderer');

test('author intelligence markdown renderer emits review handoff sections', function () {
  const markdown = renderAuthorIntelligenceMarkdown({
    generatedAt: '2026-06-22T10:00:00.000Z',
    status: 'ok',
    sourceKey: 'forum-a',
    revisionMode: 'latest-per-thread',
    reportCount: 1,
    reportRevisionCount: 2,
    recommendedNextAction: 'Work the queue.',
    summary: {
      threadCount: 1,
      authorCount: 1,
      opinionCount: 1,
      evidenceGapCount: 0,
      reviewQueueCount: 1
    },
    reviewQueue: [
      {
        type: 'high-confidence-opinion',
        priority: 'medium',
        score: 78,
        title: 'Validate high-confidence opinion from Alice',
        reason: 'high-confidence-opinion',
        summary: 'Alpha looks strong.',
        nextAction: 'Confirm the cited floor.',
        refs: [
          {
            sourceKey: 'forum-a',
            sourceThreadId: 'thread-1',
            floor: 3
          }
        ]
      }
    ],
    authors: [
      {
        author: { sourceAuthorId: 'author-1', displayName: 'Alice' },
        postCount: 2,
        opinionCount: 1,
        threadCount: 1,
        dominantStance: 'bullish',
        latestAttitude: 'bullish',
        averageOpinionConfidence: 0.82,
        intelligence: {
          evidenceStatus: 'ready',
          summary: 'Dominant stance bullish.'
        },
        topFocusEntities: [
          {
            key: 'stock:alpha',
            entity: { displayName: 'Alpha' },
            latestAttitude: 'bullish'
          }
        ]
      }
    ],
    focusEntities: [
      {
        key: 'stock:alpha',
        entity: { displayName: 'Alpha' },
        mentionCount: 2,
        primaryAuthorOpinionCount: 1,
        threadCount: 1,
        latestAttitude: 'bullish',
        evidenceLevels: { explicit: 1, inferred: 0 }
      }
    ],
    opinionTimeline: [
      {
        thread: { sourceKey: 'forum-a', sourceThreadId: 'thread-1' },
        floor: 3,
        author: { displayName: 'Alice' },
        attitude: 'bullish',
        confidence: 0.82,
        scope: 'market_opinion',
        evidenceText: 'Alpha looks strong.'
      }
    ],
    evidenceGaps: []
  });

  assert.match(markdown, /# Author Intelligence Review Package/);
  assert.match(markdown, /## Review Queue/);
  assert.match(markdown, /Validate high-confidence opinion from Alice/);
  assert.match(markdown, /forum-a\/thread-1#3/);
  assert.match(markdown, /Dominant stance bullish/);
  assert.match(markdown, /## Evidence Gaps/);
  assert.match(markdown, /No evidence gaps/);
});
