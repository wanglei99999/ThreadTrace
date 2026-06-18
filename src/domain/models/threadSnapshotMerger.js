'use strict';

const { createThreadSnapshot } = require('./threadSnapshot');

function mergeThreadSnapshots(snapshots) {
  const nonEmptySnapshots = (snapshots || []).filter(Boolean);
  if (nonEmptySnapshots.length === 0) {
    throw new Error('mergeThreadSnapshots requires at least one snapshot.');
  }

  const base = nonEmptySnapshots[0];
  const postsByIdentity = new Map();

  nonEmptySnapshots.forEach(function (snapshot) {
    (snapshot.posts || []).forEach(function (post) {
      const key = post.sourcePostId && post.sourcePostId !== snapshot.sourceKey + ':' + post.floor
        ? post.sourcePostId
        : 'floor:' + post.floor + ':author:' + ((post.author && post.author.sourceAuthorId) || '');

      if (!postsByIdentity.has(key)) {
        postsByIdentity.set(key, post);
      }
    });
  });

  const posts = Array.from(postsByIdentity.values()).sort(function (a, b) {
    return a.floor - b.floor || String(a.sourcePostId).localeCompare(String(b.sourcePostId));
  });

  return createThreadSnapshot({
    forum: base.forum,
    sourceKey: base.sourceKey,
    sourceThreadId: base.sourceThreadId,
    title: base.title,
    url: base.url,
    page: undefined,
    totalPages: maxNumber(nonEmptySnapshots.map(function (snapshot) {
      return snapshot.totalPages;
    })),
    posts,
    metadata: {
      mergedAt: new Date().toISOString(),
      mergedSnapshotCount: nonEmptySnapshots.length,
      sourceFiles: nonEmptySnapshots
        .map(function (snapshot) {
          return snapshot.metadata && snapshot.metadata.sourceFile;
        })
        .filter(Boolean)
    }
  });
}

function maxNumber(values) {
  const numbers = values.filter(function (value) {
    return typeof value === 'number' && Number.isFinite(value);
  });
  return numbers.length > 0 ? Math.max.apply(null, numbers) : undefined;
}

module.exports = {
  mergeThreadSnapshots
};
