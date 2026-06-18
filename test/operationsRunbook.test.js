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
