'use strict';

const { acknowledgeNotificationEvent: acknowledgeEvent } = require('../../domain/events/notificationEvent');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');

async function acknowledgeNotificationEvents(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const eventIds = Array.isArray(safeOptions.eventIds) ? uniqueTruthy(safeOptions.eventIds) : [];
  const acknowledgedBy = safeOptions.acknowledgedBy || 'system';
  const note = safeOptions.note;
  const acknowledgedAt = safeOptions.acknowledgedAt || safeOptions.now;
  const dryRun = safeOptions.execute === true ? false : Boolean(safeOptions.dryRun);
  const events = eventIds.length > 0
    ? await findEventsById(notificationEventRepository, eventIds)
    : (await notificationEventRepository.listEvents(buildQuery(safeOptions))).map(function (event) {
      return {
        eventId: event.id,
        event
      };
    });
  const results = [];

  for (const item of events) {
    if (!item.event) {
      results.push({
        eventId: item.eventId,
        status: 'skipped',
        reason: 'not-found'
      });
      continue;
    }

    if (item.event.acknowledgedAt) {
      results.push({
        eventId: item.event.id,
        status: 'skipped',
        reason: 'already-acknowledged',
        event: summarizeEvent(item.event)
      });
      continue;
    }

    const acknowledgedEvent = acknowledgeEvent(item.event, {
      acknowledgedBy,
      note,
      acknowledgedAt
    });
    if (!dryRun) {
      await notificationEventRepository.saveEvent(acknowledgedEvent);
    }
    results.push({
      eventId: acknowledgedEvent.id,
      status: dryRun ? 'candidate' : 'acknowledged',
      event: summarizeEvent(acknowledgedEvent)
    });
  }

  const acknowledgedCount = results.filter(function (result) {
    return result.status === 'acknowledged';
  }).length;
  const candidateCount = results.filter(function (result) {
    return result.status === 'candidate';
  }).length;
  const skippedCount = results.filter(function (result) {
    return result.status === 'skipped';
  }).length;

  return {
    status: statusForResult({ acknowledgedCount, candidateCount, dryRun }),
    dryRun,
    executed: !dryRun,
    requestedCount: eventIds.length || events.length,
    eventCount: events.length,
    candidateCount,
    acknowledgedCount,
    skippedCount,
    acknowledgedBy,
    filters: eventIds.length > 0 ? {} : cleanObject({
      type: safeOptions.type,
      sourceId: safeOptions.sourceId,
      sourceKey: safeOptions.sourceKey,
      acknowledged: typeof safeOptions.acknowledged === 'boolean' ? safeOptions.acknowledged : false,
      deliveryStatus: safeOptions.deliveryStatus,
      limit: safeOptions.limit || 50
    }),
    results
  };
}

function statusForResult(summary) {
  if (summary.dryRun && summary.candidateCount > 0) return 'preview';
  if (summary.acknowledgedCount > 0) return 'ok';
  return 'noop';
}

async function findEventsById(repository, eventIds) {
  const events = [];
  for (const eventId of eventIds) {
    events.push({
      eventId,
      event: await repository.findEvent(eventId)
    });
  }
  return events;
}

function buildQuery(options) {
  return {
    type: options.type,
    sourceId: options.sourceId,
    sourceKey: options.sourceKey,
    acknowledged: typeof options.acknowledged === 'boolean' ? options.acknowledged : false,
    deliveryStatus: options.deliveryStatus,
    limit: options.limit || 50
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

function uniqueTruthy(values) {
  return Array.from(new Set(values.map(function (value) {
    return String(value || '').trim();
  }).filter(Boolean)));
}

function cleanObject(input) {
  return Object.keys(input).reduce(function (result, key) {
    if (input[key] !== undefined) result[key] = input[key];
    return result;
  }, {});
}

module.exports = {
  acknowledgeNotificationEvents
};
