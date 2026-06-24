#!/usr/bin/env node
'use strict';

const { loadEnvFile } = require('../../runtime/envFileLoader');
const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');
const { createThreadTraceConfig } = require('../../runtime/threadTraceConfig');
const { buildWorkerLeaseKey } = require('../../domain/models/workerLeaseKey');
const { createNotificationEventWorker } = require('./notificationEventWorker');

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
    eventWorkerIntervalMs: options.intervalMs,
    workerLeaseTtlMs: options.leaseTtlMs,
    webhookUrl: options.webhookUrl
  });
  const storeDir = config.storeDir;
  const runtime = createThreadTraceRuntime({
    storeDir,
    defaultInputDir: config.defaultInputDir,
    config
  });
  const repositories = runtime.createRepositories(storeDir);
  const worker = createNotificationEventWorker({
    runtime,
    workerRunRepository: repositories.workerRunRepository,
    workerLeaseRepository: repositories.workerLeaseRepository,
    leaseKey: buildWorkerLeaseKey('notification-event', {
      sourceId: options.sourceId,
      sourceKey: options.sourceKey || options.forum
    }),
    leaseTtlMs: config.workers.leaseTtlMs,
    pollIntervalMs: config.workers.eventIntervalMs
  });
  const request = {
    channel: options.channel,
    webhookUrl: options.webhookUrl || config.notifications.webhookUrl,
    timeoutMs: options.timeoutMs ? Number(options.timeoutMs) : undefined,
    limit: options.limit ? Number(options.limit) : undefined,
    maxAttempts: options.maxAttempts ? Number(options.maxAttempts) : undefined,
    sourceId: options.sourceId,
    sourceKey: options.sourceKey || options.forum,
    retryBackoffMs: options.retryBackoffMs ? Number(options.retryBackoffMs) : undefined,
    maxRetryBackoffMs: options.maxRetryBackoffMs ? Number(options.maxRetryBackoffMs) : undefined,
    includeFailed: options.includeFailed === undefined ? undefined : options.includeFailed !== 'false',
    storeDir
  };

  if (options.loop) {
    console.log('ThreadTrace notification-event worker running. Store: ' + storeDir);
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
    console.log('Channel: ' + result.channelKey);
    console.log('Dispatched: ' + result.dispatchedCount);
    console.log('Failed: ' + result.failedCount);
    console.log('Skipped: ' + result.skippedCount);
  }
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

if (require.main === module) {
  main(process.argv).catch(function (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs
};
