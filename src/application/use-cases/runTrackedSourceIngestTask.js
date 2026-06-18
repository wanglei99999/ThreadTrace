'use strict';

const {
  markTrackedSourceRunCompleted,
  markTrackedSourceRunFailed,
  markTrackedSourceRunStarted,
  isTrackedSourceRunStale
} = require('../../domain/models/trackedSource');
const {
  buildThreadSnapshotCursor,
  compareThreadSnapshotCursor
} = require('../../domain/sources/threadSnapshotCursor');
const { createSourceChangedEvent } = require('../../domain/events/notificationEvent');
const { createApplicationError } = require('../errors/applicationError');
const { createDefaultSourceIngestHandlerRegistry } = require('../source-ingest/standardSourceIngestHandlers');
const { assertSourceRepository } = require('../ports/sourceRepository');

async function runTrackedSourceIngestTask(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const handlerRegistry = safeOptions.sourceIngestHandlerRegistry || createDefaultSourceIngestHandlerRegistry();
  const source = await sourceRepository.findSource(safeOptions.sourceId);

  if (!source) {
    throw sourceNotFoundError(safeOptions.sourceId);
  }
  if (source.enabled === false) {
    throw sourceDisabledError(source);
  }
  const handler = handlerRegistry.findHandler(source);
  if (!handler) {
    throw sourceTypeNotIngestibleError(source);
  }
  const adapter = safeOptions.adapter || resolveAdapter(handler, source, safeOptions.getAdapter);

  let runningSource = await acquireSourceRun(sourceRepository, source, {
    now: safeOptions.now,
    staleAfterMs: safeOptions.sourceRunStaleAfterMs
  });

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

async function acquireSourceRun(sourceRepository, source, options) {
  if (typeof sourceRepository.acquireSourceRun === 'function') {
    const result = await sourceRepository.acquireSourceRun({
      sourceId: source.id,
      now: options && options.now,
      staleAfterMs: options && options.staleAfterMs
    });
    if (!result || !result.acquired) {
      throw sourceAcquireFailureError(source, result);
    }
    return result.source || markTrackedSourceRunStarted(source, options && options.now);
  }

  assertSourceNotAlreadyRunning(source, options);
  const runningSource = markTrackedSourceRunStarted(source, options && options.now);
  await sourceRepository.saveSource(runningSource);
  return runningSource;
}

function sourceAcquireFailureError(source, result) {
  if (result && result.reason === 'unknown-source') {
    return sourceNotFoundError(source.id);
  }
  if (result && result.reason === 'transition-lock-held') {
    return createApplicationError('source_run_transition_locked', 'Tracked source run transition is locked: ' + source.id, {
      statusCode: 409,
      details: {
        sourceId: source.id
      }
    });
  }
  return createApplicationError('source_run_already_running', 'Tracked source is already running: ' + source.id, {
    statusCode: 409,
    details: {
      sourceId: source.id
    }
  });
}

function sourceNotFoundError(sourceId) {
  return createApplicationError('source_not_found', 'Unknown tracked source: ' + sourceId, {
    statusCode: 404,
    details: {
      sourceId
    }
  });
}

function sourceDisabledError(source) {
  return createApplicationError('source_disabled', 'Tracked source is disabled: ' + source.id, {
    statusCode: 409,
    details: {
      sourceId: source.id
    }
  });
}

function sourceTypeNotIngestibleError(source) {
  return createApplicationError('source_type_not_ingestible', 'Tracked source type is not ingestible yet: ' + source.sourceType, {
    statusCode: 400,
    details: {
      sourceId: source.id,
      sourceType: source.sourceType
    }
  });
}

function assertSourceNotAlreadyRunning(source, options) {
  const runState = source.runState || {};
  if (runState.status !== 'running') return;
  if (isStaleSourceRun(runState, options)) return;
  throw createApplicationError('source_run_already_running', 'Tracked source is already running: ' + source.id, {
    statusCode: 409,
    details: {
      sourceId: source.id
    }
  });
}

function isStaleSourceRun(runState, options) {
  const safeOptions = options || {};
  return isTrackedSourceRunStale(runState, {
    now: safeOptions.now,
    staleAfterMs: safeOptions.staleAfterMs
  });
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
