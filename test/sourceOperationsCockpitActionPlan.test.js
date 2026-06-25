'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getSourceOperationsCockpitActionPlan
} = require('../src/application/use-cases/getSourceOperationsCockpitActionPlan');

test('source operations cockpit action plan builds source-scoped remediation actions', function () {
  const plan = getSourceOperationsCockpitActionPlan({
    now: '2026-06-25T10:00:00.000Z',
    rank: 1,
    cockpit: {
      generatedAt: '2026-06-25T09:59:00.000Z',
      queue: [
        {
          id: 'source-attention:sourceId:source-1',
          rank: 1,
          kind: 'source-attention',
          scope: 'source',
          severity: 'warning',
          priorityScore: 110,
          title: 'Retry source',
          summary: 'retry wait: Failure retry window has not elapsed.',
          source: {
            id: 'source-1',
            sourceKey: 'nga',
            sourceType: 'saved-html-directory',
            displayName: 'Retry source'
          },
          runnable: true,
          recommendedNextAction: 'wait-for-failure-backoff',
          recommendedCommand: 'node src/presentation/cli/threadtrace.js reset-source-failure --source-id source-1 --retry-now true --execute true',
          relatedCommands: [
            'node src/presentation/cli/threadtrace.js source-lifecycle-report'
          ]
        }
      ]
    }
  });

  assert.equal(plan.status, 'actionable');
  assert.equal(plan.selectedItem.id, 'source-attention:sourceId:source-1');
  assert.equal(plan.summary.viewCount, 1);
  assert.equal(plan.summary.dryRunCount, 2);
  assert.equal(plan.summary.executeCount, 3);
  assert.ok(plan.actions.find(function (action) {
    return action.key === 'source.drilldown' && /sourceId=source-1/.test(action.api.path);
  }));
  assert.ok(plan.actions.find(function (action) {
    return action.key === 'source.failure-reset.preview' && action.api.body.execute === false;
  }));
  assert.ok(plan.actions.find(function (action) {
    return action.key === 'source.failure-reset.execute' && action.destructive === true && action.confirmationRequired === true;
  }));
  assert.ok(plan.actions.find(function (action) {
    return action.key === 'source-attention.events.preview' && action.api.body.sourceId === 'source-1';
  }));
  assert.match(plan.recommendedNextAction, /Preview failure reset|Open source drill-down|Retry source/);
});

test('source operations cockpit action plan builds source-type actions', function () {
  const plan = getSourceOperationsCockpitActionPlan({
    now: '2026-06-25T10:00:00.000Z',
    itemId: 'source-type-operations:saved-html-directory',
    provider: 'mock',
    cockpit: {
      queue: [
        {
          id: 'source-type-operations:saved-html-directory',
          rank: 1,
          kind: 'source-type-operations',
          scope: 'source-type',
          severity: 'warning',
          priorityScore: 210,
          title: 'saved-html-directory',
          summary: 'sources=2 | due=1 | attention=1',
          sourceType: 'saved-html-directory',
          runnable: true
        }
      ]
    }
  });

  assert.equal(plan.selectedItem.sourceType, 'saved-html-directory');
  assert.ok(plan.actions.find(function (action) {
    return action.key === 'source-type.drilldown' && /sourceType=saved-html-directory/.test(action.api.path);
  }));
  assert.ok(plan.actions.find(function (action) {
    return action.key === 'source-type-operations.events.preview' && action.api.body.sourceType === 'saved-html-directory';
  }));
  assert.ok(plan.actions.find(function (action) {
    return action.key === 'source-type.run-due-insight' && action.api.body.sourceType === 'saved-html-directory';
  }));
});

test('source operations cockpit action plan rejects empty or missing queue items', function () {
  assert.throws(function () {
    getSourceOperationsCockpitActionPlan({
      cockpit: {
        queue: []
      }
    });
  }, /Source operations cockpit has no queue items/);

  assert.throws(function () {
    getSourceOperationsCockpitActionPlan({
      itemId: 'missing',
      cockpit: {
        queue: [
          { id: 'present', rank: 1 }
        ]
      }
    });
  }, /Requested source operations cockpit item was not found/);
});
