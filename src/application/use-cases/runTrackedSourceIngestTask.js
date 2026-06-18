'use strict';

const {
  markTrackedSourceRunCompleted,
  markTrackedSourceRunFailed,
  markTrackedSourceRunStarted
} = require('../../domain/models/trackedSource');
const {
  buildThreadSnapshotCursor,
  compareThreadSnapshotCursor
} = require('../../domain/sources/threadSnapshotCursor');
const { createSourceChangedEvent } = require('../../domain/events/notificationEvent');
const { createDefaultSourceIngestHandlerRegistry } = require('../source-ingest/standardSourceIngestHandlers');
const { assertSourceRepository } = require('../ports/sourceRepository');

const DEFAULT_SOURCE_RUN_STALE_AFTER_MS = 10 * 60 * 1000;

async function runTrackedSourceIngestTask(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const handlerRegistry = safeOptions.sourceIngestHandlerRegistry || createDefaultSourceIngestHandlerRegistry();
  const source = await sourceRepository.findSource(safeOptions.sourceId);

  if (!source) {
    throw new Error('Unknown tracked source: ' + safeOptions.sourceId);
  }
  if (source.enabled === false) {
    throw new Error('Tracked source is disabled: ' + source.id);
  }
  assertSourceNotAlreadyRunning(source, {
    now: safeOptions.now,
    staleAfterMs: safeOptions.sourceRunStaleAfterMs
  });
  const handler = handlerRegistry.findHandler(source);
  if (!handler) {
    throw new Error('Tracked source type is not ingestible yet: ' + source.sourceType);
  }
  const adapter = safeOptions.adapter || resolveAdapter(handler, source, safeOptions.getAdapter);

  let runningSource = markTrackedSourceRunStarted(source);
  await sourceRepository.saveSource(runningSource);

  try {
    const result = await handler.run({
      source,
      adapter,
      crawler: safeOptions.crawler,
      threadRepository: safeOptions.threadRepository,
      reportRepository: safeOptions.reportRepository,
      taskRepository: safeOptions.taskRepository,
      rawThreadPageRepository: safeOptions.rawThreadPageRepository
    });
    const cursor = buildThreadSnapshotCursor(result.threadSnapshot);
    const cursorDiff = compareThreadSnapshotCursor(source.cursor, cursor);
    runningSource = markTrackedSourceRunCompleted(runningSource, result.task, cursor, cursorDiff);
    await sourceRepository.saveSource(runningSource);
    if (safeOptions.notificationEventRepository && cursorDiff.changed) {
      await safeOptions.notificationEventRepository.saveEvent(createSourceChangedEvent({
        source: runningSource,
        task: result.task,
        cursor,
        cursorDiff
      }));
    }
    return Object.assign({}, result, {
      source: runningSource,
      cursor,
      cursorDiff
    });
  } catch (error) {
    runningSource = markTrackedSourceRunFailed(runningSource, error);
    await sourceRepository.saveSource(runningSource);
    throw error;
  }
}

function assertSourceNotAlreadyRunning(source, options) {
  const runState = source.runState || {};
  if (runState.status !== 'running') return;
  if (isStaleSourceRun(runState, options)) return;
  throw new Error('Tracked source is already running: ' + source.id);
}

function isStaleSourceRun(runState, options) {
  const safeOptions = options || {};
  const staleAfterMs = safeOptions.staleAfterMs === undefined ? DEFAULT_SOURCE_RUN_STALE_AFTER_MS : safeOptions.staleAfterMs;
  const startedTime = Date.parse(runState.lastStartedAt);
  const nowTime = Date.parse(safeOptions.now || new Date().toISOString());
  if (Number.isNaN(startedTime) || Number.isNaN(nowTime)) return true;
  return nowTime - startedTime > staleAfterMs;
}

function resolveAdapter(handler, source, getAdapter) {
  if (typeof getAdapter !== 'function') return undefined;
  if (handler.requiresAdapter === false) return undefined;
  return getAdapter(source.sourceKey);
}

module.exports = {
  runTrackedSourceIngestTask,
  isStaleSourceRun
};
