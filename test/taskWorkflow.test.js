'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { runIngestSavedThreadDirectoryTask } = require('../src/application/use-cases/runIngestSavedThreadDirectoryTask');
const { createFileThreadRepository } = require('../src/infrastructure/storage/fileThreadRepository');
const { createFileAnalysisReportRepository } = require('../src/infrastructure/storage/fileAnalysisReportRepository');
const { createFileTaskRepository } = require('../src/infrastructure/storage/fileTaskRepository');

test('ingest task records status and output in task repository', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-task-'));
  const taskRepository = createFileTaskRepository({
    baseDir: path.join(tempDir, 'tasks')
  });

  const result = await runIngestSavedThreadDirectoryTask({
    forum: 'nga',
    adapter: getForumAdapter('nga'),
    inputDir: path.resolve(__dirname, '..', 'example'),
    threadRepository: createFileThreadRepository({
      baseDir: path.join(tempDir, 'threads')
    }),
    reportRepository: createFileAnalysisReportRepository({
      baseDir: path.join(tempDir, 'reports')
    }),
    taskRepository,
    requestId: 'task-request-1',
    traceId: 'trace-1',
    idempotencyKey: 'idem-1'
  });

  const loadedTask = await taskRepository.findTask(result.task.id);
  const tasks = await taskRepository.listTasks({
    status: 'completed',
    type: 'ingest-saved-thread-directory'
  });
  const tasksByTrace = await taskRepository.listTasks({
    requestId: 'task-request-1',
    traceId: 'trace-1',
    idempotencyKey: 'idem-1'
  });

  assert.equal(result.task.status, 'completed');
  assert.deepEqual(result.task.input._trace, {
    requestId: 'task-request-1',
    traceId: 'trace-1',
    idempotencyKey: 'idem-1'
  });
  assert.equal(loadedTask.output.sourceThreadId, '45974302');
  assert.equal(loadedTask.input._trace.requestId, 'task-request-1');
  assert.equal(tasks.length, 1);
  assert.equal(tasksByTrace.length, 1);
  assert.equal(tasksByTrace[0].id, result.task.id);
});
