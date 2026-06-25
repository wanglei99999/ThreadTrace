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
      events: { failed: 2, dueForDelivery: 3 },
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
  assert.equal(readiness.checks.find(function (item) {
    return item.key === 'events.dueForDelivery';
  }).count, 3);
});

test('operational readiness reports ok when overview has no signals', async function () {
  const readiness = await getOperationalReadiness({
    overview: {
      generatedAt: '2026-06-18T10:00:00.000Z',
      sources: { failed: 0 },
      tasks: { failed: 0 },
      events: { failed: 0, dueForDelivery: 0 },
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
      events: { failed: 0, dueForDelivery: 0 },
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

test('operational readiness reports source-scoped review action execution ledger health', async function () {
  const calls = [];
  const readiness = await getOperationalReadiness({
    sourceKey: 'nga',
    sourceId: 'source-nga',
    sourceType: 'saved-html-directory',
    enabled: true,
    async getOperationalOverview(request) {
      calls.push(request);
      return {
        generatedAt: '2026-06-18T10:00:00.000Z',
        sources: { failed: 0 },
        tasks: { failed: 0 },
        events: { failed: 0, dueForDelivery: 0 },
        workers: {
          stale: 0,
          failed: 0,
          leases: {
            expired: 0
          }
        },
        reviewActions: {
          sourceId: 'source-nga',
          sourceKey: 'nga',
          executions: {
            sourceId: 'source-nga',
            sourceKey: 'nga',
            count: 2,
            running: 1,
            staleRunning: 1,
            failed: 0,
            bySourceKey: { nga: 2 },
            staleRunningBySourceKey: { nga: 1 }
          }
        }
      };
    }
  });
  const check = readiness.checks.find(function (item) {
    return item.key === 'reviewActions.executionLedger';
  });

  assert.equal(calls[0].sourceKey, 'nga');
  assert.equal(calls[0].sourceId, 'source-nga');
  assert.equal(calls[0].sourceType, 'saved-html-directory');
  assert.equal(calls[0].enabled, true);
  assert.equal(readiness.status, 'fail');
  assert.equal(check.status, 'fail');
  assert.equal(check.count, 1);
  assert.equal(check.value.sourceKey, 'nga');
  assert.equal(check.value.staleRunningBySourceKey.nga, 1);
});
