'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');

async function getNotificationEventDetail(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const eventId = String(safeOptions.eventId || '').trim();
  if (!eventId) {
    throw createApplicationError('event_id_required', 'Notification event detail requires eventId.', {
      statusCode: 400
    });
  }

  const event = await notificationEventRepository.findEvent(eventId);
  if (!event) {
    throw createApplicationError('event_not_found', 'Notification event was not found.', {
      statusCode: 404,
      details: {
        eventId
      }
    });
  }

  const sourceScope = eventSourceScope(event);
  const relatedTask = await findRelatedTask(event, safeOptions.taskRepository);
  const nextActions = eventDetailActions(event, sourceScope, relatedTask);

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    event,
    sourceScope,
    relatedTask,
    links: eventDetailLinks(event, sourceScope, relatedTask),
    actionReadiness: eventActionReadiness(event, sourceScope, relatedTask, nextActions),
    nextActions
  };
}

function eventSourceScope(event) {
  const payload = event && event.payload || {};
  const action = payload.action || {};
  const actionEvidence = action.evidence || {};
  const source = payload.source || {};
  const recordSummary = payload.summary || {};
  return compactObject({
    sourceId: firstValue(event.sourceId, payload.sourceId, action.sourceId, actionEvidence.sourceId, source.id, source.sourceId, recordSummary.sourceId),
    sourceKey: firstValue(event.sourceKey, payload.sourceKey, payload.forum, action.sourceKey, actionEvidence.sourceKey, source.sourceKey, source.forum, recordSummary.sourceKey),
    sourceType: firstValue(payload.sourceType, action.sourceType, actionEvidence.sourceType, source.sourceType),
    sourceThreadId: firstValue(payload.sourceThreadId, payload.threadId, actionEvidence.sourceThreadId, source.sourceThreadId, recordSummary.sourceThreadId)
  });
}

async function findRelatedTask(event, taskRepository) {
  if (!event || !event.taskId || !taskRepository || typeof taskRepository.findTask !== 'function') return undefined;
  const task = await taskRepository.findTask(event.taskId);
  if (!task) {
    return {
      id: event.taskId,
      missing: true
    };
  }
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    finishedAt: task.finishedAt
  };
}

function eventDetailLinks(event, sourceScope, relatedTask) {
  const links = [
    {
      rel: 'self',
      method: 'GET',
      href: '/api/events/' + encodeURIComponent(event.id)
    }
  ];
  if (!event.acknowledgedAt) {
    links.push({
      rel: 'acknowledge',
      method: 'POST',
      href: '/api/events/' + encodeURIComponent(event.id) + '/ack'
    });
  }
  if (sourceScope.sourceId || sourceScope.sourceKey) {
    links.push({
      rel: 'source-drilldown',
      method: 'GET',
      href: '/api/operations/source-drilldown?' + sourceDrilldownQuery(sourceScope)
    });
  }
  if (relatedTask && relatedTask.id) {
    links.push({
      rel: 'task-detail',
      method: 'GET',
      href: '/api/tasks/' + encodeURIComponent(relatedTask.id)
    });
  }
  return links;
}

function eventDetailActions(event, sourceScope, relatedTask) {
  const actions = [];
  if (!event.acknowledgedAt) {
    actions.push({
      key: 'event.acknowledge',
      severity: 'info',
      summary: 'Acknowledge this notification after the operator has handled it.',
      command: 'node src/presentation/cli/threadtrace.js ack-event --event-id ' + quoteCommandValue(event.id)
    });
  }
  if ((event.deliveryStatus || 'pending') === 'pending' || event.deliveryStatus === 'failed') {
    actions.push({
      key: 'event.dispatch',
      severity: event.deliveryStatus === 'failed' ? 'warning' : 'info',
      summary: 'Dispatch pending or failed notification events for this source scope.',
      command: eventDispatchCommand(sourceScope)
    });
  }
  if (sourceScope.sourceId || sourceScope.sourceKey) {
    actions.push({
      key: 'event.source-drilldown',
      severity: 'info',
      summary: 'Inspect source-scoped workers, leases, tasks, events, and review records.',
      command: sourceDrilldownCommand(sourceScope),
      evidence: sourceScope
    });
  }
  if (relatedTask && relatedTask.id) {
    actions.push({
      key: 'event.task-detail',
      severity: relatedTask.missing ? 'warning' : 'info',
      summary: relatedTask.missing ? 'The event references a task id that is not present in the current task store.' : 'Inspect the task that produced or owns this event.',
      command: 'node src/presentation/cli/threadtrace.js task-detail --task-id ' + quoteCommandValue(relatedTask.id),
      evidence: relatedTask
    });
  }
  if (event.acknowledgedAt && (event.deliveryStatus === 'delivered' || event.deliveryStatus === 'resolved')) {
    actions.push({
      key: 'event.archive',
      severity: 'info',
      summary: 'Archive handled delivered or resolved notification events after the retention window.',
      command: eventArchiveCommand(sourceScope)
    });
  }
  return actions;
}

function eventActionReadiness(event, sourceScope, relatedTask, nextActions) {
  const deliveryStatus = event.deliveryStatus || 'pending';
  const hasSourceScope = Boolean(sourceScope.sourceId || sourceScope.sourceKey);
  const acknowledged = Boolean(event.acknowledgedAt);
  const dispatchable = deliveryStatus === 'pending' || deliveryStatus === 'failed';
  const archivable = acknowledged && (deliveryStatus === 'delivered' || deliveryStatus === 'resolved');
  const gates = [
    {
      key: 'event.present',
      status: 'ok',
      blocking: false,
      summary: 'The notification event exists in the current outbox store.'
    },
    {
      key: 'event.source-scope',
      status: hasSourceScope ? 'ok' : 'warn',
      blocking: false,
      summary: hasSourceScope ? 'Source-scoped operations can target this event context.' : 'No source scope was found; source-scoped actions will fall back to global filters.'
    },
    {
      key: 'event.delivery-state',
      status: deliveryStatus === 'failed' ? 'warn' : 'ok',
      blocking: false,
      summary: 'Delivery status is ' + deliveryStatus + '.'
    },
    {
      key: 'event.acknowledge',
      status: acknowledged ? 'skipped' : 'ok',
      executable: !acknowledged,
      blocking: false,
      summary: acknowledged ? 'The event is already acknowledged.' : 'The event can be acknowledged after operator review.'
    },
    {
      key: 'event.dispatch',
      status: dispatchable ? 'ok' : 'skipped',
      executable: dispatchable,
      blocking: false,
      summary: dispatchable ? 'Pending or failed delivery can be dispatched.' : 'Dispatch is not needed for the current delivery status.'
    },
    {
      key: 'event.task-detail',
      status: !relatedTask ? 'skipped' : relatedTask.missing ? 'warn' : 'ok',
      executable: Boolean(relatedTask && relatedTask.id),
      blocking: false,
      summary: !relatedTask ? 'No related task id is attached to this event.' : relatedTask.missing ? 'The related task id is referenced but not present in the current task store.' : 'The related task can be inspected.'
    },
    {
      key: 'event.archive',
      status: archivable ? 'ok' : 'skipped',
      executable: archivable,
      blocking: false,
      summary: archivable ? 'The handled delivered or resolved event is eligible for archive workflow.' : 'Archive is only recommended after acknowledgement and delivered/resolved status.'
    }
  ];
  const warningCount = gates.filter(function (gate) {
    return gate.status === 'warn';
  }).length;
  return {
    status: warningCount > 0 ? 'warn' : 'ok',
    gateCount: gates.length,
    warningCount,
    executableActionKeys: (nextActions || []).map(function (action) {
      return action.key;
    }),
    gates
  };
}

function sourceDrilldownQuery(sourceScope) {
  const query = new URLSearchParams();
  if (sourceScope.sourceId) query.set('sourceId', sourceScope.sourceId);
  if (sourceScope.sourceKey) query.set('sourceKey', sourceScope.sourceKey);
  query.set('limit', '50');
  return query.toString();
}

function sourceDrilldownCommand(sourceScope) {
  const parts = ['node src/presentation/cli/threadtrace.js source-drilldown'];
  if (sourceScope.sourceId) parts.push('--source-id ' + quoteCommandValue(sourceScope.sourceId));
  if (sourceScope.sourceKey) parts.push('--source-key ' + quoteCommandValue(sourceScope.sourceKey));
  return parts.join(' ');
}

function eventDispatchCommand(sourceScope) {
  const parts = ['node src/presentation/cli/threadtrace.js dispatch-events'];
  if (sourceScope.sourceId) parts.push('--source-id ' + quoteCommandValue(sourceScope.sourceId));
  if (sourceScope.sourceKey) parts.push('--source-key ' + quoteCommandValue(sourceScope.sourceKey));
  return parts.join(' ');
}

function eventArchiveCommand(sourceScope) {
  const parts = ['node src/presentation/cli/threadtrace.js archive-events'];
  if (sourceScope.sourceId) parts.push('--source-id ' + quoteCommandValue(sourceScope.sourceId));
  if (sourceScope.sourceKey) parts.push('--source-key ' + quoteCommandValue(sourceScope.sourceKey));
  return parts.join(' ');
}

function compactObject(value) {
  return Object.keys(value).reduce(function (result, key) {
    if (value[key] !== undefined && value[key] !== '') result[key] = value[key];
    return result;
  }, {});
}

function firstValue() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (arguments[index] !== undefined && arguments[index] !== '') return arguments[index];
  }
  return undefined;
}

function quoteCommandValue(value) {
  return '"' + String(value).replace(/"/g, '\\"') + '"';
}

module.exports = {
  getNotificationEventDetail,
  eventSourceScope,
  eventDetailLinks,
  eventDetailActions,
  eventActionReadiness
};
