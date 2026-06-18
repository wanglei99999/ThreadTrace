'use strict';

const { buildThreadSnapshotCursor } = require('../../domain/sources/threadSnapshotCursor');
const { validateTrackedSourceRegistration } = require('./validateTrackedSourceRegistration');

async function dryRunSourceIngest(options) {
  const safeOptions = options || {};
  const validation = validateTrackedSourceRegistration({
    sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
    getAdapter: safeOptions.getAdapter,
    allowUnknownSourceType: safeOptions.allowUnknownSourceType,
    now: safeOptions.now,
    source: safeOptions.source
  });

  if (!validation.valid || validation.status === 'fail') {
    return result({
      now: safeOptions.now,
      status: 'fail',
      sourceValidation: validation,
      checks: validation.checks.concat([
        check('dryRun.sourceValidation', 'fail', 'Source draft must pass registration validation before dry-run execution.', {})
      ])
    });
  }

  const source = validation.source;
  const handler = safeOptions.sourceIngestHandlerRegistry.findHandler(source);
  const handlerSummary = summarizeHandler(handler);
  const remoteCheck = remoteFetchCheck(handler, safeOptions.allowRemoteFetch === true);
  if (remoteCheck.status === 'fail') {
    return result({
      now: safeOptions.now,
      status: 'fail',
      source,
      handler: handlerSummary,
      sourceValidation: validation,
      checks: validation.checks.concat([remoteCheck])
    });
  }

  const memory = createMemoryRepositories();
  try {
    const ingestResult = await handler.run({
      source,
      adapter: resolveAdapter(handler, source, safeOptions.getAdapter),
      crawler: safeOptions.crawler,
      threadRepository: memory.threadRepository,
      reportRepository: memory.reportRepository,
      taskRepository: memory.taskRepository,
      rawThreadPageRepository: memory.rawThreadPageRepository,
      requestId: safeOptions.requestId,
      traceId: safeOptions.traceId,
      idempotencyKey: safeOptions.idempotencyKey
    });
    const cursor = buildThreadSnapshotCursor(ingestResult.threadSnapshot);
    return result({
      now: safeOptions.now,
      status: 'ok',
      source,
      handler: handlerSummary,
      sourceValidation: validation,
      checks: validation.checks.concat([
        remoteCheck,
        check('dryRun.execution', 'ok', 'Source ingest handler completed using isolated in-memory repositories.', {})
      ]),
      task: summarizeTask(ingestResult.task),
      thread: summarizeThread(ingestResult.threadSnapshot),
      report: summarizeReport(ingestResult.report),
      cursor,
      repositoryWrites: memory.summary()
    });
  } catch (error) {
    return result({
      now: safeOptions.now,
      status: 'fail',
      source,
      handler: handlerSummary,
      sourceValidation: validation,
      checks: validation.checks.concat([
        remoteCheck,
        check('dryRun.execution', 'fail', error && error.message ? error.message : String(error), {})
      ]),
      error: publicError(error),
      repositoryWrites: memory.summary()
    });
  }
}

function createMemoryRepositories() {
  const snapshots = [];
  const reports = [];
  const tasks = [];
  const rawPages = [];
  const writes = {
    threadSnapshots: 0,
    reports: 0,
    tasks: 0,
    rawThreadPages: 0
  };

  return {
    threadRepository: {
      async saveSnapshot(snapshot) {
        writes.threadSnapshots += 1;
        snapshots.push(snapshot);
      },
      async findSnapshot(query) {
        return snapshots.find(function (snapshot) {
          return snapshot.sourceKey === query.sourceKey && snapshot.sourceThreadId === query.sourceThreadId;
        });
      },
      async listSnapshots(query) {
        const safeQuery = query || {};
        return snapshots.filter(function (snapshot) {
          if (safeQuery.sourceKey && snapshot.sourceKey !== safeQuery.sourceKey) return false;
          return true;
        }).slice(0, safeQuery.limit || snapshots.length);
      }
    },
    reportRepository: {
      async saveReport(report) {
        writes.reports += 1;
        reports.push(report);
      },
      async findReports(query) {
        return reports.filter(function (report) {
          const thread = report.thread || {};
          if (query.sourceKey && thread.sourceKey !== query.sourceKey) return false;
          if (query.sourceThreadId && thread.sourceThreadId !== query.sourceThreadId) return false;
          if (query.reportType && report.reportType !== query.reportType) return false;
          return true;
        });
      },
      async listReports(query) {
        const safeQuery = query || {};
        return this.findReports(safeQuery).then(function (items) {
          return items.slice(0, safeQuery.limit || items.length);
        });
      }
    },
    taskRepository: {
      async saveTask(task) {
        writes.tasks += 1;
        const index = tasks.findIndex(function (item) { return item.id === task.id; });
        if (index >= 0) tasks[index] = task;
        else tasks.push(task);
      },
      async findTask(id) {
        return tasks.find(function (task) { return task.id === id; });
      },
      async listTasks(query) {
        const safeQuery = query || {};
        return tasks.filter(function (task) {
          if (safeQuery.status && task.status !== safeQuery.status) return false;
          if (safeQuery.type && task.type !== safeQuery.type) return false;
          return true;
        }).slice(0, safeQuery.limit || tasks.length);
      }
    },
    rawThreadPageRepository: {
      async saveRawThreadPage(page) {
        writes.rawThreadPages += 1;
        rawPages.push(page);
      },
      async findRawThreadPageByHash(query) {
        return rawPages.find(function (page) {
          return page.sourceKey === query.sourceKey && page.contentSha1 === query.contentSha1;
        });
      },
      async listRawThreadPages(query) {
        const safeQuery = query || {};
        return rawPages.filter(function (page) {
          if (safeQuery.sourceKey && page.sourceKey !== safeQuery.sourceKey) return false;
          if (safeQuery.sourceThreadId && page.sourceThreadId !== safeQuery.sourceThreadId) return false;
          if (safeQuery.sourceUrl && page.sourceUrl !== safeQuery.sourceUrl) return false;
          return true;
        }).slice(0, safeQuery.limit || rawPages.length);
      }
    },
    summary() {
      return Object.assign({}, writes);
    }
  };
}

function remoteFetchCheck(handler, allowRemoteFetch) {
  const fetchesRemote = handler && handler.capabilities && handler.capabilities.fetchesRemote === true;
  if (!fetchesRemote) {
    return check('dryRun.remoteFetch', 'ok', 'Handler does not require remote fetch for dry-run execution.', {
      fetchesRemote: false
    });
  }
  if (allowRemoteFetch) {
    return check('dryRun.remoteFetch', 'ok', 'Remote fetch is explicitly allowed for this dry-run.', {
      fetchesRemote: true
    });
  }
  return check('dryRun.remoteFetch', 'fail', 'Handler fetches remote content; pass allowRemoteFetch=true to execute it during dry-run.', {
    fetchesRemote: true
  });
}

function resolveAdapter(handler, source, getAdapter) {
  if (!handler || handler.requiresAdapter === false || typeof getAdapter !== 'function') return undefined;
  return getAdapter(source.sourceKey);
}

function summarizeHandler(handler) {
  if (!handler) return undefined;
  return {
    sourceType: handler.sourceType,
    requiresAdapter: handler.requiresAdapter !== false,
    capabilities: handler.capabilities || {}
  };
}

function summarizeTask(task) {
  if (!task) return undefined;
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    output: task.output
  };
}

function summarizeThread(threadSnapshot) {
  if (!threadSnapshot) return undefined;
  return {
    sourceKey: threadSnapshot.sourceKey,
    sourceThreadId: threadSnapshot.sourceThreadId,
    title: threadSnapshot.title,
    postCount: Array.isArray(threadSnapshot.posts) ? threadSnapshot.posts.length : 0
  };
}

function summarizeReport(report) {
  if (!report) return undefined;
  return {
    reportType: report.reportType,
    generatedAt: report.generatedAt,
    thread: report.thread
  };
}

function result(options) {
  const safeOptions = options || {};
  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    dryRun: true,
    status: safeOptions.status || aggregateStatus((safeOptions.checks || []).map(function (item) { return item.status; })),
    source: safeOptions.source,
    handler: safeOptions.handler,
    checks: safeOptions.checks || [],
    sourceValidation: safeOptions.sourceValidation,
    task: safeOptions.task,
    thread: safeOptions.thread,
    report: safeOptions.report,
    cursor: safeOptions.cursor,
    repositoryWrites: safeOptions.repositoryWrites || {
      threadSnapshots: 0,
      reports: 0,
      tasks: 0,
      rawThreadPages: 0
    },
    error: safeOptions.error
  };
}

function check(key, status, summary, evidence) {
  return {
    key,
    status,
    summary,
    evidence: evidence || {}
  };
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

function publicError(error) {
  if (!error) return undefined;
  return {
    message: error.message,
    code: error.code,
    details: error.details
  };
}

module.exports = {
  dryRunSourceIngest,
  createMemoryRepositories
};
