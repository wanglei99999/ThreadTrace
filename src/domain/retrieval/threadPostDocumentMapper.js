'use strict';

function mapThreadSnapshotToDocuments(threadSnapshot) {
  return (threadSnapshot.posts || [])
    .filter(function (post) {
      return post.contentText && post.contentText.trim();
    })
    .map(function (post) {
      return {
        id: [
          threadSnapshot.sourceKey,
          threadSnapshot.sourceThreadId,
          post.sourcePostId || post.floor
        ].join(':'),
        text: buildDocumentText(threadSnapshot, post),
        metadata: {
          sourceKey: threadSnapshot.sourceKey,
          sourceThreadId: threadSnapshot.sourceThreadId,
          threadTitle: threadSnapshot.title,
          sourcePostId: post.sourcePostId,
          floor: post.floor,
          author: post.author.displayName,
          authorId: post.author.sourceAuthorId,
          publishedAt: post.publishedAt,
          score: post.score
        }
      };
    });
}

function buildDocumentText(threadSnapshot, post) {
  return [
    threadSnapshot.title,
    post.subject,
    post.author.displayName,
    post.contentText
  ].filter(Boolean).join('\n');
}

module.exports = {
  mapThreadSnapshotToDocuments
};
