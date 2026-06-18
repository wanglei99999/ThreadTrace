'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createThreadSnapshot } = require('../src/domain/models/threadSnapshot');
const {
  isStaleSourceRun,
  runTrackedSourceIngestTask
} = require('../src/application/use-cases/runTrackedSourceIngestTask');
const { runEnabledSourcesIngestTasks } = require('../src/application/use-cases/runEnabledSourcesIngestTasks');
const { runDueSourcesIngestTasks } = require('../src/application/use-cases/runDueSourcesIngestTasks');

test('tracked source ingest rejects active duplicate runs', async function () {
  let handlerCalls = 0;
  let savedSources = 0;
  const source = createSource({
    runState: {
      status: 'running',
      lastStartedAt: '2026-06-19T10:00:00.000Z'
    }
  });

  await assert.rejects(function () {
    return runTrackedSourceIngestTask({
      sourceId: source.id,
      sourceRepository: {
        async saveSource() { savedSources += 1; },
        async findSource() { return source; },
        async listSources() { return [source]; }
      },
      sourceIngestHandlerRegistry: createHandlerRegistry(function () {
        handlerCalls += 1;
        return createHandlerResult();
      }),
      now: '2026-06-19T10:01:00.000Z',
      sourceRunStaleAfterMs: 10 * 60 * 1000
    });
  }, /already running/);

  assert.equal(handlerCalls, 0);
  assert.equal(savedSources, 0);
});

test('tracked source ingest recovers stale running source state', async function () {
  let handlerCalls = 0;
  const savedSources = [];
  const source = createSource({
    runState: {
      status: 'running',
      lastStartedAt: '2026-06-19T09:00:00.000Z'
    }
  });

  const result = await runTrackedSourceIngestTask({
    sourceId: source.id,
    sourceRepository: {
      async saveSource(saved) { savedSources.push(saved); },
      async findSource() { return source; },
      async listSources() { return [source]; }
    },
    sourceIngestHandlerRegistry: createHandlerRegistry(function () {
      handlerCalls += 1;
      return createHandlerResult();
    }),
    now: '2026-06-19T10:01:00.000Z',
    sourceRunStaleAfterMs: 10 * 60 * 1000
  });

  assert.equal(handlerCalls, 1);
  assert.equal(savedSources[0].runState.status, 'running');
  assert.equal(savedSources.at(-1).runState.status, 'completed');
  assert.equal(result.cursor.sourceThreadId, 'thread-1');
});

test('tracked source ingest uses repository source-run acquire when available', async function () {
  let acquireCalls = 0;
  let directSaves = 0;
  const source = createSource();

  const result = await runTrackedSourceIngestTask({
    sourceId: source.id,
    sourceRepository: {
      async saveSource() { directSaves += 1; },
      async findSource() { return source; },
      async listSources() { return [source]; },
      async acquireSourceRun(request) {
        acquireCalls += 1;
        assert.equal(request.sourceId, source.id);
        assert.equal(request.staleAfterMs, 1234);
        return {
          acquired: true,
          source: Object.assign({}, source, {
            runState: {
              status: 'running',
              lastStartedAt: request.now
            }
          })
        };
      }
    },
    sourceIngestHandlerRegistry: createHandlerRegistry(createHandlerResult),
    now: '2026-06-19T10:01:00.000Z',
    sourceRunStaleAfterMs: 1234
  });

  assert.equal(acquireCalls, 1);
  assert.equal(directSaves, 1);
  assert.equal(result.source.runState.status, 'completed');
});

test('stale source run helper treats invalid timestamps as recoverable', function () {
  assert.equal(isStaleSourceRun({
    status: 'running'
  }, {
    now: '2026-06-19T10:01:00.000Z'
  }), true);
});

test('stale source run helper respects explicit zero stale window', function () {
  assert.equal(isStaleSourceRun({
    status: 'running',
    lastStartedAt: '2026-06-19T10:00:00.000Z'
  }, {
    now: '2026-06-19T10:00:00.001Z',
    staleAfterMs: 0
  }), true);
});

test('enabled source batch records active duplicate runs as source failures', async function () {
  let handlerCalls = 0;
  const source = createSource({
    runState: {
      status: 'running',
      lastStartedAt: '2026-06-19T10:00:00.000Z'
    }
  });
  const repositories = createRepositoriesForSources([source]);

  const result = await runEnabledSourcesIngestTasks({
    sourceRepository: repositories.sourceRepository,
    threadRepository: repositories.threadRepository,
    reportRepository: repositories.reportRepository,
    taskRepository: repositories.taskRepository,
    sourceIngestHandlerRegistry: createHandlerRegistry(function () {
      handlerCalls += 1;
      return createHandlerResult();
    }),
    getAdapter() {},
    now: '2026-06-19T10:01:00.000Z',
    sourceRunStaleAfterMs: 10 * 60 * 1000
  });

  assert.equal(handlerCalls, 0);
  assert.equal(result.completedCount, 0);
  assert.equal(result.failedCount, 1);
  assert.match(result.results[0].error.message, /already running/);
});

test('due source batch can recover stale running source state', async function () {
  let handlerCalls = 0;
  const source = createSource({
    schedule: {
      enabled: true,
      nextRunAt: '2026-06-19T09:30:00.000Z'
    },
    runState: {
      status: 'running',
      lastStartedAt: '2026-06-19T09:00:00.000Z'
    }
  });
  const repositories = createRepositoriesForSources([source]);

  const result = await runDueSourcesIngestTasks({
    sourceRepository: repositories.sourceRepository,
    threadRepository: repositories.threadRepository,
    reportRepository: repositories.reportRepository,
    taskRepository: repositories.taskRepository,
    sourceIngestHandlerRegistry: createHandlerRegistry(function () {
      handlerCalls += 1;
      return createHandlerResult();
    }),
    getAdapter() {},
    now: '2026-06-19T10:01:00.000Z',
    sourceRunStaleAfterMs: 10 * 60 * 1000
  });

  assert.equal(handlerCalls, 1);
  assert.equal(result.dueCount, 1);
  assert.equal(result.completedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.results[0].scheduleReason, 'stale-source-running-next-run-at');
  assert.equal(repositories.savedSources[0].runState.status, 'running');
  assert.equal(repositories.savedSources.at(-1).runState.status, 'completed');
});

function createSource(overrides) {
  return Object.assign({
    id: 'source-1',
    sourceKey: 'custom',
    sourceType: 'custom-source',
    displayName: 'Custom source',
    enabled: true,
    location: { value: 'custom' },
    runState: { status: 'never-run' }
  }, overrides);
}

function createHandlerRegistry(run) {
  return {
    findHandler() {
      return {
        sourceType: 'custom-source',
        requiresAdapter: false,
        run
      };
    }
  };
}

function createHandlerResult() {
  return {
    task: {
      id: 'task-1',
      status: 'completed'
    },
    threadSnapshot: createThreadSnapshot({
      forum: {
        sourceKey: 'custom',
        displayName: 'Custom'
      },
      sourceKey: 'custom',
      sourceThreadId: 'thread-1',
      title: 'Thread 1',
      posts: []
    }),
    report: {
      thread: {
        sourceThreadId: 'thread-1'
      }
    }
  };
}

function createRepositoriesForSources(sources) {
  const savedSources = [];
  const savedTasks = [];
  return {
    savedSources,
    savedTasks,
    sourceRepository: {
      async saveSource(source) { savedSources.push(source); },
      async findSource(id) { return sources.find(function (source) { return source.id === id; }); },
      async listSources() { return sources; }
    },
    threadRepository: {
      async saveSnapshot() {},
      async findSnapshot() {},
      async listSnapshots() { return []; }
    },
    reportRepository: {
      async saveReport() {},
      async findReports() { return []; },
      async listReports() { return []; }
    },
    taskRepository: {
      async saveTask(task) { savedTasks.push(task); },
      async findTask() {},
      async listTasks() { return []; }
    }
  };
}
