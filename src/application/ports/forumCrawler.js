'use strict';

/**
 * Forum crawler port. Online fetching is intentionally outside the adapter that
 * parses saved HTML, because login/session/rate-limit behavior varies by source.
 *
 * @typedef {Object} ForumCrawler
 * @property {(request: { url: string, page?: number, session?: Object }) => Promise<{ html: string, finalUrl?: string, metadata?: Object }>} fetchThreadPage
 */

function assertForumCrawler(crawler) {
  if (!crawler || typeof crawler.fetchThreadPage !== 'function') {
    throw new Error('ForumCrawler must implement fetchThreadPage(request).');
  }
  return crawler;
}

module.exports = {
  assertForumCrawler
};
