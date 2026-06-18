'use strict';

const { validateThreadSnapshotPayload } = require('../../domain/contracts/threadSnapshotJsonContract');
const { readThreadSnapshotPayload } = require('./runIngestNormalizedThreadJsonTask');

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
    const payload = await readThreadSnapshotPayload(inputFile);
    const validation = validateThreadSnapshotPayload(payload, {
      sourceKey: safeOptions.sourceKey || safeOptions.forum
    });
    const sourceKey = payload.sourceKey || (payload.forum && payload.forum.sourceKey) || safeOptions.sourceKey || safeOptions.forum;
    return validationResult({
      now: safeOptions.now,
      valid: validation.valid,
      status: validation.status,
      thread: {
        sourceKey,
        sourceThreadId: payload.sourceThreadId,
        title: payload.title,
        postCount: Array.isArray(payload.posts) ? payload.posts.length : 0
      },
      checks: validation.checks,
      error: validation.valid ? undefined : {
        code: 'thread_json_contract_invalid',
        message: 'Normalized thread JSON does not satisfy the ThreadSnapshot contract.'
      }
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

module.exports = {
  validateNormalizedThreadJsonFile
};
