'use strict';

function getContextReviewHandoffContract() {
  return {
    version: '1.0.0',
    name: 'ThreadTrace ContextReviewHandoff JSON',
    description: 'Stable handoff package emitted by new-post context restoration for manual review, LLM review, persistence, and notifications.',
    schema: {
      type: 'object',
      required: ['version', 'status', 'taskCount', 'highPriorityTaskCount', 'recommendedNextAction', 'downstreamHooks', 'evidencePackage', 'openTasks'],
      properties: {
        version: { type: 'string' },
        status: { type: 'string', enum: ['no-action', 'ready-for-review', 'action-required'] },
        taskCount: { type: 'number' },
        highPriorityTaskCount: { type: 'number' },
        recommendedNextAction: { type: 'string' },
        downstreamHooks: {
          type: 'array',
          items: { type: 'string' }
        },
        evidencePackage: {
          type: 'object',
          required: ['evidenceRefCount', 'floors', 'refs'],
          properties: {
            evidenceRefCount: { type: 'number' },
            floors: {
              type: 'array',
              items: { type: 'number' }
            },
            refs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                  source: { type: 'string' },
                  type: { type: 'string' },
                  evidenceLevel: { type: 'string' },
                  floor: { type: 'number' },
                  author: { type: 'string' },
                  authorId: { type: 'string' },
                  publishedAt: { type: 'string' },
                  confidence: { type: 'number' },
                  excerpt: { type: 'string' }
                }
              }
            }
          }
        },
        openTasks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['taskId', 'taskType', 'priority', 'title', 'status'],
            properties: {
              taskId: { type: 'string' },
              taskType: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
              title: { type: 'string' },
              targetEntity: { type: 'string' },
              relationType: { type: 'string' },
              reasons: {
                type: 'array',
                items: { type: 'string' }
              },
              evidenceFloors: {
                type: 'array',
                items: { type: 'number' }
              },
              status: { type: 'string', example: 'open' }
            }
          }
        }
      }
    },
    downstreamHooks: {
      manualReview: 'Show openTasks to a reviewer and keep evidencePackage refs beside the task.',
      llmReview: 'Send recommendedNextAction, openTasks, and evidencePackage.refs to an LLM with instructions to cite floors.',
      evidencePersistence: 'Persist evidencePackage.refs as immutable review evidence before human or model judgement.',
      notification: 'Use status and highPriorityTaskCount to decide whether to notify an operator.'
    },
    example: {
      version: '1.0.0',
      status: 'action-required',
      taskCount: 2,
      highPriorityTaskCount: 1,
      recommendedNextAction: '先处理“确认历史链最新市场态度”，优先回看楼层 #0 / #7。',
      downstreamHooks: ['manual-review', 'llm-review', 'evidence-persistence', 'notification'],
      evidencePackage: {
        evidenceRefCount: 2,
        floors: [0, 7],
        refs: [
          {
            taskId: 'latest_attitude_confirmation:科技:explicit_entity_attitude_candidate',
            source: 'opinion-chain',
            type: 'opinion',
            evidenceLevel: 'explicit',
            floor: 0,
            author: '-阿狼-',
            excerpt: '历史楼层证据片段'
          },
          {
            source: 'related-evidence',
            floor: 7,
            author: '-阿狼-',
            confidence: 0.88,
            excerpt: '召回楼层证据片段'
          }
        ]
      },
      openTasks: [
        {
          taskId: 'latest_attitude_confirmation:科技:explicit_entity_attitude_candidate',
          taskType: 'latest_attitude_confirmation',
          priority: 'high',
          title: '确认历史链最新市场态度',
          targetEntity: '科技',
          relationType: 'explicit_entity_attitude_candidate',
          reasons: ['chain_latest_attitude_unknown'],
          evidenceFloors: [0, 7],
          status: 'open'
        }
      ]
    }
  };
}

function validateContextReviewHandoffPayload(payload) {
  const checks = [];
  checks.push(check('contextReviewHandoff.version', hasText(payload && payload.version) ? 'ok' : 'fail', payload && payload.version || 'missing', 'Handoff has a version.'));
  checks.push(check('contextReviewHandoff.status', validStatus(payload && payload.status) ? 'ok' : 'fail', payload && payload.status || 'missing', 'Handoff has a valid status.'));
  checks.push(check('contextReviewHandoff.taskCount', Number.isFinite(payload && payload.taskCount) ? 'ok' : 'fail', payload && payload.taskCount, 'Handoff has a numeric task count.'));
  checks.push(check('contextReviewHandoff.highPriorityTaskCount', Number.isFinite(payload && payload.highPriorityTaskCount) ? 'ok' : 'fail', payload && payload.highPriorityTaskCount, 'Handoff has a numeric high priority task count.'));
  checks.push(check('contextReviewHandoff.recommendedNextAction', hasText(payload && payload.recommendedNextAction) ? 'ok' : 'fail', payload && payload.recommendedNextAction || 'missing', 'Handoff has a recommended next action.'));
  checks.push(check('contextReviewHandoff.downstreamHooks', Array.isArray(payload && payload.downstreamHooks) ? 'ok' : 'fail', Array.isArray(payload && payload.downstreamHooks) ? payload.downstreamHooks.length : 'missing', 'Handoff declares downstream hooks.'));
  checks.push(check('contextReviewHandoff.evidencePackage', isObject(payload && payload.evidencePackage) ? 'ok' : 'fail', payload && payload.evidencePackage ? 'present' : 'missing', 'Handoff has an evidence package.'));
  if (isObject(payload && payload.evidencePackage)) {
    appendEvidencePackageChecks(checks, payload.evidencePackage);
  }
  checks.push(check('contextReviewHandoff.openTasks', Array.isArray(payload && payload.openTasks) ? 'ok' : 'fail', Array.isArray(payload && payload.openTasks) ? payload.openTasks.length : 'missing', 'Handoff has open tasks.'));
  if (Array.isArray(payload && payload.openTasks)) {
    payload.openTasks.forEach(function (task, index) {
      appendTaskChecks(checks, task, index);
    });
  }

  return {
    valid: checks.every(function (item) { return item.status !== 'fail'; }),
    status: aggregateStatus(checks),
    checks
  };
}

function appendEvidencePackageChecks(checks, evidencePackage) {
  checks.push(check('contextReviewHandoff.evidencePackage.evidenceRefCount', Number.isFinite(evidencePackage.evidenceRefCount) ? 'ok' : 'fail', evidencePackage.evidenceRefCount, 'Evidence package has a numeric ref count.'));
  checks.push(check('contextReviewHandoff.evidencePackage.floors', Array.isArray(evidencePackage.floors) ? 'ok' : 'fail', Array.isArray(evidencePackage.floors) ? evidencePackage.floors.length : 'missing', 'Evidence package has floor references.'));
  checks.push(check('contextReviewHandoff.evidencePackage.refs', Array.isArray(evidencePackage.refs) ? 'ok' : 'fail', Array.isArray(evidencePackage.refs) ? evidencePackage.refs.length : 'missing', 'Evidence package has refs.'));
}

function appendTaskChecks(checks, task, index) {
  const prefix = 'contextReviewHandoff.openTasks[' + index + ']';
  checks.push(check(prefix + '.taskId', hasText(task && task.taskId) ? 'ok' : 'fail', task && task.taskId || 'missing', 'Task has a stable id.'));
  checks.push(check(prefix + '.taskType', hasText(task && task.taskType) ? 'ok' : 'fail', task && task.taskType || 'missing', 'Task has a type.'));
  checks.push(check(prefix + '.priority', validPriority(task && task.priority) ? 'ok' : 'fail', task && task.priority || 'missing', 'Task has a valid priority.'));
  checks.push(check(prefix + '.title', hasText(task && task.title) ? 'ok' : 'fail', task && task.title || 'missing', 'Task has a title.'));
  checks.push(check(prefix + '.status', hasText(task && task.status) ? 'ok' : 'fail', task && task.status || 'missing', 'Task has a status.'));
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validStatus(value) {
  return value === 'no-action' || value === 'ready-for-review' || value === 'action-required';
}

function validPriority(value) {
  return value === 'high' || value === 'medium' || value === 'low';
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getContextReviewHandoffContract,
  validateContextReviewHandoffPayload
};
