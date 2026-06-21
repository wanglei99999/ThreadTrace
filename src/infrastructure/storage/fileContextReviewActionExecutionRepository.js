'use strict';

const fs = require('fs/promises');
const path = require('path');
const {
  assertContextReviewActionExecutionRepository
} = require('../../application/ports/contextReviewActionExecutionRepository');

function createFileContextReviewActionExecutionRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'review-action-executions'));

  const repository = {
    async claimExecution(record) {
      const safeRecord = record || {};
      const key = safeRecord.key;
      if (!key) throw new Error('Context review action execution record requires key.');
      const filePath = executionPath(baseDir, key);
      const payload = Object.assign({}, safeRecord, {
        status: 'running',
        attemptCount: 1,
        createdAt: safeRecord.createdAt || safeRecord.now || new Date().toISOString(),
        updatedAt: safeRecord.updatedAt || safeRecord.now || new Date().toISOString()
      });

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      try {
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', {
          encoding: 'utf8',
          flag: 'wx'
        });
        return {
          claimed: true,
          record: payload
        };
      } catch (error) {
        if (!error || error.code !== 'EEXIST') throw error;
      }

      const existing = await readExecution(filePath);
      if (existing.status === 'completed' || existing.status === 'running') {
        return {
          claimed: false,
          record: existing
        };
      }

      const retryPayload = Object.assign({}, existing, safeRecord, {
        status: 'running',
        attemptCount: (existing.attemptCount || 1) + 1,
        updatedAt: safeRecord.updatedAt || safeRecord.now || new Date().toISOString(),
        previousError: existing.error
      });
      await writeExecution(filePath, retryPayload);
      return {
        claimed: true,
        record: retryPayload
      };
    },

    async completeExecution(key, result, metadata) {
      const filePath = executionPath(baseDir, key);
      const existing = await repository.findExecution(key) || { key };
      const payload = Object.assign({}, existing, metadata || {}, {
        key,
        status: 'completed',
        result: result || {},
        completedAt: metadata && metadata.completedAt || metadata && metadata.now || new Date().toISOString(),
        updatedAt: metadata && metadata.updatedAt || metadata && metadata.now || new Date().toISOString()
      });
      await writeExecution(filePath, payload);
      return payload;
    },

    async failExecution(key, error, metadata) {
      const filePath = executionPath(baseDir, key);
      const existing = await repository.findExecution(key) || { key };
      const payload = Object.assign({}, existing, metadata || {}, {
        key,
        status: 'failed',
        error: {
          message: error && error.message ? error.message : String(error || 'Unknown error'),
          stack: error && error.stack
        },
        failedAt: metadata && metadata.failedAt || metadata && metadata.now || new Date().toISOString(),
        updatedAt: metadata && metadata.updatedAt || metadata && metadata.now || new Date().toISOString()
      });
      await writeExecution(filePath, payload);
      return payload;
    },

    async findExecution(key) {
      try {
        return await readExecution(executionPath(baseDir, key));
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listExecutions(query) {
      const safeQuery = query || {};
      const files = await listExecutionFiles(baseDir);
      const records = [];

      for (const filePath of files) {
        const record = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (safeQuery.action && record.action !== safeQuery.action) continue;
        if (safeQuery.status && record.status !== safeQuery.status) continue;
        if (safeQuery.taskId && record.taskId !== safeQuery.taskId) continue;
        records.push(Object.assign({}, record, {
          filePath
        }));
      }

      return records
        .sort(function (a, b) {
          return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
        })
        .slice(0, safeQuery.limit || records.length);
    }
  };

  return assertContextReviewActionExecutionRepository(repository);
}

async function readExecution(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeExecution(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function listExecutionFiles(baseDir) {
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

function executionPath(baseDir, key) {
  return path.join(baseDir, safeSegment(key) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

module.exports = {
  createFileContextReviewActionExecutionRepository
};
