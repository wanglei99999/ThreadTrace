'use strict';

const path = require('path');
const { createThreadTraceConfig } = require('./threadTraceConfig');
const { loadConnectorModulesReport } = require('./loadConnectorModules');
const { getThreadSnapshotJsonContract } = require('../domain/contracts/threadSnapshotJsonContract');
const { getConnectorModuleContract } = require('../domain/contracts/connectorModuleContract');
const { createDefaultForumAdapterRegistry } = require('../infrastructure/forum-adapters/registry');
const { analyzeSavedThreadDirectory } = require('../application/use-cases/analyzeSavedThreadDirectory');
const { interpretNewPostFromSavedThreadDirectory } = require('../application/use-cases/interpretNewPostFromSavedThreadDirectory');
const { ingestSavedThreadDirectory } = require('../application/use-cases/ingestSavedThreadDirectory');
const { diagnoseForumAdapters } = require('../application/use-cases/diagnoseForumAdapters');
const { runIngestSavedThreadDirectoryTask } = require('../application/use-cases/runIngestSavedThreadDirectoryTask');
const { registerTrackedSource } = require('../application/use-cases/registerTrackedSource');
const { validateTrackedSourceRegistration } = require('../application/use-cases/validateTrackedSourceRegistration');
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
const { getTaskTraceContext } = require('../application/use-cases/getTaskTraceContext');
const { getRuntimeDiagnostics } = require('../application/use-cases/getRuntimeDiagnostics');
const { getDeploymentChecklist } = require('../application/use-cases/getDeploymentChecklist');
const { getOperationsRunbook } = require('../application/use-cases/getOperationsRunbook');
const { getSourceConnectorCatalog } = require('../application/use-cases/getSourceConnectorCatalog');
const { getConnectorReadiness } = require('../application/use-cases/getConnectorReadiness');
const { getSourceOnboardingPreflight } = require('../application/use-cases/getSourceOnboardingPreflight');
const { getConnectorRolloutPlan } = require('../application/use-cases/getConnectorRolloutPlan');
const { getWorkerTopologyPlan } = require('../application/use-cases/getWorkerTopologyPlan');
const { getRolloutManifestPlan } = require('../application/use-cases/getRolloutManifestPlan');
const { getResourceProvisioningPlan } = require('../application/use-cases/getResourceProvisioningPlan');
const { getDeploymentGateReport } = require('../application/use-cases/getDeploymentGateReport');
const { getRolloutManifestApplyReport } = require('../application/use-cases/getRolloutManifestApplyReport');
const { dryRunSourceIngest } = require('../application/use-cases/dryRunSourceIngest');
const { createDefaultSourceIngestHandlerRegistry } = require('../application/source-ingest/standardSourceIngestHandlers');
const { migrateStoreRecords } = require('../application/use-cases/migrateStoreRecords');
const { runIngestRawThreadPageTask } = require('../application/use-cases/runIngestRawThreadPageTask');
const { validateNormalizedThreadJsonFile } = require('../application/use-cases/validateNormalizedThreadJsonFile');
const { validateConnectorModuleLoad } = require('../application/use-cases/validateConnectorModuleLoad');
const { indexSavedThreadDirectory } = require('../application/use-cases/indexSavedThreadDirectory');
const { searchEvidence } = require('../application/use-cases/searchEvidence');
const { createApplicationError } = require('../application/errors/applicationError');
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
    sourceTaskMode: safeOptions.sourceTaskMode,
    connectorModules: safeOptions.connectorModules
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
  const connectorModuleReport = loadConnectorModulesReport({
    modulePaths: connectorModulePaths(safeOptions, runtimeConfig),
    cwd: safeOptions.cwd,
    forumAdapterRegistry,
    sourceIngestHandlerRegistry,
    runtimeConfig
  });
  const connectorModules = connectorModuleReport.modules;
  const connectorModuleErrors = connectorModuleReport.errors;
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
    connectorModules,
    connectorModuleErrors,

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

    getThreadSnapshotJsonContract() {
      return getThreadSnapshotJsonContract();
    },

    getConnectorModuleContract() {
      return getConnectorModuleContract();
    },

    validateConnectorModule(request) {
      const safeRequest = request || {};
      const modulePath = safeRequest.modulePath || safeRequest.path;
      const resolvedModulePath = modulePath ? path.resolve(safeOptions.cwd || process.cwd(), modulePath) : undefined;
      const report = modulePath
        ? loadConnectorModulesReport({
          modulePaths: [modulePath],
          cwd: safeOptions.cwd,
          forumAdapterRegistry: createDefaultForumAdapterRegistry(),
          sourceIngestHandlerRegistry: createDefaultSourceIngestHandlerRegistry(),
          runtimeConfig,
          reload: true
        })
        : { modules: [], errors: [] };
      return validateConnectorModuleLoad({
        modulePath: resolvedModulePath,
        report,
        now: safeRequest.now
      });
    },

    getSourceConnectorCatalog(request) {
      const safeRequest = request || {};
      return getSourceConnectorCatalog({
        sourceIngestHandlerRegistry,
        forumAdapterRegistry,
        now: safeRequest.now
      });
    },

    async getConnectorReadiness(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return getConnectorReadiness({
        sourceRepository: repositories.sourceRepository,
        sourceIngestHandlerRegistry,
        forumAdapterRegistry,
        getAdapter: forumAdapterRegistry.get,
        connectorModules,
        connectorModuleErrors,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now
      });
    },

    async getSourceOnboardingPreflight(request) {
      const safeRequest = request || {};
      const sourceType = safeRequest.sourceType || 'saved-html-directory';
      const sourceInput = Object.assign(buildSourceRegistrationInput(safeRequest), {
        sourceType
      });
      const modulePath = safeRequest.modulePath || safeRequest.connectorModulePath;
      const preflightForumAdapterRegistry = modulePath ? createDefaultForumAdapterRegistry() : forumAdapterRegistry;
      const preflightSourceIngestHandlerRegistry = modulePath ? createDefaultSourceIngestHandlerRegistry() : sourceIngestHandlerRegistry;
      const connectorModuleReport = modulePath
        ? loadConnectorModulesReport({
          modulePaths: [modulePath],
          cwd: safeOptions.cwd,
          forumAdapterRegistry: preflightForumAdapterRegistry,
          sourceIngestHandlerRegistry: preflightSourceIngestHandlerRegistry,
          runtimeConfig,
          reload: true
        })
        : undefined;
      const connectorModuleValidation = connectorModuleReport
        ? validateConnectorModuleLoad({
          modulePath: path.resolve(safeOptions.cwd || process.cwd(), modulePath),
          report: connectorModuleReport,
          now: safeRequest.now
        })
        : undefined;
      const catalog = getSourceConnectorCatalog({
        sourceIngestHandlerRegistry: preflightSourceIngestHandlerRegistry,
        forumAdapterRegistry: preflightForumAdapterRegistry,
        now: safeRequest.now
      });
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      const connectorReadiness = await getConnectorReadiness({
        sourceRepository: repositories.sourceRepository,
        sourceIngestHandlerRegistry: preflightSourceIngestHandlerRegistry,
        forumAdapterRegistry: preflightForumAdapterRegistry,
        getAdapter: preflightForumAdapterRegistry.get,
        connectorModules: connectorModuleReport ? connectorModuleReport.modules : connectorModules,
        connectorModuleErrors: connectorModuleReport ? connectorModuleReport.errors : connectorModuleErrors,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now
      });
      const sourceValidation = validateTrackedSourceRegistration({
        sourceIngestHandlerRegistry: preflightSourceIngestHandlerRegistry,
        getAdapter: preflightForumAdapterRegistry.get,
        allowUnknownSourceType: safeRequest.allowUnknownSourceType,
        now: safeRequest.now,
        source: sourceInput
      });
      const threadJsonInputFile = sourceInput.inputFile || (sourceInput.location && sourceInput.location.inputFile);
      const threadJsonValidation = sourceType === 'normalized-thread-json' && threadJsonInputFile
        ? await validateNormalizedThreadJsonFile({
          forum: sourceInput.sourceKey,
          sourceKey: sourceInput.sourceKey,
          inputFile: threadJsonInputFile,
          now: safeRequest.now
        })
        : undefined;

      return getSourceOnboardingPreflight({
        now: safeRequest.now,
        sourceKey: sourceInput.sourceKey || safeRequest.forum,
        sourceType,
        catalog,
        connectorReadiness,
        sourceValidation,
        connectorModuleValidation,
        threadJsonValidation,
        threadSnapshotContract: getThreadSnapshotJsonContract()
      });
    },

    async dryRunSourceIngest(request) {
      const safeRequest = request || {};
      const sourceType = safeRequest.sourceType || (safeRequest.inputFile ? 'normalized-thread-json' : 'saved-html-directory');
      const sourceInput = Object.assign(buildSourceRegistrationInput(safeRequest), {
        sourceType
      });
      const modulePath = safeRequest.modulePath || safeRequest.connectorModulePath;
      const dryRunForumAdapterRegistry = modulePath ? createDefaultForumAdapterRegistry() : forumAdapterRegistry;
      const dryRunSourceIngestHandlerRegistry = modulePath ? createDefaultSourceIngestHandlerRegistry() : sourceIngestHandlerRegistry;
      if (modulePath) {
        loadConnectorModulesReport({
          modulePaths: [modulePath],
          cwd: safeOptions.cwd,
          forumAdapterRegistry: dryRunForumAdapterRegistry,
          sourceIngestHandlerRegistry: dryRunSourceIngestHandlerRegistry,
          runtimeConfig,
          reload: true
        });
      }

      return dryRunSourceIngest({
        source: sourceInput,
        sourceIngestHandlerRegistry: dryRunSourceIngestHandlerRegistry,
        getAdapter: dryRunForumAdapterRegistry.get,
        crawler: safeOptions.crawler || createHttpForumCrawler(safeOptions.crawlerOptions),
        allowUnknownSourceType: safeRequest.allowUnknownSourceType,
        allowRemoteFetch: safeRequest.allowRemoteFetch,
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey,
        now: safeRequest.now
      });
    },

    async getConnectorRolloutPlan(request) {
      const safeRequest = request || {};
      const modulePath = safeRequest.modulePath || safeRequest.connectorModulePath;
      const sourceKey = safeRequest.sourceKey || safeRequest.forum;
      const connectorModuleValidation = modulePath
        ? this.validateConnectorModule({
          modulePath,
          now: safeRequest.now
        })
        : undefined;
      const sourceOnboardingPreflight = shouldRunSourceOnboardingPreflight(safeRequest)
        ? await this.getSourceOnboardingPreflight(Object.assign({}, safeRequest, {
          modulePath
        }))
        : undefined;
      const sourceIngestDryRun = shouldRunSourceIngestDryRun(safeRequest)
        ? await this.dryRunSourceIngest(Object.assign({}, safeRequest, {
          modulePath
        }))
        : undefined;
      const connectorReadiness = await this.getConnectorReadiness({
        sourceKey,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir
      });
      const deploymentChecklist = await this.getDeploymentChecklist({
        forum: safeRequest.forum,
        sourceKey,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });

      return getConnectorRolloutPlan({
        connectorModuleContract: getConnectorModuleContract(),
        connectorModuleValidation,
        sourceOnboardingPreflight,
        sourceIngestDryRun,
        connectorReadiness,
        deploymentChecklist,
        sourceKey,
        sourceType: safeRequest.sourceType || (sourceOnboardingPreflight && sourceOnboardingPreflight.sourceType),
        modulePath,
        now: safeRequest.now
      });
    },

    async getRolloutManifestPlan(request) {
      const safeRequest = request || {};
      const manifest = safeRequest.manifest || {};
      const deployment = manifest.deployment || {};
      const now = safeRequest.now || manifest.now;
      const connectorRolloutPlan = manifest.source
        ? await this.getConnectorRolloutPlan(buildManifestConnectorRolloutRequest({
          manifest,
          now,
          storeDir: safeRequest.storeDir || deployment.storeDir,
          limit: safeRequest.limit || deployment.limit,
          workerStaleAfterMs: safeRequest.workerStaleAfterMs || deployment.workerStaleAfterMs
        }))
        : undefined;
      const workerTopologyPlan = manifest.workers && manifest.workers.enabled === false
        ? undefined
        : await this.getWorkerTopologyPlan(buildManifestWorkerTopologyRequest({
          manifest,
          now,
          storeDir: safeRequest.storeDir || deployment.storeDir,
          limit: safeRequest.limit || deployment.limit,
          workerStaleAfterMs: safeRequest.workerStaleAfterMs || deployment.workerStaleAfterMs
        }));

      return getRolloutManifestPlan({
        now,
        manifest,
        connectorRolloutPlan,
        workerTopologyPlan
      });
    },

    async getResourceProvisioningPlan(request) {
      const safeRequest = request || {};
      const diagnostics = await this.getRuntimeDiagnostics({
        now: safeRequest.now
      });
      const deploymentChecklist = await this.getDeploymentChecklist({
        forum: safeRequest.forum,
        sourceKey: safeRequest.sourceKey,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });
      const rolloutManifestPlan = safeRequest.manifest
        ? await this.getRolloutManifestPlan({
          manifest: safeRequest.manifest,
          now: safeRequest.now,
          storeDir: safeRequest.storeDir,
          limit: safeRequest.limit,
          workerStaleAfterMs: safeRequest.workerStaleAfterMs
        })
        : undefined;

      return getResourceProvisioningPlan({
        config: runtimeConfig,
        runtimeDiagnostics: diagnostics,
        deploymentChecklist,
        rolloutManifestPlan,
        manifest: safeRequest.manifest,
        now: safeRequest.now
      });
    },

    async getDeploymentGateReport(request) {
      const safeRequest = request || {};
      const rolloutManifestPlan = safeRequest.manifest
        ? await this.getRolloutManifestPlan({
          manifest: safeRequest.manifest,
          now: safeRequest.now,
          storeDir: safeRequest.storeDir,
          limit: safeRequest.limit,
          workerStaleAfterMs: safeRequest.workerStaleAfterMs
        })
        : undefined;
      const resourceProvisioningPlan = await this.getResourceProvisioningPlan({
        manifest: safeRequest.manifest,
        forum: safeRequest.forum,
        sourceKey: safeRequest.sourceKey,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });
      const deploymentChecklist = await this.getDeploymentChecklist({
        forum: safeRequest.forum,
        sourceKey: safeRequest.sourceKey,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });
      const operationsRunbook = await this.getOperationsRunbook({
        forum: safeRequest.forum,
        sourceKey: safeRequest.sourceKey,
        sourceId: safeRequest.sourceId,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        pipelineLimit: safeRequest.pipelineLimit || 20,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });

      return getDeploymentGateReport({
        rolloutManifestPlan,
        resourceProvisioningPlan,
        deploymentChecklist,
        operationsRunbook,
        now: safeRequest.now
      });
    },

    async applyRolloutManifest(request) {
      const safeRequest = request || {};
      const manifest = safeRequest.manifest || {};
      const execute = safeRequest.execute === true;
      const sourceDraft = manifest.source ? buildManifestSourceRegistrationRequest(manifest) : undefined;
      const deploymentGate = await this.getDeploymentGateReport({
        manifest,
        forum: safeRequest.forum,
        sourceKey: safeRequest.sourceKey || (sourceDraft && sourceDraft.sourceKey),
        sourceId: safeRequest.sourceId,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        pipelineLimit: safeRequest.pipelineLimit || 20,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir,
        workerStaleAfterMs: safeRequest.workerStaleAfterMs
      });
      let registration;
      let registrationError;
      if (execute && sourceDraft && deploymentGate.status !== 'fail') {
        try {
          registration = await this.registerSource(Object.assign({}, sourceDraft, {
            storeDir: safeRequest.storeDir,
            allowUnknownSourceType: sourceDraft.allowUnknownSourceType
          }));
        } catch (error) {
          registrationError = error;
        }
      }

      return getRolloutManifestApplyReport({
        manifest,
        execute,
        deploymentGate,
        sourceDraft,
        registration,
        registrationError,
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
        notificationEventRepository: repositories.notificationEventRepository,
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey
      });
    },

    async listTasks(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return repositories.taskRepository.listTasks({
        status: safeRequest.status,
        type: safeRequest.type,
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey,
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
        llmProvider: createLlmProviderFor(safeRequest),
        requestId: safeRequest.requestId,
        idempotencyKey: safeRequest.idempotencyKey
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

    async getTaskTraceContext(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      return getTaskTraceContext({
        taskRepository: repositories.taskRepository,
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey,
        status: safeRequest.status,
        type: safeRequest.type,
        limit: safeRequest.limit || 50,
        now: safeRequest.now
      });
    },

    async getRuntimeDiagnostics(request) {
      const safeRequest = request || {};
      return getRuntimeDiagnostics({
        config: runtimeConfig,
        inspectResources: function (config) {
          return inspectRuntimeResources(config, getPostgresClient);
        },
        connectorModuleErrors,
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
      const connectorReadiness = await this.getConnectorReadiness({
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        enabled: safeRequest.enabled,
        limit: safeRequest.limit || 100,
        now: safeRequest.now,
        storeDir: safeRequest.storeDir
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
        connectorReadiness,
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

    async getWorkerTopologyPlan(request) {
      const safeRequest = request || {};
      const checklist = safeRequest.includeDeploymentChecklist === false
        ? undefined
        : await this.getDeploymentChecklist({
          forum: safeRequest.forum,
          sourceKey: safeRequest.sourceKey,
          enabled: safeRequest.enabled,
          limit: safeRequest.limit || 100,
          now: safeRequest.now,
          storeDir: safeRequest.storeDir,
          workerStaleAfterMs: safeRequest.workerStaleAfterMs
        });
      const overview = safeRequest.includeOperationalOverview === false
        ? undefined
        : await this.getOperationalOverview({
          limit: safeRequest.limit || 100,
          now: safeRequest.now,
          storeDir: safeRequest.storeDir,
          workerStaleAfterMs: safeRequest.workerStaleAfterMs
        });

      return getWorkerTopologyPlan({
        config: runtimeConfig,
        storageMode: safeRequest.storageMode || runtimeConfig.storageMode,
        sourceTaskMode: safeRequest.sourceTaskMode || runtimeConfig.workers.sourceTaskMode,
        topology: safeRequest.topology || safeRequest.deploymentTopology,
        deploymentChecklist: checklist,
        operationalOverview: overview,
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
        source: buildSourceRegistrationInput(safeRequest)
      });
    },

    validateSourceRegistration(request) {
      const safeRequest = request || {};
      return validateTrackedSourceRegistration({
        sourceIngestHandlerRegistry,
        getAdapter: forumAdapterRegistry.get,
        allowUnknownSourceType: safeRequest.allowUnknownSourceType,
        now: safeRequest.now,
        source: buildSourceRegistrationInput(safeRequest)
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
        throw sourceNotFoundError(safeRequest.sourceId);
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
        now: safeRequest.now,
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey
      });
    },

    async runSourceInsightPipelineTask(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      const source = await repositories.sourceRepository.findSource(safeRequest.sourceId);
      if (!source) {
        throw sourceNotFoundError(safeRequest.sourceId);
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
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey,
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
        sourceIngestHandlerRegistry,
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey
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
        sourceIngestHandlerRegistry,
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey
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
        semanticSkipIfUnchanged: safeRequest.semanticSkipIfUnchanged,
        requestId: safeRequest.requestId,
        idempotencyKey: safeRequest.idempotencyKey
      });
    },

    async fetchThreadPage(request) {
      const safeRequest = request || {};
      const repositories = createRepositoriesFor(safeRequest.storeDir);
      const source = safeRequest.sourceId
        ? await repositories.sourceRepository.findSource(safeRequest.sourceId)
        : undefined;
      if (safeRequest.sourceId && !source) {
        throw sourceNotFoundError(safeRequest.sourceId);
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
        contentSha1: safeRequest.contentSha1,
        requestId: safeRequest.requestId,
        traceId: safeRequest.traceId,
        idempotencyKey: safeRequest.idempotencyKey
      });
    },

    async validateNormalizedThreadJsonFile(request) {
      const safeRequest = request || {};
      return validateNormalizedThreadJsonFile({
        inputFile: safeRequest.inputFile,
        sourceKey: safeRequest.sourceKey || safeRequest.forum,
        now: safeRequest.now
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

function buildManifestConnectorRolloutRequest(options) {
  const safeOptions = options || {};
  const manifest = safeOptions.manifest || {};
  const source = manifest.source || {};
  const connector = manifest.connector || {};
  const ingest = manifest.ingest || {};
  const deployment = manifest.deployment || {};
  return Object.assign({}, source, {
    forum: source.forum || source.sourceKey,
    sourceKey: source.sourceKey || source.forum,
    displayName: source.displayName || source.name,
    modulePath: connector.modulePath || source.modulePath,
    allowUnknownSourceType: source.allowUnknownSourceType,
    allowRemoteFetch: ingest.allowRemoteFetch,
    dryRunIngest: ingest.dryRun === undefined ? ingest.dryRunIngest : ingest.dryRun,
    limit: safeOptions.limit || deployment.limit,
    now: safeOptions.now,
    storeDir: safeOptions.storeDir || deployment.storeDir,
    workerStaleAfterMs: safeOptions.workerStaleAfterMs || deployment.workerStaleAfterMs
  });
}

function buildManifestWorkerTopologyRequest(options) {
  const safeOptions = options || {};
  const manifest = safeOptions.manifest || {};
  const source = manifest.source || {};
  const workers = manifest.workers || {};
  const deployment = manifest.deployment || {};
  return {
    forum: source.forum || source.sourceKey,
    sourceKey: source.sourceKey || source.forum,
    enabled: source.enabled,
    topology: workers.topology,
    sourceTaskMode: workers.sourceTaskMode,
    limit: safeOptions.limit || deployment.limit,
    now: safeOptions.now,
    storeDir: safeOptions.storeDir || deployment.storeDir,
    workerStaleAfterMs: safeOptions.workerStaleAfterMs || deployment.workerStaleAfterMs
  };
}

function buildManifestSourceRegistrationRequest(manifest) {
  const safeManifest = manifest || {};
  const source = safeManifest.source || {};
  return Object.assign({}, source, {
    forum: source.forum || source.sourceKey,
    sourceKey: source.sourceKey || source.forum,
    displayName: source.displayName || source.name,
    enabled: source.enabled,
    schedule: source.schedule
  });
}

function sourceNotFoundError(sourceId) {
  return createApplicationError('source_not_found', 'Unknown tracked source: ' + sourceId, {
    statusCode: 404,
    details: {
      sourceId
    }
  });
}

function buildSourceRegistrationInput(request) {
  const safeRequest = request || {};
  return {
    id: safeRequest.id,
    sourceKey: safeRequest.sourceKey || safeRequest.forum,
    sourceType: safeRequest.sourceType,
    displayName: safeRequest.displayName || safeRequest.name,
    inputDir: safeRequest.inputDir,
    inputFile: safeRequest.inputFile,
    url: safeRequest.url,
    location: safeRequest.location,
    enabled: safeRequest.enabled,
    tags: safeRequest.tags,
    schedule: safeRequest.schedule || buildSchedule(safeRequest)
  };
}

function resolveStoreDir(defaults, storeDir) {
  return storeDir || defaults.storeDir;
}

function resolveSourceRunStaleAfterMs(request, config) {
  if (request && request.sourceRunStaleAfterMs !== undefined) return request.sourceRunStaleAfterMs;
  return config && config.workers ? config.workers.sourceRunStaleAfterMs : undefined;
}

function shouldRunSourceOnboardingPreflight(request) {
  if (!request) return false;
  return Boolean(
    request.sourceType ||
    request.inputDir ||
    request.inputFile ||
    request.url ||
    request.location
  );
}

function shouldRunSourceIngestDryRun(request) {
  if (!request) return false;
  return request.dryRunIngest === true || request.includeIngestDryRun === true;
}

function connectorModulePaths(options, config) {
  if (Array.isArray(options.connectorModules)) return options.connectorModules;
  return (config.connectors && config.connectors.modules) || [];
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
