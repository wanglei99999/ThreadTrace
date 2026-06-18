'use strict';

const { createPostgresAnalysisReportRepository } = require('./postgresAnalysisReportRepository');
const { createPostgresNotificationEventRepository } = require('./postgresNotificationEventRepository');
const { createPostgresSourceRepository } = require('./postgresSourceRepository');
const { createPostgresTaskRepository } = require('./postgresTaskRepository');
const { createPostgresThreadRepository } = require('./postgresThreadRepository');

function createPostgresRepositories(options) {
  const safeOptions = options || {};
  const client = safeOptions.client;
  return {
    threadRepository: createPostgresThreadRepository({ client }),
    reportRepository: createPostgresAnalysisReportRepository({ client }),
    taskRepository: createPostgresTaskRepository({ client }),
    sourceRepository: createPostgresSourceRepository({ client }),
    notificationEventRepository: createPostgresNotificationEventRepository({ client })
  };
}

module.exports = {
  createPostgresRepositories
};
