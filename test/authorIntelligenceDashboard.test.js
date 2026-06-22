'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getAuthorIntelligenceDashboard } = require('../src/application/use-cases/getAuthorIntelligenceDashboard');

test('author intelligence dashboard aggregates stored basic-history reports', async function () {
  const calls = [];
  const dashboard = await getAuthorIntelligenceDashboard({
    now: '2026-06-22T10:00:00.000Z',
    sourceKey: 'forum-a',
    reportRepository: {
      async saveReport() {},
      async findReports() { return []; },
      async listReports(query) {
        calls.push(query);
        return [sampleReport('thread-2', '2026-06-22T09:00:00.000Z'), sampleReport('thread-1', '2026-06-22T08:00:00.000Z')];
      }
    }
  });

  assert.deepEqual(calls[0], {
    sourceKey: 'forum-a',
    sourceThreadId: undefined,
    reportType: 'basic-history',
    limit: 100
  });
  assert.equal(dashboard.status, 'ok');
  assert.equal(dashboard.reportCount, 2);
  assert.equal(dashboard.reportRevisionCount, 2);
  assert.equal(dashboard.revisionMode, 'latest-per-thread');
  assert.equal(dashboard.summary.threadCount, 2);
  assert.equal(dashboard.summary.authorCount, 2);
  assert.equal(dashboard.authors[0].author.sourceAuthorId, 'author-1');
  assert.equal(dashboard.authors[0].postCount, 4);
  assert.equal(dashboard.authors[0].opinionCount, 2);
  assert.equal(dashboard.authors[0].primaryThreadCount, 2);
  assert.equal(dashboard.authors[0].stanceSummary.bullish, 2);
  assert.equal(dashboard.authors[0].dominantStance, 'bullish');
  assert.equal(dashboard.authors[0].topFocusEntities.length, 1);
  assert.equal(dashboard.authors[0].topFocusEntities[0].mentionCount, 4);
  assert.equal(dashboard.authors[0].topFocusEntities[0].threadCount, 2);
  const bob = dashboard.authors.find(function (item) {
    return item.author.sourceAuthorId === 'author-2';
  });
  assert.equal(bob.opinionCount, 2);
  assert.equal(bob.stanceSummary.watch, 2);
  assert.equal(bob.dominantStance, 'watch');
  assert.equal(bob.intelligence.evidenceStatus, 'ready');
  assert.equal(dashboard.focusEntities[0].entity.displayName, 'Alpha');
  assert.equal(dashboard.focusEntities[0].mentionCount, 4);
  assert.equal(dashboard.opinionTimeline.length, 4);
  assert.equal(dashboard.evidenceGaps.length, 2);
  assert.match(dashboard.recommendedNextAction, /evidence gaps/);
});

test('author intelligence dashboard uses the latest report per thread by default', async function () {
  const latestThreadOne = sampleReport('thread-1', '2026-06-22T09:00:00.000Z');
  latestThreadOne.authorStats[0].postCount = 3;
  latestThreadOne.primaryAuthorProfile.opinionCount = 2;
  latestThreadOne.primaryAuthorProfile.stanceSummary = { bullish: 2 };
  latestThreadOne.opinionCandidates.push({
    floor: 6,
    sourcePostId: 'thread-1-p6',
    author: 'Alice',
    authorId: 'author-1',
    publishedAt: '2026-06-22T09:06:00.000Z',
    scope: 'market_opinion',
    attitude: 'risk',
    confidence: 0.7,
    evidence: { text: 'Alpha needs risk review.' }
  });
  const olderThreadOne = sampleReport('thread-1', '2026-06-22T08:00:00.000Z');
  olderThreadOne.authorStats[0].postCount = 99;
  olderThreadOne.primaryAuthorProfile.opinionCount = 99;
  const threadTwo = sampleReport('thread-2', '2026-06-22T07:00:00.000Z');

  const reportRepository = {
    async saveReport() {},
    async findReports() { return []; },
    async listReports() {
      return [latestThreadOne, olderThreadOne, threadTwo];
    }
  };
  const dashboard = await getAuthorIntelligenceDashboard({
    now: '2026-06-22T10:00:00.000Z',
    reportRepository
  });
  const revisionDashboard = await getAuthorIntelligenceDashboard({
    now: '2026-06-22T10:00:00.000Z',
    includeReportRevisions: true,
    reportRepository
  });
  const author = dashboard.authors.find(function (item) {
    return item.author.sourceAuthorId === 'author-1';
  });
  const revisionAuthor = revisionDashboard.authors.find(function (item) {
    return item.author.sourceAuthorId === 'author-1';
  });

  assert.equal(dashboard.reportCount, 2);
  assert.equal(dashboard.reportRevisionCount, 3);
  assert.equal(dashboard.summary.threadCount, 2);
  assert.equal(author.postCount, 5);
  assert.equal(author.opinionCount, 3);
  assert.equal(author.dominantStance, 'bullish');
  assert.equal(author.latestAttitude, 'risk');
  assert.equal(author.averageOpinionConfidence, 0.77);
  assert.equal(revisionDashboard.revisionMode, 'all-revisions');
  assert.equal(revisionDashboard.reportCount, 3);
  assert.equal(revisionAuthor.postCount, 104);
  assert.equal(revisionAuthor.opinionCount, 4);
});

test('author intelligence dashboard filters by author and returns warn for empty reports', async function () {
  const dashboard = await getAuthorIntelligenceDashboard({
    now: '2026-06-22T10:00:00.000Z',
    authorId: 'author-2',
    reportRepository: {
      async saveReport() {},
      async findReports() { return []; },
      async listReports() {
        return [sampleReport('thread-1', '2026-06-22T08:00:00.000Z')];
      }
    }
  });
  const empty = await getAuthorIntelligenceDashboard({
    now: '2026-06-22T10:00:00.000Z',
    reportRepository: {
      async saveReport() {},
      async findReports() { return []; },
      async listReports() { return []; }
    }
  });

  assert.equal(dashboard.authors.length, 1);
  assert.equal(dashboard.authors[0].author.sourceAuthorId, 'author-2');
  assert.equal(dashboard.authors[0].opinionCount, 1);
  assert.equal(dashboard.authors[0].stanceSummary.watch, 1);
  assert.equal(dashboard.authors[0].dominantStance, 'watch');
  assert.equal(dashboard.authors[0].averageOpinionConfidence, 0.65);
  assert.equal(dashboard.opinionTimeline.length, 1);
  assert.equal(dashboard.opinionTimeline[0].author.sourceAuthorId, 'author-2');
  assert.equal(dashboard.focusEntities.length, 0);
  assert.equal(empty.status, 'warn');
  assert.equal(empty.reportCount, 0);
  assert.match(empty.message, /No basic-history reports/);
});

function sampleReport(sourceThreadId, generatedAt) {
  return {
    reportType: 'basic-history',
    generatedAt,
    thread: {
      sourceKey: 'forum-a',
      sourceThreadId,
      title: 'Sample ' + sourceThreadId,
      parsedPostCount: 10
    },
    authorStats: [
      {
        author: { sourceKey: 'forum-a', sourceAuthorId: 'author-1', displayName: 'Alice' },
        postCount: 2,
        floors: [0, 3],
        firstFloor: 0,
        lastFloor: 3
      },
      {
        author: { sourceKey: 'forum-a', sourceAuthorId: 'author-2', displayName: 'Bob' },
        postCount: 1,
        floors: [4],
        firstFloor: 4,
        lastFloor: 4
      }
    ],
    primaryAuthorProfile: {
      author: { sourceKey: 'forum-a', sourceAuthorId: 'author-1', displayName: 'Alice' },
      opinionCount: 1,
      stanceSummary: { bullish: 1 },
      focusEntities: [
        {
          key: 'stock:alpha',
          entity: { type: 'stock', normalized: 'alpha', displayName: 'Alpha' },
          mentionCount: 2,
          primaryAuthorOpinionCount: 1,
          latestAttitude: 'bullish',
          confidence: 0.82,
          evidenceLevels: { explicit: 1, inferred: 0 }
        }
      ],
      evidenceGaps: [
        {
          key: 'stock:alpha',
          entity: { type: 'stock', normalized: 'alpha', displayName: 'Alpha' },
          reason: 'contains-inferred-opinion-link',
          summary: 'Needs evidence review.',
          firstFloor: 0,
          lastFloor: 3
        }
      ]
    },
    opinionCandidates: [
      {
        floor: 3,
        sourcePostId: sourceThreadId + '-p3',
        author: 'Alice',
        authorId: 'author-1',
        publishedAt: '2026-06-22T08:03:00.000Z',
        scope: 'market_opinion',
        attitude: 'bullish',
        confidence: 0.8,
        evidence: { text: 'Alpha looks strong.' }
      },
      {
        floor: 4,
        sourcePostId: sourceThreadId + '-p4',
        author: 'Bob',
        authorId: 'author-2',
        publishedAt: '2026-06-22T08:04:00.000Z',
        scope: 'market_opinion',
        attitude: 'watch',
        confidence: 0.65,
        evidence: { text: 'Wait for confirmation.' }
      }
    ],
    evidenceCandidates: {
      highSignalPosts: [
        {
          floor: 3,
          sourcePostId: sourceThreadId + '-p3',
          author: 'Alice',
          authorId: 'author-1',
          publishedAt: '2026-06-22T08:03:00.000Z',
          score: 12,
          excerpt: 'Alpha looks strong.',
          links: []
        }
      ]
    }
  };
}
