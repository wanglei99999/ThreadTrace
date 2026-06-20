'use strict';

const { extractMarketEntities } = require('./ruleBasedMarketEntityExtractor');
const { extractOpinionCandidates } = require('./ruleBasedOpinionExtractor');
const { extractImplicitReferenceCandidates } = require('./implicitReferenceExtractor');

function restoreContextForNewPost(threadSnapshot, newPostInput) {
  const syntheticPost = createSyntheticPost(newPostInput);
  const newEntities = extractMarketEntities([syntheticPost]);
  const newOpinions = extractOpinionCandidates([syntheticPost]);
  const newImplicitReferences = extractImplicitReferenceCandidates([syntheticPost], {
    opinionCandidates: newOpinions
  });
  const relatedEvidence = rankRelatedHistoricalPosts(threadSnapshot.posts || [], newEntities, newOpinions, newImplicitReferences, syntheticPost);

  return {
    reportType: 'new-post-context',
    generatedAt: new Date().toISOString(),
    thread: {
      sourceKey: threadSnapshot.sourceKey,
      sourceThreadId: threadSnapshot.sourceThreadId,
      title: threadSnapshot.title
    },
    newPost: {
      author: syntheticPost.author,
      publishedAt: syntheticPost.publishedAt,
      contentText: syntheticPost.contentText
    },
    newEntities,
    newOpinions,
    newImplicitReferences,
    relatedEvidence,
    interpretationSlots: [
      'explicit-entity-links',
      'implicit-reference-resolution',
      'opinion-continuity',
      'opinion-shift',
      'risk-change',
      'confidence-calibration'
    ]
  };
}

function rankRelatedHistoricalPosts(posts, newEntities, newOpinions, newImplicitReferences, syntheticPost) {
  const entityKeys = new Set(newEntities.map(function (entity) {
    return entity.type + ':' + entity.normalized;
  }));
  const opinionKeywords = new Set();
  newOpinions.forEach(function (opinion) {
    (opinion.matchedKeywords || []).forEach(function (keyword) {
      opinionKeywords.add(keyword);
    });
  });

  return posts
    .map(function (post) {
      return scoreHistoricalPost(post, entityKeys, opinionKeywords, newImplicitReferences, syntheticPost);
    })
    .filter(function (item) {
      return item.score > 0;
    })
    .sort(function (a, b) {
      return b.score - a.score || a.floor - b.floor;
    })
    .slice(0, 12);
}

function scoreHistoricalPost(post, entityKeys, opinionKeywords, newImplicitReferences, syntheticPost) {
  const reasons = [];
  let score = 0;

  const postEntities = extractMarketEntities([post]);
  const postOpinions = extractOpinionCandidates([post]);
  postEntities.forEach(function (entity) {
    const key = entity.type + ':' + entity.normalized;
    if (entityKeys.has(key)) {
      score += 5;
      reasons.push('shared_entity:' + entity.displayName);
    }
  });

  opinionKeywords.forEach(function (keyword) {
    if ((post.contentText || '').indexOf(keyword) >= 0) {
      score += 2;
      reasons.push('shared_opinion_keyword:' + keyword);
    }
  });

  if (post.author && syntheticPost.author && post.author.sourceAuthorId === syntheticPost.author.sourceAuthorId) {
    score += 1;
    reasons.push('same_author');
  }

  if ((newImplicitReferences || []).length > 0 && post.author && syntheticPost.author && post.author.sourceAuthorId === syntheticPost.author.sourceAuthorId) {
    if (postEntities.length > 0) {
      score += 2.5;
      reasons.push('implicit_reference_context:author_entity_history');
    }
    if (postOpinions.length > 0) {
      score += 1.5;
      reasons.push('implicit_reference_context:author_opinion_history');
    }
    newImplicitReferences.slice(0, 3).forEach(function (candidate) {
      reasons.push('new_implicit_reference:' + candidate.category + ':' + candidate.phrase);
    });
  }

  if ((post.links || []).length > 0) {
    score += 0.5;
    reasons.push('has_links');
  }

  if ((post.relations || []).length > 0) {
    score += 0.5;
    reasons.push('has_relations');
  }

  if (post.floor === 0) {
    score += 0.5;
    reasons.push('thread_opening');
  }

  return {
    floor: post.floor,
    sourcePostId: post.sourcePostId,
    author: post.author.displayName,
    authorId: post.author.sourceAuthorId,
    publishedAt: post.publishedAt,
    score,
    confidence: Math.min(0.95, Number((0.45 + score * 0.06).toFixed(2))),
    reasons,
    evidenceText: excerpt(post.contentText, 220)
  };
}

function createSyntheticPost(input) {
  const safeInput = input || {};
  return {
    sourceKey: safeInput.sourceKey || 'manual',
    sourcePostId: safeInput.sourcePostId || 'new-post',
    floor: typeof safeInput.floor === 'number' ? safeInput.floor : -1,
    author: {
      sourceKey: safeInput.sourceKey || 'manual',
      sourceAuthorId: safeInput.authorId || '',
      displayName: safeInput.author || 'manual'
    },
    publishedAt: safeInput.publishedAt,
    contentText: safeInput.contentText || '',
    links: [],
    relations: [],
    score: 0
  };
}

function excerpt(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '...' : text;
}

module.exports = {
  restoreContextForNewPost
};
