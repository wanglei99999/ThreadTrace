'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertRetrievalIndex } = require('../../application/ports/retrievalIndex');

function createFileTextRetrievalIndex(options) {
  const indexFile = path.resolve((options && options.indexFile) || path.join(process.cwd(), 'data', 'store', 'retrieval', 'documents.json'));

  const index = {
    async upsertDocuments(documents) {
      const existing = await readDocuments(indexFile);
      const byId = new Map(existing.map(function (document) {
        return [document.id, document];
      }));
      (documents || []).forEach(function (document) {
        byId.set(document.id, {
          id: document.id,
          text: document.text || '',
          metadata: document.metadata || {},
          indexedAt: new Date().toISOString()
        });
      });
      await fs.mkdir(path.dirname(indexFile), { recursive: true });
      await fs.writeFile(indexFile, JSON.stringify(Array.from(byId.values()), null, 2) + '\n', 'utf8');
    },

    async search(query) {
      const documents = await readDocuments(indexFile);
      const tokens = tokenize(query.text || '');
      const limit = query.limit || 10;
      const filter = query.filter || {};

      return documents
        .filter(function (document) {
          return matchesFilter(document, filter);
        })
        .map(function (document) {
          return scoreDocument(document, tokens);
        })
        .filter(function (result) {
          return result.score > 0;
        })
        .sort(function (a, b) {
          return b.score - a.score || String(a.id).localeCompare(String(b.id));
        })
        .slice(0, limit);
    }
  };

  return assertRetrievalIndex(index);
}

async function readDocuments(indexFile) {
  try {
    return JSON.parse(await fs.readFile(indexFile, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

function matchesFilter(document, filter) {
  return Object.keys(filter).every(function (key) {
    return filter[key] === undefined || document.metadata[key] === filter[key];
  });
}

function scoreDocument(document, tokens) {
  const text = normalize(document.text);
  const metadataBoost = typeof document.metadata.score === 'number'
    ? Math.min(2, Math.log10(Math.max(1, document.metadata.score)))
    : 0;
  let score = 0;
  const reasons = [];

  tokens.forEach(function (token) {
    if (!token) return;
    const count = countOccurrences(text, token);
    if (count > 0) {
      const tokenScore = token.length >= 2 ? count * Math.min(5, token.length) : count;
      score += tokenScore;
      reasons.push('match:' + token);
    }
  });

  if (score > 0) score += metadataBoost;

  return {
    id: document.id,
    score: Number(score.toFixed(3)),
    text: excerpt(document.text, 260),
    metadata: document.metadata,
    reasons
  };
}

function tokenize(value) {
  const text = normalize(value);
  const asciiTokens = text.match(/[a-z0-9_./:-]+/g) || [];
  const cjkTokens = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const cjkBigrams = [];

  cjkTokens.forEach(function (token) {
    cjkBigrams.push(token);
    for (let index = 0; index < token.length - 1; index += 1) {
      cjkBigrams.push(token.slice(index, index + 2));
    }
  });

  return Array.from(new Set(asciiTokens.concat(cjkBigrams)));
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function countOccurrences(text, token) {
  let count = 0;
  let index = text.indexOf(token);
  while (index >= 0) {
    count += 1;
    index = text.indexOf(token, index + token.length);
  }
  return count;
}

function excerpt(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '...' : text;
}

module.exports = {
  createFileTextRetrievalIndex
};
