'use strict';

const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { parseSavedThreadDirectory } = require('./parseSavedThreadDirectory');
const { restoreContextForNewPost } = require('../../domain/analysis/contextRestorationAnalyzer');

function interpretNewPostFromSavedThreadDirectory(options) {
  const adapter = assertForumAdapter(options.adapter);
  const threadSnapshot = parseSavedThreadDirectory({
    adapter,
    inputDir: options.inputDir
  });

  return restoreContextForNewPost(threadSnapshot, {
    sourceKey: threadSnapshot.sourceKey,
    authorId: options.authorId,
    author: options.author,
    contentText: options.contentText,
    publishedAt: options.publishedAt
  });
}

module.exports = {
  interpretNewPostFromSavedThreadDirectory
};
