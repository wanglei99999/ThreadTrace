'use strict';

function buildSourceCollectionPlan(source, decision, options) {
  const safeSource = source || {};
  const safeDecision = decision || {};
  const safeOptions = options || {};
  const runState = safeSource.runState || {};
  const cursor = safeSource.cursor || {};
  const cursorDiff = runState.lastCursorDiff || {};
  const sourceScope = {
    sourceId: safeSource.id,
    sourceKey: safeSource.sourceKey,
    sourceType: safeSource.sourceType
  };

  return {
    status: collectionStatus(safeSource, safeDecision),
    generatedAt: safeOptions.now,
    source: Object.assign({}, sourceScope, {
      displayName: safeSource.displayName,
      enabled: safeSource.enabled !== false
    }),
    strategy: collectionStrategy(safeSource),
    schedule: {
      enabled: safeSource.schedule && safeSource.schedule.enabled,
      intervalMinutes: safeSource.schedule && safeSource.schedule.intervalMinutes,
      nextRunAt: safeDecision.nextRunAt || safeSource.schedule && safeSource.schedule.nextRunAt,
      decision: {
        due: Boolean(safeDecision.due),
        reason: safeDecision.reason || 'unknown',
        retryAt: safeDecision.retryAt,
        failureCount: safeDecision.failureCount,
        backoffMs: safeDecision.backoffMs,
        baseReason: safeDecision.baseReason
      }
    },
    cursor: summarizeCursor(cursor),
    incremental: {
      enabled: Boolean(cursor.fingerprint),
      lastChanged: cursorDiff.changed,
      newPostCount: cursorDiff.newPostCount || 0,
      previousPostCount: cursorDiff.previousPostCount,
      nextPostCount: cursorDiff.nextPostCount || cursor.postCount,
      previousLastPostId: cursorDiff.previousLastPostId,
      nextLastPostId: cursorDiff.nextLastPostId || cursor.lastPostId,
      previousLastFloor: cursorDiff.previousLastFloor,
      nextLastFloor: cursorDiff.nextLastFloor || cursor.lastFloor
    },
    lastRun: {
      status: runState.status || 'unknown',
      lastStartedAt: runState.lastStartedAt,
      lastFinishedAt: runState.lastFinishedAt,
      lastTaskId: runState.lastTaskId,
      failureCount: runState.failureCount || 0,
      lastError: runState.lastError
    },
    replay: buildReplayEvidence(safeSource, runState),
    recommendedCommands: recommendedCommands(sourceScope, safeDecision)
  };
}

function collectionStatus(source, decision) {
  const runState = source.runState || {};
  if (source.enabled === false) return 'disabled';
  if (runState.status === 'running') return 'running';
  if (decision.due) return 'due';
  if (decision.reason === 'waiting-failure-backoff') return 'retry-waiting';
  if (decision.reason === 'no-schedule' || decision.reason === 'schedule-disabled') return 'unscheduled';
  if (runState.status === 'failed') return 'failed-waiting';
  return 'scheduled';
}

function collectionStrategy(source) {
  const sourceType = source.sourceType || 'unknown';
  const modes = {
    'saved-html-directory': 'local-archive',
    'thread-url': 'online-thread',
    'normalized-thread-json': 'external-normalized-feed'
  };
  return {
    sourceType,
    mode: modes[sourceType] || 'custom-source',
    location: summarizeLocation(source.location)
  };
}

function summarizeLocation(location) {
  const safeLocation = location || {};
  return {
    inputDir: safeLocation.inputDir,
    inputFile: safeLocation.inputFile,
    url: safeLocation.url,
    hasCustomLocation: Object.keys(safeLocation).some(function (key) {
      return ['inputDir', 'inputFile', 'url'].indexOf(key) === -1;
    })
  };
}

function summarizeCursor(cursor) {
  const safeCursor = cursor || {};
  return {
    present: Boolean(safeCursor.fingerprint),
    sourceKey: safeCursor.sourceKey,
    sourceThreadId: safeCursor.sourceThreadId,
    title: safeCursor.title,
    postCount: safeCursor.postCount || 0,
    lastFloor: safeCursor.lastFloor,
    lastPostId: safeCursor.lastPostId,
    lastPublishedAt: safeCursor.lastPublishedAt,
    capturedAt: safeCursor.capturedAt,
    fingerprint: safeCursor.fingerprint
  };
}

function buildReplayEvidence(source, runState) {
  const location = summarizeLocation(source.location);
  return {
    available: Boolean(runState.lastTaskId || source.cursor && source.cursor.fingerprint || location.inputDir || location.inputFile || location.url),
    taskId: runState.lastTaskId,
    cursorFingerprint: source.cursor && source.cursor.fingerprint,
    location,
    evidenceKinds: replayEvidenceKinds(source, runState, location)
  };
}

function replayEvidenceKinds(source, runState, location) {
  const kinds = [];
  if (runState.lastTaskId) kinds.push('task');
  if (source.cursor && source.cursor.fingerprint) kinds.push('cursor');
  if (location.inputDir) kinds.push('saved-html-directory');
  if (location.inputFile) kinds.push('normalized-json-file');
  if (location.url) kinds.push('source-url');
  return kinds;
}

function recommendedCommands(scope, decision) {
  const suffix = [
    scope.sourceId ? '--source-id ' + scope.sourceId : undefined,
    scope.sourceKey ? '--source-key ' + scope.sourceKey : undefined
  ].filter(Boolean).join(' ');
  const scoped = suffix ? ' ' + suffix : '';
  const commands = [
    'node src/presentation/cli/threadtrace.js source-drilldown' + scoped,
    'node src/presentation/cli/threadtrace.js run-source-task' + (scope.sourceId ? ' --source-id ' + scope.sourceId : scoped)
  ];
  if (decision && decision.due) {
    commands.unshift('node src/presentation/cli/threadtrace.js run-source-insight-pipeline' + (scope.sourceId ? ' --source-id ' + scope.sourceId : scoped));
  }
  return commands;
}

module.exports = {
  buildSourceCollectionPlan
};
