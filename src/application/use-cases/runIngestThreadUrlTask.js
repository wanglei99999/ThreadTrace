'use strict';

const { analyzeThreadHistory } = require('../../domain/analysis/basicHistoricalAnalyzer');
const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { mergeThreadSnapshots } = require('../../domain/models/threadSnapshotMerger');
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
  const pages = resolvePageWindow(safeOptions, source);

  if (!url) {
    throw new Error('runIngestThreadUrlTask requires url or source.location.url.');
  }

  let task = createTaskRecord('ingest-thread-url', {
    forum: safeOptions.forum || source.sourceKey || adapter.sourceKey,
    sourceId: source.id,
    url,
    pagination: {
      startPage: pages[0],
      pageCount: pages.length,
      pages
    }
  }, safeOptions);
  await taskRepository.saveTask(task);

  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const pageResults = [];
    const snapshots = [];
    for (const page of pages) {
      const fetchResult = await fetchAndStoreThreadPage({
        crawler: safeOptions.crawler,
        rawThreadPageRepository: safeOptions.rawThreadPageRepository,
        source,
        sourceKey: safeOptions.forum || source.sourceKey || adapter.sourceKey,
        sourceThreadId: safeOptions.sourceThreadId,
        url,
        page,
        session: safeOptions.session,
        headers: safeOptions.headers
      });
      const snapshot = adapter.parseSavedHtml(fetchResult.rawPage.contentText, {
        url: fetchResult.rawPage.sourceUrl,
        sourceThreadId: safeOptions.sourceThreadId,
        rawPageHash: fetchResult.rawPage.contentSha1,
        page
      });
      pageResults.push(fetchResult);
      snapshots.push(snapshot);
    }
    const threadSnapshot = snapshots.length === 1
      ? attachRawPageEvidence(snapshots[0], pageResults)
      : attachRawPageEvidence(mergeThreadSnapshots(snapshots), pageResults);
    const report = analyzeThreadHistory(threadSnapshot);

    await threadRepository.saveSnapshot(threadSnapshot);
    await reportRepository.saveReport(report);

    task = markTaskCompleted(task, {
      sourceKey: threadSnapshot.sourceKey,
      sourceThreadId: threadSnapshot.sourceThreadId,
      title: threadSnapshot.title,
      postCount: threadSnapshot.posts.length,
      rawPageHash: pageResults[0] && pageResults[0].rawPage.contentSha1,
      rawPageHashes: pageResults.map(function (item) { return item.rawPage.contentSha1; }),
      rawPages: pageResults.map(summarizeRawPageResult),
      duplicateRawPage: pageResults.every(function (item) { return item.duplicate; }),
      pagination: {
        startPage: pages[0],
        pageCount: pages.length,
        pages
      }
    });
    await taskRepository.saveTask(task);

    return {
      task,
      rawPage: pageResults[0] && pageResults[0].rawPage,
      rawPages: pageResults.map(function (item) { return item.rawPage; }),
      duplicateRawPage: pageResults.every(function (item) { return item.duplicate; }),
      threadSnapshot,
      report
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

function resolvePageWindow(options, source) {
  const location = source && source.location || {};
  if (options.page !== undefined) return [toPositiveInteger(options.page, 1)];
  const startPage = toPositiveInteger(options.startPage || location.startPage || location.pageStart, 1);
  const pageCount = toPositiveInteger(options.pageCount || location.pageCount || location.maxPages, 1);
  return Array.from({ length: pageCount }, function (_, index) {
    return startPage + index;
  });
}

function toPositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.floor(number);
}

function summarizeRawPageResult(result) {
  const rawPage = result.rawPage || {};
  return {
    sourceKey: rawPage.sourceKey,
    sourceThreadId: rawPage.sourceThreadId,
    sourceUrl: rawPage.sourceUrl,
    pageNumber: rawPage.pageNumber,
    contentSha1: rawPage.contentSha1,
    fetchedAt: rawPage.fetchedAt,
    duplicate: result.duplicate
  };
}

function attachRawPageEvidence(threadSnapshot, pageResults) {
  const rawPages = pageResults.map(summarizeRawPageResult);
  return Object.assign({}, threadSnapshot, {
    metadata: Object.assign({}, threadSnapshot.metadata || {}, {
      rawPages,
      rawPageHashes: rawPages.map(function (page) { return page.contentSha1; }),
      sourceUrls: rawPages.map(function (page) { return page.sourceUrl; }).filter(Boolean),
      pageNumbers: rawPages.map(function (page) { return page.pageNumber; }).filter(function (pageNumber) {
        return pageNumber !== undefined;
      })
    })
  });
}

module.exports = {
  runIngestThreadUrlTask
};
