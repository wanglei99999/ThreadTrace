'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { inspectNotificationChannelResources } = require('../src/infrastructure/diagnostics/notificationChannelDiagnostics');

test('notification channel diagnostics verifies file delivery directory is writable', async function () {
  const storeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-notification-diagnostics-'));
  const diagnostics = await inspectNotificationChannelResources({
    channel: 'file',
    storeDir
  });

  assert.equal(diagnostics.channel, 'file');
  assert.equal(diagnostics.checks.find(function (check) {
    return check.key === 'notifications.channel';
  }).status, 'ok');
  assert.equal(diagnostics.checks.find(function (check) {
    return check.key === 'notifications.fileDeliveryDir';
  }).status, 'ok');
});

test('notification channel diagnostics validates webhook URL without delivering', async function () {
  const diagnostics = await inspectNotificationChannelResources({
    channel: 'webhook',
    webhookUrl: 'https://user:secret@example.test/threadtrace'
  });

  assert.equal(diagnostics.channel, 'webhook');
  assert.equal(diagnostics.checks.find(function (check) {
    return check.key === 'notifications.webhookUrl';
  }).status, 'ok');
  assert.match(diagnostics.checks.find(function (check) {
    return check.key === 'notifications.webhookUrl';
  }).value, /redacted/);
});

test('notification channel diagnostics fails missing webhook URL', async function () {
  const diagnostics = await inspectNotificationChannelResources({
    channel: 'webhook'
  });

  assert.equal(diagnostics.channel, 'webhook');
  assert.equal(diagnostics.checks.find(function (check) {
    return check.key === 'notifications.webhookUrl';
  }).status, 'fail');
});
