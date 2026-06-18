#!/usr/bin/env node
'use strict';

const { loadEnvFile } = require('../../runtime/envFileLoader');
const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');
const { createThreadTraceConfig } = require('../../runtime/threadTraceConfig');
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
    console.log('Events delivered: ' + result.events.dispatchedCount);
    console.log('Events failed: ' + result.events.failedCount);
    console.log('Open events: ' + result.overview.events.unacknowledged);
    console.log('Worker stale: ' + result.overview.workers.stale);
  }
}

function buildRequest(options, storeDir, config) {
  return {
    sources: {
      forum: options.forum,
      limit: options.limit ? Number(options.limit) : undefined,
      sourceTaskMode: config.workers.sourceTaskMode,
      provider: config.llm.provider,
      traceId: options.traceId,
      baseReportType: options.baseReportType,
      semanticEnrichmentEnabled: parseOptionalBoolean(options.semanticEnrichmentEnabled),
      semanticSkipIfUnchanged: parseOptionalBoolean(options.semanticSkipIfUnchanged),
      sourceRunStaleAfterMs: config.workers.sourceRunStaleAfterMs,
      storeDir
    },
    events: {
      channel: options.channel,
      webhookUrl: options.webhookUrl,
      timeoutMs: options.timeoutMs ? Number(options.timeoutMs) : undefined,
      limit: options.limit ? Number(options.limit) : undefined,
      maxAttempts: options.maxAttempts ? Number(options.maxAttempts) : undefined,
      retryBackoffMs: options.retryBackoffMs ? Number(options.retryBackoffMs) : undefined,
      maxRetryBackoffMs: options.maxRetryBackoffMs ? Number(options.maxRetryBackoffMs) : undefined,
      includeFailed: options.includeFailed === undefined ? undefined : options.includeFailed !== 'false',
      storeDir
    },
    overview: {
      limit: options.limit ? Number(options.limit) : undefined,
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
    } else if (item === '--interval-ms') {
      options.intervalMs = args[index + 1];
      index += 1;
    } else if (item === '--lease-ttl-ms') {
      options.leaseTtlMs = args[index + 1];
      index += 1;
    } else if (item === '--source-run-stale-after-ms') {
      options.sourceRunStaleAfterMs = args[index + 1];
      index += 1;
    }
  }
  return options;
}

function parseOptionalBoolean(value) {
  if (value === undefined) return undefined;
  return value !== 'false';
}

main(process.argv).catch(function (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
