'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');

async function listSourceInsightPipelineRuns(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const sourceRepository = safeOptions.sourceRepository
    ? assertSourceRepository(safeOptions.sourceRepository)
    : undefined;
  const limit = normalizeLimit(safeOptions.limit, 20);
  const scanLimit = normalizeLimit(safeOptions.scanLimit, Math.max(limit * 5, 100));
  const tasks = await taskRepository.listTasks({
    type: 'source-insight-pipeline',
    status: safeOptions.status,
    limit: scanLimit
  });
  const filteredTasks = tasks.filter(function (task) {
    return !safeOptions.sourceId || taskSourceId(task) === safeOptions.sourceId;
  });
  const selectedTasks = filteredTasks.slice(0, limit);
  const sourceMap = await loadSourcesById(sourceRepository, selectedTasks);

  return {
    runs: selectedTasks.map(function (task) {
      return toPipelineRun(task, sourceMap[taskSourceId(task)]);
    }),
    limit,
    scannedTaskCount: tasks.length
  };
}

async function loadSourcesById(sourceRepository, tasks) {
  if (!sourceRepository) return {};
  const ids = Array.from(new Set(tasks.map(taskSourceId).filter(Boolean)));
  const entries = await Promise.all(ids.map(async function (id) {
    return [id, await sourceRepository.findSource(id)];
  }));
  return entries.reduce(function (map, entry) {
    if (entry[1]) map[entry[0]] = entry[1];
    return map;
  }, {});
}

function toPipelineRun(task, source) {
  const output = task.output || {};
  const sourceId = taskSourceId(task) || output.sourceId;
  return {
    taskId: task.id,
    taskType: task.type,
    status: task.status,
    sourceId,
    sourceKey: output.sourceKey || (source && source.sourceKey),
    sourceThreadId: output.sourceThreadId,
    source: source ? summarizeSource(source) : undefined,
    ingestTaskId: output.ingestTaskId,
    cursorDiff: summarizeCursorDiff(output.cursorDiff),
    semantic: summarizeSemantic(output.semantic),
    error: task.error,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    updatedAt: task.updatedAt
  };
}

function summarizeSource(source) {
  return {
    id: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName,
    enabled: source.enabled
  };
}

function summarizeCursorDiff(cursorDiff) {
  const safeDiff = cursorDiff || {};
  return {
    changed: safeDiff.changed,
    newPostCount: safeDiff.newPostCount,
    previousPostCount: safeDiff.previousPostCount,
    nextPostCount: safeDiff.nextPostCount,
    previousLastFloor: safeDiff.previousLastFloor,
    nextLastFloor: safeDiff.nextLastFloor
  };
}

function summarizeSemantic(semantic) {
  const safeSemantic = semantic || {};
  return {
    status: safeSemantic.status,
    reason: safeSemantic.reason,
    taskId: safeSemantic.taskId,
    reportType: safeSemantic.reportType,
    provider: safeSemantic.provider,
    traceId: safeSemantic.traceId,
    summary: safeSemantic.summary
  };
}

function taskSourceId(task) {
  return task && task.input ? task.input.sourceId : undefined;
}

function normalizeLimit(value, defaultValue) {
  const numberValue = Number(value || defaultValue);
  if (!Number.isFinite(numberValue) || numberValue < 1) return defaultValue;
  return Math.min(Math.floor(numberValue), 500);
}

module.exports = {
  listSourceInsightPipelineRuns
};
