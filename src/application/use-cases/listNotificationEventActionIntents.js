'use strict';

const {
  assertNotificationEventActionIntentRepository
} = require('../ports/notificationEventActionIntentRepository');

async function listNotificationEventActionIntents(options) {
  const safeOptions = options || {};
  const repository = assertNotificationEventActionIntentRepository(safeOptions.notificationEventActionIntentRepository);
  const intents = await repository.listIntents({
    eventId: safeOptions.eventId,
    actionKey: safeOptions.actionKey || safeOptions.action,
    status: safeOptions.status,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    actor: safeOptions.actor,
    limit: safeOptions.limit || 50
  });

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: 'ok',
    eventId: safeOptions.eventId,
    actionKey: safeOptions.actionKey || safeOptions.action,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    actor: safeOptions.actor,
    count: intents.length,
    intents
  };
}

module.exports = {
  listNotificationEventActionIntents
};
