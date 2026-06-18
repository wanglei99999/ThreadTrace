'use strict';

const fs = require('fs/promises');
const path = require('path');

async function inspectNotificationChannelResources(options) {
  const safeOptions = options || {};
  const channel = safeOptions.channel || (safeOptions.webhookUrl ? 'webhook' : 'file');

  if (channel === 'file') {
    return inspectFileChannel(safeOptions);
  }
  if (channel === 'webhook') {
    return inspectWebhookChannel(safeOptions);
  }
  return {
    channel,
    checks: [
      check('notifications.channel', 'fail', channel, 'Notification channel is supported.')
    ]
  };
}

async function inspectFileChannel(options) {
  const storeDir = options.storeDir || path.join(process.cwd(), 'data', 'store');
  const deliveryDir = path.join(storeDir, 'deliveries');
  const probePath = path.join(deliveryDir, '.threadtrace-notification-probe-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  try {
    await fs.mkdir(deliveryDir, { recursive: true });
    await fs.writeFile(probePath, 'ok\n', 'utf8');
    await fs.unlink(probePath);
    return {
      channel: 'file',
      checks: [
        check('notifications.channel', 'ok', 'file', 'Notification channel is supported.'),
        check('notifications.fileDeliveryDir', 'ok', deliveryDir, 'File notification delivery directory is writable.')
      ]
    };
  } catch (error) {
    await fs.unlink(probePath).catch(function () {});
    return {
      channel: 'file',
      checks: [
        check('notifications.channel', 'ok', 'file', 'Notification channel is supported.'),
        check('notifications.fileDeliveryDir', 'fail', errorMessage(error), 'File notification delivery directory is writable.')
      ]
    };
  }
}

function inspectWebhookChannel(options) {
  const url = options.webhookUrl;
  const checks = [
    check('notifications.channel', 'ok', 'webhook', 'Notification channel is supported.')
  ];

  if (!url) {
    checks.push(check('notifications.webhookUrl', 'fail', 'missing', 'Webhook notification channel has a URL configured.'));
    return {
      channel: 'webhook',
      checks
    };
  }

  try {
    const parsed = new URL(url);
    const supported = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    checks.push(check('notifications.webhookUrl', supported ? 'ok' : 'fail', redactUrl(parsed), 'Webhook notification URL uses http or https.'));
  } catch (error) {
    checks.push(check('notifications.webhookUrl', 'fail', errorMessage(error), 'Webhook notification URL is valid.'));
  }

  return {
    channel: 'webhook',
    checks
  };
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function redactUrl(parsed) {
  const clone = new URL(parsed.toString());
  if (clone.username || clone.password) {
    clone.username = clone.username ? 'redacted' : '';
    clone.password = clone.password ? 'redacted' : '';
  }
  return clone.toString();
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

module.exports = {
  inspectNotificationChannelResources
};
