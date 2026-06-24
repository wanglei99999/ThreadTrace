'use strict';

function getContextReviewResultContract() {
  return {
    version: '1.0.0',
    name: 'ThreadTrace ContextReviewResult JSON',
    description: 'Stable review result payload returned by a human reviewer, LLM worker, or downstream review system after processing a ContextReviewHandoff.',
    schema: {
      type: 'object',
      required: ['version', 'handoffVersion', 'status', 'reviewer', 'reviewedAt', 'decisions', 'resolvedTasks', 'remainingTasks', 'confidence', 'evidenceRefs'],
      properties: {
        version: { type: 'string' },
        handoffVersion: { type: 'string' },
        handoffId: { type: 'string' },
        sourceId: { type: 'string' },
        sourceKey: { type: 'string' },
        status: {
          type: 'string',
          enum: ['accepted', 'partially-accepted', 'rejected', 'needs-more-evidence']
        },
        reviewer: {
          type: 'object',
          required: ['type', 'id'],
          properties: {
            type: { type: 'string', enum: ['human', 'llm', 'system'] },
            id: { type: 'string' },
            displayName: { type: 'string' },
            model: { type: 'string' }
          }
        },
        reviewedAt: { type: 'string' },
        decisions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['taskId', 'decision', 'confidence'],
            properties: {
              taskId: { type: 'string' },
              taskType: { type: 'string' },
              decision: {
                type: 'string',
                enum: ['confirmed', 'corrected', 'rejected', 'needs-more-evidence']
              },
              targetEntity: { type: 'string' },
              relationType: { type: 'string' },
              correctedValue: { type: 'string' },
              confidence: { type: 'number' },
              evidenceRefs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: { type: 'string' },
                    floor: { type: 'number' },
                    taskId: { type: 'string' },
                    excerpt: { type: 'string' }
                  }
                }
              },
              rationale: { type: 'string' }
            }
          }
        },
        resolvedTasks: {
          type: 'array',
          items: { type: 'string' }
        },
        remainingTasks: {
          type: 'array',
          items: { type: 'string' }
        },
        confidence: { type: 'number' },
        evidenceRefs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              floor: { type: 'number' },
              taskId: { type: 'string' },
              excerpt: { type: 'string' }
            }
          }
        },
        notes: { type: 'string' }
      }
    },
    downstreamHooks: {
      contextMerge: 'Merge confirmed and corrected decisions back into context restoration summaries.',
      auditTrail: 'Persist the original handoff and result together for reviewer accountability.',
      taskClosure: 'Close resolved task ids and keep remaining task ids visible in operations dashboards.',
      notification: 'Notify operators when status is rejected or needs-more-evidence.'
    },
    example: {
      version: '1.0.0',
      handoffVersion: '1.0.0',
      handoffId: 'context-review-45974302-150058-001',
      sourceId: 'tracked-source-nga-001',
      sourceKey: 'nga',
      status: 'partially-accepted',
      reviewer: {
        type: 'human',
        id: 'operator-1',
        displayName: 'Ops reviewer'
      },
      reviewedAt: '2026-06-21T10:00:00.000Z',
      decisions: [
        {
          taskId: 'latest_attitude_confirmation:technology:explicit_entity_attitude_candidate',
          taskType: 'latest_attitude_confirmation',
          decision: 'confirmed',
          targetEntity: 'technology',
          relationType: 'explicit_entity_attitude_candidate',
          confidence: 0.86,
          evidenceRefs: [
            {
              source: 'opinion-chain',
              floor: 0,
              taskId: 'latest_attitude_confirmation:technology:explicit_entity_attitude_candidate',
              excerpt: 'Historical evidence excerpt'
            },
            {
              source: 'related-evidence',
              floor: 7,
              excerpt: 'Related evidence excerpt'
            }
          ],
          rationale: 'The new post keeps the same entity and asks for volume confirmation, so the latest chain remains relevant.'
        },
        {
          taskId: 'implicit_reference_resolution:market:implicit_candidate',
          taskType: 'implicit_reference_resolution',
          decision: 'needs-more-evidence',
          targetEntity: 'market',
          confidence: 0.52,
          evidenceRefs: [],
          rationale: 'The implicit target is plausible but not strong enough without another historical floor.'
        }
      ],
      resolvedTasks: ['latest_attitude_confirmation:technology:explicit_entity_attitude_candidate'],
      remainingTasks: ['implicit_reference_resolution:market:implicit_candidate'],
      confidence: 0.72,
      evidenceRefs: [
        {
          source: 'opinion-chain',
          floor: 0,
          taskId: 'latest_attitude_confirmation:technology:explicit_entity_attitude_candidate',
          excerpt: 'Historical evidence excerpt'
        },
        {
          source: 'related-evidence',
          floor: 7,
          excerpt: 'Related evidence excerpt'
        }
      ],
      notes: 'One relation was confirmed; one implicit reference still needs stronger evidence.'
    }
  };
}

function validateContextReviewResultPayload(payload) {
  const checks = [];
  checks.push(check('contextReviewResult.version', hasText(payload && payload.version) ? 'ok' : 'fail', payload && payload.version || 'missing', 'Result has a version.'));
  checks.push(check('contextReviewResult.handoffVersion', hasText(payload && payload.handoffVersion) ? 'ok' : 'fail', payload && payload.handoffVersion || 'missing', 'Result references a handoff contract version.'));
  checks.push(check('contextReviewResult.status', validStatus(payload && payload.status) ? 'ok' : 'fail', payload && payload.status || 'missing', 'Result has a valid status.'));
  checks.push(check('contextReviewResult.reviewer', isObject(payload && payload.reviewer) ? 'ok' : 'fail', payload && payload.reviewer ? 'present' : 'missing', 'Result has reviewer metadata.'));
  if (isObject(payload && payload.reviewer)) {
    appendReviewerChecks(checks, payload.reviewer);
  }
  checks.push(check('contextReviewResult.reviewedAt', hasText(payload && payload.reviewedAt) ? 'ok' : 'fail', payload && payload.reviewedAt || 'missing', 'Result has a review timestamp.'));
  checks.push(check('contextReviewResult.decisions', Array.isArray(payload && payload.decisions) ? 'ok' : 'fail', Array.isArray(payload && payload.decisions) ? payload.decisions.length : 'missing', 'Result has review decisions.'));
  if (Array.isArray(payload && payload.decisions)) {
    payload.decisions.forEach(function (decision, index) {
      appendDecisionChecks(checks, decision, index);
    });
  }
  checks.push(check('contextReviewResult.resolvedTasks', Array.isArray(payload && payload.resolvedTasks) ? 'ok' : 'fail', Array.isArray(payload && payload.resolvedTasks) ? payload.resolvedTasks.length : 'missing', 'Result has resolved task ids.'));
  checks.push(check('contextReviewResult.remainingTasks', Array.isArray(payload && payload.remainingTasks) ? 'ok' : 'fail', Array.isArray(payload && payload.remainingTasks) ? payload.remainingTasks.length : 'missing', 'Result has remaining task ids.'));
  checks.push(check('contextReviewResult.confidence', validConfidence(payload && payload.confidence) ? 'ok' : 'fail', payload && payload.confidence, 'Result has an aggregate confidence between 0 and 1.'));
  checks.push(check('contextReviewResult.evidenceRefs', Array.isArray(payload && payload.evidenceRefs) ? 'ok' : 'fail', Array.isArray(payload && payload.evidenceRefs) ? payload.evidenceRefs.length : 'missing', 'Result carries cited evidence refs.'));
  appendConsistencyChecks(checks, payload);

  return {
    valid: checks.every(function (item) { return item.status !== 'fail'; }),
    status: aggregateStatus(checks),
    checks
  };
}

function appendReviewerChecks(checks, reviewer) {
  checks.push(check('contextReviewResult.reviewer.type', validReviewerType(reviewer.type) ? 'ok' : 'fail', reviewer.type || 'missing', 'Reviewer has a supported type.'));
  checks.push(check('contextReviewResult.reviewer.id', hasText(reviewer.id) ? 'ok' : 'fail', reviewer.id || 'missing', 'Reviewer has a stable id.'));
}

function appendDecisionChecks(checks, decision, index) {
  const prefix = 'contextReviewResult.decisions[' + index + ']';
  checks.push(check(prefix + '.taskId', hasText(decision && decision.taskId) ? 'ok' : 'fail', decision && decision.taskId || 'missing', 'Decision references a task id.'));
  checks.push(check(prefix + '.decision', validDecision(decision && decision.decision) ? 'ok' : 'fail', decision && decision.decision || 'missing', 'Decision has a valid outcome.'));
  checks.push(check(prefix + '.confidence', validConfidence(decision && decision.confidence) ? 'ok' : 'fail', decision && decision.confidence, 'Decision confidence is between 0 and 1.'));
  checks.push(check(prefix + '.evidenceRefs', Array.isArray(decision && decision.evidenceRefs) ? 'ok' : 'warn', Array.isArray(decision && decision.evidenceRefs) ? decision.evidenceRefs.length : 'missing', 'Decision can cite evidence refs.'));
}

function appendConsistencyChecks(checks, payload) {
  if (!payload || !Array.isArray(payload.decisions) || !Array.isArray(payload.resolvedTasks) || !Array.isArray(payload.remainingTasks)) return;
  const decisionTaskIds = uniqueText(payload.decisions.map(function (decision) { return decision && decision.taskId; }));
  const trackedTaskIds = uniqueText(payload.resolvedTasks.concat(payload.remainingTasks));
  const untrackedDecisions = decisionTaskIds.filter(function (taskId) {
    return trackedTaskIds.indexOf(taskId) === -1;
  });
  const duplicatedTaskIds = payload.resolvedTasks.filter(function (taskId) {
    return payload.remainingTasks.indexOf(taskId) !== -1;
  });
  checks.push(check('contextReviewResult.taskCoverage', untrackedDecisions.length === 0 ? 'ok' : 'warn', untrackedDecisions.length, 'Every decision should be reflected in resolvedTasks or remainingTasks.'));
  checks.push(check('contextReviewResult.taskPartition', duplicatedTaskIds.length === 0 ? 'ok' : 'fail', duplicatedTaskIds.length, 'Resolved and remaining task ids must not overlap.'));
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
  return value === 'accepted' || value === 'partially-accepted' || value === 'rejected' || value === 'needs-more-evidence';
}

function validReviewerType(value) {
  return value === 'human' || value === 'llm' || value === 'system';
}

function validDecision(value) {
  return value === 'confirmed' || value === 'corrected' || value === 'rejected' || value === 'needs-more-evidence';
}

function validConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function uniqueText(values) {
  const seen = [];
  values.forEach(function (value) {
    if (hasText(value) && seen.indexOf(value) === -1) {
      seen.push(value);
    }
  });
  return seen;
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getContextReviewResultContract,
  validateContextReviewResultPayload
};
