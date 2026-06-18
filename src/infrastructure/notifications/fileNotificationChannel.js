'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertNotificationChannel } = require('../../application/ports/notificationChannel');

function createFileNotificationChannel(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'deliveries'));

  const channel = {
    channelKey: 'file',

    async deliver(event) {
      const deliveredAt = new Date().toISOString();
      const filePath = path.join(baseDir, safeSegment(event.id) + '.json');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify({
        deliveredAt,
        channelKey: 'file',
        event
      }, null, 2) + '\n', 'utf8');
      return {
        channelKey: 'file',
        deliveredAt,
        deliveryRef: filePath
      };
    }
  };

  return assertNotificationChannel(channel);
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

module.exports = {
  createFileNotificationChannel
};
