'use strict';

const { createApplicationError } = require('../errors/applicationError');
const {
  assertNotificationEventActionIntentRepository
} = require('../ports/notificationEventActionIntentRepository');
const { getNotificationEventDetail } = require('./getNotificationEventDetail');

async function prepareNotificationEventActionIntent(options) {
  const safeOptions = options || {};
  const actionKey = String(safeOptions.actionKey || safeOptions.action || '').trim();
  if (!actionKey) {
    throw createApplicationError('event_action_key_required', 'Notification event action intent requires actionKey.', {
      statusCode: 400
    });
  }

  const detail = await getNotificationEventDetail(safeOptions);
  const action = findAction(detail.nextActions, actionKey);
  if (!action) {
    throw createApplicationError('event_action_not_available', 'Requested notification event action is not available for this event state.', {
      statusCode: 409,
      details: {
        eventId: detail.event.id,
        actionKey,
        availableActionKeys: (detail.nextActions || []).map(function (item) {
          return item.key;
        })
      }
    });
  }

  const readinessGate = findReadinessGate(detail.actionReadiness, actionKey);
  const executable = !readinessGate || readinessGate.executable !== false;
  const intent = eventActionIntent(detail, action, readinessGate, safeOptions);
  const generatedAt = safeOptions.now || new Date().toISOString();
  const result = {
    generatedAt,
    mode: 'dry-run',
    dryRun: true,
    executed: false,
    status: executable ? intentStatus(detail.actionReadiness, readinessGate) : 'blocked',
    event: eventSummary(detail.event),
    sourceScope: detail.sourceScope,
    relatedTask: detail.relatedTask,
    action,
    readinessGate,
    intent,
    actionReadiness: detail.actionReadiness,
    nextActions: detail.nextActions
  };
  result.ledger = await saveIntentLedgerRecord(result, safeOptions.notificationEventActionIntentRepository);
  return result;
}

async function saveIntentLedgerRecord(result, repository) {
  const intentRepository = assertNotificationEventActionIntentRepository(repository);
  if (!intentRepository) {
    return {
      recorded: false,
      reason: 'notification_event_action_intent_repository_not_configured'
    };
  }
  const record = await intentRepository.saveIntent({
    generatedAt: result.generatedAt,
    mode: result.mode,
    dryRun: result.dryRun,
    executed: result.executed,
    status: result.status,
    eventId: result.event && result.event.id,
    actionKey: result.action && result.action.key,
    actor: result.intent && result.intent.actor,
    event: result.event,
    sourceScope: result.sourceScope,
    relatedTask: result.relatedTask,
    action: result.action,
    readinessGate: result.readinessGate,
    intent: result.intent,
    actionReadiness: result.actionReadiness
  });
  return {
    recorded: true,
    recordId: record.id,
    filePath: record.filePath
  };
}

function eventActionIntent(detail, action, readinessGate, options) {
  const event = detail.event || {};
  const sourceScope = detail.sourceScope || {};
  const relatedTask = detail.relatedTask || {};
  const key = action.key;
  return {
    id: intentId(event.id, key),
    type: 'notification-event-action',
    actionKey: key,
    eventId: event.id,
    summary: action.summary,
    command: action.command,
    api: apiPlanForAction(key, event, sourceScope, relatedTask),
    actor: options.actor || options.requestedBy || 'operator',
    reason: options.reason || options.note || 'operator-dry-run',
    evidence: {
      eventId: event.id,
      eventType: event.type,
      deliveryStatus: event.deliveryStatus || 'pending',
      acknowledgedAt: event.acknowledgedAt,
      sourceScope,
      relatedTask,
      readinessGate
    },
    audit: {
      required: true,
      suggestedLedger: 'notification-event-action-intents',
      dryRunOnly: true
    }
  };
}

function apiPlanForAction(actionKey, event, sourceScope, relatedTask) {
  if (actionKey === 'event.acknowledge') {
    return {
      method: 'POST',
      path: '/api/events/' + encodeURIComponent(event.id) + '/ack',
      body: {
        acknowledgedBy: '<operator>',
        note: '<review-note>'
      }
    };
  }
  if (actionKey === 'event.dispatch') {
    return {
      method: 'POST',
      path: '/api/events/dispatch',
      body: compactObject({
        sourceId: sourceScope.sourceId,
        sourceKey: sourceScope.sourceKey,
        limit: 50
      })
    };
  }
  if (actionKey === 'event.source-drilldown') {
    const query = new URLSearchParams();
    if (sourceScope.sourceId) query.set('sourceId', sourceScope.sourceId);
    if (sourceScope.sourceKey) query.set('sourceKey', sourceScope.sourceKey);
    query.set('limit', '50');
    return {
      method: 'GET',
      path: '/api/operations/source-drilldown?' + query.toString()
    };
  }
  if (actionKey === 'event.task-detail' && relatedTask && relatedTask.id) {
    return {
      method: 'GET',
      path: '/api/tasks/' + encodeURIComponent(relatedTask.id)
    };
  }
  if (actionKey === 'event.archive') {
    return {
      method: 'POST',
      path: '/api/events/archive',
      body: compactObject({
        sourceId: sourceScope.sourceId,
        sourceKey: sourceScope.sourceKey,
        execute: false,
        reason: '<retention-policy>'
      })
    };
  }
  return {
    method: 'MANUAL',
    path: 'operator-review'
  };
}

function findAction(actions, actionKey) {
  return (actions || []).find(function (action) {
    return action.key === actionKey;
  });
}

function findReadinessGate(readiness, actionKey) {
  const gates = readiness && readiness.gates || [];
  const direct = gates.find(function (gate) {
    return gate.key === actionKey;
  });
  if (direct) return direct;
  const mappedKey = {
    'event.source-drilldown': 'event.source-scope'
  }[actionKey];
  if (!mappedKey) return undefined;
  return gates.find(function (gate) {
    return gate.key === mappedKey;
  });
}

function intentStatus(readiness, readinessGate) {
  if (readinessGate && readinessGate.status === 'warn') return 'warn';
  if (readiness && readiness.status === 'warn') return 'warn';
  return 'ok';
}

function eventSummary(event) {
  return {
    id: event.id,
    type: event.type,
    severity: event.severity,
    deliveryStatus: event.deliveryStatus || 'pending',
    createdAt: event.createdAt,
    acknowledgedAt: event.acknowledgedAt,
    sourceId: event.sourceId,
    sourceKey: event.sourceKey,
    taskId: event.taskId,
    title: event.title,
    summary: event.summary
  };
}

function intentId(eventId, actionKey) {
  return ['event-action-intent', eventId, actionKey].map(function (value) {
    return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
  }).join(':');
}

function compactObject(value) {
  return Object.keys(value).reduce(function (result, key) {
    if (value[key] !== undefined && value[key] !== '') result[key] = value[key];
    return result;
  }, {});
}

module.exports = {
  prepareNotificationEventActionIntent,
  apiPlanForAction,
  findReadinessGate,
  saveIntentLedgerRecord
};
