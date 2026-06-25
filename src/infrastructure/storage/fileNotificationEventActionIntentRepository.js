'use strict';

const fs = require('fs/promises');
const path = require('path');
const {
  assertNotificationEventActionIntentRepository
} = require('../../application/ports/notificationEventActionIntentRepository');

function createFileNotificationEventActionIntentRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'event-action-intents'));

  const repository = {
    async saveIntent(record) {
      const payload = normalizeRecord(record);
      const filePath = intentPath(baseDir, payload.id);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
      return Object.assign({}, payload, {
        filePath
      });
    },

    async findIntent(id) {
      try {
        const filePath = intentPath(baseDir, id);
        const record = JSON.parse(await fs.readFile(filePath, 'utf8'));
        return Object.assign({}, record, {
          filePath
        });
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listIntents(query) {
      const safeQuery = query || {};
      const files = await listIntentFiles(baseDir);
      const records = [];

      for (const filePath of files) {
        const record = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (safeQuery.eventId && record.eventId !== safeQuery.eventId) continue;
        if (safeQuery.actionKey && record.actionKey !== safeQuery.actionKey) continue;
        if (safeQuery.status && record.status !== safeQuery.status) continue;
        if (safeQuery.sourceId && recordSourceId(record) !== safeQuery.sourceId) continue;
        if (safeQuery.sourceKey && recordSourceKey(record) !== safeQuery.sourceKey) continue;
        if (safeQuery.actor && record.actor !== safeQuery.actor) continue;
        records.push(Object.assign({}, record, {
          sourceId: recordSourceId(record),
          sourceKey: recordSourceKey(record),
          filePath
        }));
      }

      return records
        .sort(function (a, b) {
          return String(b.generatedAt || b.createdAt || '').localeCompare(String(a.generatedAt || a.createdAt || ''));
        })
        .slice(0, safeQuery.limit || records.length);
    }
  };

  return assertNotificationEventActionIntentRepository(repository);
}

function normalizeRecord(record) {
  const safeRecord = record || {};
  const generatedAt = safeRecord.generatedAt || new Date().toISOString();
  const intent = safeRecord.intent || {};
  const event = safeRecord.event || {};
  const action = safeRecord.action || {};
  return Object.assign({}, safeRecord, {
    id: safeRecord.id || recordId(intent.id || event.id || 'event', action.key || intent.actionKey || 'action', generatedAt),
    type: safeRecord.type || 'notification-event-action-intent',
    generatedAt,
    eventId: safeRecord.eventId || event.id || intent.eventId,
    actionKey: safeRecord.actionKey || action.key || intent.actionKey,
    status: safeRecord.status || 'ok',
    actor: safeRecord.actor || intent.actor,
    sourceScope: safeRecord.sourceScope || intent.evidence && intent.evidence.sourceScope || {}
  });
}

function recordId(intentId, actionKey, generatedAt) {
  return [intentId, actionKey, generatedAt].map(safeSegment).join(':');
}

function intentPath(baseDir, id) {
  return path.join(baseDir, safeSegment(id) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function listIntentFiles(baseDir) {
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

function recordSourceId(record) {
  return record && record.sourceScope ? record.sourceScope.sourceId : undefined;
}

function recordSourceKey(record) {
  return record && record.sourceScope ? record.sourceScope.sourceKey : undefined;
}

module.exports = {
  createFileNotificationEventActionIntentRepository
};
