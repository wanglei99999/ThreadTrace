'use strict';

const fs = require('fs/promises');
const path = require('path');

async function inspectFileResources(options) {
  const safeOptions = options || {};
  const inputDir = safeOptions.inputDir;
  const storeDir = safeOptions.storeDir;
  const checks = [];

  checks.push(await inspectReadableDirectory('resources.inputDir', inputDir, 'Default input directory is readable.'));
  checks.push(await inspectWritableDirectory('resources.storeDir', storeDir, 'Store directory is writable.'));

  return {
    storageMode: 'file',
    inputDir,
    storeDir,
    checks
  };
}

async function inspectReadableDirectory(key, dir, summary) {
  if (!dir) {
    return check(key, 'fail', 'missing', summary);
  }
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      return check(key, 'fail', dir, summary + ' Path is not a directory.');
    }
    await fs.access(dir);
    return check(key, 'ok', dir, summary);
  } catch (error) {
    return check(key, 'fail', dir, summary + ' ' + error.message);
  }
}

async function inspectWritableDirectory(key, dir, summary) {
  if (!dir) {
    return check(key, 'fail', 'missing', summary);
  }
  const probePath = path.join(dir, '.threadtrace-write-probe');
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(probePath, 'ok\n', 'utf8');
    await fs.unlink(probePath);
    return check(key, 'ok', dir, summary);
  } catch (error) {
    try {
      await fs.unlink(probePath);
    } catch (_) {
      // Best-effort cleanup after a partially successful probe.
    }
    return check(key, 'fail', dir, summary + ' ' + error.message);
  }
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

module.exports = {
  inspectFileResources
};
