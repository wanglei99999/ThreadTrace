'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildThreadSnapshotCursor,
  compareThreadSnapshotCursor
} = require('../src/domain/sources/threadSnapshotCursor');

test('thread snapshot cursor summarizes last seen post and detects deltas', function () {
  const previous = buildThreadSnapshotCursor({
    sourceKey: 'nga',
    sourceThreadId: '1',
    title: 'sample',
    posts: [
      { floor: 0, sourcePostId: 'a', publishedAt: '2026-01-01', contentText: 'first' }
    ]
  });
  const next = buildThreadSnapshotCursor({
    sourceKey: 'nga',
    sourceThreadId: '1',
    title: 'sample',
    posts: [
      { floor: 0, sourcePostId: 'a', publishedAt: '2026-01-01', contentText: 'first' },
      { floor: 1, sourcePostId: 'b', publishedAt: '2026-01-02', contentText: 'second' }
    ]
  });
  const diff = compareThreadSnapshotCursor(previous, next);

  assert.equal(previous.postCount, 1);
  assert.equal(next.lastFloor, 1);
  assert.equal(next.lastPostId, 'b');
  assert.equal(diff.changed, true);
  assert.equal(diff.newPostCount, 1);
});
