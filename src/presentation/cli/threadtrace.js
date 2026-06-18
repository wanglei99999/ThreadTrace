#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseSavedThread } = require('../../application/use-cases/parseSavedThread');
const { analyzeSavedThread } = require('../../application/use-cases/analyzeSavedThread');
const { parseSavedThreadDirectory } = require('../../application/use-cases/parseSavedThreadDirectory');
const { analyzeSavedThreadDirectory } = require('../../application/use-cases/analyzeSavedThreadDirectory');
const { interpretNewPostFromSavedThreadDirectory } = require('../../application/use-cases/interpretNewPostFromSavedThreadDirectory');
const { writeJsonFile } = require('../../infrastructure/storage/jsonFileStorage');
const { writeTextFile } = require('../../infrastructure/storage/textFileWriter');
const { getForumAdapter } = require('../../infrastructure/forum-adapters/registry');
const { renderBasicHistoryMarkdown } = require('../../domain/analysis/markdownReportRenderer');
const { renderNewPostContextMarkdown } = require('../../domain/analysis/contextMarkdownRenderer');
const { loadEnvFile } = require('../../runtime/envFileLoader');
const { createThreadTraceConfig } = require('../../runtime/threadTraceConfig');
const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');

function main(argv) {
  loadEnvFile({
    cwd: process.cwd()
  });
  const command = argv[2] || 'help';
  const options = parseArgs(argv.slice(3));
  const config = createThreadTraceConfig({
    env: process.env,
    cwd: process.cwd(),
    defaultForum: options.forum,
    defaultInputDir: options.input,
    storeDir: options.storeDir,
    llmProvider: options.provider,
    sourceTaskMode: options.sourceTaskMode,
    workerLeaseTtlMs: options.leaseTtlMs
  });
  const runtime = createThreadTraceRuntime({
    config
  });
  const defaultForum = config.defaultForum;
  const defaultInputDir = config.defaultInputDir;
  const defaultStoreDir = config.storeDir;
  const defaultLlmProvider = config.llm.provider;

  if (command === 'parse-html') {
    const inputPath = options.input || findDefaultExampleHtml(defaultInputDir);
    const adapter = getForumAdapter(options.forum || defaultForum);
    const threadSnapshot = parseSavedThread({
      adapter,
      inputPath
    });
    const outputPath = options.output || defaultParsedOutputPath(threadSnapshot);
    const writtenPath = writeJsonFile(outputPath, threadSnapshot);

    printThreadSummary(threadSnapshot);
    console.log('Parsed JSON written to: ' + writtenPath);
    return;
  }

  if (command === 'parse-html-dir') {
    const inputDir = options.input || defaultInputDir;
    const adapter = getForumAdapter(options.forum || defaultForum);
    const threadSnapshot = parseSavedThreadDirectory({
      adapter,
      inputDir
    });
    const outputPath = options.output || defaultParsedOutputPath(threadSnapshot);
    const writtenPath = writeJsonFile(outputPath, threadSnapshot);

    printThreadSummary(threadSnapshot);
    console.log('Parsed merged JSON written to: ' + writtenPath);
    return;
  }

  if (command === 'analyze-html') {
    const inputPath = options.input || findDefaultExampleHtml(defaultInputDir);
    const adapter = getForumAdapter(options.forum || defaultForum);
    const result = analyzeSavedThread({
      adapter,
      inputPath
    });
    const outputPath = options.output || defaultReportOutputPath(result.threadSnapshot);
    const writtenPath = writeJsonFile(outputPath, result.report);
    const markdownPath = options.markdownOutput || defaultMarkdownReportOutputPath(result.threadSnapshot);
    const writtenMarkdownPath = writeTextFile(markdownPath, renderBasicHistoryMarkdown(result.report));

    printThreadSummary(result.threadSnapshot);
    printReportSummary(result.report);
    console.log('Analysis report written to: ' + writtenPath);
    console.log('Markdown report written to: ' + writtenMarkdownPath);
    return;
  }

  if (command === 'analyze-html-dir') {
    const inputDir = options.input || defaultInputDir;
    const adapter = getForumAdapter(options.forum || defaultForum);
    const result = analyzeSavedThreadDirectory({
      adapter,
      inputDir
    });
    const outputPath = options.output || defaultReportOutputPath(result.threadSnapshot);
    const writtenPath = writeJsonFile(outputPath, result.report);
    const markdownPath = options.markdownOutput || defaultMarkdownReportOutputPath(result.threadSnapshot);
    const writtenMarkdownPath = writeTextFile(markdownPath, renderBasicHistoryMarkdown(result.report));

    printThreadSummary(result.threadSnapshot);
    printReportSummary(result.report);
    console.log('Merged analysis report written to: ' + writtenPath);
    console.log('Merged markdown report written to: ' + writtenMarkdownPath);
    return;
  }

  if (command === 'enrich-html-dir') {
    const inputDir = options.input || defaultInputDir;
    runtime.enrichDirectory({
      forum: options.forum,
      inputDir,
      provider: options.provider || defaultLlmProvider
    }).then(function (result) {
      printThreadSummary(result.threadSnapshot);
      printReportSummary(result.report);
      console.log('Semantic provider: ' + result.report.semanticInsights.provider);
      console.log('Semantic summary: ' + result.report.semanticInsights.summary);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'ingest-html-dir') {
    const inputDir = options.input || defaultInputDir;
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.ingestDirectory({
      forum: options.forum,
      inputDir,
      storeDir
    }).then(function (result) {
      printThreadSummary(result.threadSnapshot);
      printReportSummary(result.report);
      console.log('Snapshot and report stored under: ' + storeDir);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-ingest-task') {
    const inputDir = options.input || defaultInputDir;
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runIngestDirectoryTask({
      forum: options.forum,
      inputDir,
      storeDir
    }).then(function (result) {
      console.log('Task completed: ' + result.task.id);
      console.log('Snapshot and report stored under: ' + storeDir);
      printThreadSummary(result.threadSnapshot);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-tasks') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.listTasks({
      storeDir,
      status: options.status,
      type: options.type,
      requestId: options.requestId,
      traceId: options.traceId,
      idempotencyKey: options.idempotencyKey,
      limit: options.limit ? Number(options.limit) : 20
    }).then(function (tasks) {
      tasks.forEach(function (task) {
        console.log(task.id + '\t' + task.status + '\t' + task.type + '\t' + task.createdAt);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-reports') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.listAnalysisReports({
      storeDir,
      sourceKey: options.sourceKey || options.forum,
      sourceThreadId: options.sourceThreadId,
      reportType: options.reportType,
      limit: options.limit ? Number(options.limit) : 20
    }).then(function (reports) {
      reports.forEach(function (report) {
        const thread = report.thread || {};
        console.log((report.generatedAt || '') + '\t' + (report.reportType || '') + '\t' + (thread.sourceKey || '') + '\t' + (thread.sourceThreadId || '') + '\t' + (thread.title || ''));
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-semantic-enrichment-task') {
    if (!options.sourceThreadId) {
      console.error('run-semantic-enrichment-task requires --source-thread-id.');
      process.exitCode = 1;
      return;
    }
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runSemanticEnrichmentTask({
      storeDir,
      sourceKey: options.sourceKey || options.forum,
      sourceThreadId: options.sourceThreadId,
      baseReportType: options.baseReportType,
      provider: options.provider || defaultLlmProvider,
      traceId: options.traceId
    }).then(function (result) {
      console.log('Task completed: ' + result.task.id);
      console.log('Report type: ' + result.report.reportType);
      console.log('Semantic provider: ' + result.report.semanticInsights.provider);
      console.log('Semantic summary: ' + result.report.semanticInsights.summary);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'operations-overview') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getOperationalOverview({
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir
    }).then(function (overview) {
      console.log('Storage: ' + overview.storageMode);
      console.log('Sources: total=' + overview.sources.total + ', enabled=' + overview.sources.enabled + ', due=' + overview.sources.due + ', failed=' + overview.sources.failed);
      console.log('Tasks: total=' + overview.tasks.total + ', running=' + overview.tasks.running + ', failed=' + overview.tasks.failed);
      console.log('Events: pending=' + overview.events.pending + ', failed=' + overview.events.failed + ', unacknowledged=' + overview.events.unacknowledged + ', due=' + overview.events.dueForDelivery);
      console.log('Workers: running=' + overview.workers.running + ', stale=' + overview.workers.stale + ', failed=' + overview.workers.failed + ', latestHeartbeat=' + (overview.workers.latestHeartbeatAt || 'none'));
      console.log('Worker leases: active=' + overview.workers.leases.active + ', expired=' + overview.workers.leases.expired);
      console.log('Raw pages: total=' + overview.rawPages.total + ', latest=' + (overview.rawPages.latestFetchedAt || 'none'));
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'operations-readiness') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getOperationalReadiness({
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir
    }).then(function (readiness) {
      console.log('Readiness: ' + readiness.status);
      readiness.checks.forEach(function (check) {
        console.log(check.status + '\t' + check.key + '\t' + check.count + '\t' + check.summary);
      });
      if (readiness.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'trace-context') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getTaskTraceContext({
      requestId: options.requestId,
      traceId: options.traceId,
      idempotencyKey: options.idempotencyKey,
      status: options.status,
      type: options.type,
      limit: options.limit ? Number(options.limit) : 50,
      now: options.now,
      storeDir
    }).then(function (result) {
      console.log('Trace context: tasks=' + result.taskCount);
      console.log('Query: requestId=' + (result.query.requestId || '') + ', traceId=' + (result.query.traceId || '') + ', idempotencyKey=' + (result.query.idempotencyKey || ''));
      result.tasks.forEach(function (task) {
        console.log(task.status + '\t' + task.type + '\t' + task.id + '\t' + task.createdAt);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'operations-runbook') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getOperationsRunbook({
      forum: options.forum,
      sourceKey: options.sourceKey,
      sourceId: options.sourceId,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      limit: options.limit ? Number(options.limit) : 100,
      pipelineLimit: options.pipelineLimit ? Number(options.pipelineLimit) : 20,
      now: options.now,
      storeDir
    }).then(function (runbook) {
      console.log('Operations runbook: ' + runbook.status);
      console.log('Actions: ' + runbook.actionCount);
      runbook.actions.forEach(function (action) {
        console.log(action.severity + '\t' + action.area + '\t' + action.key + '\t' + action.title);
        if (action.recommendedCommand) {
          console.log('  command: ' + action.recommendedCommand);
        }
        (action.relatedCommands || []).forEach(function (command) {
          console.log('  related: ' + command);
        });
      });
      if (runbook.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'worker-topology-plan') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getWorkerTopologyPlan({
      forum: options.forum,
      sourceKey: options.sourceKey,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      topology: options.topology,
      sourceTaskMode: options.sourceTaskMode,
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir,
      workerStaleAfterMs: options.workerStaleAfterMs ? Number(options.workerStaleAfterMs) : undefined
    }).then(function (plan) {
      console.log('Worker topology plan: ' + plan.status);
      console.log('Topology: ' + plan.topology + '\tstorage=' + plan.storageMode + '\tsourceTaskMode=' + plan.sourceTaskMode);
      console.log('Workers: ' + plan.workers.length);
      plan.workers.forEach(function (worker) {
        console.log(worker.workerType + '\t' + worker.scale + '\tintervalMs=' + worker.intervalMs + '\tlease=' + worker.leaseKey);
        console.log('  command: ' + worker.command);
      });
      console.log('Checks: ' + plan.checks.length);
      plan.checks.forEach(function (check) {
        console.log(check.status + '\t' + check.key + '\t' + check.summary);
      });
      console.log('Next actions: ' + plan.nextActions.length);
      plan.nextActions.forEach(function (action) {
        console.log(action.severity + '\t' + action.key + '\t' + action.command);
      });
      if (plan.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'runtime-diagnostics') {
    runtime.getRuntimeDiagnostics({
      now: options.now
    }).then(function (diagnostics) {
      console.log('Diagnostics: ' + diagnostics.status);
      console.log('Storage: ' + diagnostics.configuration.storageMode);
      console.log('Store dir: ' + diagnostics.configuration.storeDir);
      console.log('LLM provider: ' + diagnostics.configuration.llm.provider);
      console.log('Source task mode: ' + diagnostics.configuration.workers.sourceTaskMode);
      console.log('Source run stale after ms: ' + diagnostics.configuration.workers.sourceRunStaleAfterMs);
      diagnostics.checks.forEach(function (check) {
        console.log(check.status + '\t' + check.key + '\t' + check.summary);
      });
      if (diagnostics.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'adapter-diagnostics') {
    runtime.diagnoseAdapters({
      now: options.now
    }).then(function (diagnostics) {
      console.log('Adapter diagnostics: ' + diagnostics.status);
      console.log('Adapters: ' + diagnostics.adapterCount);
      diagnostics.adapters.forEach(function (adapter) {
        const nonOkChecks = adapter.checks.filter(function (check) {
          return check.status !== 'ok';
        }).map(function (check) {
          return check.key + '=' + check.status;
        }).join(',');
        console.log(adapter.status + '\t' + adapter.sourceKey + '\t' + adapter.displayName + (nonOkChecks ? '\t' + nonOkChecks : ''));
      });
      if (diagnostics.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'deployment-checklist') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getDeploymentChecklist({
      forum: options.forum,
      sourceKey: options.sourceKey,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir
    }).then(function (checklist) {
      console.log('Deployment checklist: ' + checklist.status);
      checklist.items.forEach(function (item) {
        console.log(item.status + '\t' + item.area + '\t' + item.key + '\t' + item.summary);
      });
      if (checklist.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'migrate-store') {
    const fromStoreDir = options.fromStoreDir || options.storeDir || defaultStoreDir;
    runtime.migrateStore({
      fromStoreDir,
      toStoreDir: options.toStoreDir,
      dryRun: options.dryRun === undefined ? true : options.dryRun !== 'false',
      limit: options.limit ? Number(options.limit) : undefined
    }).then(function (summary) {
      console.log('Dry run: ' + summary.dryRun);
      console.log('Sources: ' + summary.migrated.sources);
      console.log('Threads: ' + summary.migrated.threadSnapshots);
      console.log('Reports: ' + summary.migrated.analysisReports);
      console.log('Tasks: ' + summary.migrated.tasks);
      console.log('Events: ' + summary.migrated.notificationEvents);
      console.log('Raw pages: ' + summary.migrated.rawThreadPages);
      console.log('Worker runs: ' + summary.migrated.workerRuns);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-events') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.listNotificationEvents({
      storeDir,
      type: options.type,
      sourceId: options.sourceId,
      acknowledged: options.acknowledged === undefined ? undefined : options.acknowledged === 'true',
      deliveryStatus: options.deliveryStatus,
      limit: options.limit ? Number(options.limit) : 50
    }).then(function (events) {
      events.forEach(function (event) {
        console.log(event.createdAt + '\t' + event.type + '\t' + event.sourceId + '\t' + event.summary);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'fetch-thread-page') {
    if (!options.url && !options.sourceId) {
      throw new Error('fetch-thread-page requires --url or --source-id.');
    }
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.fetchThreadPage({
      sourceId: options.sourceId,
      forum: options.forum,
      sourceThreadId: options.sourceThreadId,
      url: options.url,
      page: options.page ? Number(options.page) : undefined,
      storeDir
    }).then(function (result) {
      console.log('Fetched raw page: ' + result.rawPage.contentSha1);
      console.log('Source: ' + result.rawPage.sourceKey);
      console.log('URL: ' + result.rawPage.sourceUrl);
      console.log('Duplicate: ' + result.duplicate);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-raw-pages') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.listRawThreadPages({
      forum: options.forum,
      sourceThreadId: options.sourceThreadId,
      url: options.url,
      limit: options.limit ? Number(options.limit) : 50,
      storeDir
    }).then(function (pages) {
      pages.forEach(function (page) {
        console.log(page.fetchedAt + '\t' + page.sourceKey + '\t' + page.contentSha1 + '\t' + page.sourceUrl);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'ingest-raw-page') {
    if (!options.contentSha1) {
      throw new Error('ingest-raw-page requires --content-sha1.');
    }
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runRawThreadPageIngestTask({
      forum: options.forum,
      contentSha1: options.contentSha1,
      storeDir
    }).then(function (result) {
      console.log('Task completed: ' + result.task.id);
      console.log('Raw page: ' + result.rawPage.contentSha1);
      printThreadSummary(result.threadSnapshot);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'dispatch-events') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.dispatchNotificationEvents({
      channel: options.channel,
      webhookUrl: options.webhookUrl,
      timeoutMs: options.timeoutMs ? Number(options.timeoutMs) : undefined,
      limit: options.limit ? Number(options.limit) : 50,
      maxAttempts: options.maxAttempts ? Number(options.maxAttempts) : 3,
      retryBackoffMs: options.retryBackoffMs ? Number(options.retryBackoffMs) : undefined,
      maxRetryBackoffMs: options.maxRetryBackoffMs ? Number(options.maxRetryBackoffMs) : undefined,
      includeFailed: options.includeFailed === undefined ? undefined : options.includeFailed !== 'false',
      storeDir
    }).then(function (result) {
      console.log('Channel: ' + result.channelKey);
      console.log('Dispatched: ' + result.dispatchedCount);
      console.log('Failed: ' + result.failedCount);
      console.log('Skipped: ' + result.skippedCount);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'ack-event') {
    if (!options.eventId) {
      throw new Error('ack-event requires --event-id.');
    }
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.acknowledgeNotificationEvent({
      eventId: options.eventId,
      acknowledgedBy: options.by,
      note: options.note,
      storeDir
    }).then(function (result) {
      console.log('Acknowledged event: ' + result.event.id);
      console.log(result.event.acknowledgedAt + '\t' + result.event.acknowledgedBy);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'register-source') {
    const sourceType = options.sourceType || 'saved-html-directory';
    const inputDir = options.input || (sourceType === 'saved-html-directory' ? defaultInputDir : undefined);
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.registerSource({
      id: options.sourceId,
      forum: options.forum,
      sourceType,
      displayName: options.name,
      inputDir,
      inputFile: options.inputFile,
      url: options.url,
      location: parseLocationOption(options),
      enabled: options.enabled !== 'false',
      allowUnknownSourceType: options.allowUnknownSourceType === 'true',
      intervalMinutes: options.intervalMinutes,
      nextRunAt: options.nextRunAt,
      scheduleEnabled: options.scheduleEnabled === undefined ? undefined : options.scheduleEnabled !== 'false',
      storeDir
    }).then(function (result) {
      console.log((result.created ? 'Created' : 'Updated') + ' source: ' + result.source.id);
      console.log(result.source.sourceKey + '\t' + result.source.sourceType + '\t' + result.source.displayName);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'validate-source') {
    const sourceType = options.sourceType || 'saved-html-directory';
    const inputDir = options.input || (sourceType === 'saved-html-directory' ? defaultInputDir : undefined);
    const result = runtime.validateSourceRegistration({
      id: options.sourceId,
      forum: options.forum,
      sourceType,
      displayName: options.name,
      inputDir,
      inputFile: options.inputFile,
      url: options.url,
      location: parseLocationOption(options),
      enabled: options.enabled === undefined ? undefined : options.enabled !== 'false',
      allowUnknownSourceType: options.allowUnknownSourceType === 'true',
      allowRemoteFetch: options.allowRemoteFetch === 'true',
      dryRunIngest: options.dryRunIngest === 'true',
      intervalMinutes: options.intervalMinutes,
      nextRunAt: options.nextRunAt,
      scheduleEnabled: options.scheduleEnabled === undefined ? undefined : options.scheduleEnabled !== 'false',
      now: options.now
    });
    console.log('Source validation: valid=' + result.valid + ', status=' + result.status);
    if (result.source) {
      console.log(result.source.id + '\t' + result.source.sourceKey + '\t' + result.source.sourceType + '\t' + result.source.displayName);
    }
    if (result.error) {
      console.log('Error: ' + result.error.code + '\t' + result.error.message);
    }
    result.checks.forEach(function (check) {
      console.log(check.status + '\t' + check.key + '\t' + check.summary + '\t' + check.value);
    });
    if (!result.valid || result.status === 'fail') {
      process.exitCode = 2;
    }
    return;
  }

  if (command === 'validate-thread-json') {
    runtime.validateNormalizedThreadJsonFile({
      forum: options.forum,
      sourceKey: options.sourceKey,
      inputFile: options.inputFile || options.input,
      now: options.now
    }).then(function (result) {
      console.log('Thread JSON validation: valid=' + result.valid + ', status=' + result.status);
      if (result.thread) {
        console.log(result.thread.sourceKey + '\t' + result.thread.sourceThreadId + '\tposts=' + result.thread.postCount);
      }
      if (result.error) {
        console.log('Error: ' + result.error.code + '\t' + result.error.message);
      }
      result.checks.forEach(function (check) {
        console.log(check.status + '\t' + check.key + '\t' + check.summary + '\t' + check.value);
      });
      if (!result.valid) {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'source-onboarding-preflight') {
    const sourceType = options.sourceType || (options.inputFile ? 'normalized-thread-json' : 'saved-html-directory');
    const inputDir = options.input || (sourceType === 'saved-html-directory' ? defaultInputDir : undefined);
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getSourceOnboardingPreflight({
      id: options.sourceId,
      forum: options.forum,
      sourceKey: options.sourceKey,
      sourceType,
      displayName: options.name,
      modulePath: options.modulePath,
      inputDir,
      inputFile: options.inputFile,
      url: options.url,
      location: parseLocationOption(options),
      enabled: options.enabled === undefined ? undefined : options.enabled !== 'false',
      allowUnknownSourceType: options.allowUnknownSourceType === 'true',
      allowRemoteFetch: options.allowRemoteFetch === 'true',
      dryRunIngest: options.dryRunIngest === 'true',
      intervalMinutes: options.intervalMinutes,
      nextRunAt: options.nextRunAt,
      scheduleEnabled: options.scheduleEnabled === undefined ? undefined : options.scheduleEnabled !== 'false',
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir
    }).then(function (preflight) {
      console.log('Source onboarding preflight: ' + preflight.status);
      console.log('Source: ' + (preflight.sourceKey || 'unknown') + '\t' + (preflight.sourceType || 'unknown'));
      console.log('Steps: ' + preflight.steps.length);
      preflight.steps.forEach(function (step) {
        console.log(step.status + '\t' + step.key + '\t' + step.summary);
      });
      if (preflight.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'source-ingest-dry-run') {
    const sourceType = options.sourceType || (options.inputFile ? 'normalized-thread-json' : 'saved-html-directory');
    const inputDir = options.input || (sourceType === 'saved-html-directory' ? defaultInputDir : undefined);
    runtime.dryRunSourceIngest({
      id: options.sourceId,
      forum: options.forum,
      sourceKey: options.sourceKey,
      sourceType,
      displayName: options.name,
      modulePath: options.modulePath,
      inputDir,
      inputFile: options.inputFile,
      url: options.url,
      location: parseLocationOption(options),
      enabled: options.enabled === undefined ? undefined : options.enabled !== 'false',
      allowUnknownSourceType: options.allowUnknownSourceType === 'true',
      allowRemoteFetch: options.allowRemoteFetch === 'true',
      intervalMinutes: options.intervalMinutes,
      nextRunAt: options.nextRunAt,
      scheduleEnabled: options.scheduleEnabled === undefined ? undefined : options.scheduleEnabled !== 'false',
      now: options.now
    }).then(function (preview) {
      console.log('Source ingest dry-run: ' + preview.status);
      console.log('Dry run: ' + preview.dryRun);
      console.log('Source: ' + (preview.source ? preview.source.sourceKey : 'unknown') + '\t' + (preview.source ? preview.source.sourceType : 'unknown'));
      if (preview.thread) {
        console.log('Thread: ' + preview.thread.sourceThreadId + '\tposts=' + preview.thread.postCount + '\t' + preview.thread.title);
      }
      if (preview.task) {
        console.log('Task: ' + preview.task.type + '\t' + preview.task.status);
      }
      console.log('Repository writes: snapshots=' + preview.repositoryWrites.threadSnapshots + ', reports=' + preview.repositoryWrites.reports + ', tasks=' + preview.repositoryWrites.tasks + ', rawPages=' + preview.repositoryWrites.rawThreadPages);
      preview.checks.forEach(function (check) {
        console.log(check.status + '\t' + check.key + '\t' + check.summary);
      });
      if (preview.error) {
        console.log('Error: ' + (preview.error.code || 'error') + '\t' + preview.error.message);
      }
      if (preview.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'connector-rollout-plan') {
    const sourceType = options.sourceType || (options.inputFile ? 'normalized-thread-json' : undefined);
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getConnectorRolloutPlan({
      id: options.sourceId,
      forum: options.forum,
      sourceKey: options.sourceKey,
      sourceType,
      displayName: options.name,
      modulePath: options.modulePath,
      inputDir: options.input,
      inputFile: options.inputFile,
      url: options.url,
      location: parseLocationOption(options),
      enabled: options.enabled === undefined ? undefined : options.enabled !== 'false',
      allowUnknownSourceType: options.allowUnknownSourceType === 'true',
      allowRemoteFetch: options.allowRemoteFetch === 'true',
      dryRunIngest: options.dryRunIngest === 'true',
      intervalMinutes: options.intervalMinutes,
      nextRunAt: options.nextRunAt,
      scheduleEnabled: options.scheduleEnabled === undefined ? undefined : options.scheduleEnabled !== 'false',
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir
    }).then(function (plan) {
      console.log('Connector rollout plan: ' + plan.status);
      console.log('Source: ' + (plan.sourceKey || 'not provided') + '\t' + (plan.sourceType || 'not provided'));
      console.log('Module: ' + (plan.modulePath || 'not provided'));
      console.log('Steps: ' + plan.steps.length);
      plan.steps.forEach(function (item) {
        console.log(item.status + '\t' + item.key + '\t' + item.summary);
      });
      console.log('Next actions: ' + plan.nextActions.length);
      plan.nextActions.forEach(function (action) {
        console.log(action.severity + '\t' + action.key + '\t' + action.command);
      });
      if (plan.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'rollout-manifest-plan') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getRolloutManifestPlan({
      manifest: parseManifestOption(options),
      now: options.now,
      storeDir,
      limit: options.limit ? Number(options.limit) : 100,
      workerStaleAfterMs: options.workerStaleAfterMs ? Number(options.workerStaleAfterMs) : undefined
    }).then(function (plan) {
      console.log('Rollout manifest plan: ' + plan.status);
      console.log('Manifest: ' + (plan.name || 'unnamed') + '\tversion=' + plan.manifestVersion);
      console.log('Source: ' + (plan.sourceKey || 'not provided') + '\t' + (plan.sourceType || 'not provided'));
      console.log('Module: ' + (plan.modulePath || 'not provided'));
      console.log('Steps: ' + plan.steps.length);
      plan.steps.forEach(function (item) {
        console.log(item.status + '\t' + item.key + '\t' + item.summary);
      });
      if (plan.connectorRolloutPlan) {
        console.log('Connector rollout: ' + plan.connectorRolloutPlan.status);
      }
      if (plan.workerTopologyPlan) {
        console.log('Worker topology: ' + plan.workerTopologyPlan.status + '\t' + plan.workerTopologyPlan.topology);
      }
      console.log('Next actions: ' + plan.nextActions.length);
      plan.nextActions.forEach(function (action) {
        console.log(action.severity + '\t' + action.key + '\t' + action.command);
        (action.relatedCommands || []).forEach(function (command) {
          console.log('  related: ' + command);
        });
      });
      if (plan.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'resource-provisioning-plan') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getResourceProvisioningPlan({
      manifest: options.manifestFile ? parseManifestOption(options) : undefined,
      forum: options.forum,
      sourceKey: options.sourceKey,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir,
      workerStaleAfterMs: options.workerStaleAfterMs ? Number(options.workerStaleAfterMs) : undefined
    }).then(function (plan) {
      console.log('Resource provisioning plan: ' + plan.status);
      console.log('Environment: storage=' + plan.environment.storageMode + '\tsourceTaskMode=' + (plan.environment.sourceTaskMode || 'unknown') + '\tllm=' + (plan.environment.llmProvider || 'unknown'));
      console.log('Resources: ' + plan.resources.length);
      plan.resources.forEach(function (item) {
        console.log(item.status + '\t' + item.area + '\t' + item.key + '\t' + (item.required ? 'required' : 'optional') + '\t' + item.summary);
        if (item.env.length > 0) {
          console.log('  env: ' + item.env.join(', '));
        }
        item.commands.forEach(function (command) {
          console.log('  command: ' + command);
        });
      });
      console.log('Next actions: ' + plan.nextActions.length);
      plan.nextActions.forEach(function (action) {
        console.log(action.severity + '\t' + action.key + '\t' + action.summary);
      });
      if (plan.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'deployment-gate') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getDeploymentGateReport({
      manifest: options.manifestFile ? parseManifestOption(options) : undefined,
      forum: options.forum,
      sourceKey: options.sourceKey,
      sourceId: options.sourceId,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      limit: options.limit ? Number(options.limit) : 100,
      pipelineLimit: options.pipelineLimit ? Number(options.pipelineLimit) : 20,
      now: options.now,
      storeDir,
      workerStaleAfterMs: options.workerStaleAfterMs ? Number(options.workerStaleAfterMs) : undefined
    }).then(function (report) {
      console.log('Deployment gate: ' + report.status);
      console.log('Gates: ' + report.gateCount);
      report.gates.forEach(function (gate) {
        console.log(gate.status + '\t' + gate.area + '\t' + gate.key + '\t' + gate.summary);
      });
      console.log('Next actions: ' + report.nextActions.length);
      report.nextActions.forEach(function (action) {
        console.log(action.severity + '\t' + action.key + '\t' + action.summary);
        (action.commands || []).forEach(function (command) {
          console.log('  command: ' + command);
        });
      });
      if (report.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-sources') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.listSources({
      forum: options.forum,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      limit: options.limit ? Number(options.limit) : 50,
      storeDir
    }).then(function (sources) {
      sources.forEach(function (source) {
        console.log(source.id + '\t' + source.sourceKey + '\t' + source.sourceType + '\t' + source.displayName);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'source-diagnostics') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.diagnoseSources({
      forum: options.forum,
      sourceKey: options.sourceKey,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir
    }).then(function (diagnostics) {
      console.log('Source diagnostics: ' + diagnostics.status);
      console.log('Sources: ' + diagnostics.sourceCount);
      diagnostics.sources.forEach(function (source) {
        const nonOkChecks = source.checks.filter(function (check) {
          return check.status !== 'ok';
        }).map(function (check) {
          return check.key + '=' + check.status;
        }).join(',');
        console.log(source.status + '\t' + source.sourceId + '\t' + source.sourceKey + '\t' + source.sourceType + '\t' + source.displayName + (nonOkChecks ? '\t' + nonOkChecks : ''));
      });
      if (diagnostics.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'notification-diagnostics') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getNotificationDiagnostics({
      channel: options.channel,
      webhookUrl: options.webhookUrl,
      storeDir
    }).then(function (diagnostics) {
      const hasFailure = diagnostics.checks.some(function (check) {
        return check.status === 'fail';
      });
      console.log('Notification diagnostics: ' + (hasFailure ? 'fail' : 'ok'));
      console.log('Channel: ' + diagnostics.channel);
      diagnostics.checks.forEach(function (check) {
        console.log(check.status + '\t' + check.key + '\t' + check.summary);
      });
      if (hasFailure) {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'connector-catalog') {
    const catalog = runtime.getSourceConnectorCatalog({
      now: options.now
    });
    console.log('Connector catalog: sourceTypes=' + catalog.sourceTypes.length + ', adapters=' + catalog.adapters.length);
    catalog.sourceTypes.forEach(function (sourceType) {
      const required = sourceType.locationSchema && sourceType.locationSchema.required
        ? sourceType.locationSchema.required.join(',')
        : '';
      const compatible = sourceType.compatibleSourceKeys && sourceType.compatibleSourceKeys.length
        ? sourceType.compatibleSourceKeys.join(',')
        : 'none';
      console.log(sourceType.sourceType + '\tadapter=' + sourceType.requiresAdapter + '\trequired=' + required + '\tcompatible=' + compatible);
    });
    return;
  }

  if (command === 'thread-snapshot-contract') {
    console.log(JSON.stringify(runtime.getThreadSnapshotJsonContract(), null, 2));
    return;
  }

  if (command === 'connector-module-contract') {
    console.log(JSON.stringify(runtime.getConnectorModuleContract(), null, 2));
    return;
  }

  if (command === 'validate-connector-module') {
    const result = runtime.validateConnectorModule({
      modulePath: options.modulePath || options.inputFile || options.input,
      now: options.now
    });
    console.log('Connector module validation: valid=' + result.valid + ', status=' + result.status);
    console.log('Module: ' + (result.modulePath || 'missing'));
    console.log('Registrations: modules=' + result.modules.length + ', errors=' + result.errors.length);
    result.checks.forEach(function (check) {
      console.log(check.status + '\t' + check.key + '\t' + check.summary + '\t' + check.value);
    });
    if (!result.valid) {
      process.exitCode = 2;
    }
    return;
  }

  if (command === 'connector-readiness') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.getConnectorReadiness({
      sourceKey: options.sourceKey || options.forum,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      limit: options.limit ? Number(options.limit) : 100,
      now: options.now,
      storeDir
    }).then(function (readiness) {
      console.log('Connector readiness: ' + readiness.status);
      console.log('Connectors: ' + readiness.connectorCount + ', sources=' + readiness.sourceCount);
      console.log('Modules: ' + (readiness.modules ? readiness.modules.count : 0) + ', errors=' + (readiness.modules ? readiness.modules.errorCount : 0));
      readiness.connectors.forEach(function (connector) {
        console.log(connector.status + '\t' + connector.sourceType + '\tsources=' + connector.sourceCount + '\tenabled=' + connector.enabledSourceCount);
      });
      if (readiness.status === 'fail') {
        process.exitCode = 2;
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-source-task') {
    if (!options.sourceId) {
      throw new Error('run-source-task requires --source-id.');
    }
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runSourceIngestTask({
      sourceId: options.sourceId,
      sourceRunStaleAfterMs: options.sourceRunStaleAfterMs ? Number(options.sourceRunStaleAfterMs) : undefined,
      now: options.now,
      traceId: options.traceId,
      storeDir
    }).then(function (result) {
      console.log('Task completed: ' + result.task.id);
      console.log('Source: ' + options.sourceId);
      printThreadSummary(result.threadSnapshot);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-source-insight-pipeline') {
    if (!options.sourceId) {
      throw new Error('run-source-insight-pipeline requires --source-id.');
    }
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runSourceInsightPipelineTask({
      sourceId: options.sourceId,
      provider: options.provider || defaultLlmProvider,
      traceId: options.traceId,
      baseReportType: options.baseReportType,
      semanticEnrichmentEnabled: parseOptionalBoolean(options.semanticEnrichmentEnabled),
      semanticSkipIfUnchanged: parseOptionalBoolean(options.semanticSkipIfUnchanged),
      sourceRunStaleAfterMs: options.sourceRunStaleAfterMs ? Number(options.sourceRunStaleAfterMs) : undefined,
      now: options.now,
      traceId: options.traceId,
      storeDir
    }).then(function (result) {
      console.log('Task completed: ' + result.task.id);
      console.log('Source: ' + options.sourceId);
      console.log('Ingest task: ' + result.ingest.task.id);
      console.log('Changed: ' + result.ingest.cursorDiff.changed);
      console.log('New posts: ' + result.ingest.cursorDiff.newPostCount);
      console.log('Semantic status: ' + result.semantic.status);
      if (result.semantic.reason) {
        console.log('Semantic reason: ' + result.semantic.reason);
      }
      if (result.semantic.reportType) {
        console.log('Semantic report type: ' + result.semantic.reportType);
      }
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-sources-task') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runEnabledSourcesIngestTasks({
      forum: options.forum,
      limit: options.limit ? Number(options.limit) : 50,
      sourceRunStaleAfterMs: options.sourceRunStaleAfterMs ? Number(options.sourceRunStaleAfterMs) : undefined,
      now: options.now,
      storeDir
    }).then(function (result) {
      console.log('Sources: ' + result.sourceCount);
      console.log('Completed: ' + result.completedCount);
      console.log('Failed: ' + result.failedCount);
      result.results.forEach(function (item) {
        console.log(item.status + '\t' + item.source.id + '\t' + (item.task ? item.task.id : item.error.message));
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-due-sources-task') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runDueSourcesIngestTasks({
      forum: options.forum,
      limit: options.limit ? Number(options.limit) : 50,
      now: options.now,
      sourceRunStaleAfterMs: options.sourceRunStaleAfterMs ? Number(options.sourceRunStaleAfterMs) : undefined,
      traceId: options.traceId,
      storeDir
    }).then(function (result) {
      console.log('Sources: ' + result.sourceCount);
      console.log('Due: ' + result.dueCount);
      console.log('Skipped: ' + result.skippedCount);
      console.log('Completed: ' + result.completedCount);
      console.log('Failed: ' + result.failedCount);
      result.results.forEach(function (item) {
        console.log(item.status + '\t' + item.scheduleReason + '\t' + item.source.id + '\t' + (item.task ? item.task.id : item.error.message));
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-due-source-insight-pipelines') {
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runDueSourceInsightPipelineTasks({
      forum: options.forum,
      limit: options.limit ? Number(options.limit) : 50,
      now: options.now,
      sourceRunStaleAfterMs: options.sourceRunStaleAfterMs ? Number(options.sourceRunStaleAfterMs) : undefined,
      provider: options.provider || defaultLlmProvider,
      traceId: options.traceId,
      baseReportType: options.baseReportType,
      semanticEnrichmentEnabled: parseOptionalBoolean(options.semanticEnrichmentEnabled),
      semanticSkipIfUnchanged: parseOptionalBoolean(options.semanticSkipIfUnchanged),
      storeDir
    }).then(function (result) {
      console.log('Sources: ' + result.sourceCount);
      console.log('Due: ' + result.dueCount);
      console.log('Skipped: ' + result.skippedCount);
      console.log('Completed: ' + result.completedCount);
      console.log('Failed: ' + result.failedCount);
      result.results.forEach(function (item) {
        console.log(item.status + '\t' + item.scheduleReason + '\t' + item.source.id + '\t' + (item.task ? item.task.id : item.error.message) + '\tsemantic=' + (item.semantic ? item.semantic.status : 'none'));
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'interpret-text-dir') {
    const inputDir = options.input || defaultInputDir;
    const text = options.text;
    if (!text) {
      throw new Error('interpret-text-dir requires --text.');
    }

    const adapter = getForumAdapter(options.forum || defaultForum);
    const report = interpretNewPostFromSavedThreadDirectory({
      adapter,
      inputDir,
      authorId: options.authorId,
      author: options.author,
      contentText: text
    });
    const outputPath = options.output || path.resolve(process.cwd(), 'data', 'parsed', 'new-post-context.json');
    const markdownPath = options.markdownOutput || path.resolve(process.cwd(), 'data', 'reports', 'new-post-context.md');
    const writtenPath = writeJsonFile(outputPath, report);
    const writtenMarkdownPath = writeTextFile(markdownPath, renderNewPostContextMarkdown(report));

    console.log('Context report written to: ' + writtenPath);
    console.log('Context markdown written to: ' + writtenMarkdownPath);
    console.log('Related evidence count: ' + report.relatedEvidence.length);
    return;
  }

  if (command === 'index-html-dir') {
    const inputDir = options.input || defaultInputDir;
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.indexDirectory({
      forum: options.forum,
      inputDir,
      storeDir
    }).then(function (result) {
      console.log('Indexed documents: ' + result.indexedDocumentCount);
      printThreadSummary(result.threadSnapshot);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'search-index') {
    if (!options.text) {
      throw new Error('search-index requires --text.');
    }
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.search({
      text: options.text,
      limit: options.limit ? Number(options.limit) : 10,
      storeDir
    }).then(function (results) {
      results.forEach(function (result) {
        console.log(result.score + '\t#' + result.metadata.floor + '\t' + result.metadata.author + '\t' + result.text);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-adapters') {
    runtime.listAdapters().forEach(function (adapter) {
      console.log(adapter.sourceKey + '\t' + adapter.displayName);
    });
    return;
  }

  printHelp();
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--input' || item === '-i') {
      options.input = args[index + 1];
      index += 1;
    } else if (item === '--output' || item === '-o') {
      options.output = args[index + 1];
      index += 1;
    } else if (item === '--markdown-output') {
      options.markdownOutput = args[index + 1];
      index += 1;
    } else if (item === '--forum') {
      options.forum = args[index + 1];
      index += 1;
    } else if (item === '--provider') {
      options.provider = args[index + 1];
      index += 1;
    } else if (item === '--source-key') {
      options.sourceKey = args[index + 1];
      index += 1;
    } else if (item === '--report-type') {
      options.reportType = args[index + 1];
      index += 1;
    } else if (item === '--base-report-type') {
      options.baseReportType = args[index + 1];
      index += 1;
    } else if (item === '--trace-id') {
      options.traceId = args[index + 1];
      index += 1;
    } else if (item === '--request-id') {
      options.requestId = args[index + 1];
      index += 1;
    } else if (item === '--idempotency-key') {
      options.idempotencyKey = args[index + 1];
      index += 1;
    } else if (item === '--semantic-enrichment-enabled') {
      options.semanticEnrichmentEnabled = args[index + 1];
      index += 1;
    } else if (item === '--semantic-skip-if-unchanged') {
      options.semanticSkipIfUnchanged = args[index + 1];
      index += 1;
    } else if (item === '--source-task-mode') {
      options.sourceTaskMode = args[index + 1];
      index += 1;
    } else if (item === '--topology') {
      options.topology = args[index + 1];
      index += 1;
    } else if (item === '--lease-ttl-ms') {
      options.leaseTtlMs = args[index + 1];
      index += 1;
    } else if (item === '--worker-stale-after-ms') {
      options.workerStaleAfterMs = args[index + 1];
      index += 1;
    } else if (item === '--source-run-stale-after-ms') {
      options.sourceRunStaleAfterMs = args[index + 1];
      index += 1;
    } else if (item === '--store-dir') {
      options.storeDir = args[index + 1];
      index += 1;
    } else if (item === '--from-store-dir') {
      options.fromStoreDir = args[index + 1];
      index += 1;
    } else if (item === '--to-store-dir') {
      options.toStoreDir = args[index + 1];
      index += 1;
    } else if (item === '--dry-run') {
      options.dryRun = args[index + 1];
      index += 1;
    } else if (item === '--text') {
      options.text = args[index + 1];
      index += 1;
    } else if (item === '--author-id') {
      options.authorId = args[index + 1];
      index += 1;
    } else if (item === '--author') {
      options.author = args[index + 1];
      index += 1;
    } else if (item === '--status') {
      options.status = args[index + 1];
      index += 1;
    } else if (item === '--type') {
      options.type = args[index + 1];
      index += 1;
    } else if (item === '--limit') {
      options.limit = args[index + 1];
      index += 1;
    } else if (item === '--pipeline-limit') {
      options.pipelineLimit = args[index + 1];
      index += 1;
    } else if (item === '--source-id') {
      options.sourceId = args[index + 1];
      index += 1;
    } else if (item === '--source-thread-id') {
      options.sourceThreadId = args[index + 1];
      index += 1;
    } else if (item === '--content-sha1') {
      options.contentSha1 = args[index + 1];
      index += 1;
    } else if (item === '--page') {
      options.page = args[index + 1];
      index += 1;
    } else if (item === '--source-type') {
      options.sourceType = args[index + 1];
      index += 1;
    } else if (item === '--name') {
      options.name = args[index + 1];
      index += 1;
    } else if (item === '--url') {
      options.url = args[index + 1];
      index += 1;
    } else if (item === '--location-json') {
      options.locationJson = args[index + 1];
      index += 1;
    } else if (item === '--location-file') {
      options.locationFile = args[index + 1];
      index += 1;
    } else if (item === '--input-file') {
      options.inputFile = args[index + 1];
      index += 1;
    } else if (item === '--module-path') {
      options.modulePath = args[index + 1];
      index += 1;
    } else if (item === '--manifest-file') {
      options.manifestFile = args[index + 1];
      index += 1;
    } else if (item === '--enabled') {
      options.enabled = args[index + 1];
      index += 1;
    } else if (item === '--allow-unknown-source-type') {
      if (args[index + 1] && !String(args[index + 1]).startsWith('--')) {
        options.allowUnknownSourceType = args[index + 1];
        index += 1;
      } else {
        options.allowUnknownSourceType = 'true';
      }
    } else if (item === '--allow-remote-fetch') {
      if (args[index + 1] && !String(args[index + 1]).startsWith('--')) {
        options.allowRemoteFetch = args[index + 1];
        index += 1;
      } else {
        options.allowRemoteFetch = 'true';
      }
    } else if (item === '--dry-run-ingest') {
      if (args[index + 1] && !String(args[index + 1]).startsWith('--')) {
        options.dryRunIngest = args[index + 1];
        index += 1;
      } else {
        options.dryRunIngest = 'true';
      }
    } else if (item === '--interval-minutes') {
      options.intervalMinutes = args[index + 1];
      index += 1;
    } else if (item === '--next-run-at') {
      options.nextRunAt = args[index + 1];
      index += 1;
    } else if (item === '--schedule-enabled') {
      options.scheduleEnabled = args[index + 1];
      index += 1;
    } else if (item === '--now') {
      options.now = args[index + 1];
      index += 1;
    } else if (item === '--acknowledged') {
      options.acknowledged = args[index + 1];
      index += 1;
    } else if (item === '--delivery-status') {
      options.deliveryStatus = args[index + 1];
      index += 1;
    } else if (item === '--max-attempts') {
      options.maxAttempts = args[index + 1];
      index += 1;
    } else if (item === '--retry-backoff-ms') {
      options.retryBackoffMs = args[index + 1];
      index += 1;
    } else if (item === '--max-retry-backoff-ms') {
      options.maxRetryBackoffMs = args[index + 1];
      index += 1;
    } else if (item === '--include-failed') {
      options.includeFailed = args[index + 1];
      index += 1;
    } else if (item === '--channel') {
      options.channel = args[index + 1];
      index += 1;
    } else if (item === '--webhook-url') {
      options.webhookUrl = args[index + 1];
      index += 1;
    } else if (item === '--timeout-ms') {
      options.timeoutMs = args[index + 1];
      index += 1;
    } else if (item === '--event-id') {
      options.eventId = args[index + 1];
      index += 1;
    } else if (item === '--by') {
      options.by = args[index + 1];
      index += 1;
    } else if (item === '--note') {
      options.note = args[index + 1];
      index += 1;
    }
  }
  return options;
}

function parseOptionalBoolean(value) {
  if (value === undefined) return undefined;
  return value !== 'false';
}

function parseManifestOption(options) {
  const safeOptions = options || {};
  if (!safeOptions.manifestFile) {
    throw new Error('rollout-manifest-plan requires --manifest-file.');
  }
  return parseJsonFile(safeOptions.manifestFile, '--manifest-file');
}

function parseJsonFile(filePath, label) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  return parseJsonText(fs.readFileSync(resolvedPath, 'utf8'), label);
}

function parseLocationOption(options) {
  const safeOptions = options || {};
  if (safeOptions.locationFile) {
    return parseJsonFile(safeOptions.locationFile, '--location-file');
  }
  return parseJsonText(safeOptions.locationJson, '--location-json');
}

function parseJsonText(value, label) {
  if (!value) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(String(value).replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error('Invalid ' + label + ': ' + (error && error.message ? error.message : String(error)));
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(label + ' must be a JSON object.');
  }
  return parsed;
}

function findDefaultExampleHtml(inputDir) {
  const exampleDir = inputDir || path.resolve(process.cwd(), 'example');
  const files = fs.readdirSync(exampleDir)
    .filter(function (name) {
      return /\.html?$/i.test(name);
    })
    .sort();

  if (files.length === 0) {
    throw new Error('No .html file found in example directory.');
  }

  return path.join(exampleDir, files[0]);
}

function defaultParsedOutputPath(threadSnapshot) {
  const id = threadSnapshot.sourceThreadId || 'unknown';
  return path.resolve(process.cwd(), 'data', 'parsed', 'nga-thread-' + id + '.json');
}

function defaultReportOutputPath(threadSnapshot) {
  const id = threadSnapshot.sourceThreadId || 'unknown';
  return path.resolve(process.cwd(), 'data', 'parsed', 'nga-thread-' + id + '.basic-report.json');
}

function defaultMarkdownReportOutputPath(threadSnapshot) {
  const id = threadSnapshot.sourceThreadId || 'unknown';
  return path.resolve(process.cwd(), 'data', 'reports', 'nga-thread-' + id + '.basic-report.md');
}

function printThreadSummary(threadSnapshot) {
  console.log('ThreadTrace');
  console.log('Forum: ' + threadSnapshot.forum.displayName);
  console.log('Thread: ' + threadSnapshot.title + ' (' + threadSnapshot.sourceThreadId + ')');
  console.log('Posts parsed: ' + threadSnapshot.posts.length);
  if (threadSnapshot.totalPages) {
    console.log('Pages: current ' + (threadSnapshot.page || '?') + ', total ' + threadSnapshot.totalPages);
  }
}

function printReportSummary(report) {
  console.log('Primary author: ' + (report.primaryAuthor ? report.primaryAuthor.displayName : 'unknown'));
  console.log('Authors found: ' + report.authorStats.length);
  console.log('High-signal candidates: ' + report.evidenceCandidates.highSignalPosts.length);
  console.log('Low-signal candidates: ' + report.evidenceCandidates.lowSignalPosts.length);
  console.log('External links: ' + report.evidenceCandidates.externalLinks.length);
}

function printHelp() {
  console.log('Usage:');
  console.log('  node src/presentation/cli/threadtrace.js list-adapters');
  console.log('  node src/presentation/cli/threadtrace.js parse-html [--forum nga] [--input file] [--output file]');
  console.log('  node src/presentation/cli/threadtrace.js parse-html-dir [--forum nga] [--input dir] [--output file]');
  console.log('  node src/presentation/cli/threadtrace.js analyze-html [--forum nga] [--input file] [--output file] [--markdown-output file]');
  console.log('  node src/presentation/cli/threadtrace.js analyze-html-dir [--forum nga] [--input dir] [--output file] [--markdown-output file]');
  console.log('  node src/presentation/cli/threadtrace.js enrich-html-dir [--forum nga] [--input dir] [--provider mock]');
  console.log('  node src/presentation/cli/threadtrace.js ingest-html-dir [--forum nga] [--input dir] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-ingest-task [--forum nga] [--input dir] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js list-tasks [--store-dir dir] [--status status] [--type type] [--request-id id] [--trace-id id] [--idempotency-key key] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js list-reports [--source-key key] [--source-thread-id id] [--report-type type] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-semantic-enrichment-task --source-thread-id id [--source-key nga] [--provider mock] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js operations-overview [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js operations-readiness [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js trace-context [--request-id id | --trace-id id | --idempotency-key key] [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js operations-runbook [--forum nga] [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js worker-topology-plan [--topology operations-worker|split-workers] [--source-task-mode ingest|insight-pipeline] [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js runtime-diagnostics [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js adapter-diagnostics [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js deployment-checklist [--forum nga] [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js migrate-store --from-store-dir dir [--to-store-dir dir] [--dry-run true|false] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js list-events [--source-id id] [--type type] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js fetch-thread-page [--forum nga] [--url url | --source-id id] [--source-thread-id id] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js list-raw-pages [--forum nga] [--source-thread-id id] [--limit n] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js ingest-raw-page [--forum nga] --content-sha1 sha1 [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js dispatch-events [--channel file|webhook] [--webhook-url url] [--limit n] [--max-attempts n] [--retry-backoff-ms ms] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js ack-event --event-id id [--by user] [--note text] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js validate-source [--forum nga] [--source-type type] [--location-json json | --location-file file] [--input dir] [--input-file file] [--url url] [--name name] [--allow-unknown-source-type true|false] [--interval-minutes n] [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js validate-thread-json --input-file file [--forum sourceKey] [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js source-onboarding-preflight [--forum nga] [--source-type type] [--module-path file] [--location-json json | --location-file file] [--input dir] [--input-file file] [--url url] [--store-dir dir] [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js source-ingest-dry-run [--forum nga] [--source-type type] [--module-path file] [--location-json json | --location-file file] [--input dir] [--input-file file] [--url url] [--allow-remote-fetch true] [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js connector-rollout-plan [--forum nga] [--source-type type] [--module-path file] [--location-json json | --location-file file] [--input dir] [--input-file file] [--url url] [--dry-run-ingest true] [--store-dir dir] [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file file [--store-dir dir] [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js resource-provisioning-plan [--manifest-file file] [--store-dir dir] [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js deployment-gate [--manifest-file file] [--store-dir dir] [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js register-source [--forum nga] [--source-type type] [--location-json json | --location-file file] [--input dir] [--input-file file] [--url url] [--name name] [--allow-unknown-source-type true|false] [--interval-minutes n] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js list-sources [--forum nga] [--enabled true] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js source-diagnostics [--forum nga] [--enabled true] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js connector-catalog [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js thread-snapshot-contract');
  console.log('  node src/presentation/cli/threadtrace.js connector-module-contract');
  console.log('  node src/presentation/cli/threadtrace.js validate-connector-module --module-path file [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js connector-readiness [--forum nga] [--enabled true] [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js notification-diagnostics [--channel file|webhook] [--webhook-url url] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-source-task --source-id id [--trace-id id] [--source-run-stale-after-ms ms] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id id [--provider mock] [--trace-id id] [--semantic-enrichment-enabled true|false] [--semantic-skip-if-unchanged true|false] [--source-run-stale-after-ms ms] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-sources-task [--forum nga] [--limit n] [--trace-id id] [--source-run-stale-after-ms ms] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-due-sources-task [--forum nga] [--now iso] [--trace-id id] [--source-run-stale-after-ms ms] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-due-source-insight-pipelines [--forum nga] [--provider mock] [--trace-id id] [--now iso] [--source-run-stale-after-ms ms] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js index-html-dir [--forum nga] [--input dir] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js search-index --text text [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js interpret-text-dir [--forum nga] [--input dir] --text text [--author-id id] [--output file] [--markdown-output file]');
}

main(process.argv);
