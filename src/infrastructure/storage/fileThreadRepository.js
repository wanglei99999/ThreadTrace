'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertThreadRepository } = require('../../application/ports/threadRepository');

function createFileThreadRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'threads'));

  const repository = {
    async saveSnapshot(snapshot) {
      const filePath = snapshotPath(baseDir, snapshot.sourceKey, snapshot.sourceThreadId);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    },

    async findSnapshot(query) {
      const filePath = snapshotPath(baseDir, query.sourceKey, query.sourceThreadId);
      try {
        const text = await fs.readFile(filePath, 'utf8');
        return JSON.parse(text);
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listSnapshots(query) {
      const safeQuery = query || {};
      const sourceDirs = safeQuery.sourceKey
        ? [path.join(baseDir, safeSegment(safeQuery.sourceKey))]
        : await listExistingDirs(baseDir);
      const snapshots = [];

      for (const sourceDir of sourceDirs) {
        const files = await listJsonFiles(sourceDir);
        for (const filePath of files) {
          const snapshot = JSON.parse(await fs.readFile(filePath, 'utf8'));
          if (safeQuery.authorId && !snapshotHasAuthor(snapshot, safeQuery.authorId)) continue;
          snapshots.push(snapshot);
        }
      }

      return snapshots
        .sort(function (a, b) {
          return String(a.sourceThreadId).localeCompare(String(b.sourceThreadId));
        })
        .slice(0, safeQuery.limit || snapshots.length);
    }
  };

  return assertThreadRepository(repository);
}

function snapshotPath(baseDir, sourceKey, sourceThreadId) {
  return path.join(baseDir, safeSegment(sourceKey), safeSegment(sourceThreadId) + '.json');
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

function snapshotHasAuthor(snapshot, authorId) {
  return (snapshot.posts || []).some(function (post) {
    return post.author && post.author.sourceAuthorId === authorId;
  });
}

module.exports = {
  createFileThreadRepository
};
