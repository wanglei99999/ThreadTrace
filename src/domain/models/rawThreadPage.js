'use strict';

const crypto = require('crypto');

function createRawThreadPage(input) {
  const safeInput = input || {};
  const contentText = safeInput.contentText || safeInput.html || '';
  const contentSha1 = safeInput.contentSha1 || sha1(contentText);
  return {
    id: safeInput.id,
    sourceKey: safeInput.sourceKey || 'unknown',
    sourceThreadId: safeInput.sourceThreadId,
    sourceUrl: safeInput.sourceUrl || safeInput.url,
    pageNumber: safeInput.pageNumber || safeInput.page,
    contentEncoding: safeInput.contentEncoding,
    contentSha1,
    contentText,
    fetchedAt: safeInput.fetchedAt || new Date().toISOString(),
    metadata: safeInput.metadata || {}
  };
}

function sha1(text) {
  return crypto.createHash('sha1').update(String(text || '')).digest('hex');
}

module.exports = {
  createRawThreadPage,
  sha1
};
