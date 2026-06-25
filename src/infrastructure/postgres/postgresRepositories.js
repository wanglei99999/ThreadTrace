'use strict';

const { createPostgresAnalysisReportRepository } = require('./postgresAnalysisReportRepository');
const { createPostgresAuthorReviewQueueRepository } = require('./postgresAuthorReviewQueueRepository');
const { createPostgresContextReviewActionExecutionRepository } = require('./postgresContextReviewActionExecutionRepository');
const { createPostgresContextReviewResultRepository } = require('./postgresContextReviewResultRepository');
const { createPostgresNotificationEventActionExecutionRepository } = require('./postgresNotificationEventActionExecutionRepository');
const { createPostgresNotificationEventRepository } = require('./postgresNotificationEventRepository');
const { createPostgresRawThreadPageRepository } = require('./postgresRawThreadPageRepository');
const { createPostgresSourceRepository } = require('./postgresSourceRepository');
const { createPostgresTaskRepository } = require('./postgresTaskRepository');
const { createPostgresThreadRepository } = require('./postgresThreadRepository');
const { createPostgresWorkerLeaseRepository } = require('./postgresWorkerLeaseRepository');
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
    workerRunRepository: createPostgresWorkerRunRepository({ client }),
    workerLeaseRepository: createPostgresWorkerLeaseRepository({ client }),
    contextReviewResultRepository: createPostgresContextReviewResultRepository({ client }),
    contextReviewActionExecutionRepository: createPostgresContextReviewActionExecutionRepository({ client }),
    notificationEventActionExecutionRepository: createPostgresNotificationEventActionExecutionRepository({ client }),
    authorReviewQueueRepository: createPostgresAuthorReviewQueueRepository({ client })
  };
}

module.exports = {
  createPostgresRepositories
};
