'use strict';

const path = require('path');
const { createThreadTraceConfig } = require('./threadTraceConfig');
const { createDefaultForumAdapterRegistry } = require('../infrastructure/forum-adapters/registry');
const { analyzeSavedThreadDirectory } = require('../application/use-cases/analyzeSavedThreadDirectory');
const { interpretNewPostFromSavedThreadDirectory } = require('../application/use-cases/interpretNewPostFromSavedThreadDirectory');
const { ingestSavedThreadDirectory } = require('../application/use-cases/ingestSavedThreadDirectory');
const { diagnoseForumAdapters } = require('../application/use-cases/diagnoseForumAdapters');
const { runIngestSavedThreadDirectoryTask } = require('../application/use-cases/runIngestSavedThreadDirectoryTask');
const { registerTrackedSource } = require('../application/use-cases/registerTrackedSource');
const { listTrackedSources } = require('../application/use-cases/listTrackedSources');
const { diagnoseTrackedSources } = require('../application/use-cases/diagnoseTrackedSources');
const { runTrackedSourceIngestTask } = require('../application/use-cases/runTrackedSourceIngestTask');
const { runSourceInsightPipelineTask } = require('../application/use-cases/runSourceInsightPipelineTask');
const { listSourceInsightPipelineRuns } = require('../application/use-cases/listSourceInsightPipelineRuns');
const { runEnabledSourcesIngestTasks } = require('../application/use-cases/runEnabledSourcesIngestTasks');
const { runDueSourcesIngestTasks } = require('../application/use-cases/runDueSourcesIngestTasks');
const { runDueSourceInsightPipelineTasks } = require('../application/use-cases/runDueSourceInsightPipelineTasks');
const { acknowledgeNotificationEvent } = require('../application/use-cases/acknowledgeNotificationEvent');
const { dispatchPendingNotificationEvents } = require('../application/use-cases/dispatchPendingNotificationEvents');
const { fetchAndStoreThreadPage } = require('../application/use-cases/fetchAndStoreThreadPage');
const { enrichAnalysisReportWithLlm } = require('../application/use-cases/enrichAnalysisReportWithLlm');
const { runSemanticEnrichmentTask } = require('../application/use-cases/runSemanticEnrichmentTask');
const { getOperationalOverview } = require('../application/use-cases/getOperationalOverview');
const { getOperationalReadiness } = require('../application/use-cases/getOperationalReadiness');
const { getRuntimeDiagnostics } = require('../application/use-cases/getRuntimeDiagnostics');
const { getDeploymentChecklist } = require('../application/use-cases/getDeploymentChecklist');
const { getOperationsRunbook } = require('../application/use-cases/getOperationsRunbook');
const { getSourceConnectorCatalog } = require('../application/use-cases/getSourceConnectorCatalog');
const { createDefaultSourceIngestHandlerRegistry } = require('../application/source-ingest/standardSourceIngestHandlers');
const { migrateStoreRecords } = require('../application/use-cases/migrateStoreRecords');
const { runIngestRawThreadPageTask } = require('../application/use-cases/runIngestRawThreadPageTask');
const { indexSavedThreadDirectory } = require('../application/use-cases/indexSavedThreadDirectory');
const { searchEvidence } = require('../application/use-cases/searchEvidence');
const { createFileThreadRepository } = require('../infrastructure/storage/fileThreadRepository');
const { createFileAnalysisReportRepository } = require('../infrastructure/storage/fileAnalysisReportRepository');
const { createFileTaskRepository } = require('../infrastructure/storage/fileTaskRepository');
const { createFileSourceRepository } = require('../infrastructure/storage/fileSourceRepository');
const { createFileNotificationEventRepository } = require('../infrastructure/storage/fileNotificationEventRepository');
const { createFileRawThreadPageRepository } = require('../infrastructure/storage/fileRawThreadPageRepository');
const { createFileWorkerRunRepository } = require('../infrastructure/storage/fileWorkerRunRepository');
const { createFileWorkerLeaseRepository } = require('../infrastructure/storage/fileWorkerLeaseRepository');
const { createFileNotificationChannel } = require('../infrastructure/notifications/fileNotificationChannel');
const { createWebhookNotificationChannel } = require('../infrastructure/notifications/webhookNotificationChannel');
const { inspectFileResources } = require('../infrastructure/diagnostics/fileResourceDiagnostics');
const { inspectPostgresResources } = require('../infrastructure/diagnostics/postgresResourceDiagnostics');
const { inspectNotificationChannelResources } = require('../infrastructure/diagnostics/notificationChannelDiagnostics');
const { createHttpForumCrawler } = require('../infrastructure/crawlers/httpForumCrawler');
const { createLlmProvider } = require('../infrastructure/llm/llmProviderFactory');
const { createFileTextRetrievalIndex } = require('../infrastructure/retrieval/fileTextRetrievalIndex');
const { createPostgresPool } = require('../infrastructure/postgres/postgresConnection');
const { createPostgresRepositories } = require('../infrastructure/postgres/postgresRepositories');

function createThreadTraceRuntime(options) {
  const safeOptions = options || {};
  const runtimeConfig = safeOptions.config || createThreadTraceConfig({
    env: safeOptions.env,
    cwd: safeOptions.cwd,
    defaultForum: safeOptions.defaultForum,
    defaultInputDir: safeOptions.defaultInputDir,
    storeDir: safeOptions.storeDir,
    storageMode: safeOptions.storageMode,
    sourceTaskMode: safeOptions.sourceTaskMode
  });
  const defaults = {
    defaultForum: runtimeConfig.defaultForum,
    defaultInputDir: runtimeConfig.defaultInputDir,
    storeDir: runtimeConfig.storeDir,
    storageMode: runtimeConfig.storageMode
  };
  let postgresClient = safeOptions.postgresClient;
  const forumAdapterRegistry = safeOptions.forumAdapterRegistry || createDefaultForumAdapterRegistry();
  const sourceIngestHandlerRegistry = safeOptions.sourceIngestHandlerRegistry || createDefaultSourceIngestHandlerRegistry();
  const createRetrievalIndexFor = function (storeDir) {
    return createFileTextRetrievalIndex({
      indexFile: path.join(resolveStoreDir(defaults, storeDir), 'retrieval', 'documents.json')
    });
  };
  const createRepositoriesFor = function (storeDir) {
    if (defaults.storageMode === 'postgres') {
      return createPostgresRepositories({
        client: getPostgresClient()
      });
    }
    if (defaults.storageMode !== 'file') {
      throw new Error('Unknown ThreadTrace storage mode: ' + defaults.storageMode);
    }
    return createFileRepositories(resolveStoreDir(defaults, storeDir));
  };
  const getPostgresClient = function () {
    if (!postgresClient) {
      postgresClient = createPostgresPool(safeOptions.postgres);
    }
    return postgresClient;
  };
  const createLlmProviderFor = function (request) {
    return safeOptions.llmProvider || createLlmProvider({
      provider: request && request.provider,
      env: safeOptions.env,
      fetch: safeOptions.fetch,
      openAiCompatible: safeOptions.openAiCompatibleLlm
    });
  };

  return {
    defaults,

    getAdapter(forum) {
      return forumAdapterRegistry.get(forum || defaults.defaultForum);
    },

    listAdapters() {
      return forumAdapterRegistry.list();
    },

    diagnoseAdapters(request) {
      const safeRequest = request || {};
      return diagnoseForumAdapters({
        forumAdapterRegistry,
        samples: safeRequest.samples,
        now: safeRequest.now
      });
    },

    listSourceIngestHandlers() {
      return sourceIngestHandlerRegistry.listHandlers();
    },

    getSourceConnectorCatalog(request) {
      const safeRequest = request || {};
      return getSourceConnectorCatalog({
        sourceIngestHandlerRegistry,
        forumAdapterRegistry,
        now: safeRequest.now
      });
    },

    createRepositories(storeDir) {
      return createRepositoriesFor(storeDir);
    },

    createRetrievalIndex(storeDir) {
      return createRetrievalIndexFor(storeDir);
    },

    analyzeDirectory(request) {
      const safeRequest = request || {};
      return analyzeSavedThreadDirectory({
        adapter: forumAdapterRegistry.get(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir
      });
    },

    async enrichDirectory(request) {
      const safeRequest = request || {};
      const result = analyzeSavedThreadDirectory({
        adapter: forumAdapterRegistry.get(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir
      });
      const enrichedReport = await enrichAnalysisReportWithLlm({
        report: result.report,
        llmProvider: createLlmProviderFor(safeRequest),
        providerKey: safeRequest.provider || 'mock',
        traceId: safeRequest.traceId
      });
      return {
        threadSnapshot: result.threadSnapshot,
        report: enrichedReport
      };
    },

    interpretText(request) {
      const safeRequest = request || {};
      return interpretNewPostFromSavedThreadDirectory({
        adapter: forumAdapterRegistry.get(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir,
        authorId: safeRequest.authorId,
        author: safeRequest.author,
        contentText: safeRequest.text || safeRequest.contentText,
        publishedAt: safeRequest.publishedAt
      });
    },

    async ingestDirectory(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return ingestSavedThreadDirectory({
        adapter: forumAdapterRegistry.get(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository
      });
    },

    async runIngestDirectoryTask(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return runIngestSavedThreadDirectoryTask({
        forum: safeRequest.forum || defaults.defaultForum,
        adapter: forumAdapterRegistry.get(safeRequest.forum || defaults.defaultForum),
        inputDir: safeRequest.inputDir || defaults.defaultInputDir,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        notificationEventRepository: repositories.notificationEventRepository
      });
    },

    async listTasks(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return repositories.taskRepository.listTasks({
        status: safeRequest.status,
        type: safeRequest.type,
        limit: safeRequest.limit || 20
      });
    },

    async listSourceInsightPipelineRuns(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return listSourceInsightPipelineRuns({
        sourceId: safeRequest.sourceId,
        status: safeRequest.status,
        limit: safeRequest.limit || 20,
        scanLimit: safeRequest.scanLimit,
        taskRepository: repositories.taskRepository,
        sourceRepository: repositories.sourceRepository
      });
    },

    async listAnalysisReports(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return repositories.reportRepository.listReports({
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        sourceThreadId: safeRequest.sourceThreadId,
        reportType: safeRequest.reportType,
        limit: safeRequest.limit || 50
      });
    },

    async runSemanticEnrichmentTask(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return runSemanticEnrichmentTask({
        sourceKey: safeRequest.sourceKey || safeRequest.forum || defaults.defaultForum,
        sourceThreadId: safeRequest.sourceThreadId,
        baseReportType: safeRequest.baseReportType,
        providerKey: safeRequest.provider || 'mock',
        traceId: safeRequest.traceId,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        llmProvider: createLlmProviderFor(safeRequest)
      });
    },

    async getOperationalOverview(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      const overview = await getOperationalOverview({
        sourceRepository: repositories.sourceRepository,
        taskRepository: repositories.taskRepository,
        notificationEventRepository: repositories.notificationEventRepository,
        rawThreadPageRepository: repositories.rawThreadPageRepository,
        workerRunRepository: repositories.workerRunRepository,
        workerLeaseRepository: repositories.workerLeaseRepository,
        now: safeRequest.now,
        limit: safeRequest.limit || 100,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });
      return Object.assign({
        storageMode: defaults.storageMode
      }, overview);
    },

    async getOperationalReadiness(request) {
      const safeRequest = request || {};
      return getOperationalReadiness({
        getOperationalOverview: this.getOperationalOverview,
        diagnostics: await this.getRuntimeDiagnostics({
          now: safeRequest.now
        }),
        now: safeRequest.now,
        limit: safeRequest.limit || 100,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });
    },

    async getRuntimeDiagnostics(request) {
      const safeRequest = request || {};
      return getRuntimeDiagnostics({
        config: runtimeConfig,
        inspectResources: function (config) {
          return inspectRuntimeResources(config, getPostgresClient);
        },
        now: safeRequest.now
      });
    },

    async getDeploymentChecklist(request) {
      const safeRequest = request || {};
      const diagnostics = await this.getRuntimeDiagnostics({
        now: safeRequest.now
      });
      const adapterDiagnostics = await this.diagnoseAdapters({
        now: safeRequest.now
      });
      const notificationDiagnostics = await this.getNotificationDiagnostics({
        channel: safeRequest.channel,
        webhookUrl: safeRequest.webhookUrl,
        storeDir: safeRequest.storeDir
      });
      const sourceDiagnostics = await this.diagnoseSources({
        forum: safeRequest.forum,
        sourceKey: safeRequest.sourceKey,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir
      });
      const readiness = await getOperationalReadiness({
        getOperationalOverview: this.getOperationalOverview,
        diagnostics,
        now: safeRequest.now,
        limit: safeRequest.limit || 100,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });
      return getDeploymentChecklist({
        diagnostics,
        adapterDiagnostics,
        notificationDiagnostics,
        sourceDiagnostics,
        readiness,
        now: safeRequest.now
      });
    },

    async getNotificationDiagnostics(request) {
      const safeRequest = request || {};
      return inspectNotificationChannelResources({
        channel: safeRequest.channel,
        webhookUrl: safeRequest.webhookUrl || runtimeConfig.notifications.webhookUrl,
        storeDir: resolveStoreDir(defaults, safeRequest.storeDir)
      });
    },

    async getOperationsRunbook(request) {
      const safeRequest = request || {};
      const checklist = await this.getDeploymentChecklist({
        forum: safeRequest.forum,
        sourceKey: safeRequest.sourceKey,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });
      const pipelineRuns = await this.listSourceInsightPipelineRuns({
        sourceId: safeRequest.sourceId,
        limit: safeRequest.pipelineLimit || 20,
        storeDir: safeRequest.storeDir
      });
      return getOperationsRunbook({
        checklist,
        pipelineRuns,
        now: safeRequest.now
      });
    },

    async migrateStore(request) {
      const safeRequest = request || {};
      const fromStoreDir = resolveStoreDir(defaults, safeRequest.fromStoreDir || safeRequest.storeDir);
      const toStoreDir = safeRequest.toStoreDir || safeRequest.targetStoreDir;
      if (defaults.storageMode === 'file' && path.resolve(fromStoreDir) === path.resolve(resolveStoreDir(defaults, toStoreDir))) {
        throw new Error('Refusing to migrate file store onto itself. Provide --to-store-dir or use THREADTRACE_STORAGE=postgres.');
      }
      return migrateStoreRecords({
        sourceRepositories: createFileRepositories(fromStoreDir),
        targetRepositories: createRepositoriesFor(toStoreDir),
        dryRun: safeRequest.dryRun !== false,
        limit: safeRequest.limit ? Number(safeRequest.limit) : undefined
      });
    },

    async registerSource(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return registerTrackedSource({
        sourceRepository: repositories.sourceRepository,
        sourceIngestHandlerRegistry,
        allowUnknownSourceType: safeRequest.allowUnknownSourceType,
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
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return listTrackedSources({
        sourceRepository: repositories.sourceRepository,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 50
      });
    },

    async diagnoseSources(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return diagnoseTrackedSources({
        sourceRepository: repositories.sourceRepository,
        sourceIngestHandlerRegistry,
        getAdapter: forumAdapterRegistry.get,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now
      });
    },

    async runSourceIngestTask(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      const source = await repositories.sourceRepository.findSource(safeRequest.sourceId);
      if (!source) {
        throw new Error('Unknown tracked source: ' + safeRequest.sourceId);
      }

      return runTrackedSourceIngestTask({
        sourceId: safeRequest.sourceId,
        sourceRepository: repositories.sourceRepository,
        getAdapter: forumAdapterRegistry.get,
        crawler: safeOptions.crawler || createHttpForumCrawler(safeOptions.crawlerOptions),
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        rawThreadPageRepository: repositories.rawThreadPageRepository,
        notificationEventRepository: repositories.notificationEventRepository,
        sourceIngestHandlerRegistry,
        sourceRunStaleAfterMs: resolveSourceRunStaleAfterMs(safeRequest, runtimeConfig),
        now: safeRequest.now
      });
    },

    async runSourceInsightPipelineTask(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      const source = await repositories.sourceRepository.findSource(safeRequest.sourceId);
      if (!source) {
        throw new Error('Unknown tracked source: ' + safeRequest.sourceId);
      }

      return runSourceInsightPipelineTask({
        sourceId: safeRequest.sourceId,
        sourceRepository: repositories.sourceRepository,
        getAdapter: forumAdapterRegistry.get,
        crawler: safeOptions.crawler || createHttpForumCrawler(safeOptions.crawlerOptions),
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        rawThreadPageRepository: repositories.rawThreadPageRepository,
        notificationEventRepository: repositories.notificationEventRepository,
        sourceIngestHandlerRegistry,
        llmProvider: createLlmProviderFor(safeRequest),
        sourceRunStaleAfterMs: resolveSourceRunStaleAfterMs(safeRequest, runtimeConfig),
        now: safeRequest.now,
        semanticEnrichment: {
          enabled: safeRequest.semanticEnrichmentEnabled !== false,
          skipIfUnchanged: safeRequest.semanticSkipIfUnchanged !== false,
          baseReportType: safeRequest.baseReportType,
          provider: safeRequest.provider || 'mock',
          traceId: safeRequest.traceId
        }
      });
    },

    async runEnabledSourcesIngestTasks(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return runEnabledSourcesIngestTasks({
        sourceRepository: repositories.sourceRepository,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        notificationEventRepository: repositories.notificationEventRepository,
        rawThreadPageRepository: repositories.rawThreadPageRepository,
        crawler: safeOptions.crawler || createHttpForumCrawler(safeOptions.crawlerOptions),
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        limit: safeRequest.limit || 50,
        now: safeRequest.now,
        sourceRunStaleAfterMs: resolveSourceRunStaleAfterMs(safeRequest, runtimeConfig),
        getAdapter: forumAdapterRegistry.get,
        sourceIngestHandlerRegistry
      });
    },

    async runDueSourcesIngestTasks(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return runDueSourcesIngestTasks({
        sourceRepository: repositories.sourceRepository,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        notificationEventRepository: repositories.notificationEventRepository,
        rawThreadPageRepository: repositories.rawThreadPageRepository,
        crawler: safeOptions.crawler || createHttpForumCrawler(safeOptions.crawlerOptions),
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        limit: safeRequest.limit || 50,
        now: safeRequest.now,
        sourceRunStaleAfterMs: resolveSourceRunStaleAfterMs(safeRequest, runtimeConfig),
        getAdapter: forumAdapterRegistry.get,
        sourceIngestHandlerRegistry
      });
    },

    async indexDirectory(request) {
      const safeRequest = request || {};
      return indexSavedThreadDirectory({
        adapter: forumAdapterRegistry.get(safeRequest.forum || defaults.defaultForum),
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

    async runDueSourceInsightPipelineTasks(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return runDueSourceInsightPipelineTasks({
        sourceKey: safeRequest.forum || safeRequest.sourceKey,
        limit: safeRequest.limit,
        now: safeRequest.now,
        sourceRunStaleAfterMs: resolveSourceRunStaleAfterMs(safeRequest, runtimeConfig),
        sourceRepository: repositories.sourceRepository,
        getAdapter: forumAdapterRegistry.get,
        crawler: safeOptions.crawler || createHttpForumCrawler(safeOptions.crawlerOptions),
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        rawThreadPageRepository: repositories.rawThreadPageRepository,
        notificationEventRepository: repositories.notificationEventRepository,
        sourceIngestHandlerRegistry,
        llmProvider: createLlmProviderFor(safeRequest),
        provider: safeRequest.provider || 'mock',
        traceId: safeRequest.traceId,
        baseReportType: safeRequest.baseReportType,
        semanticEnrichmentEnabled: safeRequest.semanticEnrichmentEnabled,
        semanticSkipIfUnchanged: safeRequest.semanticSkipIfUnchanged
      });
    },

    async fetchThreadPage(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      const source = safeRequest.sourceId
        ? await repositories.sourceRepository.findSource(safeRequest.sourceId)
        : undefined;
      if (safeRequest.sourceId && !source) {
        throw new Error('Unknown tracked source: ' + safeRequest.sourceId);
      }
      return fetchAndStoreThreadPage({
        crawler: safeOptions.crawler || createHttpForumCrawler(safeOptions.crawlerOptions),
        rawThreadPageRepository: repositories.rawThreadPageRepository,
        source,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        sourceThreadId: safeRequest.sourceThreadId,
        url: safeRequest.url,
        page: safeRequest.page,
        session: safeRequest.session,
        headers: safeRequest.headers
      });
    },

    async listRawThreadPages(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return repositories.rawThreadPageRepository.listRawThreadPages({
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        sourceThreadId: safeRequest.sourceThreadId,
        sourceUrl: safeRequest.sourceUrl || safeRequest.url,
        limit: safeRequest.limit || 50
      });
    },

    async runRawThreadPageIngestTask(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      const sourceKey = safeRequest.sourceKey || safeRequest.forum || defaults.defaultForum;
      return runIngestRawThreadPageTask({
        adapter: forumAdapterRegistry.get(sourceKey),
        rawThreadPageRepository: repositories.rawThreadPageRepository,
        threadRepository: repositories.threadRepository,
        reportRepository: repositories.reportRepository,
        taskRepository: repositories.taskRepository,
        sourceKey,
        contentSha1: safeRequest.contentSha1
      });
    },

    async listNotificationEvents(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
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
      const repositories = createRepositoriesFor(safeRequest.storeDir);
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
      const repositories = createRepositoriesFor(storeDir);
      return dispatchPendingNotificationEvents({
        notificationEventRepository: repositories.notificationEventRepository,
        notificationChannel: createNotificationChannel(safeRequest, storeDir, runtimeConfig.notifications),
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

function createFileRepositories(storeDir) {
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
    }),
    rawThreadPageRepository: createFileRawThreadPageRepository({
      baseDir: path.join(storeDir, 'raw-pages')
    }),
    workerRunRepository: createFileWorkerRunRepository({
      baseDir: path.join(storeDir, 'worker-runs')
    }),
    workerLeaseRepository: createFileWorkerLeaseRepository({
      baseDir: path.join(storeDir, 'worker-leases')
    })
  };
}

function resolveStoreDir(defaults, storeDir) {
  return storeDir || defaults.storeDir;
}

function resolveSourceRunStaleAfterMs(request, config) {
  if (request && request.sourceRunStaleAfterMs !== undefined) return request.sourceRunStaleAfterMs;
  return config && config.workers ? config.workers.sourceRunStaleAfterMs : undefined;
}

async function inspectRuntimeResources(config, getPostgresClient) {
  if (config.storageMode === 'file') {
    return inspectFileResources({
      inputDir: config.defaultInputDir,
      storeDir: config.storeDir
    });
  }
  if (config.storageMode === 'postgres') {
    try {
      return inspectPostgresResources({
        client: getPostgresClient()
      });
    } catch (error) {
      return inspectPostgresResources({
        error
      });
    }
  }
  return {
    storageMode: config.storageMode,
    checks: [
      {
        key: 'resources.storageMode',
        status: 'fail',
        value: config.storageMode,
        summary: 'Storage mode has no resource diagnostics implementation.'
      }
    ]
  };
}

function buildSchedule(request) {
  if (!request.intervalMinutes && !request.nextRunAt) return undefined;
  return {
    enabled: request.scheduleEnabled !== false,
    intervalMinutes: request.intervalMinutes ? Number(request.intervalMinutes) : undefined,
    nextRunAt: request.nextRunAt
  };
}

function createNotificationChannel(request, storeDir, notificationConfig) {
  const channel = request.channel || (request.webhookUrl ? 'webhook' : 'file');
  if (channel === 'webhook') {
    return createWebhookNotificationChannel({
      url: request.webhookUrl || (notificationConfig && notificationConfig.webhookUrl),
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
