'use strict';

const { analyzeThreadHistory } = require('../../domain/analysis/basicHistoricalAnalyzer');
const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertRawThreadPageRepository } = require('../ports/rawThreadPageRepository');
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

async function runIngestRawThreadPageTask(options) {
  const safeOptions = options || {};
  const adapter = assertForumAdapter(safeOptions.adapter);
  const rawThreadPageRepository = assertRawThreadPageRepository(safeOptions.rawThreadPageRepository);
  const threadRepository = assertThreadRepository(safeOptions.threadRepository);
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);

  if (!safeOptions.sourceKey || !safeOptions.contentSha1) {
    throw new Error('runIngestRawThreadPageTask requires sourceKey and contentSha1.');
  }

  let task = createTaskRecord('ingest-raw-thread-page', {
    sourceKey: safeOptions.sourceKey,
    contentSha1: safeOptions.contentSha1
  }, safeOptions);
  const reusableTask = await findReusableCompletedTask(taskRepository, task);
  if (reusableTask) {
    return buildReplayResult({
      task: reusableTask,
      rawThreadPageRepository,
      threadRepository,
      reportRepository
    });
  }

  await taskRepository.saveTask(task);

  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const rawPage = await rawThreadPageRepository.findRawThreadPageByHash({
      sourceKey: safeOptions.sourceKey,
      contentSha1: safeOptions.contentSha1
    });
    if (!rawPage) {
      throw new Error('Raw thread page not found: ' + safeOptions.sourceKey + '/' + safeOptions.contentSha1);
    }

    const threadSnapshot = adapter.parseSavedHtml(rawPage.contentText, {
      url: rawPage.sourceUrl,
      sourceThreadId: rawPage.sourceThreadId,
      rawPageHash: rawPage.contentSha1
    });
    const report = analyzeThreadHistory(threadSnapshot);

    await threadRepository.saveSnapshot(threadSnapshot);
    await reportRepository.saveReport(report);

    task = markTaskCompleted(task, {
      sourceKey: threadSnapshot.sourceKey,
      sourceThreadId: threadSnapshot.sourceThreadId,
      title: threadSnapshot.title,
      postCount: threadSnapshot.posts.length,
      rawPageHash: rawPage.contentSha1,
      reportType: report.reportType
    });
    await taskRepository.saveTask(task);

    return {
      task,
      rawPage,
      threadSnapshot,
      report
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

async function buildReplayResult(options) {
  const task = options.task;
  const input = task.input || {};
  const output = task.output || {};
  const rawPage = input.sourceKey && input.contentSha1
    ? await options.rawThreadPageRepository.findRawThreadPageByHash({
      sourceKey: input.sourceKey,
      contentSha1: input.contentSha1
    })
    : undefined;
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
    rawPage,
    threadSnapshot,
    report: reports[0],
    idempotency: buildIdempotentReplay(task)
  };
}

module.exports = {
  runIngestRawThreadPageTask
};
