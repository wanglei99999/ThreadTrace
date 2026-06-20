'use strict';

const DEFAULT_NEARBY_FLOOR_WINDOW = 3;

const IMPLICIT_REFERENCE_RULES = [
  {
    category: 'implicit_target',
    label: '隐含对象',
    confidence: 0.62,
    pattern: /(?:那个|这个|这条|那条|前面那个|之前那个)(?:方向|线|主线|票|股|位置|标的)/g
  },
  {
    category: 'historical_continuity',
    label: '历史延续',
    confidence: 0.64,
    pattern: /(?:前面|之前|昨天|上次|早上|刚才)(?:说|讲|提|聊|看的)[^。！？；;]{0,18}/g
  },
  {
    category: 'condition',
    label: '条件确认',
    confidence: 0.6,
    pattern: /(?:看量|量能|放量|缩量|确认|验证|走出来)[^。！？；;]{0,18}/g
  },
  {
    category: 'risk_control',
    label: '风险控制',
    confidence: 0.6,
    pattern: /(?:别追|不要追|不急|等一等|再等等|小心|谨慎)[^。！？；;]{0,18}/g
  },
  {
    category: 'nickname',
    label: '作者别称',
    confidence: 0.56,
    pattern: /(?:老地方|老情人|老朋友|药里那个|中字头那个)[^。！？；;]{0,18}/g
  }
];

function extractImplicitReferenceCandidates(posts, options) {
  const safeOptions = options || {};
  const nearbyFloorWindow = typeof safeOptions.nearbyFloorWindow === 'number'
    ? safeOptions.nearbyFloorWindow
    : DEFAULT_NEARBY_FLOOR_WINDOW;
  const candidates = [];
  const seen = new Set();

  (posts || []).forEach(function (post) {
    const text = normalizeText(post.contentText);
    if (!text) return;
    IMPLICIT_REFERENCE_RULES.forEach(function (rule) {
      collectRuleMatches({
        rule,
        text,
        post,
        seen,
        candidates,
        entityCandidates: safeOptions.entityCandidates || [],
        opinionCandidates: safeOptions.opinionCandidates || [],
        nearbyFloorWindow
      });
    });
  });

  return candidates.sort(function (a, b) {
    return b.confidence - a.confidence || a.floor - b.floor || a.phrase.localeCompare(b.phrase);
  }).slice(0, 50);
}

function collectRuleMatches(options) {
  options.rule.pattern.lastIndex = 0;
  let match;
  while ((match = options.rule.pattern.exec(options.text)) !== null) {
    const phrase = normalizeText(match[0]);
    if (!phrase || phrase.length < 2) continue;
    const key = options.post.floor + ':' + options.rule.category + ':' + phrase;
    if (options.seen.has(key)) continue;
    options.seen.add(key);
    options.candidates.push(candidateFromMatch({
      rule: options.rule,
      phrase,
      post: options.post,
      entityCandidates: options.entityCandidates,
      opinionCandidates: options.opinionCandidates,
      nearbyFloorWindow: options.nearbyFloorWindow
    }));
  }
}

function candidateFromMatch(options) {
  const nearbyEntities = findNearbyEntities({
    post: options.post,
    entityCandidates: options.entityCandidates,
    nearbyFloorWindow: options.nearbyFloorWindow
  });
  const sameFloorOpinions = findSameFloorOpinions(options.post, options.opinionCandidates);
  const supportBoost = Math.min(0.16, nearbyEntities.length * 0.04 + sameFloorOpinions.length * 0.04);

  return {
    floor: options.post.floor,
    sourcePostId: options.post.sourcePostId,
    author: options.post.author.displayName,
    authorId: options.post.author.sourceAuthorId,
    publishedAt: options.post.publishedAt,
    phrase: options.phrase,
    category: options.rule.category,
    label: options.rule.label,
    confidence: Math.min(0.92, Number((options.rule.confidence + supportBoost).toFixed(2))),
    evidenceText: excerpt(options.post.contentText, 220),
    nearbyEntities: nearbyEntities.slice(0, 5),
    sameFloorOpinions: sameFloorOpinions.slice(0, 3)
  };
}

function findNearbyEntities(options) {
  const post = options.post;
  const entities = [];
  (options.entityCandidates || []).forEach(function (entity) {
    const mentions = (entity.mentions || []).filter(function (mention) {
      return Math.abs(mention.floor - post.floor) <= options.nearbyFloorWindow
        && (!mention.authorId || !post.author.sourceAuthorId || mention.authorId === post.author.sourceAuthorId || mention.floor === post.floor);
    }).sort(function (a, b) {
      return Math.abs(a.floor - post.floor) - Math.abs(b.floor - post.floor);
    });
    if (mentions.length === 0) return;
    entities.push({
      key: entity.type + ':' + entity.normalized,
      displayName: entity.displayName,
      type: entity.type,
      evidenceLevel: mentions[0].floor === post.floor ? 'explicit' : 'inferred',
      floor: mentions[0].floor,
      excerpt: mentions[0].excerpt
    });
  });
  return entities.sort(function (a, b) {
    return evidenceRank(a.evidenceLevel) - evidenceRank(b.evidenceLevel) || Math.abs(a.floor - post.floor) - Math.abs(b.floor - post.floor);
  });
}

function findSameFloorOpinions(post, opinionCandidates) {
  return (opinionCandidates || []).filter(function (opinion) {
    return opinion.floor === post.floor;
  }).map(function (opinion) {
    return {
      attitude: opinion.attitude,
      confidence: opinion.confidence,
      matchedKeywords: opinion.matchedKeywords || [],
      conditionSignals: opinion.conditionSignals || []
    };
  });
}

function evidenceRank(value) {
  return value === 'explicit' ? 0 : 1;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function excerpt(value, maxLength) {
  const text = normalizeText(value);
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '...' : text;
}

module.exports = {
  extractImplicitReferenceCandidates
};
