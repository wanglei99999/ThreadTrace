'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { createWebhookNotificationChannel } = require('../src/infrastructure/notifications/webhookNotificationChannel');

test('webhook notification channel posts event payloads', async function () {
  const received = [];
  const server = http.createServer(function (request, response) {
    const chunks = [];
    request.on('data', function (chunk) {
      chunks.push(chunk);
    });
    request.on('end', function () {
      received.push({
        method: request.method,
        contentType: request.headers['content-type'],
        body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
      });
      response.writeHead(204);
      response.end();
    });
  });
  await listen(server, 0);

  try {
    const address = server.address();
    const channel = createWebhookNotificationChannel({
      url: 'http://127.0.0.1:' + address.port + '/events'
    });
    const result = await channel.deliver({
      id: 'event-1',
      type: 'source-changed',
      summary: 'sample changed'
    });

    assert.equal(result.channelKey, 'webhook');
    assert.equal(result.statusCode, 204);
    assert.equal(received.length, 1);
    assert.equal(received[0].method, 'POST');
    assert.equal(received[0].body.event.id, 'event-1');
  } finally {
    await close(server);
  }
});

function listen(server, port) {
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

function close(server) {
  return new Promise(function (resolve, reject) {
    server.close(function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
}
