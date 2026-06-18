'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertSourceRepository } = require('../../application/ports/sourceRepository');

function createFileSourceRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'sources'));

  const repository = {
    async saveSource(source) {
      const filePath = sourcePath(baseDir, source.id);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(source, null, 2) + '\n', 'utf8');
    },

    async findSource(id) {
      try {
        const text = await fs.readFile(sourcePath(baseDir, id), 'utf8');
        return JSON.parse(text);
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listSources(query) {
      const safeQuery = query || {};
      const files = await listSourceFiles(baseDir);
      const sources = [];

      for (const filePath of files) {
        const source = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (safeQuery.sourceKey && source.sourceKey !== safeQuery.sourceKey) continue;
        if (typeof safeQuery.enabled === 'boolean' && source.enabled !== safeQuery.enabled) continue;
        sources.push(source);
      }

      return sources
        .sort(function (a, b) {
          return String(a.displayName || a.id).localeCompare(String(b.displayName || b.id));
        })
        .slice(0, safeQuery.limit || sources.length);
    }
  };

  return assertSourceRepository(repository);
}

function sourcePath(baseDir, id) {
  return path.join(baseDir, safeSegment(id) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function listSourceFiles(baseDir) {
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
  createFileSourceRepository
};
