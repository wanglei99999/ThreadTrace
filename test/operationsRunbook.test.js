'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getOperationsRunbook } = require('../src/application/use-cases/getOperationsRunbook');

test('operations runbook turns diagnostics and pipeline failures into actions', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: [
        {
          key: 'sources.ingestConfiguration',
          area: 'sources',
          status: 'fail',
          summary: 'Tracked sources have usable locations, handlers, and adapters.',
          evidence: { sourceCount: 2 }
        },
        {
          key: 'llm.configuration',
          area: 'llm',
          status: 'warn',
          summary: 'LLM provider configuration is ready for the selected provider.'
        },
        {
          key: 'resources.storage',
          area: 'resources',
          status: 'ok',
          summary: 'Primary storage resources are reachable.'
        }
      ]
    },
    pipelineRuns: {
      runs: [
        {
          taskId: 'task-1',
          status: 'failed',
          sourceId: 'source-1',
          source: {
            displayName: 'NGA archive'
          },
          semantic: {
            status: 'skipped'
          }
        }
      ]
    }
  });

  assert.equal(runbook.status, 'fail');
  assert.equal(runbook.actionCount, 3);
  assert.equal(runbook.actions[0].key, 'checklist.sources.ingestConfiguration');
  assert.equal(runbook.actions[0].severity, 'critical');
  assert.match(runbook.actions[0].recommendedCommand, /source-diagnostics/);
  assert.equal(runbook.actions[1].severity, 'warning');
  assert.equal(runbook.actions[2].key, 'pipeline.task-1');
  assert.match(runbook.actions[2].summary, /NGA archive/);
});

test('operations runbook flags duplicate idempotency task risk', function () {
  const runbook = getOperationsRunbook({
    now: '2026-06-19T10:00:00.000Z',
    checklist: {
      generatedAt: '2026-06-19T10:00:00.000Z',
      items: [],
      readiness: {
        overview: {
          recent: {
            tasks: [
              task('task-2', 'completed', 'idem-1'),
              task('task-1', 'failed', 'idem-1'),
              task('task-3', 'completed', 'idem-2')
            ]
          }
        }
      }
    },
    pipelineRuns: {
      runs: []
    }
  });

  assert.equal(runbook.status, 'warn');
  assert.equal(runbook.actionCount, 1);
  assert.equal(runbook.actions[0].key, 'idempotency.idem-1');
  assert.equal(runbook.actions[0].severity, 'warning');
  assert.equal(runbook.actions[0].evidence.reusableTaskId, 'task-2');
  assert.deepEqual(runbook.actions[0].evidence.taskIds, ['task-2', 'task-1']);
  assert.match(runbook.actions[0].recommendedCommand, /trace-context --idempotency-key idem-1/);
});

function task(id, status, idempotencyKey) {
  return {
    id,
    type: 'demo-task',
    status,
    input: {
      _trace: {
        idempotencyKey
      }
    }
  };
}
