'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createFileContextReviewResultRepository } = require('../src/infrastructure/storage/fileContextReviewResultRepository');

test('file context review result repository saves, finds, and filters records', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-review-results-'));
  const repository = createFileContextReviewResultRepository({
    baseDir: tempDir
  });
  const first = {
    id: 'result-1',
    status: 'partially-accepted',
    handoffId: 'handoff-1',
    reviewer: { id: 'operator-1' },
    submittedAt: '2026-06-21T10:00:00.000Z'
  };
  const second = {
    id: 'result-2',
    status: 'accepted',
    handoffId: 'handoff-2',
    reviewer: { id: 'operator-2' },
    submittedAt: '2026-06-21T11:00:00.000Z'
  };

  await repository.saveReviewResult(first);
  await repository.saveReviewResult(second);

  const found = await repository.findReviewResult('result-1');
  const byStatus = await repository.listReviewResults({ status: 'accepted' });
  const byReviewer = await repository.listReviewResults({ reviewerId: 'operator-1' });
  const all = await repository.listReviewResults();

  assert.equal(found.id, 'result-1');
  assert.equal(byStatus.length, 1);
  assert.equal(byStatus[0].id, 'result-2');
  assert.equal(byReviewer.length, 1);
  assert.equal(byReviewer[0].id, 'result-1');
  assert.deepEqual(all.map(function (record) { return record.id; }), ['result-2', 'result-1']);
});
