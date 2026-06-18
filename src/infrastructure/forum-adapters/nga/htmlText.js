'use strict';

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  zwnj: '',
  zwj: ''
};

function decodeHtmlEntities(value) {
  if (!value) return '';
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, function (_, token) {
    if (token.charAt(0) === '#') {
      const isHex = token.charAt(1).toLowerCase() === 'x';
      const numberText = isHex ? token.slice(2) : token.slice(1);
      const codePoint = parseInt(numberText, isHex ? 16 : 10);
      if (Number.isFinite(codePoint)) {
        try {
          return String.fromCodePoint(codePoint);
        } catch (error) {
          return '';
        }
      }
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, token)
      ? NAMED_ENTITIES[token]
      : '&' + token + ';';
  });
}

function stripTags(html) {
  if (!html) return '';

  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<span\b[^>]*class=["'][^"']*\burltip\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<img\b[^>]*(?:alt|title)=["']([^"']+)["'][^>]*>/gi, ' [$1] ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<\/div\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\u200b/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractLinks(html) {
  const links = [];
  if (!html) return links;

  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    links.push({
      url: decodeHtmlEntities(match[1]).trim(),
      text: stripTags(match[2])
    });
  }
  return links;
}

function extractInnerById(html, id) {
  const startPattern = new RegExp("<([a-zA-Z0-9]+)\\b[^>]*\\bid=[\"']" + escapeRegExp(id) + "[\"'][^>]*>", 'i');
  const startMatch = startPattern.exec(html);
  if (!startMatch) return '';

  const tagName = startMatch[1].toLowerCase();
  const openEnd = startMatch.index + startMatch[0].length;
  const tagPattern = new RegExp('<\\/?' + tagName + '\\b[^>]*>', 'gi');
  tagPattern.lastIndex = openEnd;

  let depth = 1;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const isClosing = /^<\//.test(match[0]);
    depth += isClosing ? -1 : 1;
    if (depth === 0) {
      return html.slice(openEnd, match.index);
    }
  }

  return html.slice(openEnd);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  decodeHtmlEntities,
  extractInnerById,
  extractLinks,
  stripTags
};
