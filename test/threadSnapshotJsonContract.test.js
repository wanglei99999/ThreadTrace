'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getThreadSnapshotJsonContract } = require('../src/domain/contracts/threadSnapshotJsonContract');
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
