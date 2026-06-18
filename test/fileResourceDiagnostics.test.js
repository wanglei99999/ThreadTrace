'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { inspectFileResources } = require('../src/infrastructure/diagnostics/fileResourceDiagnostics');

test('file resource diagnostics checks input and writable store directories', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-file-diagnostics-'));
  const inputDir = path.join(tempDir, 'input');
  const storeDir = path.join(tempDir, 'store');
  await fs.mkdir(inputDir);

  const diagnostics = await inspectFileResources({
    inputDir,
    storeDir
  });

  assert.equal(diagnostics.storageMode, 'file');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.inputDir';
  }).status, 'ok');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.storeDir';
  }).status, 'ok');
});

test('file resource diagnostics fails missing input directory', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-file-diagnostics-missing-'));
  const diagnostics = await inspectFileResources({
    inputDir: path.join(tempDir, 'missing'),
    storeDir: path.join(tempDir, 'store')
  });

  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.inputDir';
  }).status, 'fail');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.storeDir';
  }).status, 'ok');
});
