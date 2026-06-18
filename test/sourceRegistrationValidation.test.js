'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { validateTrackedSourceRegistration } = require('../src/application/use-cases/validateTrackedSourceRegistration');
const { createDefaultSourceIngestHandlerRegistry } = require('../src/application/source-ingest/standardSourceIngestHandlers');

test('source registration validation reports a ready source draft', function () {
  const result = validateTrackedSourceRegistration({
    now: '2026-06-19T10:00:00.000Z',
    sourceIngestHandlerRegistry: createDefaultSourceIngestHandlerRegistry(),
    getAdapter(sourceKey) {
      if (sourceKey === 'nga') return { sourceKey: 'nga' };
      return undefined;
    },
    source: {
      forum: 'nga',
      sourceType: 'saved-html-directory',
      displayName: 'NGA archive',
      inputDir: 'example'
    }
  });

  assert.equal(result.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(result.valid, true);
  assert.equal(result.status, 'ok');
  assert.equal(result.source.sourceKey, 'nga');
  assert.equal(result.source.sourceType, 'saved-html-directory');
  assert.equal(result.checks.find(function (check) {
    return check.key === 'source.handler';
  }).status, 'ok');
  assert.equal(result.checks.find(function (check) {
    return check.key === 'source.adapter';
  }).status, 'ok');
});

test('source registration validation reports invalid source drafts without throwing', function () {
  const missingLocation = validateTrackedSourceRegistration({
    sourceIngestHandlerRegistry: createDefaultSourceIngestHandlerRegistry(),
    source: {
      forum: 'nga',
      sourceType: 'saved-html-directory'
    }
  });
  const unknownType = validateTrackedSourceRegistration({
    sourceIngestHandlerRegistry: createDefaultSourceIngestHandlerRegistry(),
    source: {
      forum: 'custom',
      sourceType: 'external-feed',
      location: {
        endpoint: 'https://example.test/feed'
      }
    }
  });
  const stagedUnknownType = validateTrackedSourceRegistration({
    sourceIngestHandlerRegistry: createDefaultSourceIngestHandlerRegistry(),
    allowUnknownSourceType: true,
    source: {
      forum: 'custom',
      sourceType: 'external-feed',
      location: {
        endpoint: 'https://example.test/feed'
      }
    }
  });

  assert.equal(missingLocation.valid, false);
  assert.equal(missingLocation.status, 'fail');
  assert.equal(missingLocation.error.code, 'source_location_invalid');
  assert.equal(missingLocation.checks[0].key, 'source.location');
  assert.equal(unknownType.valid, false);
  assert.equal(unknownType.error.code, 'source_type_unregistered');
  assert.equal(unknownType.error.details.sourceType, 'external-feed');
  assert.equal(stagedUnknownType.valid, true);
  assert.equal(stagedUnknownType.status, 'fail');
  assert.equal(stagedUnknownType.checks.find(function (check) {
    return check.key === 'source.handler';
  }).status, 'fail');
});

test('source registration validation supports normalized thread json sources', function () {
  const ready = validateTrackedSourceRegistration({
    sourceIngestHandlerRegistry: createDefaultSourceIngestHandlerRegistry(),
    source: {
      forum: 'external',
      sourceType: 'normalized-thread-json',
      displayName: 'External normalized feed',
      inputFile: 'D:/feeds/threadtrace/thread.json'
    }
  });
  const missingInputFile = validateTrackedSourceRegistration({
    sourceIngestHandlerRegistry: createDefaultSourceIngestHandlerRegistry(),
    source: {
      forum: 'external',
      sourceType: 'normalized-thread-json',
      location: {
        inputDir: 'D:/feeds/threadtrace'
      }
    }
  });

  assert.equal(ready.valid, true);
  assert.equal(ready.status, 'ok');
  assert.equal(ready.source.location.inputFile, 'D:/feeds/threadtrace/thread.json');
  assert.equal(ready.checks.some(function (check) {
    return check.key === 'source.adapter';
  }), false);
  assert.equal(missingInputFile.valid, false);
  assert.equal(missingInputFile.error.code, 'source_location_invalid');
  assert.deepEqual(missingInputFile.error.details.missingFields, ['inputFile']);
});
