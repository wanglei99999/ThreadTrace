'use strict';

/**
 * Forum adapters are infrastructure concerns. They convert a concrete forum's
 * page shape into ThreadTrace's canonical domain model.
 *
 * @typedef {Object} ForumAdapter
 * @property {string} sourceKey
 * @property {(html: string, context?: Object<string, unknown>) => import('../../domain/models/threadSnapshot').ThreadSnapshot} parseSavedHtml
 */

function assertForumAdapter(adapter) {
  if (!adapter || typeof adapter.sourceKey !== 'string') {
    throw new Error('ForumAdapter must expose a sourceKey.');
  }
  if (typeof adapter.parseSavedHtml !== 'function') {
    throw new Error('ForumAdapter must implement parseSavedHtml(html, context).');
  }
  return adapter;
}

module.exports = {
  assertForumAdapter
};
