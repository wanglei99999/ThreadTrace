'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getThreadSnapshotJsonContract,
  validateThreadSnapshotPayload
} = require('../src/domain/contracts/threadSnapshotJsonContract');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('thread snapshot json contract exposes required normalized source fields', function () {
  const contract = getThreadSnapshotJsonContract();
  const runtime = createThreadTraceRuntime({});
  const runtimeContract = runtime.getThreadSnapshotJsonContract();

  assert.equal(contract.version, '1.0.0');
  assert.deepEqual(contract.schema.required, ['sourceKey', 'sourceThreadId', 'title', 'posts']);
  assert.deepEqual(contract.schema.properties.posts.items.required, ['sourceKey', 'sourcePostId', 'floor', 'author', 'contentText']);
  assert.equal(contract.example.sourceKey, 'external');
  assert.equal(runtimeContract.name, contract.name);
});

test('thread snapshot json contract validator reports post field failures', function () {
  const validation = validateThreadSnapshotPayload({
    sourceKey: 'external',
    sourceThreadId: 'thread-1',
    title: 'Broken thread',
    posts: [
      {
        sourceKey: 'external',
        floor: '0',
        author: {},
        contentText: 123
      }
    ]
  });
  const failedKeys = validation.checks.filter(function (check) {
    return check.status === 'fail';
  }).map(function (check) {
    return check.key;
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.status, 'fail');
  assert.ok(failedKeys.includes('threadJson.posts[0].sourcePostId'));
  assert.ok(failedKeys.includes('threadJson.posts[0].floor'));
  assert.ok(failedKeys.includes('threadJson.posts[0].author.sourceAuthorId'));
  assert.ok(failedKeys.includes('threadJson.posts[0].contentText'));
});
