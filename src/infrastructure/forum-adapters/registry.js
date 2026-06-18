'use strict';

const ngaSavedHtmlAdapter = require('./nga/ngaSavedHtmlAdapter');
const { assertForumAdapter } = require('./forumAdapter');

const adapters = new Map([
  [ngaSavedHtmlAdapter.sourceKey, assertForumAdapter(ngaSavedHtmlAdapter)]
]);

function getForumAdapter(sourceKey) {
  const adapter = adapters.get(sourceKey);
  if (!adapter) {
    throw new Error('Unknown forum adapter: ' + sourceKey);
  }
  return adapter;
}

function listForumAdapters() {
  return Array.from(adapters.values()).map(function (adapter) {
    return {
      sourceKey: adapter.sourceKey,
      displayName: adapter.displayName || adapter.sourceKey
    };
  });
}

module.exports = {
  getForumAdapter,
  listForumAdapters
};
