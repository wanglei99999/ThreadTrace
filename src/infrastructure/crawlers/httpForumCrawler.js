'use strict';

const { assertForumCrawler } = require('../../application/ports/forumCrawler');

function createHttpForumCrawler(options) {
  const safeOptions = options || {};
  const fetchImpl = safeOptions.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('HttpForumCrawler requires fetch. Use Node.js 20+ or pass fetch.');
  }

  const crawler = {
    async fetchThreadPage(request) {
      const safeRequest = request || {};
      if (!safeRequest.url) {
        throw new Error('fetchThreadPage requires url.');
      }
      const response = await fetchImpl(safeRequest.url, {
        method: 'GET',
        headers: Object.assign({
          'user-agent': safeOptions.userAgent || 'ThreadTrace/0.1'
        }, safeOptions.headers || {}, safeRequest.headers || {})
      });

      if (!response.ok) {
        throw new Error('Thread page fetch failed with HTTP ' + response.status + ' for ' + safeRequest.url);
      }

      const html = await response.text();
      return {
        html,
        finalUrl: response.url || safeRequest.url,
        contentEncoding: response.headers && response.headers.get ? response.headers.get('content-encoding') || undefined : undefined,
        metadata: {
          status: response.status,
          contentType: response.headers && response.headers.get ? response.headers.get('content-type') || undefined : undefined
        }
      };
    }
  };

  return assertForumCrawler(crawler);
}

module.exports = {
  createHttpForumCrawler
};
