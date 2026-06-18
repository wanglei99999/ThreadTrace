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
    sourceTaskMode: options.sourceTaskMode
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

  if (command === 'runtime-diagnostics') {
    runtime.getRuntimeDiagnostics({
      now: options.now
    }).then(function (diagnostics) {
      console.log('Diagnostics: ' + diagnostics.status);
      console.log('Storage: ' + diagnostics.configuration.storageMode);
      console.log('Store dir: ' + diagnostics.configuration.storeDir);
      console.log('LLM provider: ' + diagnostics.configuration.llm.provider);
      console.log('Source task mode: ' + diagnostics.configuration.workers.sourceTaskMode);
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
    const inputDir = options.input || defaultInputDir;
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.registerSource({
      id: options.sourceId,
      forum: options.forum,
      sourceType: options.sourceType || 'saved-html-directory',
      displayName: options.name,
      inputDir,
      url: options.url,
      enabled: options.enabled !== 'false',
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

  if (command === 'run-source-task') {
    if (!options.sourceId) {
      throw new Error('run-source-task requires --source-id.');
    }
    const storeDir = options.storeDir || defaultStoreDir;
    runtime.runSourceIngestTask({
      sourceId: options.sourceId,
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
    } else if (item === '--semantic-enrichment-enabled') {
      options.semanticEnrichmentEnabled = args[index + 1];
      index += 1;
    } else if (item === '--semantic-skip-if-unchanged') {
      options.semanticSkipIfUnchanged = args[index + 1];
      index += 1;
    } else if (item === '--source-task-mode') {
      options.sourceTaskMode = args[index + 1];
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
    } else if (item === '--enabled') {
      options.enabled = args[index + 1];
      index += 1;
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
  console.log('  node src/presentation/cli/threadtrace.js list-tasks [--store-dir dir] [--status status] [--type type] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js list-reports [--source-key key] [--source-thread-id id] [--report-type type] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-semantic-enrichment-task --source-thread-id id [--source-key nga] [--provider mock] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js operations-overview [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js operations-readiness [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js runtime-diagnostics [--now iso]');
  console.log('  node src/presentation/cli/threadtrace.js migrate-store --from-store-dir dir [--to-store-dir dir] [--dry-run true|false] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js list-events [--source-id id] [--type type] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js fetch-thread-page [--forum nga] [--url url | --source-id id] [--source-thread-id id] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js list-raw-pages [--forum nga] [--source-thread-id id] [--limit n] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js ingest-raw-page [--forum nga] --content-sha1 sha1 [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js dispatch-events [--channel file|webhook] [--webhook-url url] [--limit n] [--max-attempts n] [--retry-backoff-ms ms] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js ack-event --event-id id [--by user] [--note text] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js register-source [--forum nga] [--input dir] [--name name] [--interval-minutes n] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js list-sources [--forum nga] [--enabled true] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-source-task --source-id id [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id id [--provider mock] [--semantic-enrichment-enabled true|false] [--semantic-skip-if-unchanged true|false] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-sources-task [--forum nga] [--limit n] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-due-sources-task [--forum nga] [--now iso] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-due-source-insight-pipelines [--forum nga] [--provider mock] [--now iso] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js index-html-dir [--forum nga] [--input dir] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js search-index --text text [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js interpret-text-dir [--forum nga] [--input dir] --text text [--author-id id] [--output file] [--markdown-output file]');
}

main(process.argv);
