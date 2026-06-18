'use strict';

const { readThreadSnapshotJson } = require('./runIngestNormalizedThreadJsonTask');

async function validateNormalizedThreadJsonFile(options) {
  const safeOptions = options || {};
  const inputFile = safeOptions.inputFile;
  if (!inputFile) {
    return validationResult({
      now: safeOptions.now,
      valid: false,
      status: 'fail',
      checks: [
        check('threadJson.inputFile', 'fail', 'missing', 'Input file is configured.')
      ],
      error: {
        code: 'thread_json_input_file_required',
        message: 'Normalized thread JSON validation requires inputFile.'
      }
    });
  }

  try {
    const threadSnapshot = await readThreadSnapshotJson(inputFile, {
      sourceKey: safeOptions.sourceKey || safeOptions.forum
    });
    const checks = buildChecks(threadSnapshot);
    return validationResult({
      now: safeOptions.now,
      valid: checks.every(function (item) { return item.status !== 'fail'; }),
      status: aggregateStatus(checks),
      thread: {
        sourceKey: threadSnapshot.sourceKey,
        sourceThreadId: threadSnapshot.sourceThreadId,
        title: threadSnapshot.title,
        postCount: threadSnapshot.posts.length
      },
      checks
    });
  } catch (error) {
    return validationResult({
      now: safeOptions.now,
      valid: false,
      status: 'fail',
      checks: [
        check('threadJson.parse', 'fail', error && error.message ? error.message : String(error), 'Input file can be parsed as a normalized ThreadSnapshot.')
      ],
      error: {
        code: 'thread_json_invalid',
        message: error && error.message ? error.message : String(error)
      }
    });
  }
}

function buildChecks(threadSnapshot) {
  return [
    check('threadJson.sourceKey', threadSnapshot.sourceKey ? 'ok' : 'fail', threadSnapshot.sourceKey || 'missing', 'Snapshot has a source key.'),
    check('threadJson.sourceThreadId', threadSnapshot.sourceThreadId ? 'ok' : 'fail', threadSnapshot.sourceThreadId || 'missing', 'Snapshot has a source thread id.'),
    check('threadJson.posts', Array.isArray(threadSnapshot.posts) ? 'ok' : 'fail', threadSnapshot.posts.length, 'Snapshot has a posts array.')
  ];
}

function validationResult(options) {
  const safeOptions = options || {};
  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    valid: safeOptions.valid === true,
    status: safeOptions.status || 'fail',
    thread: safeOptions.thread,
    checks: safeOptions.checks || [],
    error: safeOptions.error
  };
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  validateNormalizedThreadJsonFile
};
