'use strict';

function buildDueSourceBatchEvidence(options) {
  const safeOptions = options || {};
  const batchTask = safeOptions.batchTask || {};
  const results = safeOptions.results || [];
  const skipped = safeOptions.skipped || [];
  const due = results.map(function (result) {
    const source = compactSource(result.source);
    const childTask = result.task || {};
    const ingestTask = result.ingestTask || result.task || {};
    return removeEmpty({
      status: result.status,
      source,
      schedule: {
        due: true,
        reason: result.scheduleReason
      },
      tasks: removeEmpty({
        batchTaskId: batchTask.id,
        childTaskId: childTask.id,
        ingestTaskId: ingestTask.id
      }),
      cursor: summarizeCursorDiff(result.cursorDiff),
      semantic: summarizeSemantic(result.semantic),
      replay: removeEmpty({
        taskId: ingestTask.id || childTask.id,
        sourceThreadId: result.report && result.report.thread && result.report.thread.sourceThreadId,
        cursorChanged: result.cursorDiff && result.cursorDiff.changed,
        newPostCount: result.cursorDiff && result.cursorDiff.newPostCount
      }),
      error: result.error
    });
  });
  const skippedEvidence = skipped.map(function (item) {
    return removeEmpty({
      status: 'skipped',
      source: compactSource(item.source),
      schedule: removeEmpty({
        due: false,
        reason: item.reason,
        nextRunAt: item.nextRunAt,
        retryAt: item.retryAt,
        failureCount: item.failureCount,
        backoffMs: item.backoffMs,
        baseReason: item.baseReason
      })
    });
  });

  return {
    batch: removeEmpty({
      taskId: batchTask.id,
      taskType: batchTask.type,
      traceId: batchTask.input && batchTask.input._trace && batchTask.input._trace.traceId,
      checkedAt: safeOptions.checkedAt,
      startedAt: safeOptions.startedAt || batchTask.startedAt,
      finishedAt: safeOptions.finishedAt
    }),
    summary: {
      sourceCount: safeOptions.sourceCount || 0,
      dueCount: due.length,
      skippedCount: skippedEvidence.length,
      completedCount: due.filter(function (item) { return item.status === 'completed'; }).length,
      failedCount: due.filter(function (item) { return item.status === 'failed'; }).length,
      replayableCount: due.filter(function (item) {
        return item.replay && item.replay.taskId;
      }).length,
      backoffSkippedCount: skippedEvidence.filter(function (item) {
        return item.schedule && item.schedule.reason === 'waiting-failure-backoff';
      }).length
    },
    due,
    skipped: skippedEvidence,
    timeline: buildTimeline(due, skippedEvidence)
  };
}

function buildTimeline(due, skipped) {
  return due.map(function (item) {
    return {
      kind: 'due-source',
      status: item.status,
      sourceId: item.source && item.source.id,
      sourceKey: item.source && item.source.sourceKey,
      scheduleReason: item.schedule && item.schedule.reason,
      taskId: item.tasks && (item.tasks.childTaskId || item.tasks.ingestTaskId),
      changed: item.cursor && item.cursor.changed,
      newPostCount: item.cursor && item.cursor.newPostCount,
      semanticStatus: item.semantic && item.semantic.status
    };
  }).concat(skipped.map(function (item) {
    return {
      kind: 'skipped-source',
      status: 'skipped',
      sourceId: item.source && item.source.id,
      sourceKey: item.source && item.source.sourceKey,
      scheduleReason: item.schedule && item.schedule.reason,
      nextRunAt: item.schedule && item.schedule.nextRunAt,
      retryAt: item.schedule && item.schedule.retryAt,
      backoffMs: item.schedule && item.schedule.backoffMs
    };
  }));
}

function compactSource(source) {
  const safeSource = source || {};
  return removeEmpty({
    id: safeSource.id || safeSource.sourceId,
    sourceKey: safeSource.sourceKey,
    sourceType: safeSource.sourceType,
    displayName: safeSource.displayName
  });
}

function summarizeCursorDiff(cursorDiff) {
  const safeDiff = cursorDiff || {};
  return removeEmpty({
    changed: safeDiff.changed,
    newPostCount: safeDiff.newPostCount,
    previousPostCount: safeDiff.previousPostCount,
    nextPostCount: safeDiff.nextPostCount,
    previousLastPostId: safeDiff.previousLastPostId,
    nextLastPostId: safeDiff.nextLastPostId,
    previousLastFloor: safeDiff.previousLastFloor,
    nextLastFloor: safeDiff.nextLastFloor
  });
}

function summarizeSemantic(semantic) {
  if (!semantic) return undefined;
  return removeEmpty({
    status: semantic.status,
    skipped: semantic.skipped,
    provider: semantic.provider,
    reportId: semantic.report && semantic.report.id || semantic.reportId,
    reason: semantic.reason
  });
}

function removeEmpty(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const cleaned = Object.keys(value).reduce(function (result, key) {
    if (value[key] !== undefined) result[key] = value[key];
    return result;
  }, {});
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

module.exports = {
  buildDueSourceBatchEvidence
};
