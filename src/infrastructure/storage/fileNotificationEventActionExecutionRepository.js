'use strict';

const fs = require('fs/promises');
const path = require('path');
const {
  assertNotificationEventActionExecutionRepository
} = require('../../application/ports/notificationEventActionExecutionRepository');

function createFileNotificationEventActionExecutionRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'event-action-executions'));

  const repository = {
    async claimExecution(record) {
      const safeRecord = record || {};
      const key = safeRecord.key;
      if (!key) throw new Error('Notification event action execution record requires key.');
      const filePath = executionPath(baseDir, key);
      const now = safeRecord.now || new Date().toISOString();
      const payload = Object.assign({}, safeRecord, {
        status: 'running',
        attemptCount: 1,
        createdAt: safeRecord.createdAt || now,
        updatedAt: safeRecord.updatedAt || now
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
          record: withDerivedFields(existing, filePath)
        };
      }

      const retryPayload = Object.assign({}, existing, safeRecord, {
        status: 'running',
        attemptCount: (existing.attemptCount || 1) + 1,
        updatedAt: safeRecord.updatedAt || now,
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
      const safeMetadata = metadata || {};
      const existing = await repository.findExecution(key) || { key };
      const now = safeMetadata.now || new Date().toISOString();
      const payload = Object.assign({}, existing, safeMetadata, {
        key,
        status: 'completed',
        result: result || {},
        completedAt: safeMetadata.completedAt || now,
        updatedAt: safeMetadata.updatedAt || now
      });
      await writeExecution(filePath, payload);
      return withDerivedFields(payload, filePath);
    },

    async failExecution(key, error, metadata) {
      const filePath = executionPath(baseDir, key);
      const safeMetadata = metadata || {};
      const existing = await repository.findExecution(key) || { key };
      const now = safeMetadata.now || new Date().toISOString();
      const payload = Object.assign({}, existing, safeMetadata, {
        key,
        status: 'failed',
        error: {
          message: error && error.message ? error.message : String(error || 'Unknown error'),
          stack: error && error.stack
        },
        failedAt: safeMetadata.failedAt || now,
        updatedAt: safeMetadata.updatedAt || now
      });
      await writeExecution(filePath, payload);
      return withDerivedFields(payload, filePath);
    },

    async findExecution(key) {
      try {
        const filePath = executionPath(baseDir, key);
        return withDerivedFields(await readExecution(filePath), filePath);
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
        const record = withDerivedFields(JSON.parse(await fs.readFile(filePath, 'utf8')), filePath);
        if (safeQuery.eventId && record.eventId !== safeQuery.eventId) continue;
        if (safeQuery.actionKey && record.actionKey !== safeQuery.actionKey) continue;
        if (safeQuery.status && record.status !== safeQuery.status) continue;
        if (safeQuery.sourceId && record.sourceId !== safeQuery.sourceId) continue;
        if (safeQuery.sourceKey && record.sourceKey !== safeQuery.sourceKey) continue;
        if (safeQuery.actor && record.actor !== safeQuery.actor) continue;
        records.push(record);
      }

      return records
        .sort(function (a, b) {
          return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
        })
        .slice(0, safeQuery.limit || records.length);
    }
  };

  return assertNotificationEventActionExecutionRepository(repository);
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

function withDerivedFields(record, filePath) {
  const safeRecord = record || {};
  const sourceScope = safeRecord.sourceScope || safeRecord.intent && safeRecord.intent.sourceScope || {};
  return Object.assign({}, safeRecord, {
    eventId: safeRecord.eventId || safeRecord.event && safeRecord.event.id,
    actionKey: safeRecord.actionKey || safeRecord.action && safeRecord.action.key,
    actor: safeRecord.actor || safeRecord.intent && safeRecord.intent.actor,
    sourceId: safeRecord.sourceId || sourceScope.sourceId,
    sourceKey: safeRecord.sourceKey || sourceScope.sourceKey,
    filePath
  });
}

module.exports = {
  createFileNotificationEventActionExecutionRepository
};
