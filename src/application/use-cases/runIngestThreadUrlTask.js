'use strict';

const { analyzeThreadHistory } = require('../../domain/analysis/basicHistoricalAnalyzer');
const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');
const { fetchAndStoreThreadPage } = require('./fetchAndStoreThreadPage');

async function runIngestThreadUrlTask(options) {
  const safeOptions = options || {};
  const adapter = assertForumAdapter(safeOptions.adapter);
  const threadRepository = assertThreadRepository(safeOptions.threadRepository);
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const source = safeOptions.source || {};
  const url = safeOptions.url || (source.location && source.location.url);

  if (!url) {
    throw new Error('runIngestThreadUrlTask requires url or source.location.url.');
  }

  let task = createTaskRecord('ingest-thread-url', {
    forum: safeOptions.forum || source.sourceKey || adapter.sourceKey,
    sourceId: source.id,
    url,
    page: safeOptions.page
  }, safeOptions);
  await taskRepository.saveTask(task);

  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const fetchResult = await fetchAndStoreThreadPage({
      crawler: safeOptions.crawler,
      rawThreadPageRepository: safeOptions.rawThreadPageRepository,
      source,
      sourceKey: safeOptions.forum || source.sourceKey || adapter.sourceKey,
      sourceThreadId: safeOptions.sourceThreadId,
      url,
      page: safeOptions.page,
      session: safeOptions.session,
      headers: safeOptions.headers
    });
    const threadSnapshot = adapter.parseSavedHtml(fetchResult.rawPage.contentText, {
      url: fetchResult.rawPage.sourceUrl,
      sourceThreadId: safeOptions.sourceThreadId,
      rawPageHash: fetchResult.rawPage.contentSha1
    });
    const report = analyzeThreadHistory(threadSnapshot);

    await threadRepository.saveSnapshot(threadSnapshot);
    await reportRepository.saveReport(report);

    task = markTaskCompleted(task, {
      sourceKey: threadSnapshot.sourceKey,
      sourceThreadId: threadSnapshot.sourceThreadId,
      title: threadSnapshot.title,
      postCount: threadSnapshot.posts.length,
      rawPageHash: fetchResult.rawPage.contentSha1,
      duplicateRawPage: fetchResult.duplicate
    });
    await taskRepository.saveTask(task);

    return {
      task,
      rawPage: fetchResult.rawPage,
      duplicateRawPage: fetchResult.duplicate,
      threadSnapshot,
      report
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

module.exports = {
  runIngestThreadUrlTask
};
