'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertRawThreadPageRepository } = require('../../application/ports/rawThreadPageRepository');

function createFileRawThreadPageRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'raw-pages'));

  const repository = {
    async saveRawThreadPage(page) {
      const filePath = rawPagePath(baseDir, page.sourceKey, page.contentSha1);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(page, null, 2) + '\n', 'utf8');
    },

    async findRawThreadPageByHash(query) {
      try {
        const text = await fs.readFile(rawPagePath(baseDir, query.sourceKey, query.contentSha1), 'utf8');
        return JSON.parse(text);
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listRawThreadPages(query) {
      const safeQuery = query || {};
      const sourceDirs = safeQuery.sourceKey
        ? [path.join(baseDir, safeSegment(safeQuery.sourceKey))]
        : await listExistingDirs(baseDir);
      const pages = [];

      for (const sourceDir of sourceDirs) {
        const files = await listJsonFiles(sourceDir);
        for (const filePath of files) {
          const page = JSON.parse(await fs.readFile(filePath, 'utf8'));
          if (safeQuery.sourceThreadId && page.sourceThreadId !== safeQuery.sourceThreadId) continue;
          if (safeQuery.sourceUrl && page.sourceUrl !== safeQuery.sourceUrl) continue;
          pages.push(page);
        }
      }

      return pages
        .sort(function (a, b) {
          return String(b.fetchedAt || '').localeCompare(String(a.fetchedAt || ''));
        })
        .slice(0, safeQuery.limit || pages.length);
    }
  };

  return assertRawThreadPageRepository(repository);
}

function rawPagePath(baseDir, sourceKey, contentSha1) {
  return path.join(baseDir, safeSegment(sourceKey), safeSegment(contentSha1) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function listExistingDirs(baseDir) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries.filter(function (entry) {
      return entry.isDirectory();
    }).map(function (entry) {
      return path.join(baseDir, entry.name);
    });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function listJsonFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(function (entry) {
      return entry.isFile() && /\.json$/i.test(entry.name);
    }).map(function (entry) {
      return path.join(dir, entry.name);
    });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

module.exports = {
  createFileRawThreadPageRepository
};
