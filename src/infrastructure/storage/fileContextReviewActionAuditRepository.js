'use strict';

const fs = require('fs/promises');
const path = require('path');
const {
  assertContextReviewActionAuditRepository
} = require('../../application/ports/contextReviewActionAuditRepository');
const {
  auditSourceId,
  auditSourceKey
} = require('../../domain/review-actions/contextReviewActionAuditScope');

function createFileContextReviewActionAuditRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'review-action-audits'));

  const repository = {
    async listActionAudits(query) {
      const safeQuery = query || {};
      const files = await listAuditFiles(baseDir);
      const records = [];

      for (const filePath of files) {
        const record = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (safeQuery.action && record.action !== safeQuery.action) continue;
        if (safeQuery.taskId && auditTaskId(record) !== safeQuery.taskId) continue;
        if (safeQuery.sourceId && auditSourceId(record) !== safeQuery.sourceId) continue;
        if (safeQuery.sourceKey && auditSourceKey(record) !== safeQuery.sourceKey) continue;
        records.push(Object.assign({}, record, {
          sourceId: auditSourceId(record),
          sourceKey: auditSourceKey(record),
          filePath
        }));
      }

      return records
        .sort(function (a, b) {
          return String(b.generatedAt || '').localeCompare(String(a.generatedAt || ''));
        })
        .slice(0, safeQuery.limit || records.length);
    }
  };

  return assertContextReviewActionAuditRepository(repository);
}

async function listAuditFiles(baseDir) {
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

function auditTaskId(record) {
  return record && record.request ? record.request.taskId : undefined;
}

module.exports = {
  createFileContextReviewActionAuditRepository
};
