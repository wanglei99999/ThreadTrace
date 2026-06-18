'use strict';

const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const { assertRawThreadPageRepository } = require('../ports/rawThreadPageRepository');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const { assertWorkerRunRepository } = require('../ports/workerRunRepository');

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
      workerRuns: 0
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

  return summary;
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

  return result;
}

module.exports = {
  migrateStoreRecords
};
