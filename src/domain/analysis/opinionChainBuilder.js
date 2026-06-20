'use strict';

const DEFAULT_NEARBY_FLOOR_WINDOW = 2;

function buildOpinionChains(input) {
  const safeInput = input || {};
  const postsByFloor = indexPostsByFloor(safeInput.posts || []);
  const primaryAuthorId = safeInput.primaryAuthor && safeInput.primaryAuthor.sourceAuthorId;
  const nearbyFloorWindow = typeof safeInput.nearbyFloorWindow === 'number'
    ? safeInput.nearbyFloorWindow
    : DEFAULT_NEARBY_FLOOR_WINDOW;

  return (safeInput.entityCandidates || [])
    .map(function (entity) {
      return buildEntityOpinionChain({
        entity,
        opinions: safeInput.opinionCandidates || [],
        postsByFloor,
        primaryAuthorId,
        nearbyFloorWindow
      });
    })
    .filter(function (chain) {
      return chain.opinionCount > 0;
    })
    .sort(function (a, b) {
      return b.primaryAuthorOpinionCount - a.primaryAuthorOpinionCount
        || b.opinionCount - a.opinionCount
        || b.mentionCount - a.mentionCount
        || a.firstFloor - b.firstFloor;
    });
}

function buildEntityOpinionChain(options) {
  const entity = options.entity;
  const mentions = (entity.mentions || []).slice().sort(compareByFloor);
  const linkedOpinions = linkOpinionsToEntity({
    entity,
    mentions,
    opinions: options.opinions,
    nearbyFloorWindow: options.nearbyFloorWindow
  });
  const timeline = buildTimeline({
    entity,
    mentions,
    linkedOpinions,
    postsByFloor: options.postsByFloor,
    primaryAuthorId: options.primaryAuthorId
  });
  const changeEvents = buildOpinionChangeEvents({
    timeline,
    primaryAuthorId: options.primaryAuthorId
  });
  const attitudeSummary = summarizeAttitudes(linkedOpinions);
  const firstFloor = timeline.length > 0 ? timeline[0].floor : mentions[0] && mentions[0].floor;
  const lastFloor = timeline.length > 0 ? timeline[timeline.length - 1].floor : mentions[mentions.length - 1] && mentions[mentions.length - 1].floor;

  return {
    key: entity.type + ':' + entity.normalized,
    entity: {
      type: entity.type,
      normalized: entity.normalized,
      displayName: entity.displayName,
      metadata: entity.metadata || {}
    },
    mentionCount: mentions.length,
    opinionCount: linkedOpinions.length,
    primaryAuthorOpinionCount: linkedOpinions.filter(function (item) {
      return item.opinion.authorId && item.opinion.authorId === options.primaryAuthorId;
    }).length,
    firstFloor,
    lastFloor,
    firstPublishedAt: firstTimestamp(timeline),
    lastPublishedAt: lastTimestamp(timeline),
    dominantAttitude: attitudeSummary.dominantAttitude,
    latestAttitude: latestAttitude(linkedOpinions),
    attitudeSummary,
    confidence: chainConfidence(linkedOpinions, mentions.length),
    evidenceLevels: summarizeEvidenceLevels(linkedOpinions),
    latestChange: changeEvents[changeEvents.length - 1],
    changeEvents,
    timeline: timeline.slice(0, 16),
    evidenceRefs: buildEvidenceRefs(linkedOpinions, mentions).slice(0, 12)
  };
}

function linkOpinionsToEntity(options) {
  return (options.opinions || [])
    .map(function (opinion) {
      return linkOpinionToEntity({
        opinion,
        entity: options.entity,
        mentions: options.mentions,
        nearbyFloorWindow: options.nearbyFloorWindow
      });
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return a.opinion.floor - b.opinion.floor || b.opinion.confidence - a.opinion.confidence;
    });
}

function linkOpinionToEntity(options) {
  const opinion = options.opinion;
  const mentionOnSameFloor = options.mentions.find(function (mention) {
    return mention.floor === opinion.floor;
  });
  if (mentionOnSameFloor) {
    return linkedOpinion(opinion, mentionOnSameFloor, 'explicit_entity_same_floor', 'explicit');
  }

  const evidenceText = opinion.evidence && opinion.evidence.text;
  const matchedMention = textMentionsEntity(evidenceText, options.entity, options.mentions);
  if (matchedMention) {
    return linkedOpinion(opinion, matchedMention, 'explicit_entity_text', 'explicit');
  }

  const nearbyMention = nearestNearbyMention(opinion, options.mentions, options.nearbyFloorWindow);
  if (nearbyMention) {
    return linkedOpinion(opinion, nearbyMention, 'nearby_same_author_context', 'inferred');
  }

  return undefined;
}

function linkedOpinion(opinion, mention, linkType, evidenceLevel) {
  return {
    opinion,
    matchedMention: mention,
    linkType,
    evidenceLevel
  };
}

function textMentionsEntity(text, entity, mentions) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return undefined;
  const tokens = entityTokens(entity);
  if (tokens.some(function (token) { return token && normalizedText.indexOf(token.toLowerCase()) >= 0; })) {
    return mentions[0];
  }
  return mentions.find(function (mention) {
    const mentionText = normalizeText(mention.evidenceText);
    return mentionText && normalizedText.indexOf(mentionText.toLowerCase()) >= 0;
  });
}

function entityTokens(entity) {
  const tokens = [entity.displayName, entity.normalized];
  if (entity.type === 'stock_code' && entity.normalized) {
    const parts = String(entity.normalized).split(':');
    tokens.push(parts[parts.length - 1]);
  }
  if (entity.metadata && entity.metadata.sourceThreadId) {
    tokens.push(entity.metadata.sourceThreadId);
  }
  return tokens.filter(Boolean).map(function (token) {
    return String(token).toLowerCase();
  });
}

function nearestNearbyMention(opinion, mentions, nearbyFloorWindow) {
  return mentions
    .filter(function (mention) {
      return opinion.authorId
        && mention.authorId
        && opinion.authorId === mention.authorId
        && Math.abs(mention.floor - opinion.floor) <= nearbyFloorWindow;
    })
    .sort(function (a, b) {
      return Math.abs(a.floor - opinion.floor) - Math.abs(b.floor - opinion.floor);
    })[0];
}

function buildTimeline(options) {
  const mentionEvents = options.mentions.map(function (mention) {
    const post = options.postsByFloor.get(mention.floor);
    return {
      eventType: 'entity-mention',
      evidenceLevel: 'explicit',
      floor: mention.floor,
      sourcePostId: post && post.sourcePostId,
      author: mention.author,
      authorId: mention.authorId,
      isPrimaryAuthor: Boolean(options.primaryAuthorId && mention.authorId === options.primaryAuthorId),
      publishedAt: mention.publishedAt,
      summary: mention.evidenceText,
      evidenceText: mention.excerpt
    };
  });
  const opinionEvents = options.linkedOpinions.map(function (item) {
    const opinion = item.opinion;
    return {
      eventType: 'opinion',
      evidenceLevel: item.evidenceLevel,
      linkType: item.linkType,
      floor: opinion.floor,
      sourcePostId: opinion.sourcePostId,
      author: opinion.author,
      authorId: opinion.authorId,
      isPrimaryAuthor: Boolean(options.primaryAuthorId && opinion.authorId === options.primaryAuthorId),
      publishedAt: opinion.publishedAt,
      attitude: opinion.attitude,
      confidence: opinion.confidence,
      horizon: opinion.horizon,
      conditionSignals: opinion.conditionSignals || [],
      matchedKeywords: opinion.matchedKeywords || [],
      summary: opinion.attitude,
      evidenceText: opinion.evidence && opinion.evidence.text,
      matchedEntityFloor: item.matchedMention && item.matchedMention.floor
    };
  });

  return mentionEvents.concat(opinionEvents).sort(function (a, b) {
    return a.floor - b.floor || eventOrder(a.eventType) - eventOrder(b.eventType);
  });
}

function eventOrder(eventType) {
  return eventType === 'entity-mention' ? 0 : 1;
}

function buildOpinionChangeEvents(options) {
  const opinionEvents = opinionTimeline(options.timeline, options.primaryAuthorId);
  const changes = [];
  for (let index = 1; index < opinionEvents.length; index += 1) {
    const previous = opinionEvents[index - 1];
    const current = opinionEvents[index];
    const change = classifyOpinionChange(previous, current);
    if (change) {
      changes.push(Object.assign(change, {
        fromFloor: previous.floor,
        toFloor: current.floor,
        fromPublishedAt: previous.publishedAt,
        toPublishedAt: current.publishedAt,
        fromEvidenceLevel: previous.evidenceLevel,
        toEvidenceLevel: current.evidenceLevel,
        confidence: changeConfidence(previous, current),
        evidenceRefs: [
          eventEvidenceRef(previous),
          eventEvidenceRef(current)
        ]
      }));
    }
  }
  return changes;
}

function opinionTimeline(timeline, primaryAuthorId) {
  const opinionEvents = (timeline || []).filter(function (event) {
    return event.eventType === 'opinion' && event.attitude && event.attitude !== 'disclaimer';
  });
  const primaryAuthorEvents = primaryAuthorId
    ? opinionEvents.filter(function (event) { return event.authorId === primaryAuthorId; })
    : [];
  return (primaryAuthorEvents.length >= 2 ? primaryAuthorEvents : opinionEvents)
    .sort(function (a, b) { return a.floor - b.floor; });
}

function classifyOpinionChange(previous, current) {
  const from = normalizeAttitude(previous.attitude);
  const to = normalizeAttitude(current.attitude);
  if (!from || !to || from === to) return undefined;

  if (from === 'watch' && to === 'bullish') {
    return change('watch_to_validation', 'positive', from, to, '观察信号转为验证或走强。');
  }
  if (from === 'bullish' && to === 'watch') {
    return change('bullish_to_wait', 'caution', from, to, '看多后转为等待确认。');
  }
  if (from === 'bullish' && to === 'risk') {
    return change('bullish_to_risk', 'caution', from, to, '看多后出现风险或不追提示。');
  }
  if (from === 'bullish' && to === 'bearish') {
    return change('bullish_to_bearish', 'negative', from, to, '看多转为看空或放弃。');
  }
  if ((from === 'risk' || from === 'bearish') && to === 'bullish') {
    return change('risk_to_recovery', 'positive', from, to, '风险或看空后重新出现走强信号。');
  }
  if (from === 'watch' && (to === 'risk' || to === 'bearish')) {
    return change('watch_to_risk', 'caution', from, to, '观察状态转为风险提示。');
  }
  if (from === 'risk' && to === 'watch') {
    return change('risk_to_wait', 'caution', from, to, '风险提示后转为等待确认。');
  }

  return change('attitude_shift', 'info', from, to, '观点态度发生变化。');
}

function change(changeType, severity, fromAttitude, toAttitude, summary) {
  return {
    changeType,
    severity,
    fromAttitude,
    toAttitude,
    summary
  };
}

function normalizeAttitude(value) {
  if (value === 'bullish' || value === 'bearish' || value === 'risk' || value === 'watch') return value;
  return undefined;
}

function changeConfidence(previous, current) {
  const base = ((previous.confidence || 0.5) + (current.confidence || 0.5)) / 2;
  const evidenceBoost = previous.evidenceLevel === 'explicit' && current.evidenceLevel === 'explicit' ? 0.08 : 0;
  return Math.min(0.95, Number((base + evidenceBoost).toFixed(2)));
}

function eventEvidenceRef(event) {
  return {
    floor: event.floor,
    author: event.author,
    authorId: event.authorId,
    publishedAt: event.publishedAt,
    attitude: event.attitude,
    confidence: event.confidence,
    evidenceLevel: event.evidenceLevel,
    excerpt: event.evidenceText
  };
}

function summarizeAttitudes(linkedOpinions) {
  const summary = {};
  linkedOpinions.forEach(function (item) {
    const attitude = item.opinion.attitude || 'unknown';
    summary[attitude] = (summary[attitude] || 0) + 1;
  });
  const dominantAttitude = Object.keys(summary).sort(function (a, b) {
    return summary[b] - summary[a] || a.localeCompare(b);
  })[0];
  return Object.assign({ dominantAttitude: dominantAttitude || 'unknown' }, summary);
}

function latestAttitude(linkedOpinions) {
  if (linkedOpinions.length === 0) return 'unknown';
  return linkedOpinions[linkedOpinions.length - 1].opinion.attitude || 'unknown';
}

function chainConfidence(linkedOpinions, mentionCount) {
  if (linkedOpinions.length === 0) return 0;
  const averageOpinionConfidence = linkedOpinions.reduce(function (total, item) {
    return total + (item.opinion.confidence || 0);
  }, 0) / linkedOpinions.length;
  const explicitCount = linkedOpinions.filter(function (item) {
    return item.evidenceLevel === 'explicit';
  }).length;
  const supportBoost = Math.min(0.12, mentionCount * 0.02 + linkedOpinions.length * 0.03);
  const explicitBoost = explicitCount > 0 ? 0.04 : -0.08;
  return Math.max(0, Math.min(0.97, Number((averageOpinionConfidence + supportBoost + explicitBoost).toFixed(2))));
}

function summarizeEvidenceLevels(linkedOpinions) {
  return linkedOpinions.reduce(function (summary, item) {
    summary[item.evidenceLevel] = (summary[item.evidenceLevel] || 0) + 1;
    return summary;
  }, { explicit: 0, inferred: 0 });
}

function buildEvidenceRefs(linkedOpinions, mentions) {
  const refs = [];
  linkedOpinions.forEach(function (item) {
    refs.push({
      type: 'opinion',
      evidenceLevel: item.evidenceLevel,
      floor: item.opinion.floor,
      author: item.opinion.author,
      authorId: item.opinion.authorId,
      publishedAt: item.opinion.publishedAt,
      attitude: item.opinion.attitude,
      confidence: item.opinion.confidence,
      excerpt: item.opinion.evidence && item.opinion.evidence.text
    });
  });
  mentions.slice(0, 4).forEach(function (mention) {
    refs.push({
      type: 'entity-mention',
      evidenceLevel: 'explicit',
      floor: mention.floor,
      author: mention.author,
      authorId: mention.authorId,
      publishedAt: mention.publishedAt,
      excerpt: mention.excerpt
    });
  });
  return refs.sort(compareByFloor);
}

function firstTimestamp(timeline) {
  const item = timeline.find(function (entry) { return entry.publishedAt; });
  return item && item.publishedAt;
}

function lastTimestamp(timeline) {
  const reversed = timeline.slice().reverse();
  const item = reversed.find(function (entry) { return entry.publishedAt; });
  return item && item.publishedAt;
}

function indexPostsByFloor(posts) {
  const byFloor = new Map();
  posts.forEach(function (post) {
    byFloor.set(post.floor, post);
  });
  return byFloor;
}

function compareByFloor(a, b) {
  return a.floor - b.floor;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

module.exports = {
  buildOpinionChains
};
