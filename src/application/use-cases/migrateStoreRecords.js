'use strict';

const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertAuthorReviewQueueRepository } = require('../ports/authorReviewQueueRepository');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const { assertRawThreadPageRepository } = require('../ports/rawThreadPageRepository');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const { assertWorkerRunRepository } = require('../ports/workerRunRepository');
const {
  assertContextReviewActionExecutionRepository
} = require('../ports/contextReviewActionExecutionRepository');

async function migrateStoreRecords(options) {
  const safeOptions = options || {};
  const dryRun = safeOptions.dryRun !== false;
  const limit = safeOptions.limit;
  const source = assertRepositorySet(safeOptions.sourceRepositories, { workerRunRepository: true });
  const target = dryRun ? undefined : assertRepositorySet(safeOptions.targetRepositories, { workerRunRepository: true });
  const summary = {
    dryRun,
    migrated: {
      sources: 0,
      threadSnapshots: 0,
      analysisReports: 0,
      tasks: 0,
      notificationEvents: 0,
      rawThreadPages: 0,
      workerRuns: 0,
      reviewActionExecutions: 0,
      authorReviewQueueItems: 0
    }
  };

  await migrateCollection({
    items: await source.sourceRepository.listSources({ limit }),
    save: dryRun ? undefined : target.sourceRepository.saveSource,
    count: function (count) { summary.migrated.sources = count; }
  });
  await migrateCollection({
    items: await source.threadRepository.listSnapshots({ limit }),
    save: dryRun ? undefined : target.threadRepository.saveSnapshot,
    count: function (count) { summary.migrated.threadSnapshots = count; }
  });
  await migrateCollection({
    items: await source.reportRepository.listReports({ limit }),
    save: dryRun ? undefined : target.reportRepository.saveReport,
    count: function (count) { summary.migrated.analysisReports = count; }
  });
  await migrateCollection({
    items: await source.taskRepository.listTasks({ limit }),
    save: dryRun ? undefined : target.taskRepository.saveTask,
    count: function (count) { summary.migrated.tasks = count; }
  });
  await migrateCollection({
    items: await source.notificationEventRepository.listEvents({ limit }),
    save: dryRun ? undefined : target.notificationEventRepository.saveEvent,
    count: function (count) { summary.migrated.notificationEvents = count; }
  });
  await migrateCollection({
    items: await source.rawThreadPageRepository.listRawThreadPages({ limit }),
    save: dryRun ? undefined : target.rawThreadPageRepository.saveRawThreadPage,
    count: function (count) { summary.migrated.rawThreadPages = count; }
  });
  if (source.workerRunRepository) {
    await migrateCollection({
      items: await source.workerRunRepository.listWorkerRuns({ limit }),
      save: dryRun ? undefined : target.workerRunRepository.saveWorkerRun,
      count: function (count) { summary.migrated.workerRuns = count; }
    });
  }
  if (source.contextReviewActionExecutionRepository) {
    if (!dryRun && !target.contextReviewActionExecutionRepository) {
      throw new Error('Target repository set must include contextReviewActionExecutionRepository when source executions are migrated.');
    }
    await migrateCollection({
      items: await source.contextReviewActionExecutionRepository.listExecutions({ limit }),
      save: dryRun ? undefined : function (execution) {
        return migrateExecutionRecord(target.contextReviewActionExecutionRepository, execution);
      },
      count: function (count) { summary.migrated.reviewActionExecutions = count; }
    });
  }
  if (source.authorReviewQueueRepository) {
    if (!dryRun && !target.authorReviewQueueRepository) {
      throw new Error('Target repository set must include authorReviewQueueRepository when source author review queue items are migrated.');
    }
    await migrateCollection({
      items: await source.authorReviewQueueRepository.listItems({ limit }),
      save: dryRun ? undefined : target.authorReviewQueueRepository.saveItem,
      count: function (count) { summary.migrated.authorReviewQueueItems = count; }
    });
  }

  return summary;
}

async function migrateExecutionRecord(repository, execution) {
  if (!repository) return;
  const claimed = await repository.claimExecution({
    key: execution.key,
    action: execution.action,
    taskId: execution.taskId,
    requestHash: execution.requestHash,
    request: execution.request,
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
    now: execution.updatedAt || execution.createdAt
  });
  if (!claimed.claimed && claimed.record && claimed.record.status === 'completed') return;
  if (execution.status === 'completed') {
    await repository.completeExecution(execution.key, execution.result || {}, {
      taskId: execution.taskId,
      completedAt: execution.completedAt,
      updatedAt: execution.updatedAt,
      now: execution.updatedAt
    });
  } else if (execution.status === 'failed') {
    await repository.failExecution(execution.key, executionError(execution), {
      taskId: execution.taskId,
      failedAt: execution.failedAt,
      updatedAt: execution.updatedAt,
      now: execution.updatedAt
    });
  }
}

async function migrateCollection(options) {
  const items = options.items || [];
  if (options.save) {
    for (const item of items) {
      await options.save(item);
    }
  }
  options.count(items.length);
}

function assertRepositorySet(repositories, optional) {
  const safeOptional = optional || {};
  const safeRepositories = repositories || {};
  const result = {
    threadRepository: assertThreadRepository(safeRepositories.threadRepository),
    reportRepository: assertAnalysisReportRepository(safeRepositories.reportRepository),
    taskRepository: assertTaskRepository(safeRepositories.taskRepository),
    sourceRepository: assertSourceRepository(safeRepositories.sourceRepository),
    notificationEventRepository: assertNotificationEventRepository(safeRepositories.notificationEventRepository),
    rawThreadPageRepository: assertRawThreadPageRepository(safeRepositories.rawThreadPageRepository)
  };

  if (safeRepositories.workerRunRepository) {
    result.workerRunRepository = assertWorkerRunRepository(safeRepositories.workerRunRepository);
  } else if (!safeOptional.workerRunRepository) {
    throw new Error('Repository set must include workerRunRepository.');
  }
  if (safeRepositories.contextReviewActionExecutionRepository) {
    result.contextReviewActionExecutionRepository = assertContextReviewActionExecutionRepository(safeRepositories.contextReviewActionExecutionRepository);
  }
  if (safeRepositories.authorReviewQueueRepository) {
    result.authorReviewQueueRepository = assertAuthorReviewQueueRepository(safeRepositories.authorReviewQueueRepository);
  }

  return result;
}

function executionError(execution) {
  const error = new Error(execution && execution.error && execution.error.message
    ? execution.error.message
    : 'Migrated failed context review action execution.');
  if (execution && execution.error && execution.error.stack) error.stack = execution.error.stack;
  return error;
}

module.exports = {
  migrateStoreRecords
};
