'use strict';

const { createRawThreadPage } = require('../../domain/models/rawThreadPage');
const { assertForumCrawler } = require('../ports/forumCrawler');
const { assertRawThreadPageRepository } = require('../ports/rawThreadPageRepository');

async function fetchAndStoreThreadPage(options) {
  const safeOptions = options || {};
  const crawler = assertForumCrawler(safeOptions.crawler);
  const rawThreadPageRepository = assertRawThreadPageRepository(safeOptions.rawThreadPageRepository);
  const source = safeOptions.source || {};
  const sourceKey = safeOptions.sourceKey || source.sourceKey || 'unknown';
  const url = safeOptions.url || source.url || (source.location && source.location.url);

  if (!url) {
    throw new Error('fetchAndStoreThreadPage requires url or source.location.url.');
  }

  const fetched = await crawler.fetchThreadPage({
    url,
    page: safeOptions.page,
    session: safeOptions.session,
    headers: safeOptions.headers
  });
  const rawPage = createRawThreadPage({
    sourceKey,
    sourceThreadId: safeOptions.sourceThreadId,
    sourceUrl: fetched.finalUrl || url,
    pageNumber: safeOptions.page,
    contentEncoding: fetched.contentEncoding,
    contentText: fetched.html,
    fetchedAt: safeOptions.fetchedAt,
    metadata: Object.assign({}, fetched.metadata || {}, {
      crawler: safeOptions.crawlerKey || 'http',
      requestedUrl: url,
      sourceId: source.id
    })
  });

  const existing = await rawThreadPageRepository.findRawThreadPageByHash({
    sourceKey: rawPage.sourceKey,
    contentSha1: rawPage.contentSha1
  });
  await rawThreadPageRepository.saveRawThreadPage(rawPage);

  return {
    rawPage,
    duplicate: Boolean(existing)
  };
}

module.exports = {
  fetchAndStoreThreadPage
};
