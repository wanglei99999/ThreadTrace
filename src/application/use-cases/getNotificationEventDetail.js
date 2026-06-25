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

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    event,
    sourceScope,
    relatedTask,
    links: eventDetailLinks(event, sourceScope, relatedTask),
    nextActions: eventDetailActions(event, sourceScope, relatedTask)
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
  eventDetailActions
};
