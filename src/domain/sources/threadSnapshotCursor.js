'use strict';

const crypto = require('crypto');

function buildThreadSnapshotCursor(threadSnapshot) {
  const posts = Array.isArray(threadSnapshot.posts) ? threadSnapshot.posts : [];
  const lastPost = posts.reduce(function (current, post) {
    if (!current) return post;
    const currentFloor = typeof current.floor === 'number' ? current.floor : -1;
    const postFloor = typeof post.floor === 'number' ? post.floor : -1;
    return postFloor >= currentFloor ? post : current;
  }, undefined);

  return {
    sourceKey: threadSnapshot.sourceKey,
    sourceThreadId: threadSnapshot.sourceThreadId,
    title: threadSnapshot.title,
    postCount: posts.length,
    lastFloor: lastPost ? lastPost.floor : undefined,
    lastPostId: lastPost ? lastPost.sourcePostId : undefined,
    lastPublishedAt: lastPost ? lastPost.publishedAt : undefined,
    fingerprint: buildFingerprint(threadSnapshot, posts, lastPost),
    capturedAt: new Date().toISOString()
  };
}

function compareThreadSnapshotCursor(previousCursor, nextCursor) {
  const previous = previousCursor || {};
  const next = nextCursor || {};
  const previousPostCount = Number(previous.postCount || 0);
  const nextPostCount = Number(next.postCount || 0);
  const newPostCount = Math.max(0, nextPostCount - previousPostCount);

  return {
    changed: !previous.fingerprint || previous.fingerprint !== next.fingerprint,
    newPostCount,
    previousPostCount,
    nextPostCount,
    previousLastPostId: previous.lastPostId,
    nextLastPostId: next.lastPostId,
    previousLastFloor: previous.lastFloor,
    nextLastFloor: next.lastFloor
  };
}

function buildFingerprint(threadSnapshot, posts, lastPost) {
  const hash = crypto.createHash('sha1');
  hash.update(String(threadSnapshot.sourceKey || ''));
  hash.update('|');
  hash.update(String(threadSnapshot.sourceThreadId || ''));
  hash.update('|');
  hash.update(String(posts.length));
  hash.update('|');
  hash.update(String(lastPost && lastPost.sourcePostId || ''));
  hash.update('|');
  hash.update(String(lastPost && lastPost.floor || ''));
  hash.update('|');
  hash.update(String(lastPost && lastPost.publishedAt || ''));
  hash.update('|');
  hash.update(String(lastPost && lastPost.contentText || '').slice(0, 500));
  return hash.digest('hex');
}

module.exports = {
  buildThreadSnapshotCursor,
  compareThreadSnapshotCursor
};
