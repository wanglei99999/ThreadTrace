'use strict';

const ATTITUDE_RULES = [
  {
    attitude: 'risk',
    confidence: 0.72,
    keywords: ['风险', '别追', '谨慎', '回避', '不建议', '不要追', '止损', '跌破', '退潮', '小心']
  },
  {
    attitude: 'bullish',
    confidence: 0.66,
    keywords: ['看多', '走强', '突破', '机会', '反弹', '验证', '关注', '主线', '拉升', '启动']
  },
  {
    attitude: 'bearish',
    confidence: 0.62,
    keywords: ['看空', '走弱', '下跌', '杀跌', '破位', '放弃', '不看好']
  },
  {
    attitude: 'watch',
    confidence: 0.58,
    keywords: ['观望', '等待', '看量', '确认', '不急', '再看', '看看', '先看']
  }
];

const HORIZON_RULES = [
  { horizon: 'intraday', keywords: ['今天', '明天', '盘中', '早盘', '午后', '尾盘'] },
  { horizon: 'short_term', keywords: ['短线', '这几天', '最近', '本周', '近期'] },
  { horizon: 'mid_term', keywords: ['中线', '波段', '阶段'] },
  { horizon: 'long_term', keywords: ['长期', '长线', '几年', '体系'] }
];

function extractOpinionCandidates(posts, options) {
  const safeOptions = options || {};
  const minConfidence = typeof safeOptions.minConfidence === 'number' ? safeOptions.minConfidence : 0.5;

  return (posts || [])
    .map(function (post) {
      return extractOpinionFromPost(post);
    })
    .filter(function (candidate) {
      return candidate && candidate.confidence >= minConfidence;
    })
    .sort(function (a, b) {
      return b.confidence - a.confidence || a.floor - b.floor;
    });
}

function extractOpinionFromPost(post) {
  const text = normalizeText(post.contentText || '');
  if (!text) return undefined;

  const policyMatch = matchDiscussionPolicy(text);
  const attitudeMatch = matchAttitude(text);
  const conditionSignals = extractConditionSignals(text);
  const horizon = matchHorizon(text);
  const hasUsefulStructure = policyMatch || attitudeMatch || conditionSignals.length > 0 || horizon;

  if (!hasUsefulStructure) return undefined;
  if (!policyMatch && attitudeMatch && attitudeMatch.attitude === 'watch' && text.length < 20 && conditionSignals.length === 0) {
    return undefined;
  }
  if (!policyMatch && !attitudeMatch && text.length < 40) {
    return undefined;
  }

  const confidence = policyMatch
    ? calculatePolicyConfidence(policyMatch, post)
    : calculateConfidence(attitudeMatch, conditionSignals, horizon, post);

  return {
    floor: post.floor,
    sourcePostId: post.sourcePostId,
    author: post.author.displayName,
    authorId: post.author.sourceAuthorId,
    publishedAt: post.publishedAt,
    scope: policyMatch ? 'discussion_policy' : 'market_opinion',
    attitude: policyMatch ? 'disclaimer' : attitudeMatch ? attitudeMatch.attitude : 'unknown',
    confidence,
    matchedKeywords: policyMatch ? policyMatch.matchedKeywords : attitudeMatch ? attitudeMatch.matchedKeywords : [],
    horizon: horizon,
    conditionSignals,
    evidence: {
      text: excerpt(text, 220),
      links: post.links || [],
      relations: post.relations || []
    }
  };
}

function matchDiscussionPolicy(text) {
  const keywords = ['个人看法', '不做任何的指导', '没有任何别的渠道', '不单纯讨论个股', '这里只', '这里开帖子聊'];
  const matchedKeywords = keywords.filter(function (keyword) {
    return text.indexOf(keyword) >= 0;
  });

  return matchedKeywords.length > 0
    ? {
        matchedKeywords
      }
    : undefined;
}

function matchAttitude(text) {
  const matches = ATTITUDE_RULES
    .map(function (rule) {
      const matchedKeywords = rule.keywords.filter(function (keyword) {
        return text.indexOf(keyword) >= 0;
      });
      return matchedKeywords.length > 0
        ? {
            attitude: rule.attitude,
            confidence: rule.confidence,
            matchedKeywords
          }
        : undefined;
    })
    .filter(Boolean);

  if (matches.length === 0) return undefined;
  return matches.sort(function (a, b) {
    return b.confidence - a.confidence || b.matchedKeywords.length - a.matchedKeywords.length;
  })[0];
}

function matchHorizon(text) {
  const match = HORIZON_RULES.find(function (rule) {
    return rule.keywords.some(function (keyword) {
      return text.indexOf(keyword) >= 0;
    });
  });
  return match ? match.horizon : undefined;
}

function extractConditionSignals(text) {
  const signals = [];
  const patterns = [
    /如果[^。！？；;]{1,40}/g,
    /要是[^。！？；;]{1,40}/g,
    /除非[^。！？；;]{1,40}/g,
    /只要[^。！？；;]{1,40}/g,
    /看量[^。！？；;]{0,30}/g,
    /确认[^。！？；;]{0,30}/g,
    /放量[^。！？；;]{0,30}/g,
    /缩量[^。！？；;]{0,30}/g
  ];

  patterns.forEach(function (pattern) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const signal = match[0].trim();
      if (signal && signals.indexOf(signal) < 0) {
        signals.push(signal);
      }
    }
  });

  return signals.slice(0, 8);
}

function calculatePolicyConfidence(policyMatch, post) {
  let confidence = 0.72 + Math.min(0.12, policyMatch.matchedKeywords.length * 0.03);
  if (post.floor === 0) confidence += 0.07;
  if (post.score >= 10) confidence += 0.03;
  return Math.min(0.95, Number(confidence.toFixed(2)));
}

function calculateConfidence(attitudeMatch, conditionSignals, horizon, post) {
  let confidence = attitudeMatch ? attitudeMatch.confidence : 0.48;

  if (conditionSignals.length > 0) confidence += Math.min(0.12, conditionSignals.length * 0.04);
  if (horizon) confidence += 0.04;
  if (post.floor === 0) confidence += 0.04;
  if (post.score >= 10) confidence += 0.04;
  if ((post.links || []).length > 0) confidence += 0.03;
  if ((post.relations || []).length > 0) confidence += 0.03;

  return Math.min(0.95, Number(confidence.toFixed(2)));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function excerpt(value, maxLength) {
  const text = normalizeText(value);
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '...' : text;
}

module.exports = {
  extractOpinionCandidates
};
