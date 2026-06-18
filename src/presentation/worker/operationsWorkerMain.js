#!/usr/bin/env node
'use strict';

const path = require('path');
const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');
const { createOperationsWorker } = require('./operationsWorker');

async function main(argv) {
  const options = parseArgs(argv.slice(2));
  const storeDir = options.storeDir || process.env.THREADTRACE_STORE_DIR || path.resolve(process.cwd(), 'data', 'store');
  const runtime = createThreadTraceRuntime({
    storeDir,
    defaultInputDir: options.input || process.env.THREADTRACE_EXAMPLE_DIR || path.resolve(process.cwd(), 'example')
  });
  const repositories = runtime.createRepositories(storeDir);
  const worker = createOperationsWorker({
    runtime,
    workerRunRepository: repositories.workerRunRepository,
    workerLeaseRepository: repositories.workerLeaseRepository,
    leaseTtlMs: options.leaseTtlMs ? Number(options.leaseTtlMs) : Number(process.env.THREADTRACE_WORKER_LEASE_TTL_MS || 5 * 60 * 1000),
    pollIntervalMs: options.intervalMs ? Number(options.intervalMs) : Number(process.env.THREADTRACE_OPERATIONS_WORKER_INTERVAL_MS || 60 * 1000)
  });
  const request = buildRequest(options, storeDir);

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

function buildRequest(options, storeDir) {
  return {
    sources: {
      forum: options.forum,
      limit: options.limit ? Number(options.limit) : undefined,
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
    }
  }
  return options;
}

main(process.argv).catch(function (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
