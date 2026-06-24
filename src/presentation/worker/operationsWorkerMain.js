#!/usr/bin/env node
'use strict';

const { loadEnvFile } = require('../../runtime/envFileLoader');
const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');
const { createThreadTraceConfig } = require('../../runtime/threadTraceConfig');
const { buildWorkerLeaseKey } = require('../../domain/models/workerLeaseKey');
const { createOperationsWorker } = require('./operationsWorker');

async function main(argv) {
  loadEnvFile({
    cwd: process.cwd()
  });
  const options = parseArgs(argv.slice(2));
  const config = createThreadTraceConfig({
    env: process.env,
    cwd: process.cwd(),
    defaultInputDir: options.input,
    storeDir: options.storeDir,
    sourceTaskMode: options.sourceTaskMode,
    llmProvider: options.provider,
    sourceRunStaleAfterMs: options.sourceRunStaleAfterMs,
    sourceFailureRetryBackoffMs: options.sourceFailureRetryBackoffMs,
    sourceFailureMaxRetryBackoffMs: options.sourceFailureMaxRetryBackoffMs,
    operationsWorkerIntervalMs: options.intervalMs,
    workerLeaseTtlMs: options.leaseTtlMs
  });
  const storeDir = config.storeDir;
  const runtime = createThreadTraceRuntime({
    storeDir,
    defaultInputDir: config.defaultInputDir,
    config
  });
  const repositories = runtime.createRepositories(storeDir);
  const worker = createOperationsWorker({
    runtime,
    workerRunRepository: repositories.workerRunRepository,
    workerLeaseRepository: repositories.workerLeaseRepository,
    leaseKey: buildWorkerLeaseKey('operations', {
      sourceId: options.sourceId,
      sourceKey: options.sourceKey || options.forum
    }),
    sourceTaskMode: config.workers.sourceTaskMode,
    leaseTtlMs: config.workers.leaseTtlMs,
    pollIntervalMs: config.workers.operationsIntervalMs
  });
  const request = buildRequest(options, storeDir, config);

  if (options.loop) {
    console.log('ThreadTrace operations worker running. Store: ' + storeDir);
    worker.start(request);
    process.once('SIGINT', function () {
      worker.stop();
      process.exit(0);
    });
    process.once('SIGTERM', function () {
      worker.stop();
      process.exit(0);
    });
    return;
  }

  const result = await worker.runOnce(request);
  if (result.skipped !== true) {
    console.log('Due sources: ' + result.dueSources.dueCount);
    console.log('Source completed: ' + result.dueSources.completedCount);
    console.log('Source failed: ' + result.dueSources.failedCount);
    if (result.reviewActionTask) {
      console.log('Review action: ' + result.reviewActionTask.report.status + ', dryRun=' + result.reviewActionTask.report.dryRun);
    }
    if (result.contextReviewResultEvents) {
      console.log('Review result events: ' + result.contextReviewResultEvents.eventCount + ', dryRun=' + result.contextReviewResultEvents.dryRun);
    }
    if (result.authorReviewQueueEvents) {
      console.log('Author queue events: ' + result.authorReviewQueueEvents.eventCount + ', dryRun=' + result.authorReviewQueueEvents.dryRun);
    }
    console.log('Events delivered: ' + result.events.dispatchedCount);
    console.log('Events failed: ' + result.events.failedCount);
    if (result.archivedEvents) {
      console.log('Events archived: ' + result.archivedEvents.archivedCount + ', candidates=' + result.archivedEvents.candidateCount + ', dryRun=' + result.archivedEvents.dryRun);
    }
    console.log('Open events: ' + result.overview.events.unacknowledged);
    console.log('Worker stale: ' + result.overview.workers.stale);
    if (result.sourceAttention) {
      console.log('Source attention: ' + result.sourceAttention.status + ', total=' + (result.sourceAttention.summary && result.sourceAttention.summary.total || 0));
    }
  }
}

function buildRequest(options, storeDir, config) {
  return {
    sources: {
      forum: options.forum,
      sourceId: options.sourceId,
      sourceKey: options.sourceKey,
      limit: options.limit ? Number(options.limit) : undefined,
      sourceTaskMode: config.workers.sourceTaskMode,
      provider: config.llm.provider,
      traceId: options.traceId,
      baseReportType: options.baseReportType,
      semanticEnrichmentEnabled: parseOptionalBoolean(options.semanticEnrichmentEnabled),
      semanticSkipIfUnchanged: parseOptionalBoolean(options.semanticSkipIfUnchanged),
      sourceRunStaleAfterMs: config.workers.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: config.workers.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: config.workers.sourceFailureMaxRetryBackoffMs,
      storeDir
    },
    events: {
      channel: options.channel,
      webhookUrl: options.webhookUrl,
      timeoutMs: options.timeoutMs ? Number(options.timeoutMs) : undefined,
      limit: options.limit ? Number(options.limit) : undefined,
      maxAttempts: options.maxAttempts ? Number(options.maxAttempts) : undefined,
      sourceId: options.sourceId,
      sourceKey: options.sourceKey || options.forum,
      retryBackoffMs: options.retryBackoffMs ? Number(options.retryBackoffMs) : undefined,
      maxRetryBackoffMs: options.maxRetryBackoffMs ? Number(options.maxRetryBackoffMs) : undefined,
      includeFailed: options.includeFailed === undefined ? undefined : options.includeFailed !== 'false',
      storeDir
    },
    archiveEvents: options.archiveEvents === 'true' || options.archiveEventsExecute === 'true'
      ? {
        sourceKey: options.sourceKey || options.forum,
        sourceId: options.sourceId,
        type: options.archiveEventType,
        deliveryStatuses: options.archiveDeliveryStatuses,
        requireAcknowledged: parseOptionalBoolean(options.archiveRequireAcknowledged),
        olderThanDays: options.archiveOlderThanDays ? Number(options.archiveOlderThanDays) : undefined,
        scanLimit: options.archiveScanLimit ? Number(options.archiveScanLimit) : undefined,
        archiveLimit: options.archiveLimit ? Number(options.archiveLimit) : (options.limit ? Number(options.limit) : undefined),
        execute: options.archiveEventsExecute === 'true',
        archivedBy: options.archiveBy,
        reason: options.archiveReason,
        storeDir
      }
      : undefined,
    runbookEvents: options.runbookEvents === 'true' || options.runbookEventsExecute === 'true'
      ? {
        forum: options.forum,
        sourceId: options.sourceId,
        sourceKey: options.sourceKey,
        execute: options.runbookEventsExecute === 'true',
        limit: options.limit ? Number(options.limit) : undefined,
        sourceRunStaleAfterMs: config.workers.sourceRunStaleAfterMs,
        sourceFailureRetryBackoffMs: config.workers.sourceFailureRetryBackoffMs,
        sourceFailureMaxRetryBackoffMs: config.workers.sourceFailureMaxRetryBackoffMs,
        storeDir
      }
      : undefined,
    contextReviewResultEvents: options.contextReviewResultEvents === 'true' || options.contextReviewResultEventsExecute === 'true'
      ? {
        sourceId: options.sourceId,
        sourceKey: options.sourceKey || options.forum,
        execute: options.contextReviewResultEventsExecute === 'true',
        handoffId: options.handoffId,
        status: options.reviewStatus,
        reviewerId: options.reviewerId,
        limit: options.limit ? Number(options.limit) : undefined,
        storeDir
      }
      : undefined,
    authorReviewQueueEvents: options.authorReviewQueueEvents === 'true' || options.authorReviewQueueEventsExecute === 'true'
      ? {
        sourceKey: options.sourceKey || options.forum,
        sourceThreadId: options.sourceThreadId,
        status: options.authorReviewQueueStatus || 'open',
        type: options.authorReviewQueueType,
        priority: options.authorReviewQueuePriority,
        execute: options.authorReviewQueueEventsExecute === 'true',
        resolveStale: parseOptionalBoolean(options.authorReviewQueueResolveStale),
        limit: options.limit ? Number(options.limit) : undefined,
        storeDir
      }
      : undefined,
    reviewAction: options.reviewAction === 'true' || options.reviewActionExecute === 'true'
      ? {
        sourceId: options.sourceId,
        sourceKey: options.sourceKey || options.forum,
        execute: options.reviewActionExecute === 'true',
        handoffId: options.handoffId,
        status: options.reviewStatus,
        reviewerId: options.reviewerId,
        limit: options.limit ? Number(options.limit) : undefined,
        storeDir
      }
      : undefined,
    overview: {
      forum: options.forum,
      sourceId: options.sourceId,
      sourceKey: options.sourceKey,
      limit: options.limit ? Number(options.limit) : undefined,
      storeDir
    },
    sourceAttention: {
      forum: options.forum,
      sourceId: options.sourceId,
      sourceKey: options.sourceKey,
      limit: options.limit ? Number(options.limit) : undefined,
      sourceRunStaleAfterMs: config.workers.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: config.workers.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: config.workers.sourceFailureMaxRetryBackoffMs,
      storeDir
    }
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--loop') {
      options.loop = true;
    } else if (item === '--once') {
      options.loop = false;
    } else if (item === '--store-dir') {
      options.storeDir = args[index + 1];
      index += 1;
    } else if (item === '--input') {
      options.input = args[index + 1];
      index += 1;
    } else if (item === '--forum') {
      options.forum = args[index + 1];
      index += 1;
    } else if (item === '--source-key') {
      options.sourceKey = args[index + 1];
      index += 1;
    } else if (item === '--source-thread-id') {
      options.sourceThreadId = args[index + 1];
      index += 1;
    } else if (item === '--source-id') {
      options.sourceId = args[index + 1];
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
    } else if (item === '--limit') {
      options.limit = args[index + 1];
      index += 1;
    } else if (item === '--source-task-mode') {
      options.sourceTaskMode = args[index + 1];
      index += 1;
    } else if (item === '--provider') {
      options.provider = args[index + 1];
      index += 1;
    } else if (item === '--trace-id') {
      options.traceId = args[index + 1];
      index += 1;
    } else if (item === '--base-report-type') {
      options.baseReportType = args[index + 1];
      index += 1;
    } else if (item === '--semantic-enrichment-enabled') {
      options.semanticEnrichmentEnabled = args[index + 1];
      index += 1;
    } else if (item === '--semantic-skip-if-unchanged') {
      options.semanticSkipIfUnchanged = args[index + 1];
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
    } else if (item === '--runbook-events') {
      options.runbookEvents = args[index + 1];
      index += 1;
    } else if (item === '--runbook-events-execute') {
      options.runbookEventsExecute = args[index + 1];
      index += 1;
    } else if (item === '--context-review-result-events') {
      options.contextReviewResultEvents = args[index + 1];
      index += 1;
    } else if (item === '--context-review-result-events-execute') {
      options.contextReviewResultEventsExecute = args[index + 1];
      index += 1;
    } else if (item === '--author-review-queue-events') {
      options.authorReviewQueueEvents = args[index + 1];
      index += 1;
    } else if (item === '--author-review-queue-events-execute') {
      options.authorReviewQueueEventsExecute = args[index + 1];
      index += 1;
    } else if (item === '--author-review-queue-status') {
      options.authorReviewQueueStatus = args[index + 1];
      index += 1;
    } else if (item === '--author-review-queue-type') {
      options.authorReviewQueueType = args[index + 1];
      index += 1;
    } else if (item === '--author-review-queue-priority') {
      options.authorReviewQueuePriority = args[index + 1];
      index += 1;
    } else if (item === '--author-review-queue-resolve-stale') {
      options.authorReviewQueueResolveStale = args[index + 1];
      index += 1;
    } else if (item === '--archive-events') {
      options.archiveEvents = args[index + 1];
      index += 1;
    } else if (item === '--archive-events-execute') {
      options.archiveEventsExecute = args[index + 1];
      index += 1;
    } else if (item === '--archive-event-type') {
      options.archiveEventType = args[index + 1];
      index += 1;
    } else if (item === '--archive-delivery-statuses') {
      options.archiveDeliveryStatuses = args[index + 1];
      index += 1;
    } else if (item === '--archive-require-acknowledged') {
      options.archiveRequireAcknowledged = args[index + 1];
      index += 1;
    } else if (item === '--archive-older-than-days') {
      options.archiveOlderThanDays = args[index + 1];
      index += 1;
    } else if (item === '--archive-scan-limit') {
      options.archiveScanLimit = args[index + 1];
      index += 1;
    } else if (item === '--archive-limit') {
      options.archiveLimit = args[index + 1];
      index += 1;
    } else if (item === '--archive-by') {
      options.archiveBy = args[index + 1];
      index += 1;
    } else if (item === '--archive-reason') {
      options.archiveReason = args[index + 1];
      index += 1;
    } else if (item === '--review-action') {
      options.reviewAction = args[index + 1];
      index += 1;
    } else if (item === '--review-action-execute') {
      options.reviewActionExecute = args[index + 1];
      index += 1;
    } else if (item === '--handoff-id') {
      options.handoffId = args[index + 1];
      index += 1;
    } else if (item === '--review-status') {
      options.reviewStatus = args[index + 1];
      index += 1;
    } else if (item === '--reviewer-id') {
      options.reviewerId = args[index + 1];
      index += 1;
    } else if (item === '--interval-ms') {
      options.intervalMs = args[index + 1];
      index += 1;
    } else if (item === '--lease-ttl-ms') {
      options.leaseTtlMs = args[index + 1];
      index += 1;
    } else if (item === '--source-run-stale-after-ms') {
      options.sourceRunStaleAfterMs = args[index + 1];
      index += 1;
    } else if (item === '--source-failure-retry-backoff-ms') {
      options.sourceFailureRetryBackoffMs = args[index + 1];
      index += 1;
    } else if (item === '--source-failure-max-retry-backoff-ms') {
      options.sourceFailureMaxRetryBackoffMs = args[index + 1];
      index += 1;
    }
  }
  return options;
}

function parseOptionalBoolean(value) {
  if (value === undefined) return undefined;
  return value !== 'false';
}

if (require.main === module) {
  main(process.argv).catch(function (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildRequest,
  parseArgs
};
