'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertSourceRepository } = require('../../application/ports/sourceRepository');
const {
  markTrackedSourceRunStarted,
  isTrackedSourceRunStale
} = require('../../domain/models/trackedSource');

const DEFAULT_TRANSITION_LOCK_STALE_AFTER_MS = 60 * 1000;

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
        if (safeQuery.sourceType && source.sourceType !== safeQuery.sourceType) continue;
        if (typeof safeQuery.enabled === 'boolean' && source.enabled !== safeQuery.enabled) continue;
        sources.push(source);
      }

      return sources
        .sort(function (a, b) {
          return String(a.displayName || a.id).localeCompare(String(b.displayName || b.id));
        })
        .slice(0, safeQuery.limit || sources.length);
    },

    async acquireSourceRun(request) {
      const safeRequest = request || {};
      const lock = await acquireTransitionLock(baseDir, safeRequest);
      if (!lock.acquired) {
        return {
          acquired: false,
          reason: 'transition-lock-held'
        };
      }

      try {
        const source = await repository.findSource(safeRequest.sourceId);
        if (!source) {
          return {
            acquired: false,
            reason: 'unknown-source'
          };
        }
        if (isActiveRunningSource(source, safeRequest)) {
          return {
            acquired: false,
            source
          };
        }

        const runningSource = markTrackedSourceRunStarted(source, safeRequest.now);
        await repository.saveSource(runningSource);
        return {
          acquired: true,
          source: runningSource
        };
      } finally {
        await releaseTransitionLock(lock.filePath);
      }
    }
  };

  return assertSourceRepository(repository);
}

function sourcePath(baseDir, id) {
  return path.join(baseDir, safeSegment(id) + '.json');
}

function sourceRunTransitionLockPath(baseDir, id) {
  return path.join(baseDir, '.locks', safeSegment(id) + '.run-transition.lock');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function isActiveRunningSource(source, request) {
  const runState = source.runState || {};
  if (runState.status !== 'running') return false;
  return !isTrackedSourceRunStale(runState, {
    now: request.now,
    staleAfterMs: request.staleAfterMs
  });
}

async function acquireTransitionLock(baseDir, request) {
  const filePath = sourceRunTransitionLockPath(baseDir, request.sourceId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = {
    sourceId: request.sourceId,
    createdAt: request.now || new Date().toISOString()
  };

  try {
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    return {
      acquired: true,
      filePath
    };
  } catch (error) {
    if (!error || error.code !== 'EEXIST') throw error;
  }

  const existing = await readTransitionLock(filePath);
  if (isStaleTransitionLock(existing, request)) {
    await releaseTransitionLock(filePath);
    try {
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
      return {
        acquired: true,
        filePath
      };
    } catch (error) {
      if (!error || error.code !== 'EEXIST') throw error;
    }
  }

  return {
    acquired: false,
    filePath
  };
}

async function readTransitionLock(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return undefined;
    return undefined;
  }
}

function isStaleTransitionLock(lock, request) {
  if (!lock || !lock.createdAt) return true;
  const createdTime = Date.parse(lock.createdAt);
  const nowTime = Date.parse(request.now || new Date().toISOString());
  if (Number.isNaN(createdTime) || Number.isNaN(nowTime)) return true;
  return nowTime - createdTime > DEFAULT_TRANSITION_LOCK_STALE_AFTER_MS;
}

async function releaseTransitionLock(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
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
