'use strict';

const crypto = require('crypto');

function createSourceChangedEvent(input) {
  const safeInput = input || {};
  const now = safeInput.createdAt || new Date().toISOString();
  const cursorDiff = safeInput.cursorDiff || {};
  const cursor = safeInput.cursor || {};
  const source = safeInput.source || {};

  return {
    id: safeInput.id || crypto.randomUUID(),
    type: 'source-changed',
    severity: cursorDiff.newPostCount > 0 ? 'info' : 'debug',
    sourceId: source.id,
    sourceKey: source.sourceKey,
    taskId: safeInput.task && safeInput.task.id,
    createdAt: now,
    title: source.displayName || cursor.title || source.id,
    summary: buildSummary(source, cursorDiff, cursor),
    payload: {
      source,
      cursor,
      cursorDiff
    },
    acknowledgedAt: safeInput.acknowledgedAt
  };
}

function acknowledgeNotificationEvent(event, input) {
  const safeInput = input || {};
  const now = safeInput.acknowledgedAt || new Date().toISOString();
  return Object.assign({}, event, {
    acknowledgedAt: event.acknowledgedAt || now,
    acknowledgedBy: event.acknowledgedBy || safeInput.acknowledgedBy || 'system',
    acknowledgementNote: event.acknowledgementNote || safeInput.note
  });
}

function buildSummary(source, cursorDiff, cursor) {
  const name = source.displayName || source.id || 'source';
  if (!cursorDiff.previousPostCount) {
    return name + ' initialized with ' + (cursor.postCount || 0) + ' posts.';
  }
  if (cursorDiff.newPostCount > 0) {
    return name + ' has ' + cursorDiff.newPostCount + ' new posts, now at #' + cursorDiff.nextLastFloor + '.';
  }
  return name + ' changed without new post count growth.';
}

module.exports = {
  createSourceChangedEvent,
  acknowledgeNotificationEvent
};
