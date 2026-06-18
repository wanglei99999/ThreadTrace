'use strict';

/**
 * Notification delivery channel port. Infrastructure implementations can
 * deliver events to files, webhooks, email, queues, or chat systems.
 *
 * @typedef {Object} NotificationChannel
 * @property {string=} channelKey
 * @property {(event: Object) => Promise<Object>} deliver
 */

function assertNotificationChannel(channel) {
  if (!channel || typeof channel.deliver !== 'function') {
    throw new Error('NotificationChannel must implement deliver(event).');
  }
  return channel;
}

module.exports = {
  assertNotificationChannel
};
