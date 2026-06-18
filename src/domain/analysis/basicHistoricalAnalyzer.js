'use strict';

const { extractMarketEntities } = require('./ruleBasedMarketEntityExtractor');
const { extractOpinionCandidates } = require('./ruleBasedOpinionExtractor');

function analyzeThreadHistory(threadSnapshot) {
  const posts = threadSnapshot.posts || [];
  const authorStats = summarizeAuthors(posts);
  const primaryAuthor = posts[0] ? posts[0].author : undefined;
  const entityCandidates = extractMarketEntities(posts);
  const opinionCandidates = extractOpinionCandidates(posts);

  return {
    reportType: 'basic-history',
    generatedAt: new Date().toISOString(),
    thread: {
      sourceKey: threadSnapshot.sourceKey,
      sourceThreadId: threadSnapshot.sourceThreadId,
      title: threadSnapshot.title,
      url: threadSnapshot.url,
      page: threadSnapshot.page,
      totalPages: threadSnapshot.totalPages,
      parsedPostCount: posts.length
    },
    primaryAuthor,
    authorStats,
    entityCandidates,
    relationCandidates: collectRelations(posts),
    opinionCandidates,
    evidenceCandidates: {
      highSignalPosts: pickHighSignalPosts(posts),
      externalLinks: collectExternalLinks(posts),
      lowSignalPosts: pickLowSignalPosts(posts)
    },
    nextAnalysisSlots: [
      'entity-extraction',
      'evidence-linking',
      'implicit-reference-resolution',
      'opinion-chain-tracking'
    ]
  };
}

function collectRelations(posts) {
  const relations = [];
  posts.forEach(function (post) {
    (post.relations || []).forEach(function (relation) {
      relations.push({
        sourceFloor: post.floor,
        sourceAuthor: post.author.displayName,
        sourceAuthorId: post.author.sourceAuthorId,
        type: relation.type,
        targetThreadId: relation.targetThreadId,
        targetPostId: relation.targetPostId,
        targetFloor: relation.targetFloor,
        evidenceText: relation.evidenceText
      });
    });
  });
  return relations;
}

function summarizeAuthors(posts) {
  const byAuthor = new Map();

  posts.forEach(function (post) {
    const key = post.author.sourceAuthorId || post.author.displayName || 'unknown';
    if (!byAuthor.has(key)) {
      byAuthor.set(key, {
        author: post.author,
        postCount: 0,
        floors: [],
        firstFloor: post.floor,
        lastFloor: post.floor
      });
    }

    const item = byAuthor.get(key);
    item.postCount += 1;
    item.floors.push(post.floor);
    item.firstFloor = Math.min(item.firstFloor, post.floor);
    item.lastFloor = Math.max(item.lastFloor, post.floor);
  });

  return Array.from(byAuthor.values()).sort(function (a, b) {
    return b.postCount - a.postCount || a.firstFloor - b.firstFloor;
  });
}

function pickHighSignalPosts(posts) {
  return posts
    .filter(function (post) {
      return post.floor === 0
        || (post.contentText && post.contentText.length >= 80)
        || (post.links && post.links.length > 0)
        || (typeof post.score === 'number' && post.score >= 10);
    })
    .map(toEvidenceSummary)
    .slice(0, 20);
}

function pickLowSignalPosts(posts) {
  return posts
    .filter(function (post) {
      const text = post.contentText || '';
      return post.floor !== 0 && text.length > 0 && text.length <= 12 && (!post.links || post.links.length === 0);
    })
    .map(toEvidenceSummary)
    .slice(0, 20);
}

function collectExternalLinks(posts) {
  const links = [];
  posts.forEach(function (post) {
    (post.links || []).forEach(function (link) {
      links.push({
        floor: post.floor,
        author: post.author.displayName,
        url: link.url,
        text: link.text
      });
    });
  });
  return links;
}

function toEvidenceSummary(post) {
  return {
    floor: post.floor,
    sourcePostId: post.sourcePostId,
    author: post.author.displayName,
    authorId: post.author.sourceAuthorId,
    publishedAt: post.publishedAt,
    subject: post.subject,
    score: post.score,
    excerpt: excerpt(post.contentText, 160),
    links: post.links
  };
}

function excerpt(value, maxLength) {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '...' : text;
}

module.exports = {
  analyzeThreadHistory
};
