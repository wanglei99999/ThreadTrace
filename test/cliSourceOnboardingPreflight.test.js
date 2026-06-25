'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

test('CLI source onboarding preflight accepts rollout manifests', async function () {
  const root = path.resolve(__dirname, '..');
  const scriptPath = path.join(root, 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-onboarding-preflight',
    '--manifest-file',
    'docs/examples/rss-archive-rollout-manifest.sample.json',
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: root,
    timeout: 20000
  });

  assert.match(result.stdout, /Source onboarding preflight: ok/);
  assert.match(result.stdout, /Source: rss-archive\trss-archive-normalized-feed/);
  assert.match(result.stdout, /ok\tconnectorModule.validation\tExternal connector module can be loaded for this onboarding preflight\./);
  assert.equal(result.stderr, '');
});
