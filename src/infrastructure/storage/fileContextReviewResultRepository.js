'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertContextReviewResultRepository } = require('../../application/ports/contextReviewResultRepository');

function createFileContextReviewResultRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'context-review-results'));

  const repository = {
    async saveReviewResult(record) {
      const filePath = reviewResultPath(baseDir, record.id);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(record, null, 2) + '\n', 'utf8');
    },

    async findReviewResult(id) {
      try {
        const text = await fs.readFile(reviewResultPath(baseDir, id), 'utf8');
        return JSON.parse(text);
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listReviewResults(query) {
      const safeQuery = query || {};
      const files = await listReviewResultFiles(baseDir);
      const records = [];

      for (const filePath of files) {
        const record = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (safeQuery.handoffId && record.handoffId !== safeQuery.handoffId) continue;
        if (safeQuery.status && record.status !== safeQuery.status) continue;
        if (safeQuery.reviewerId && reviewerId(record) !== safeQuery.reviewerId) continue;
        records.push(record);
      }

      return records
        .sort(function (a, b) {
          return String(b.submittedAt || b.createdAt || '').localeCompare(String(a.submittedAt || a.createdAt || ''));
        })
        .slice(0, safeQuery.limit || records.length);
    }
  };

  return assertContextReviewResultRepository(repository);
}

function reviewResultPath(baseDir, id) {
  return path.join(baseDir, safeSegment(id) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function listReviewResultFiles(baseDir) {
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

function reviewerId(record) {
  return record && record.reviewer ? record.reviewer.id : undefined;
}

module.exports = {
  createFileContextReviewResultRepository
};
