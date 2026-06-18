'use strict';

const path = require('path');
const { getForumAdapter, listForumAdapters } = require('../infrastructure/forum-adapters/registry');
const { analyzeSavedThreadDirectory } = require('../application/use-cases/analyzeSavedThreadDirectory');
const { interpretNewPostFromSavedThreadDirectory } = require('../application/use-cases/interpretNewPostFromSavedThreadDirectory');
const { ingestSavedThreadDirectory } = require('../application/use-cases/ingestSavedThreadDirectory');
const { runIngestSavedThreadDirectoryTask } = require('../application/use-cases/runIngestSavedThreadDirectoryTask');
const { registerTrackedSource } = require('../application/use-cases/registerTrackedSource');
const { listTrackedSources } = require('../application/use-cases/listTrackedSources');
const { runTrackedSourceIngestTask } = require('../application/use-cases/runTrackedSourceIngestTask');
const { runEnabledSourcesIngestTasks } = require('../application/use-cases/runEnabledSourcesIngestTasks');
const { runDueSourcesIngestTasks } = require('../application/use-cases/runDueSourcesIngestTasks');
const { acknowledgeNotificationEvent } = require('../application/use-cases/acknowledgeNotificationEvent');
const { dispatchPendingNotificationEvents } = require('../application/use-cases/dispatchPendingNotificationEvents');
const { indexSavedThreadDirectory } = require('../application/use-cases/indexSavedThreadDirectory');
const { searchEvidence } = require('../application/use-cases/searchEvidence');
const { createFileThreadRepository } = require('../infrastructure/storage/fileThreadRepository');
const { createFileAnalysisReportRepository } = require('../infrastructure/storage/fileAnalysisReportRepository');
const { createFileTaskRepository } = require('../infrastructure/storage/fileTaskRepository');
const { createFileSourceRepository } = require('../infrastructure/storage/fileSourceRepository');
const { createFileNotificationEventRepository } = require('../infrastructure/storage/fileNotificationEventRepository');
const { createFileNotificationChannel } = require('../infrastructure/notifications/fileNotificationChannel');
const { createWebhookNotificationChannel } = require('../infrastructure/notifications/webhookNotificationChannel');
const { createFileTextRetrievalIndex } = require('../infrastructure/retrieval/fileTextRetrievalIndex');

function createThreadTraceRuntime(options) {
  const safeOptions = options || {};
  const defaults = {
    defaultForum: safeOptions.defaultForum || 'nga',
    defaultInputDir: safeOptions.defaultInputDir || path.resolve(process.cwd(), 'example'),
    storeDir: safeOptions.storeDir || path.resolve(process.cwd(), 'data', 'store')
  };
  const createRetrievalIndexFor = function (storeDir) {
    return createFileTextRetrievalIndex({
      indexFile: path.join(resolveStoreDir(defaults, storeDir), 'retrieval', 'documents.json')
    });
  };

  return {
    defaults,

    getAdapter(forum) {
      return getForumAdapter(forum || defaults.defaultForum);
    },

    listAdapters() {
      return listForumAdapters();
    },

    createRepositories(storeDir) {
      return createRepositories(resolveStoreDir(defaults, storeDir));
    },

    createRetrievalIndex(storeDir) {
      return createRetrievalIndexFor(storeDir);
    },

    analyzeDirectory(request) {
      const safeRequest = request || {};
      return analyzeSavedThreadDirectory({
        adapter: getForumAdapter(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir
      });
    },

    interpretText(request) {
      const safeRequest = request || {};
      return interpretNewPostFromSavedThreadDirectory({
        adapter: getForumAdapter(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir,
        authorId: safeRequest.authorId,
        author: safeRequest.author,
        contentText: safeRequest.text || safeRequest.contentText,
        publishedAt: safeRequest.publishedAt
      });
    },

    async ingestDirectory(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return ingestSavedThreadDirectory({
        adapter: getForumAdapter(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository
      });
    },

    async runIngestDirectoryTask(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return runIngestSavedThreadDirectoryTask({
        forum: safeRequest.forum || defaults.defaultForum,
        adapter: getForumAdapter(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        notificationEventRepository: repositories.notificationEventRepository
      });
    },

    async listTasks(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return repositories.taskRepository.listTasks({
        status: safeRequest.status,
        type: safeRequest.type,
        limit: safeRequest.limit || 20
      });
    },

    async registerSource(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return registerTrackedSource({
        sourceRepository: repositories.sourceRepository,
        source: {
          id: safeRequest.id,
          sourceKey: safeRequest.sourceKey || safeRequest.forum,
          sourceType: safeRequest.sourceType,
          displayName: safeRequest.displayName || safeRequest.name,
          inputDir: safeRequest.inputDir,
          url: safeRequest.url,
          location: safeRequest.location,
          enabled: safeRequest.enabled,
          tags: safeRequest.tags,
          schedule: safeRequest.schedule || buildSchedule(safeRequest)
        }
      });
    },

    async listSources(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return listTrackedSources({
        sourceRepository: repositories.sourceRepository,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 50
      });
    },

    async runSourceIngestTask(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      const source = await repositories.sourceRepository.findSource(safeRequest.sourceId);
      if (!source) {
        throw new Error('Unknown tracked source: ' + safeRequest.sourceId);
      }

      return runTrackedSourceIngestTask({
        sourceId: safeRequest.sourceId,
        sourceRepository: repositories.sourceRepository,
        adapter: getForumAdapter(source.sourceKey),
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        notificationEventRepository: repositories.notificationEventRepository
      });
    },

    async runEnabledSourcesIngestTasks(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return runEnabledSourcesIngestTasks({
        sourceRepository: repositories.sourceRepository,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        notificationEventRepository: repositories.notificationEventRepository,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        limit: safeRequest.limit || 50,
        getAdapter: getForumAdapter
      });
    },

    async runDueSourcesIngestTasks(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return runDueSourcesIngestTasks({
        sourceRepository: repositories.sourceRepository,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        notificationEventRepository: repositories.notificationEventRepository,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        limit: safeRequest.limit || 50,
        now: safeRequest.now,
        getAdapter: getForumAdapter
      });
    },

    async indexDirectory(request) {
      const safeRequest = request || {};
      return indexSavedThreadDirectory({
        adapter: getForumAdapter(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir,
        retrievalIndex: createRetrievalIndexFor(safeRequest.storeDir)
      });
    },

    async search(request) {
      const safeRequest = request || {};
      return searchEvidence({
        text: safeRequest.text,
        filter: safeRequest.filter,
        limit: safeRequest.limit || 10,
        retrievalIndex: createRetrievalIndexFor(safeRequest.storeDir)
      });
    },

    async listNotificationEvents(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return repositories.notificationEventRepository.listEvents({
        type: safeRequest.type,
        sourceId: safeRequest.sourceId,
        acknowledged: safeRequest.acknowledged,
        deliveryStatus: safeRequest.deliveryStatus,
        limit: safeRequest.limit || 50
      });
    },

    async acknowledgeNotificationEvent(request) {
      const safeRequest = request || {};
      const repositories = createRepositories(resolveStoreDir(defaults, safeRequest.storeDir));
      return acknowledgeNotificationEvent({
        notificationEventRepository: repositories.notificationEventRepository,
        eventId: safeRequest.eventId,
        acknowledgedBy: safeRequest.acknowledgedBy,
        note: safeRequest.note
      });
    },

    async dispatchNotificationEvents(request) {
      const safeRequest = request || {};
      const storeDir = resolveStoreDir(defaults, safeRequest.storeDir);
      const repositories = createRepositories(storeDir);
      return dispatchPendingNotificationEvents({
        notificationEventRepository: repositories.notificationEventRepository,
        notificationChannel: createNotificationChannel(safeRequest, storeDir),
        limit: safeRequest.limit || 50,
        maxAttempts: safeRequest.maxAttempts || 3,
        includeFailed: safeRequest.includeFailed,
        now: safeRequest.now,
        retryBackoffMs: safeRequest.retryBackoffMs,
        maxRetryBackoffMs: safeRequest.maxRetryBackoffMs
      });
    }
  };
}

function createRepositories(storeDir) {
  return {
    threadRepository: createFileThreadRepository({
      baseDir: path.join(storeDir, 'threads')
    }),
    reportRepository: createFileAnalysisReportRepository({
      baseDir: path.join(storeDir, 'reports')
    }),
    taskRepository: createFileTaskRepository({
      baseDir: path.join(storeDir, 'tasks')
    }),
    sourceRepository: createFileSourceRepository({
      baseDir: path.join(storeDir, 'sources')
    }),
    notificationEventRepository: createFileNotificationEventRepository({
      baseDir: path.join(storeDir, 'events')
    })
  };
}

function resolveStoreDir(defaults, storeDir) {
  return storeDir || defaults.storeDir;
}

function buildSchedule(request) {
  if (!request.intervalMinutes && !request.nextRunAt) return undefined;
  return {
    enabled: request.scheduleEnabled !== false,
    intervalMinutes: request.intervalMinutes ? Number(request.intervalMinutes) : undefined,
    nextRunAt: request.nextRunAt
  };
}

function createNotificationChannel(request, storeDir) {
  const channel = request.channel || (request.webhookUrl ? 'webhook' : 'file');
  if (channel === 'webhook') {
    return createWebhookNotificationChannel({
      url: request.webhookUrl || process.env.THREADTRACE_WEBHOOK_URL,
      timeoutMs: request.timeoutMs ? Number(request.timeoutMs) : undefined
    });
  }
  if (channel === 'file') {
    return createFileNotificationChannel({
      baseDir: path.join(storeDir, 'deliveries')
    });
  }
  throw new Error('Unknown notification channel: ' + channel);
}

module.exports = {
  createThreadTraceRuntime
};
