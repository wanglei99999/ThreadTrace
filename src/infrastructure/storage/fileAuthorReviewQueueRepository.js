'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertAuthorReviewQueueRepository } = require('../../application/ports/authorReviewQueueRepository');

function createFileAuthorReviewQueueRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'author-review-queue'));

  const repository = {
    async saveItem(item) {
      const filePath = itemPath(baseDir, item.id);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(item, null, 2) + '\n', 'utf8');
    },

    async findItem(id) {
      try {
        const text = await fs.readFile(itemPath(baseDir, id), 'utf8');
        return JSON.parse(text);
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listItems(query) {
      const safeQuery = query || {};
      const files = await listItemFiles(baseDir);
      const items = [];

      for (const filePath of files) {
        const item = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (safeQuery.status && item.status !== safeQuery.status) continue;
        if (safeQuery.sourceKey && item.sourceKey !== safeQuery.sourceKey) continue;
        if (safeQuery.sourceThreadId && item.sourceThreadId !== safeQuery.sourceThreadId) continue;
        if (safeQuery.type && item.type !== safeQuery.type) continue;
        if (safeQuery.priority && item.priority !== safeQuery.priority) continue;
        items.push(item);
      }

      return items
        .sort(function (a, b) {
          return String(b.updatedAt || b.lastSeenAt || '').localeCompare(String(a.updatedAt || a.lastSeenAt || ''));
        })
        .slice(0, safeQuery.limit || items.length);
    }
  };

  return assertAuthorReviewQueueRepository(repository);
}

function itemPath(baseDir, id) {
  return path.join(baseDir, safeSegment(id) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function listItemFiles(baseDir) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries
      .filter(function (entry) {
        return entry.isFile() && /\.json$/i.test(entry.name);
      })
      .map(function (entry) {
        return path.join(baseDir, entry.name);
      });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

module.exports = {
  createFileAuthorReviewQueueRepository
};
