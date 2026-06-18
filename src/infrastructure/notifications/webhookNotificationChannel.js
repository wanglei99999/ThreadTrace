'use strict';

const { assertNotificationChannel } = require('../../application/ports/notificationChannel');

function createWebhookNotificationChannel(options) {
  const safeOptions = options || {};
  const url = safeOptions.url;
  const headers = safeOptions.headers || {};
  const timeoutMs = safeOptions.timeoutMs || 10000;

  if (!url) {
    throw new Error('Webhook notification channel requires url.');
  }

  const channel = {
    channelKey: 'webhook',

    async deliver(event) {
      const deliveredAt = new Date().toISOString();
      const controller = new AbortController();
      const timeout = setTimeout(function () {
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: Object.assign({
            'content-type': 'application/json'
          }, headers),
          body: JSON.stringify({
            deliveredAt,
            event
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Webhook delivery failed with HTTP ' + response.status);
        }

        return {
          channelKey: 'webhook',
          deliveredAt,
          deliveryRef: url,
          statusCode: response.status
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };

  return assertNotificationChannel(channel);
}

module.exports = {
  createWebhookNotificationChannel
};
