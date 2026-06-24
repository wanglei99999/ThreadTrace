'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertWorkerRunRepository } = require('../../application/ports/workerRunRepository');
const { deriveWorkerRunSourceScope } = require('../../domain/models/workerRun');

function createFileWorkerRunRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'worker-runs'));

  const repository = {
    async saveWorkerRun(run) {
      const filePath = workerRunPath(baseDir, run.id);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(run, null, 2) + '\n', 'utf8');
    },

    async findWorkerRun(id) {
      try {
        const text = await fs.readFile(workerRunPath(baseDir, id), 'utf8');
        return JSON.parse(text);
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listWorkerRuns(query) {
      const safeQuery = query || {};
      const files = await listWorkerRunFiles(baseDir);
      const runs = [];

      for (const filePath of files) {
        const run = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (safeQuery.workerType && run.workerType !== safeQuery.workerType) continue;
        if (safeQuery.status && run.status !== safeQuery.status) continue;
        const scope = deriveWorkerRunSourceScope(run);
        if (safeQuery.sourceId && scope.sourceId !== safeQuery.sourceId) continue;
        if (safeQuery.sourceKey && scope.sourceKey !== safeQuery.sourceKey) continue;
        runs.push(run);
      }

      return runs
        .sort(function (a, b) {
          return String(b.startedAt || '').localeCompare(String(a.startedAt || ''));
        })
        .slice(0, safeQuery.limit || runs.length);
    }
  };

  return assertWorkerRunRepository(repository);
}

function workerRunPath(baseDir, id) {
  return path.join(baseDir, safeSegment(id) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function listWorkerRunFiles(baseDir) {
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
  createFileWorkerRunRepository
};
