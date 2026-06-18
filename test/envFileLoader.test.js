'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadEnvFile, parseEnvFile } = require('../src/runtime/envFileLoader');

test('env file parser supports comments and quoted values', function () {
  const values = parseEnvFile([
    '# comment',
    'THREADTRACE_STORE_DIR=data/store',
    'THREADTRACE_LLM_MODEL="model-a"',
    "THREADTRACE_DEFAULT_FORUM='nga'",
    'THREADTRACE_HTTP_PORT=3017 # local port',
    'not valid',
    '1_INVALID=nope'
  ].join('\n'));

  assert.deepEqual(values, {
    THREADTRACE_STORE_DIR: 'data/store',
    THREADTRACE_LLM_MODEL: 'model-a',
    THREADTRACE_DEFAULT_FORUM: 'nga',
    THREADTRACE_HTTP_PORT: '3017'
  });
});

test('env file loader does not override existing env by default', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-env-loader-'));
  await fs.writeFile(path.join(tempDir, '.env'), [
    'THREADTRACE_STORE_DIR=from-file',
    'THREADTRACE_SOURCE_TASK_MODE=insight-pipeline'
  ].join('\n'), 'utf8');
  const env = {
    THREADTRACE_STORE_DIR: 'from-process'
  };

  const result = loadEnvFile({
    cwd: tempDir,
    env
  });

  assert.equal(result.loaded, true);
  assert.equal(env.THREADTRACE_STORE_DIR, 'from-process');
  assert.equal(env.THREADTRACE_SOURCE_TASK_MODE, 'insight-pipeline');
});

test('env file loader can override existing env explicitly', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-env-loader-override-'));
  await fs.writeFile(path.join(tempDir, '.env'), 'THREADTRACE_STORE_DIR=from-file\n', 'utf8');
  const env = {
    THREADTRACE_STORE_DIR: 'from-process'
  };

  loadEnvFile({
    cwd: tempDir,
    env,
    override: true
  });

  assert.equal(env.THREADTRACE_STORE_DIR, 'from-file');
});
