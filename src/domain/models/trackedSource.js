'use strict';

const crypto = require('crypto');

const SOURCE_TYPES = {
  SAVED_HTML_DIRECTORY: 'saved-html-directory',
  THREAD_URL: 'thread-url'
};

function createTrackedSource(input) {
  const safeInput = input || {};
  const sourceKey = safeInput.sourceKey || safeInput.forum || 'nga';
  const sourceType = safeInput.sourceType || SOURCE_TYPES.SAVED_HTML_DIRECTORY;
  const location = normalizeLocation(sourceType, safeInput.location || {
    inputDir: safeInput.inputDir,
    url: safeInput.url
  });
  const now = safeInput.updatedAt || new Date().toISOString();

  return {
    id: safeInput.id || buildSourceId(sourceKey, sourceType, location),
    sourceKey,
    sourceType,
    displayName: safeInput.displayName || safeInput.name || defaultDisplayName(sourceKey, sourceType, location),
    location,
    enabled: safeInput.enabled !== false,
    tags: Array.isArray(safeInput.tags) ? safeInput.tags : [],
    schedule: safeInput.schedule || undefined,
    runState: safeInput.runState || {
      status: 'never-run',
      failureCount: 0
    },
    createdAt: safeInput.createdAt || now,
    updatedAt: now
  };
}

function markTrackedSourceRunStarted(source, timestamp) {
  const now = timestamp || new Date().toISOString();
  return Object.assign({}, source, {
    runState: Object.assign({}, source.runState || {}, {
      status: 'running',
      lastStartedAt: now
    }),
    updatedAt: now
  });
}

function markTrackedSourceRunCompleted(source, task, timestamp) {
  const now = timestamp || new Date().toISOString();
  return Object.assign({}, source, {
    runState: Object.assign({}, source.runState || {}, {
      status: 'completed',
      lastStartedAt: source.runState && source.runState.lastStartedAt,
      lastFinishedAt: now,
      lastTaskId: task && task.id,
      lastError: undefined,
      failureCount: 0
    }),
    updatedAt: now
  });
}

function markTrackedSourceRunFailed(source, error, timestamp) {
  const now = timestamp || new Date().toISOString();
  const currentState = source.runState || {};
  return Object.assign({}, source, {
    runState: Object.assign({}, currentState, {
      status: 'failed',
      lastStartedAt: currentState.lastStartedAt,
      lastFinishedAt: now,
      lastError: {
        message: error && error.message ? error.message : String(error)
      },
      failureCount: (currentState.failureCount || 0) + 1
    }),
    updatedAt: now
  });
}

function normalizeLocation(sourceType, location) {
  const safeLocation = location || {};
  if (sourceType === SOURCE_TYPES.SAVED_HTML_DIRECTORY) {
    if (!safeLocation.inputDir) {
      throw new Error('saved-html-directory source requires inputDir.');
    }
    return {
      inputDir: safeLocation.inputDir
    };
  }

  if (sourceType === SOURCE_TYPES.THREAD_URL) {
    if (!safeLocation.url) {
      throw new Error('thread-url source requires url.');
    }
    return {
      url: safeLocation.url
    };
  }

  throw new Error('Unsupported sourceType: ' + sourceType);
}

function buildSourceId(sourceKey, sourceType, location) {
  const key = [
    sourceKey,
    sourceType,
    location.inputDir || location.url || ''
  ].join('|');
  const digest = crypto.createHash('sha1').update(key).digest('hex').slice(0, 10);
  return safeSegment(sourceKey + '-' + sourceType) + '-' + digest;
}

function defaultDisplayName(sourceKey, sourceType, location) {
  return sourceKey + ' ' + sourceType + ' ' + (location.inputDir || location.url || '');
}

function safeSegment(value) {
  return String(value || 'source').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

module.exports = {
  SOURCE_TYPES,
  createTrackedSource,
  markTrackedSourceRunStarted,
  markTrackedSourceRunCompleted,
  markTrackedSourceRunFailed
};
