'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildWorkerLeaseKey, parseWorkerLeaseKey, normalizeLeaseSegment } = require('../src/domain/models/workerLeaseKey');

test('worker lease key defaults to global worker type scope', function () {
  assert.equal(buildWorkerLeaseKey('operations'), 'worker:operations');
  assert.equal(buildWorkerLeaseKey('due-source', {}), 'worker:due-source');
});

test('worker lease key prefers source id over source key', function () {
  assert.equal(buildWorkerLeaseKey('due-source', {
    sourceId: 'source-a',
    sourceKey: 'forum-a'
  }), 'worker:due-source:source-id:source-a');
});

test('worker lease key falls back to source key or forum', function () {
  assert.equal(buildWorkerLeaseKey('notification-event', {
    sourceKey: 'forum-a'
  }), 'worker:notification-event:source-key:forum-a');
  assert.equal(buildWorkerLeaseKey('operations', {
    forum: 'forum-b'
  }), 'worker:operations:source-key:forum-b');
});

test('worker lease key normalizes unsafe segments', function () {
  assert.equal(normalizeLeaseSegment(' source/a 1 '), 'source-a-1');
  assert.equal(buildWorkerLeaseKey('due source', {
    sourceId: 'tenant/source a'
  }), 'worker:due-source:source-id:tenant-source-a');
});

test('worker lease key parser extracts source scope', function () {
  assert.deepEqual(parseWorkerLeaseKey('worker:operations'), {
    leaseKey: 'worker:operations',
    workerType: 'operations',
    scope: {},
    scoped: false
  });
  assert.deepEqual(parseWorkerLeaseKey('worker:due-source:source-id:source-a'), {
    leaseKey: 'worker:due-source:source-id:source-a',
    workerType: 'due-source',
    scope: {
      sourceId: 'source-a'
    },
    scoped: true
  });
  assert.deepEqual(parseWorkerLeaseKey('worker:notification-event:source-key:forum-a'), {
    leaseKey: 'worker:notification-event:source-key:forum-a',
    workerType: 'notification-event',
    scope: {
      sourceKey: 'forum-a'
    },
    scoped: true
  });
});
