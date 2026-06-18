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
    createdAt: safeInput.createdAt || now,
    updatedAt: now
  };
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
  createTrackedSource
};
