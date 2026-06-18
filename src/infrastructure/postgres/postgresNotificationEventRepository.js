'use strict';

const { assertNotificationEventRepository } = require('../../application/ports/notificationEventRepository');
const { assertPostgresClient } = require('./postgresConnection');
const { optionalJson, pushLimit, toIso } = require('./postgresRows');

function createPostgresNotificationEventRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async saveEvent(event) {
      await client.query(
        [
          'insert into notification_events (',
          'id, type, severity, source_id, source_key, task_id, title, summary, payload, delivery_status, delivery_attempts, delivery_result,',
          'last_delivery_error, last_delivery_attempt_at, last_delivered_at, next_delivery_at, acknowledged_at, acknowledged_by, acknowledgement_note, created_at',
          ') values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)',
          'on conflict (id) do update set',
          'type = excluded.type,',
          'severity = excluded.severity,',
          'source_id = excluded.source_id,',
          'source_key = excluded.source_key,',
          'task_id = excluded.task_id,',
          'title = excluded.title,',
          'summary = excluded.summary,',
          'payload = excluded.payload,',
          'delivery_status = excluded.delivery_status,',
          'delivery_attempts = excluded.delivery_attempts,',
          'delivery_result = excluded.delivery_result,',
          'last_delivery_error = excluded.last_delivery_error,',
          'last_delivery_attempt_at = excluded.last_delivery_attempt_at,',
          'last_delivered_at = excluded.last_delivered_at,',
          'next_delivery_at = excluded.next_delivery_at,',
          'acknowledged_at = excluded.acknowledged_at,',
          'acknowledged_by = excluded.acknowledged_by,',
          'acknowledgement_note = excluded.acknowledgement_note'
        ].join(' '),
        [
          event.id,
          event.type,
          event.severity || 'info',
          event.sourceId || null,
          event.sourceKey || null,
          event.taskId || null,
          event.title || null,
          event.summary,
          event.payload || {},
          event.deliveryStatus || 'pending',
          event.deliveryAttempts || 0,
          event.deliveryResult || null,
          event.lastDeliveryError || null,
          event.lastDeliveryAttemptAt || null,
          event.lastDeliveredAt || null,
          event.nextDeliveryAt || null,
          event.acknowledgedAt || null,
          event.acknowledgedBy || null,
          event.acknowledgementNote || null,
          event.createdAt
        ]
      );
    },

    async findEvent(id) {
      const result = await client.query('select * from notification_events where id = $1', [id]);
      return result.rows[0] ? rowToEvent(result.rows[0]) : undefined;
    },

    async listEvents(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.type) {
        params.push(safeQuery.type);
        where.push('type = $' + params.length);
      }
      if (safeQuery.sourceId) {
        params.push(safeQuery.sourceId);
        where.push('source_id = $' + params.length);
      }
      if (typeof safeQuery.acknowledged === 'boolean') {
        where.push(safeQuery.acknowledged ? 'acknowledged_at is not null' : 'acknowledged_at is null');
      }
      if (safeQuery.deliveryStatus) {
        params.push(safeQuery.deliveryStatus);
        where.push('delivery_status = $' + params.length);
      }
      if (safeQuery.dueBefore) {
        params.push(safeQuery.dueBefore);
        where.push('(next_delivery_at is null or next_delivery_at <= $' + params.length + ')');
      }
      const sql = 'select * from notification_events' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by created_at desc' +
        pushLimit(params, safeQuery.limit);
      const result = await client.query(sql, params);
      return result.rows.map(rowToEvent);
    }
  };

  return assertNotificationEventRepository(repository);
}

function rowToEvent(row) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    sourceId: row.source_id,
    sourceKey: row.source_key,
    taskId: row.task_id,
    createdAt: toIso(row.created_at),
    title: row.title,
    summary: row.summary,
    payload: optionalJson(row.payload, {}),
    deliveryStatus: row.delivery_status || 'pending',
    deliveryAttempts: row.delivery_attempts || 0,
    deliveryResult: optionalJson(row.delivery_result, undefined),
    lastDeliveryError: optionalJson(row.last_delivery_error, undefined),
    lastDeliveryAttemptAt: toIso(row.last_delivery_attempt_at),
    lastDeliveredAt: toIso(row.last_delivered_at),
    nextDeliveryAt: toIso(row.next_delivery_at),
    acknowledgedAt: toIso(row.acknowledged_at),
    acknowledgedBy: row.acknowledged_by || undefined,
    acknowledgementNote: row.acknowledgement_note || undefined
  };
}

module.exports = {
  createPostgresNotificationEventRepository,
  rowToEvent
};
