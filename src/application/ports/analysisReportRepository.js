'use strict';

/**
 * Storage port for generated reports. Reports are separated from snapshots so
 * analysis can be rerun without mutating raw evidence.
 *
 * @typedef {Object} AnalysisReportRepository
 * @property {(report: Object) => Promise<void>} saveReport
 * @property {(query: { sourceKey: string, sourceThreadId: string, reportType?: string }) => Promise<Object[]>} findReports
 * @property {(query?: { sourceKey?: string, sourceThreadId?: string, reportType?: string, limit?: number }) => Promise<Object[]>} listReports
 */

function assertAnalysisReportRepository(repository) {
  if (!repository || typeof repository.saveReport !== 'function') {
    throw new Error('AnalysisReportRepository must implement saveReport(report).');
  }
  if (typeof repository.findReports !== 'function') {
    throw new Error('AnalysisReportRepository must implement findReports(query).');
  }
  if (typeof repository.listReports !== 'function') {
    throw new Error('AnalysisReportRepository must implement listReports(query).');
  }
  return repository;
}

module.exports = {
  assertAnalysisReportRepository
};
