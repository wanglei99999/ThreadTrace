'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { dryRunSourceIngest } = require('../src/application/use-cases/dryRunSourceIngest');
const { createSourceIngestHandlerRegistry } = require('../src/application/source-ingest/sourceIngestHandlerRegistry');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime source ingest dry-run previews normalized thread JSON without durable writes', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-dry-run-'));
  const inputFile = path.join(tempDir, 'thread.json');
  await fs.writeFile(inputFile, JSON.stringify({
    sourceKey: 'external',
    sourceThreadId: 'external-thread-dry-run',
    title: 'External dry-run thread',
    posts: [
      {
        sourceKey: 'external',
        sourcePostId: 'post-1',
        floor: 0,
        author: {
          sourceKey: 'external',
          sourceAuthorId: 'author-1',
          displayName: 'External Author'
        },
        publishedAt: '2026-06-19T10:00:00.000Z',
        contentText: 'Dry-run should produce a report without touching durable storage.',
        links: [],
        relations: []
      }
    ]
  }, null, 2) + '\n', 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const preview = await runtime.dryRunSourceIngest({
    sourceKey: 'external',
    sourceType: 'normalized-thread-json',
    inputFile,
    now: '2026-06-19T10:00:00.000Z'
  });
  const reports = await runtime.listAnalysisReports({
    sourceKey: 'external',
    sourceThreadId: 'external-thread-dry-run'
  });

  assert.equal(preview.dryRun, true);
  assert.equal(preview.status, 'ok');
  assert.equal(preview.thread.sourceThreadId, 'external-thread-dry-run');
  assert.equal(preview.thread.postCount, 1);
  assert.equal(preview.report.reportType, 'basic-history');
  assert.equal(preview.repositoryWrites.threadSnapshots, 1);
  assert.equal(preview.repositoryWrites.reports, 1);
  assert.equal(preview.repositoryWrites.tasks, 3);
  assert.equal(reports.length, 0);
});

test('source ingest dry-run blocks remote-fetching handlers by default', async function () {
  const registry = createSourceIngestHandlerRegistry([
    {
      sourceType: 'remote-feed',
      requiresAdapter: false,
      locationSchema: {
        required: ['url'],
        properties: {
          url: { type: 'string' }
        }
      },
      capabilities: {
        fetchesRemote: true
      },
      async run() {
        throw new Error('remote handler should not run');
      }
    }
  ]);
  const preview = await dryRunSourceIngest({
    sourceIngestHandlerRegistry: registry,
    source: {
      sourceKey: 'external',
      sourceType: 'remote-feed',
      location: {
        url: 'https://example.test/feed'
      }
    },
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(preview.status, 'fail');
  assert.equal(preview.checks.find(function (check) {
    return check.key === 'dryRun.remoteFetch';
  }).status, 'fail');
  assert.equal(preview.repositoryWrites.threadSnapshots, 0);
  assert.equal(preview.error, undefined);
});

