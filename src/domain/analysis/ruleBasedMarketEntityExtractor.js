'use strict';

const DEFAULT_TOPIC_KEYWORDS = [
  'AI',
  '半导体',
  '芯片',
  '科技',
  '算力',
  '机器人',
  '软件',
  '医药',
  '创新药',
  '中字头',
  '央企',
  '大金融',
  '券商',
  '军工',
  '新能源',
  '光伏',
  '消费',
  '地产',
  '低空经济'
];

function extractMarketEntities(posts, options) {
  const safeOptions = options || {};
  const topicKeywords = safeOptions.topicKeywords || DEFAULT_TOPIC_KEYWORDS;
  const entityMap = new Map();

  (posts || []).forEach(function (post) {
    const text = post.contentText || '';
    collectStockCodes(entityMap, text, post);
    collectTopicKeywords(entityMap, text, post, topicKeywords);
    collectThreadLinks(entityMap, post);
  });

  return Array.from(entityMap.values()).sort(function (a, b) {
    return b.mentions.length - a.mentions.length || a.normalized.localeCompare(b.normalized);
  });
}

function collectStockCodes(entityMap, text, post) {
  const pattern = /\b(?:(SH|SZ|BJ)\s*)?((?:000|001|002|003|300|301|600|601|603|605|688|689|830|831|832|833|834|835|836|837|838|839|870|871|872|873|874|875|876|877|878|879|920)\d{3})\b/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const exchange = match[1] ? match[1].toUpperCase() : inferExchange(match[2]);
    addMention(entityMap, {
      type: 'stock_code',
      normalized: exchange + ':' + match[2],
      displayName: (exchange ? exchange + ' ' : '') + match[2],
      evidenceText: match[0],
      post
    });
  }
}

function collectTopicKeywords(entityMap, text, post, topicKeywords) {
  topicKeywords.forEach(function (keyword) {
    if (text.indexOf(keyword) >= 0) {
      addMention(entityMap, {
        type: 'topic_keyword',
        normalized: keyword.toLowerCase(),
        displayName: keyword,
        evidenceText: keyword,
        post
      });
    }
  });
}

function collectThreadLinks(entityMap, post) {
  (post.links || []).forEach(function (link) {
    const tidMatch = /[?&]tid=(\d+)/i.exec(link.url || '');
    if (!tidMatch) return;

    addMention(entityMap, {
      type: 'forum_thread',
      normalized: 'nga:thread:' + tidMatch[1],
      displayName: 'NGA 主题 ' + tidMatch[1],
      evidenceText: link.text || link.url,
      post,
      metadata: {
        url: link.url,
        sourceThreadId: tidMatch[1]
      }
    });
  });
}

function addMention(entityMap, mentionInput) {
  const key = mentionInput.type + ':' + mentionInput.normalized;
  if (!entityMap.has(key)) {
    entityMap.set(key, {
      type: mentionInput.type,
      normalized: mentionInput.normalized,
      displayName: mentionInput.displayName,
      metadata: mentionInput.metadata || {},
      mentions: []
    });
  }

  entityMap.get(key).mentions.push({
    floor: mentionInput.post.floor,
    author: mentionInput.post.author.displayName,
    authorId: mentionInput.post.author.sourceAuthorId,
    publishedAt: mentionInput.post.publishedAt,
    evidenceText: mentionInput.evidenceText,
    excerpt: excerptAround(mentionInput.post.contentText || '', mentionInput.evidenceText)
  });
}

function inferExchange(code) {
  if (/^(600|601|603|605|688|689)/.test(code)) return 'SH';
  if (/^(830|831|832|833|834|835|836|837|838|839|870|871|872|873|874|875|876|877|878|879|920)/.test(code)) return 'BJ';
  return 'SZ';
}

function excerptAround(text, needle) {
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
  const index = normalizedText.indexOf(needle);
  if (index < 0) {
    return normalizedText.slice(0, 160);
  }
  const start = Math.max(0, index - 70);
  const end = Math.min(normalizedText.length, index + String(needle).length + 70);
  return (start > 0 ? '...' : '') + normalizedText.slice(start, end) + (end < normalizedText.length ? '...' : '');
}

module.exports = {
  DEFAULT_TOPIC_KEYWORDS,
  extractMarketEntities
};
