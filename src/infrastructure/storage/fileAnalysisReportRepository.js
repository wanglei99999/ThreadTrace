'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertAnalysisReportRepository } = require('../../application/ports/analysisReportRepository');

function createFileAnalysisReportRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'reports'));

  const repository = {
    async saveReport(report) {
      const thread = report.thread || {};
      const filePath = reportPath(baseDir, thread.sourceKey, thread.sourceThreadId, report.reportType || 'report', report.generatedAt);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    },

    async findReports(query) {
      const sourceDir = path.join(baseDir, safeSegment(query.sourceKey), safeSegment(query.sourceThreadId));
      const files = await listJsonFiles(sourceDir);
      const reports = [];

      for (const filePath of files) {
        const report = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (query.reportType && report.reportType !== query.reportType) continue;
        reports.push(report);
      }

      return reports.sort(function (a, b) {
        return String(b.generatedAt || '').localeCompare(String(a.generatedAt || ''));
      });
    }
  };

  return assertAnalysisReportRepository(repository);
}

function reportPath(baseDir, sourceKey, sourceThreadId, reportType, generatedAt) {
  const timestamp = safeSegment(generatedAt || new Date().toISOString());
  return path.join(baseDir, safeSegment(sourceKey), safeSegment(sourceThreadId), safeSegment(reportType) + '-' + timestamp + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
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

module.exports = {
  createFileAnalysisReportRepository
};
