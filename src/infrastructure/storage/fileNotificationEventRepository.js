'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertNotificationEventRepository } = require('../../application/ports/notificationEventRepository');

function createFileNotificationEventRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'events'));

  const repository = {
    async saveEvent(event) {
      const filePath = eventPath(baseDir, event.id);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(event, null, 2) + '\n', 'utf8');
    },

    async findEvent(id) {
      try {
        const text = await fs.readFile(eventPath(baseDir, id), 'utf8');
        return JSON.parse(text);
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async archiveEvent(id, metadata) {
      const filePath = eventPath(baseDir, id);
      const safeMetadata = metadata || {};
      let event;
      try {
        event = JSON.parse(await fs.readFile(filePath, 'utf8'));
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }

      const archivedEvent = Object.assign({}, event, {
        archivedAt: safeMetadata.archivedAt || new Date().toISOString(),
        archivedBy: safeMetadata.archivedBy || 'system',
        archiveReason: safeMetadata.reason || safeMetadata.archiveReason,
        archiveBatchId: safeMetadata.batchId
      });
      const archivePath = archivedEventPath(baseDir, archivedEvent);
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      await fs.rename(filePath, archivePath);
      await fs.writeFile(archivePath, JSON.stringify(archivedEvent, null, 2) + '\n', 'utf8');
      return archivedEvent;
    },

    async listEvents(query) {
      const safeQuery = query || {};
      const files = safeQuery.includeArchived
        ? (await listEventFiles(baseDir)).concat(await listArchivedEventFiles(baseDir))
        : await listEventFiles(baseDir);
      const events = [];

      for (const filePath of files) {
        const event = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (!safeQuery.includeArchived && event.archivedAt) continue;
        if (safeQuery.type && event.type !== safeQuery.type) continue;
        if (safeQuery.sourceId && event.sourceId !== safeQuery.sourceId) continue;
        if (safeQuery.sourceKey && event.sourceKey !== safeQuery.sourceKey) continue;
        if (typeof safeQuery.acknowledged === 'boolean') {
          const acknowledged = Boolean(event.acknowledgedAt);
          if (acknowledged !== safeQuery.acknowledged) continue;
        }
        if (safeQuery.deliveryStatus && (event.deliveryStatus || 'pending') !== safeQuery.deliveryStatus) continue;
        if (safeQuery.dueBefore && !isEventDue(event, safeQuery.dueBefore)) continue;
        events.push(event);
      }

      return events
        .sort(function (a, b) {
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        })
        .slice(0, safeQuery.limit || events.length);
    }
  };

  return assertNotificationEventRepository(repository);
}

function eventPath(baseDir, id) {
  return path.join(baseDir, safeSegment(id) + '.json');
}

function archivedEventPath(baseDir, event) {
  const archivedAt = event.archivedAt || new Date().toISOString();
  const bucket = /^\d{4}-\d{2}/.test(archivedAt) ? archivedAt.slice(0, 7) : 'unknown';
  return path.join(baseDir, '_archive', bucket, safeSegment(event.id) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function listEventFiles(baseDir) {
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

async function listArchivedEventFiles(baseDir) {
  const archiveDir = path.join(baseDir, '_archive');
  try {
    const buckets = await fs.readdir(archiveDir, { withFileTypes: true });
    const files = [];
    for (const bucket of buckets) {
      if (!bucket.isDirectory()) continue;
      const bucketDir = path.join(archiveDir, bucket.name);
      const entries = await fs.readdir(bucketDir, { withFileTypes: true });
      entries.forEach(function (entry) {
        if (entry.isFile() && /\.json$/i.test(entry.name)) {
          files.push(path.join(bucketDir, entry.name));
        }
      });
    }
    return files;
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

function isEventDue(event, dueBefore) {
  const dueBeforeTime = Date.parse(dueBefore);
  if (Number.isNaN(dueBeforeTime)) return true;
  if (!event.nextDeliveryAt) return true;
  const nextDeliveryTime = Date.parse(event.nextDeliveryAt);
  if (Number.isNaN(nextDeliveryTime)) return true;
  return nextDeliveryTime <= dueBeforeTime;
}

module.exports = {
  createFileNotificationEventRepository
};
