'use strict';

const crypto = require('crypto');
const { createApplicationError } = require('../errors/applicationError');
const { acknowledgeNotificationEvent } = require('./acknowledgeNotificationEvent');
const { prepareNotificationEventActionIntent } = require('./prepareNotificationEventActionIntent');
const {
  assertNotificationEventActionExecutionRepository
} = require('../ports/notificationEventActionExecutionRepository');

async function executeNotificationEventAction(options) {
  const safeOptions = options || {};
  const execute = safeOptions.execute === true;
  const actionKey = String(safeOptions.actionKey || safeOptions.action || '').trim();
  if (!actionKey) {
    throw createApplicationError('event_action_key_required', 'Notification event action execution requires actionKey.', {
      statusCode: 400
    });
  }

  const eventId = String(safeOptions.eventId || '').trim();
  const executionRepository = assertNotificationEventActionExecutionRepository(safeOptions.notificationEventActionExecutionRepository);
  const replay = execute && executionRepository
    ? await executionRepository.findExecution(buildExecutionKey(eventId, actionKey))
    : undefined;
  if (replay && replay.status === 'completed') {
    return withReplay(replay);
  }

  const intentResult = await prepareNotificationEventActionIntent(Object.assign({}, safeOptions, {
    actionKey
  }));
  if (!execute) {
    return Object.assign({}, intentResult, {
      mode: 'dry-run',
      dryRun: true,
      executed: false,
      executionLedger: {
        recorded: false,
        reason: 'execute_false'
      }
    });
  }

  if (!executionRepository) {
    throw createApplicationError('event_action_execution_repository_required', 'Notification event action execution requires an execution ledger repository.', {
      statusCode: 503
    });
  }
  if (intentResult.status === 'blocked' || intentResult.readinessGate && intentResult.readinessGate.executable === false) {
    throw createApplicationError('event_action_execution_blocked', 'Notification event action execution is blocked by readiness gates.', {
      statusCode: 409,
      details: {
        eventId,
        actionKey,
        readinessGate: intentResult.readinessGate
      }
    });
  }
  if (actionKey !== 'event.acknowledge') {
    throw createApplicationError('event_action_execution_unsupported', 'Notification event action execution currently supports event.acknowledge only.', {
      statusCode: 409,
      details: {
        eventId,
        actionKey,
        supportedActionKeys: ['event.acknowledge']
      }
    });
  }

  return runAcknowledgeExecution({
    executionRepository,
    notificationEventRepository: safeOptions.notificationEventRepository,
    intentResult,
    eventId,
    actionKey,
    actor: safeOptions.actor || safeOptions.acknowledgedBy || safeOptions.requestedBy || 'operator',
    note: safeOptions.note || safeOptions.reason,
    now: safeOptions.now
  });
}

async function runAcknowledgeExecution(options) {
  const safeOptions = options || {};
  const key = buildExecutionKey(safeOptions.eventId, safeOptions.actionKey);
  const logicalInput = {
    eventId: safeOptions.eventId,
    actionKey: safeOptions.actionKey,
    actor: safeOptions.actor,
    note: safeOptions.note,
    sourceScope: safeOptions.intentResult && safeOptions.intentResult.sourceScope || {}
  };
  const claimed = await safeOptions.executionRepository.claimExecution({
    key,
    type: 'notification-event-action-execution',
    actionKey: safeOptions.actionKey,
    eventId: safeOptions.eventId,
    actor: safeOptions.actor,
    sourceScope: logicalInput.sourceScope,
    requestHash: hashStable(logicalInput),
    intent: compactIntentResult(safeOptions.intentResult),
    now: safeOptions.now
  });

  if (!claimed.claimed) {
    if (claimed.record && claimed.record.status === 'completed') {
      return withReplay(claimed.record);
    }
    throw createApplicationError('event_action_execution_running', 'Notification event action execution is already running.', {
      statusCode: 409,
      details: {
        key,
        eventId: safeOptions.eventId,
        actionKey: safeOptions.actionKey
      }
    });
  }

  try {
    const actionResult = await acknowledgeNotificationEvent({
      notificationEventRepository: safeOptions.notificationEventRepository,
      eventId: safeOptions.eventId,
      acknowledgedBy: safeOptions.actor,
      note: safeOptions.note,
      acknowledgedAt: safeOptions.now
    });
    const result = {
      generatedAt: safeOptions.now || new Date().toISOString(),
      mode: 'execute',
      dryRun: false,
      executed: true,
      status: 'ok',
      action: safeOptions.intentResult.action,
      event: summarizeEvent(actionResult.event),
      sourceScope: logicalInput.sourceScope,
      intent: safeOptions.intentResult.intent
    };
    const execution = await safeOptions.executionRepository.completeExecution(key, result, {
      eventId: safeOptions.eventId,
      actionKey: safeOptions.actionKey,
      actor: safeOptions.actor,
      sourceScope: logicalInput.sourceScope,
      now: safeOptions.now
    });
    return Object.assign({}, result, {
      executionLedger: {
        recorded: true,
        key,
        status: 'completed',
        replayed: false,
        filePath: execution.filePath
      }
    });
  } catch (error) {
    await safeOptions.executionRepository.failExecution(key, error, {
      eventId: safeOptions.eventId,
      actionKey: safeOptions.actionKey,
      actor: safeOptions.actor,
      sourceScope: logicalInput.sourceScope,
      now: safeOptions.now
    });
    throw error;
  }
}

function withReplay(record) {
  const result = Object.assign({}, record.result || {}, {
    executionLedger: {
      recorded: true,
      key: record.key,
      status: 'completed',
      replayed: true,
      originalUpdatedAt: record.updatedAt,
      filePath: record.filePath
    }
  });
  if (result.executed === undefined) result.executed = true;
  if (result.dryRun === undefined) result.dryRun = false;
  if (!result.mode) result.mode = 'execute';
  return result;
}

function compactIntentResult(intentResult) {
  return {
    generatedAt: intentResult.generatedAt,
    status: intentResult.status,
    event: intentResult.event,
    sourceScope: intentResult.sourceScope,
    relatedTask: intentResult.relatedTask,
    action: intentResult.action,
    readinessGate: intentResult.readinessGate,
    intent: intentResult.intent,
    ledger: intentResult.ledger
  };
}

function summarizeEvent(event) {
  return {
    id: event.id,
    type: event.type,
    severity: event.severity,
    sourceId: event.sourceId,
    sourceKey: event.sourceKey,
    title: event.title,
    summary: event.summary,
    createdAt: event.createdAt,
    deliveryStatus: event.deliveryStatus || 'pending',
    acknowledgedAt: event.acknowledgedAt,
    acknowledgedBy: event.acknowledgedBy,
    acknowledgementNote: event.acknowledgementNote
  };
}

function buildExecutionKey(eventId, actionKey) {
  return 'notification-event-action:v1:' + safeKey(eventId) + ':' + safeKey(actionKey);
}

function safeKey(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function hashStable(value) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(value))
    .digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + stableStringify(value[key]);
    }).join(',') + '}';
  }
  return JSON.stringify(value);
}

module.exports = {
  executeNotificationEventAction,
  buildExecutionKey
};
