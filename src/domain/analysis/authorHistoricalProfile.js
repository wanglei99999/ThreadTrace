'use strict';

function buildPrimaryAuthorProfile(input) {
  const safeInput = input || {};
  const primaryAuthor = safeInput.primaryAuthor;
  if (!primaryAuthor) {
    return undefined;
  }

  const primaryAuthorId = primaryAuthor.sourceAuthorId;
  const authorStats = findAuthorStats(safeInput.authorStats || [], primaryAuthor);
  const authoredOpinions = (safeInput.opinionCandidates || []).filter(function (opinion) {
    return sameAuthor(opinion.authorId, opinion.author, primaryAuthor);
  });
  const authoredEntityMentions = collectAuthoredEntityMentions(safeInput.entityCandidates || [], primaryAuthor);
  const focusEntities = buildFocusEntities({
    authoredEntityMentions,
    opinionChains: safeInput.opinionChains || [],
    primaryAuthorId
  });

  return {
    author: primaryAuthor,
    postCount: authorStats ? authorStats.postCount : 0,
    firstFloor: authorStats && authorStats.firstFloor,
    lastFloor: authorStats && authorStats.lastFloor,
    floors: authorStats ? authorStats.floors.slice(0, 40) : [],
    opinionCount: authoredOpinions.length,
    stanceSummary: summarizeStances(authoredOpinions),
    focusEntities,
    evidenceGaps: buildEvidenceGaps(focusEntities).slice(0, 8)
  };
}

function findAuthorStats(authorStats, primaryAuthor) {
  return authorStats.find(function (item) {
    return sameAuthor(
      item.author && item.author.sourceAuthorId,
      item.author && item.author.displayName,
      primaryAuthor
    );
  });
}

function collectAuthoredEntityMentions(entityCandidates, primaryAuthor) {
  return entityCandidates.map(function (entity) {
    const mentions = (entity.mentions || []).filter(function (mention) {
      return sameAuthor(mention.authorId, mention.author, primaryAuthor);
    });
    return {
      entity,
      mentions
    };
  }).filter(function (item) {
    return item.mentions.length > 0;
  });
}

function buildFocusEntities(options) {
  return options.authoredEntityMentions.map(function (item) {
    const entity = item.entity;
    const chain = (options.opinionChains || []).find(function (candidate) {
      return candidate.key === entity.type + ':' + entity.normalized;
    });
    const mentionFloors = item.mentions.map(function (mention) {
      return mention.floor;
    }).sort(function (a, b) { return a - b; });
    return {
      key: entity.type + ':' + entity.normalized,
      entity: {
        type: entity.type,
        normalized: entity.normalized,
        displayName: entity.displayName,
        metadata: entity.metadata || {}
      },
      mentionCount: item.mentions.length,
      firstFloor: mentionFloors[0],
      lastFloor: mentionFloors[mentionFloors.length - 1],
      opinionChainKey: chain && chain.key,
      primaryAuthorOpinionCount: chain ? chain.primaryAuthorOpinionCount : 0,
      latestAttitude: chain ? chain.latestAttitude : 'unknown',
      confidence: chain ? chain.confidence : 0,
      evidenceLevels: chain ? chain.evidenceLevels : { explicit: 0, inferred: 0 },
      evidenceRefs: item.mentions.slice(0, 3).map(function (mention) {
        return {
          floor: mention.floor,
          author: mention.author,
          authorId: mention.authorId,
          publishedAt: mention.publishedAt,
          excerpt: mention.excerpt
        };
      })
    };
  }).sort(function (a, b) {
    return b.primaryAuthorOpinionCount - a.primaryAuthorOpinionCount
      || b.mentionCount - a.mentionCount
      || a.firstFloor - b.firstFloor;
  }).slice(0, 12);
}

function summarizeStances(opinions) {
  return opinions.reduce(function (summary, opinion) {
    const attitude = opinion.attitude || 'unknown';
    summary[attitude] = (summary[attitude] || 0) + 1;
    return summary;
  }, {});
}

function buildEvidenceGaps(focusEntities) {
  const gaps = [];
  focusEntities.forEach(function (item) {
    if (item.primaryAuthorOpinionCount === 0) {
      gaps.push({
        key: item.key,
        entity: item.entity,
        reason: 'entity-mentioned-without-linked-author-opinion',
        summary: '主作者提到该对象，但当前规则尚未连接到明确观点。',
        firstFloor: item.firstFloor,
        lastFloor: item.lastFloor
      });
    }
    if ((item.evidenceLevels && item.evidenceLevels.inferred) > 0) {
      gaps.push({
        key: item.key,
        entity: item.entity,
        reason: 'contains-inferred-opinion-link',
        summary: '该对象的部分观点连接来自邻近楼层推断，需要后续证据确认。',
        firstFloor: item.firstFloor,
        lastFloor: item.lastFloor
      });
    }
  });
  return gaps;
}

function sameAuthor(authorId, authorName, primaryAuthor) {
  if (!primaryAuthor) return false;
  if (authorId && primaryAuthor.sourceAuthorId && authorId === primaryAuthor.sourceAuthorId) return true;
  return Boolean(authorName && primaryAuthor.displayName && authorName === primaryAuthor.displayName);
}

module.exports = {
  buildPrimaryAuthorProfile
};
