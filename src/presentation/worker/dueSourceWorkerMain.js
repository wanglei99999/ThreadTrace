#!/usr/bin/env node
'use strict';

const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');
const { createThreadTraceConfig } = require('../../runtime/threadTraceConfig');
const { createDueSourceWorker } = require('./dueSourceWorker');

async function main(argv) {
  const options = parseArgs(argv.slice(2));
  const config = createThreadTraceConfig({
    env: process.env,
    cwd: process.cwd(),
    defaultInputDir: options.input,
    storeDir: options.storeDir,
    sourceTaskMode: options.sourceTaskMode,
    llmProvider: options.provider,
    workerIntervalMs: options.intervalMs,
    workerLeaseTtlMs: options.leaseTtlMs
  });
  const storeDir = config.storeDir;
  const runtime = createThreadTraceRuntime({
    storeDir,
    defaultInputDir: config.defaultInputDir,
    config
  });
  const repositories = runtime.createRepositories(storeDir);
  const worker = createDueSourceWorker({
    runtime,
    workerRunRepository: repositories.workerRunRepository,
    workerLeaseRepository: repositories.workerLeaseRepository,
    sourceTaskMode: config.workers.sourceTaskMode,
    leaseTtlMs: config.workers.leaseTtlMs,
    pollIntervalMs: config.workers.dueSourceIntervalMs
  });
  const request = {
    forum: options.forum,
    limit: options.limit ? Number(options.limit) : undefined,
    sourceTaskMode: config.workers.sourceTaskMode,
    provider: config.llm.provider,
    traceId: options.traceId,
    baseReportType: options.baseReportType,
    semanticEnrichmentEnabled: parseOptionalBoolean(options.semanticEnrichmentEnabled),
    semanticSkipIfUnchanged: parseOptionalBoolean(options.semanticSkipIfUnchanged),
    storeDir
  };

  if (options.loop) {
    console.log('ThreadTrace due-source worker running. Store: ' + storeDir);
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
    console.log('Due sources: ' + result.dueCount);
    console.log('Completed: ' + result.completedCount);
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

function parseOptionalBoolean(value) {
  if (value === undefined) return undefined;
  return value !== 'false';
}

main(process.argv).catch(function (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
