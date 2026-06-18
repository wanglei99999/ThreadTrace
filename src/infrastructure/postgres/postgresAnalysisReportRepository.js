'use strict';

const { assertAnalysisReportRepository } = require('../../application/ports/analysisReportRepository');
const { assertPostgresClient } = require('./postgresConnection');

function createPostgresAnalysisReportRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveReport(report) {
      const thread = report.thread || {};
      await client.query(
        [
          'insert into analysis_reports (source_key, source_thread_id, report_type, generated_at, report)',
          'values ($1,$2,$3,$4,$5)'
        ].join(' '),
        [
          thread.sourceKey,
          thread.sourceThreadId,
          report.reportType || 'report',
          report.generatedAt || new Date().toISOString(),
          report
        ]
      );
    },

    async findReports(query) {
      const params = [query.sourceKey, query.sourceThreadId];
      const where = ['source_key = $1', 'source_thread_id = $2'];
      if (query.reportType) {
        params.push(query.reportType);
        where.push('report_type = $' + params.length);
      }
      const result = await client.query(
        'select report from analysis_reports where ' + where.join(' and ') + ' order by generated_at desc',
        params
      );
      return result.rows.map(function (row) {
        return row.report;
      });
    }
  };

  return assertAnalysisReportRepository(repository);
}

module.exports = {
  createPostgresAnalysisReportRepository
};
