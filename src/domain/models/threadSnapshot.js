'use strict';

/**
 * @typedef {Object} ForumSource
 * @property {string} sourceKey
 * @property {string} displayName
 * @property {string=} url
 */

/**
 * @typedef {Object} Author
 * @property {string} sourceKey
 * @property {string} sourceAuthorId
 * @property {string} displayName
 * @property {Object<string, unknown>=} metadata
 */

/**
 * @typedef {Object} Post
 * @property {string} sourceKey
 * @property {string} sourcePostId
 * @property {number} floor
 * @property {string=} subject
 * @property {Author} author
 * @property {string=} publishedAt
 * @property {string} contentText
 * @property {string=} contentHtml
 * @property {Array<{url: string, text: string}>} links
 * @property {Array<{type: string, targetThreadId?: string, targetPostId?: string, targetFloor?: number, evidenceText?: string}>} relations
 * @property {number=} score
 * @property {Object<string, unknown>=} metadata
 */

/**
 * @typedef {Object} ThreadSnapshot
 * @property {ForumSource} forum
 * @property {string} sourceKey
 * @property {string} sourceThreadId
 * @property {string} title
 * @property {string=} url
 * @property {number=} page
 * @property {number=} totalPages
 * @property {Post[]} posts
 * @property {Object<string, unknown>=} metadata
 */

function createThreadSnapshot(snapshot) {
  return {
    forum: snapshot.forum,
    sourceKey: snapshot.sourceKey,
    sourceThreadId: String(snapshot.sourceThreadId || ''),
    title: snapshot.title || '',
    url: snapshot.url,
    page: snapshot.page,
    totalPages: snapshot.totalPages,
    posts: Array.isArray(snapshot.posts) ? snapshot.posts : [],
    metadata: snapshot.metadata || {}
  };
}

module.exports = {
  createThreadSnapshot
};
