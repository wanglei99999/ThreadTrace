'use strict';

const { createPostgresAnalysisReportRepository } = require('./postgresAnalysisReportRepository');
const { createPostgresNotificationEventRepository } = require('./postgresNotificationEventRepository');
const { createPostgresRawThreadPageRepository } = require('./postgresRawThreadPageRepository');
const { createPostgresSourceRepository } = require('./postgresSourceRepository');
const { createPostgresTaskRepository } = require('./postgresTaskRepository');
const { createPostgresThreadRepository } = require('./postgresThreadRepository');
const { createPostgresWorkerRunRepository } = require('./postgresWorkerRunRepository');

function createPostgresRepositories(options) {
  const safeOptions = options || {};
  const client = safeOptions.client;
  return {
    threadRepository: createPostgresThreadRepository({ client }),
    reportRepository: createPostgresAnalysisReportRepository({ client }),
    taskRepository: createPostgresTaskRepository({ client }),
    sourceRepository: createPostgresSourceRepository({ client }),
    notificationEventRepository: createPostgresNotificationEventRepository({ client }),
    rawThreadPageRepository: createPostgresRawThreadPageRepository({ client }),
    workerRunRepository: createPostgresWorkerRunRepository({ client })
  };
}

module.exports = {
  createPostgresRepositories
};
