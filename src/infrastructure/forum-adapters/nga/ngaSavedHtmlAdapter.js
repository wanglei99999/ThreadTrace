'use strict';

const { createThreadSnapshot } = require('../../../domain/models/threadSnapshot');
const { decodeHtmlEntities, extractInnerById, extractLinks, stripTags } = require('./htmlText');

const SOURCE_KEY = 'nga';

function parseSavedHtml(html, context) {
  const safeContext = context || {};
  const sourceThreadId = firstMatch(html, /__CURRENT_TID\s*=\s*parseInt\('([^']+)'/i)
    || firstMatch(html, /__CURRENT_TID\s*=\s*(\d+)/i)
    || firstMatch(html, /read\.php\?tid=(\d+)/i)
    || safeContext.sourceThreadId
    || '';

  const title = cleanupTitle(
    firstMatch(html, /<title>([\s\S]*?)<\/title>/i)
      || firstMatch(html, /<h3\b[^>]*id=["']postsubject0["'][^>]*>([\s\S]*?)<\/h3>/i)
      || safeContext.title
      || ''
  );

  const totalPages = parseInt(
    firstMatch(html, /title=["']最后页 第(\d+)页["']/i) || '',
    10
  ) || undefined;

  const page = parseInt(firstMatch(html, /__CURRENT_PAGE\s*=\s*(\d+)/i) || '', 10) || undefined;
  const url = safeContext.url || firstMatch(html, /saved from url=\(([^)]+)\)/i);
  const posts = parsePosts(html);

  return createThreadSnapshot({
    forum: {
      sourceKey: SOURCE_KEY,
      displayName: 'NGA 玩家社区',
      url: 'https://bbs.nga.cn'
    },
    sourceKey: SOURCE_KEY,
    sourceThreadId,
    title,
    url,
    page,
    totalPages,
    posts,
    metadata: {
      adapter: 'ngaSavedHtmlAdapter',
      parsedAt: new Date().toISOString(),
      sourceFile: safeContext.sourceFile
    }
  });
}

function parsePosts(html) {
  const floors = collectPostFloors(html);
  return floors.map(function (floor) {
    const authorHtml = extractInnerById(html, 'postauthor' + floor);
    const posterInfoHtml = extractInnerById(html, 'posterinfo' + floor);
    const subjectHtml = extractInnerById(html, 'postsubject' + floor);
    const contentHtml = extractInnerById(html, 'postcontent' + floor);
    const postInfoHtml = extractInnerById(html, 'postInfo' + floor);
    const containerHtml = extractInnerById(html, 'postcontainer' + floor);

    const uid = firstMatch(posterInfoHtml, /uid=(\d+)/i)
      || firstMatch(posterInfoHtml, /name=["']uid["'][^>]*>(\d+)</i)
      || '';

    return {
      sourceKey: SOURCE_KEY,
      sourcePostId: firstMatch(containerHtml, /pid(\d+)Anchor/i) || SOURCE_KEY + ':' + floor,
      floor,
      subject: stripTags(subjectHtml),
      author: {
        sourceKey: SOURCE_KEY,
        sourceAuthorId: uid,
        displayName: stripTags(authorHtml),
        metadata: {}
      },
      publishedAt: stripTags(extractInnerById(postInfoHtml, 'postdate' + floor)) || undefined,
      contentText: stripTags(contentHtml),
      contentHtml,
      links: extractLinks(contentHtml),
      score: parseScore(html, floor),
      metadata: {
        platform: parsePlatform(postInfoHtml)
      }
    };
  });
}

function collectPostFloors(html) {
  const floors = new Set();
  const pattern = /\bid=["']postcontent(\d+)["']/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    floors.add(parseInt(match[1], 10));
  }
  return Array.from(floors).sort(function (a, b) {
    return a - b;
  });
}

function parseScore(html, floor) {
  const blockStart = html.indexOf('id="postcontentandsubject' + floor + '"');
  const contentStart = html.indexOf('id="postcontent' + floor + '"');
  if (blockStart < 0 || contentStart < blockStart) return undefined;
  const block = html.slice(blockStart, contentStart);
  const scoreText = stripTags(firstMatch(block, /<span\b[^>]*class=["'][^"']*\brecommendvalue\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || '');
  const score = parseInt(scoreText, 10);
  return Number.isFinite(score) ? score : undefined;
}

function parsePlatform(postInfoHtml) {
  const title = firstMatch(postInfoHtml, /title=["']发送自([^"']+)["']/i);
  return title ? title.trim() : undefined;
}

function cleanupTitle(value) {
  return stripTags(decodeHtmlEntities(value)).replace(/\s*NGA玩家社区\s*$/i, '').trim();
}

function firstMatch(value, pattern) {
  const match = pattern.exec(value || '');
  return match ? decodeHtmlEntities(match[1]) : '';
}

module.exports = {
  sourceKey: SOURCE_KEY,
  parseSavedHtml
};
