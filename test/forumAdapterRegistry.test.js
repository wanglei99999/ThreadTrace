'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createThreadSnapshot } = require('../src/domain/models/threadSnapshot');
const { createForumAdapterRegistry, getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('forum adapter registry supports custom adapters without changing runtime', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-custom-forum-'));
  const inputDir = path.join(tempDir, 'input');
  await fs.mkdir(inputDir, { recursive: true });
  await fs.writeFile(path.join(inputDir, 'custom.html'), '<html>custom forum export</html>', 'utf8');

  const customAdapter = {
    sourceKey: 'custom',
    displayName: 'Custom Forum',
    parseSavedHtml(html, context) {
      assert.match(html, /custom forum export/);
      return createThreadSnapshot({
        forum: {
          sourceKey: 'custom',
          displayName: 'Custom Forum'
        },
        sourceKey: 'custom',
        sourceThreadId: 'custom-thread-1',
        title: 'Custom imported thread',
        url: context && context.url,
        posts: [
          {
            sourceKey: 'custom',
            sourcePostId: 'custom-post-1',
            floor: 0,
            author: {
              sourceKey: 'custom',
              sourceAuthorId: 'author-1',
              displayName: 'Custom Author'
            },
            publishedAt: '2026-06-19T10:00:00.000Z',
            contentText: 'This custom forum adapter returns a canonical ThreadSnapshot.',
            links: [],
            relations: []
          }
        ],
        metadata: {
          sourceFile: context && context.inputPath
        }
      });
    }
  };
  const forumAdapterRegistry = createForumAdapterRegistry([
    getForumAdapter('nga'),
    customAdapter
  ]);
  const runtime = createThreadTraceRuntime({
    defaultForum: 'custom',
    defaultInputDir: inputDir,
    storeDir: path.join(tempDir, 'store'),
    forumAdapterRegistry
  });

  const analysis = runtime.analyzeDirectory({});
  const registered = await runtime.registerSource({
    sourceKey: 'custom',
    sourceType: 'saved-html-directory',
    displayName: 'Custom archive',
    inputDir
  });
  const ingest = await runtime.runSourceIngestTask({
    sourceId: registered.source.id
  });

  assert.equal(runtime.listAdapters().some(function (adapter) {
    return adapter.sourceKey === 'custom';
  }), true);
  assert.equal(analysis.threadSnapshot.sourceKey, 'custom');
  assert.equal(analysis.report.thread.sourceThreadId, 'custom-thread-1');
  assert.equal(ingest.threadSnapshot.sourceKey, 'custom');
  assert.equal(ingest.cursor.sourceThreadId, 'custom-thread-1');
});
