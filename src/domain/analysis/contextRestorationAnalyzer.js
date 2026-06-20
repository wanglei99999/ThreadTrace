'use strict';

const { extractMarketEntities } = require('./ruleBasedMarketEntityExtractor');
const { extractOpinionCandidates } = require('./ruleBasedOpinionExtractor');
const { extractImplicitReferenceCandidates } = require('./implicitReferenceExtractor');
const { buildOpinionChains } = require('./opinionChainBuilder');
const { classifyNewPostChainRelation } = require('./contextChainRelationClassifier');
const { summarizeContextMatches } = require('./contextMatchSummarizer');

function restoreContextForNewPost(threadSnapshot, newPostInput) {
  const syntheticPost = createSyntheticPost(newPostInput);
  const newEntities = extractMarketEntities([syntheticPost]);
  const newOpinions = extractOpinionCandidates([syntheticPost]);
  const newImplicitReferences = extractImplicitReferenceCandidates([syntheticPost], {
    opinionCandidates: newOpinions
  });
  const relatedEvidence = rankRelatedHistoricalPosts(threadSnapshot.posts || [], newEntities, newOpinions, newImplicitReferences, syntheticPost);
  const contextChainMatches = matchHistoricalOpinionChains({
    posts: threadSnapshot.posts || [],
    newEntities,
    newOpinions,
    newImplicitReferences,
    syntheticPost
  });
  const contextMatchSummary = summarizeContextMatches(contextChainMatches);
  const interpretationSummary = summarizeInterpretation({
    newEntities,
    newOpinions,
    newImplicitReferences,
    contextChainMatches,
    relatedEvidence
  });

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
    contextChainMatches,
    contextMatchSummary,
    interpretationSummary,
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

function summarizeInterpretation(input) {
  const topChainMatch = (input.contextChainMatches || [])[0];
  const topEvidence = (input.relatedEvidence || [])[0];
  const hasExplicitEntity = (input.newEntities || []).length > 0;
  const hasImplicitReference = (input.newImplicitReferences || []).length > 0;
  const confidence = summaryConfidence(topChainMatch, topEvidence, hasExplicitEntity, hasImplicitReference);
  const evidenceLevel = hasExplicitEntity ? 'explicit' : hasImplicitReference ? 'inferred' : 'weak';
  const topChain = topChainMatch && topChainMatch.chain;
  const topEntity = topChain && topChain.entity ? topChain.entity.displayName : undefined;

  return {
    status: topChainMatch ? 'matched' : topEvidence ? 'evidence-only' : 'unmatched',
    confidence,
    evidenceLevel,
    topEntity,
    relationType: topChainMatch && topChainMatch.relationType,
    relationSummary: topChainMatch && topChainMatch.relationSummary,
    summary: interpretationSummaryText({
      topEntity,
      topChainMatch,
      topEvidence,
      hasExplicitEntity,
      hasImplicitReference
    }),
    signals: {
      explicitEntityCount: (input.newEntities || []).length,
      opinionCount: (input.newOpinions || []).length,
      implicitReferenceCount: (input.newImplicitReferences || []).length,
      contextChainMatchCount: (input.contextChainMatches || []).length,
      relatedEvidenceCount: (input.relatedEvidence || []).length
    }
  };
}

function summaryConfidence(topChainMatch, topEvidence, hasExplicitEntity, hasImplicitReference) {
  let confidence = topChainMatch ? topChainMatch.confidence : topEvidence ? topEvidence.confidence : 0.35;
  if (hasExplicitEntity) confidence += 0.05;
  if (!hasExplicitEntity && hasImplicitReference) confidence -= 0.03;
  return Math.max(0.1, Math.min(0.95, Number(confidence.toFixed(2))));
}

function interpretationSummaryText(input) {
  if (input.topChainMatch && input.topEntity) {
    const prefix = input.hasExplicitEntity ? '新发言直接命中' : '新发言通过隐晦表达可能承接';
    return prefix + '“' + input.topEntity + '”历史观点链：' + input.topChainMatch.relationSummary;
  }
  if (input.topEvidence) {
    return '未匹配到明确观点链，但找到了可参考的历史楼层 #' + input.topEvidence.floor + '。';
  }
  return '暂未找到足够历史证据，需要更多上下文。';
}

function matchHistoricalOpinionChains(options) {
  const posts = options.posts || [];
  const historicalEntities = extractMarketEntities(posts);
  const historicalOpinions = extractOpinionCandidates(posts);
  const chains = buildOpinionChains({
    posts,
    entityCandidates: historicalEntities,
    opinionCandidates: historicalOpinions,
    primaryAuthor: options.syntheticPost.author
  });
  const newEntityKeys = new Set((options.newEntities || []).map(function (entity) {
    return entity.type + ':' + entity.normalized;
  }));
  const hasImplicitReference = (options.newImplicitReferences || []).length > 0;

  return chains.map(function (chain) {
    return scoreChainMatch({
      chain,
      newEntityKeys,
      newOpinions: options.newOpinions || [],
      newImplicitReferences: options.newImplicitReferences || [],
      hasImplicitReference
    });
  }).filter(function (match) {
    return match.score > 0;
  }).sort(function (a, b) {
    return b.score - a.score || b.confidence - a.confidence || a.chain.firstFloor - b.chain.firstFloor;
  }).slice(0, 6);
}

function scoreChainMatch(options) {
  const chain = options.chain;
  const reasons = [];
  let score = 0;
  const hasSharedEntity = options.newEntityKeys.has(chain.key);

  if (hasSharedEntity) {
    score += 8;
    reasons.push('shared_entity_chain');
  }

  if (options.hasImplicitReference && chain.primaryAuthorOpinionCount > 0) {
    score += Math.min(6, chain.primaryAuthorOpinionCount * 2 + chain.mentionCount);
    reasons.push('implicit_reference_to_author_chain');
  }

  if (options.hasImplicitReference && chain.latestChange) {
    score += 1.5;
    reasons.push('chain_has_prior_change:' + chain.latestChange.changeType);
  }

  const relation = classifyNewPostChainRelation(chain, options.newOpinions, options.hasImplicitReference, hasSharedEntity);
  if (relation.relationType !== 'unrelated') {
    score += relation.scoreBoost;
    reasons.push('relation:' + relation.relationType);
  }

  return {
    chain: compactChain(chain),
    relationType: relation.relationType,
    relationFamily: relation.relationFamily,
    relationEvidenceLevel: relation.evidenceLevel,
    latestAttitude: relation.latestAttitude,
    newAttitudes: relation.newAttitudes,
    relationSummary: relation.summary,
    score,
    confidence: Math.min(0.95, Number((0.42 + score * 0.05 + (chain.confidence || 0) * 0.2).toFixed(2))),
    reviewRequired: relation.reviewRequired,
    reviewReasons: relation.reviewReasons,
    reasons
  };
}

function compactChain(chain) {
  return {
    key: chain.key,
    entity: chain.entity,
    mentionCount: chain.mentionCount,
    opinionCount: chain.opinionCount,
    primaryAuthorOpinionCount: chain.primaryAuthorOpinionCount,
    latestAttitude: chain.latestAttitude,
    latestChange: chain.latestChange,
    confidence: chain.confidence,
    firstFloor: chain.firstFloor,
    lastFloor: chain.lastFloor,
    evidenceLevels: chain.evidenceLevels,
    evidenceRefs: (chain.evidenceRefs || []).slice(0, 4)
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
