'use strict';

const fs = require('fs/promises');
const { analyzeThreadHistory } = require('../../domain/analysis/basicHistoricalAnalyzer');
const { createThreadSnapshot } = require('../../domain/models/threadSnapshot');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');
const {
  buildIdempotentReplay,
  findReusableCompletedTask
} = require('../jobs/taskIdempotency');

async function runIngestNormalizedThreadJsonTask(options) {
  const safeOptions = options || {};
  const threadRepository = assertThreadRepository(safeOptions.threadRepository);
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const source = safeOptions.source || {};
  const inputFile = safeOptions.inputFile || (source.location && source.location.inputFile);

  if (!inputFile) {
    throw new Error('runIngestNormalizedThreadJsonTask requires inputFile or source.location.inputFile.');
  }

  let task = createTaskRecord('ingest-normalized-thread-json', {
    sourceKey: safeOptions.sourceKey || safeOptions.forum || source.sourceKey,
    sourceId: source.id,
    inputFile
  }, safeOptions);
  const reusableTask = await findReusableCompletedTask(taskRepository, task);
  if (reusableTask) {
    return buildReplayResult({
      task: reusableTask,
      threadRepository,
      reportRepository
    });
  }

  await taskRepository.saveTask(task);

  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const threadSnapshot = await readThreadSnapshotJson(inputFile, {
      sourceKey: safeOptions.sourceKey || safeOptions.forum || source.sourceKey,
      displayName: source.displayName
    });
    const report = analyzeThreadHistory(threadSnapshot);

    await threadRepository.saveSnapshot(threadSnapshot);
    await reportRepository.saveReport(report);

    task = markTaskCompleted(task, {
      sourceKey: threadSnapshot.sourceKey,
      sourceThreadId: threadSnapshot.sourceThreadId,
      title: threadSnapshot.title,
      parsedPostCount: threadSnapshot.posts.length,
      reportType: report.reportType
    });
    await taskRepository.saveTask(task);

    return {
      task,
      threadSnapshot,
      report
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

async function readThreadSnapshotJson(inputFile, defaults) {
  const parsed = JSON.parse(stripUtf8Bom(await fs.readFile(inputFile, 'utf8')));
  const safeDefaults = defaults || {};
  const sourceKey = parsed.sourceKey || (parsed.forum && parsed.forum.sourceKey) || safeDefaults.sourceKey;
  const threadSnapshot = createThreadSnapshot(Object.assign({}, parsed, {
    sourceKey,
    forum: parsed.forum || {
      sourceKey,
      displayName: safeDefaults.displayName || sourceKey
    }
  }));
  if (!threadSnapshot.sourceKey) {
    throw new Error('Normalized thread JSON requires sourceKey or forum.sourceKey.');
  }
  if (!threadSnapshot.sourceThreadId) {
    throw new Error('Normalized thread JSON requires sourceThreadId.');
  }
  return threadSnapshot;
}

function stripUtf8Bom(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

async function buildReplayResult(options) {
  const task = options.task;
  const output = task.output || {};
  const threadSnapshot = output.sourceKey && output.sourceThreadId
    ? await options.threadRepository.findSnapshot({
      sourceKey: output.sourceKey,
      sourceThreadId: output.sourceThreadId
    })
    : undefined;
  const reports = output.sourceKey && output.sourceThreadId
    ? await options.reportRepository.findReports({
      sourceKey: output.sourceKey,
      sourceThreadId: output.sourceThreadId,
      reportType: output.reportType || 'basic-history'
    })
    : [];

  return {
    task,
    threadSnapshot,
    report: reports[0],
    idempotency: buildIdempotentReplay(task)
  };
}

module.exports = {
  runIngestNormalizedThreadJsonTask,
  readThreadSnapshotJson,
  stripUtf8Bom
};
