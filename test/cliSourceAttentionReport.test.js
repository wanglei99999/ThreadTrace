'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

test('CLI prints source attention report for an empty store', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-cli-source-attention-'));
  const scriptPath = path.resolve(__dirname, '..', 'src', 'presentation', 'cli', 'threadtrace.js');

  const result = await execFileAsync(process.execPath, [
    scriptPath,
    'source-attention-report',
    '--store-dir',
    tempDir,
    '--now',
    '2026-06-25T10:00:00.000Z'
  ], {
    cwd: path.resolve(__dirname, '..'),
    timeout: 20000
  });

  assert.match(result.stdout, /Source attention: ok/);
  assert.match(result.stdout, /Sources: total=0/);
  assert.match(result.stdout, /Signals: none/);
  assert.equal(result.stderr, '');
});
