'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildRequest, parseArgs } = require('../src/presentation/worker/operationsWorkerMain');

test('operations worker main request scopes event dispatch runbook synthesis and overview by source', function () {
  const options = parseArgs([
    '--once',
    '--forum', 'forum-a',
    '--source-key', 'forum-a',
    '--source-id', 'source-a',
    '--runbook-events', 'true',
    '--source-attention-events', 'true',
    '--source-type-operations-events', 'true',
    '--source-type', 'thread-url',
    '--priority-score-threshold', '80',
    '--attention-limit', '12',
    '--source-type-limit', '7',
    '--include-failed', 'true',
    '--limit', '25'
  ]);
  const request = buildRequest(options, 'data/store', {
    llm: {
      provider: 'mock'
    },
    workers: {
      sourceTaskMode: 'ingest',
      sourceRunStaleAfterMs: 600000,
      sourceFailureRetryBackoffMs: 300000,
      sourceFailureMaxRetryBackoffMs: 3600000
    }
  });

  assert.equal(request.sources.sourceKey, 'forum-a');
  assert.equal(request.sources.sourceId, 'source-a');
  assert.equal(request.events.sourceId, 'source-a');
  assert.equal(request.events.sourceKey, 'forum-a');
  assert.equal(request.runbookEvents.sourceId, 'source-a');
  assert.equal(request.runbookEvents.sourceKey, 'forum-a');
  assert.equal(request.sourceAttentionEvents.sourceId, 'source-a');
  assert.equal(request.sourceAttentionEvents.sourceKey, 'forum-a');
  assert.equal(request.sourceAttentionEvents.execute, false);
  assert.equal(request.sourceAttentionEvents.priorityScoreThreshold, 80);
  assert.equal(request.sourceAttentionEvents.attentionLimit, 12);
  assert.equal(request.sourceTypeOperationsEvents.sourceType, 'thread-url');
  assert.equal(request.sourceTypeOperationsEvents.execute, false);
  assert.equal(request.sourceTypeOperationsEvents.priorityScoreThreshold, 80);
  assert.equal(request.sourceTypeOperationsEvents.attentionLimit, 12);
  assert.equal(request.sourceTypeOperationsEvents.sourceTypeLimit, 7);
  assert.equal(request.overview.sourceId, 'source-a');
  assert.equal(request.overview.sourceKey, 'forum-a');
  assert.equal(request.sourceAttention.sourceId, 'source-a');
  assert.equal(request.sourceAttention.sourceKey, 'forum-a');
  assert.equal(request.sourceAttention.limit, 25);
  assert.equal(request.sourceAttention.sourceRunStaleAfterMs, 600000);
  assert.equal(request.sourceAttention.sourceFailureRetryBackoffMs, 300000);
  assert.equal(request.sourceAttention.sourceFailureMaxRetryBackoffMs, 3600000);
  assert.equal(request.events.includeFailed, true);
  assert.equal(request.events.limit, 25);
});
