'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getOperationalReadiness } = require('../src/application/use-cases/getOperationalReadiness');

test('operational readiness aggregates warning and failure checks', async function () {
  const readiness = await getOperationalReadiness({
    overview: {
      generatedAt: '2026-06-18T10:00:00.000Z',
      sources: { failed: 1 },
      tasks: { failed: 0 },
      events: { failed: 2 },
      workers: {
        stale: 1,
        failed: 0,
        leases: {
          expired: 1
        }
      }
    }
  });

  assert.equal(readiness.status, 'fail');
  assert.equal(readiness.checks.find(function (item) {
    return item.key === 'workers.stale';
  }).status, 'fail');
  assert.equal(readiness.checks.find(function (item) {
    return item.key === 'events.failed';
  }).status, 'warn');
});

test('operational readiness reports ok when overview has no signals', async function () {
  const readiness = await getOperationalReadiness({
    overview: {
      generatedAt: '2026-06-18T10:00:00.000Z',
      sources: { failed: 0 },
      tasks: { failed: 0 },
      events: { failed: 0 },
      workers: {
        stale: 0,
        failed: 0,
        leases: {
          expired: 0
        }
      }
    }
  });

  assert.equal(readiness.status, 'ok');
  assert.equal(readiness.checks.every(function (item) {
    return item.status === 'ok';
  }), true);
});

test('operational readiness includes runtime diagnostic checks', async function () {
  const readiness = await getOperationalReadiness({
    overview: {
      generatedAt: '2026-06-18T10:00:00.000Z',
      sources: { failed: 0 },
      tasks: { failed: 0 },
      events: { failed: 0 },
      workers: {
        stale: 0,
        failed: 0,
        leases: {
          expired: 0
        }
      }
    },
    diagnostics: {
      status: 'warn',
      checks: [
        {
          key: 'config.llm.apiKey',
          status: 'warn',
          value: 0,
          summary: 'Remote LLM provider has an API key configured.'
        }
      ]
    }
  });

  assert.equal(readiness.status, 'warn');
  assert.equal(readiness.diagnostics.status, 'warn');
  assert.equal(readiness.checks.find(function (item) {
    return item.key === 'config.llm.apiKey';
  }).status, 'warn');
});
