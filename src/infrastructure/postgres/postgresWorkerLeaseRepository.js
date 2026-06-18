'use strict';

const { assertWorkerLeaseRepository } = require('../../application/ports/workerLeaseRepository');
const { assertPostgresClient } = require('./postgresConnection');
const { pushLimit, toIso } = require('./postgresRows');

function createPostgresWorkerLeaseRepository(options) {
  const client = assertPostgresClient(options && options.client);

  const repository = {
    async acquireWorkerLease(request) {
      const safeRequest = request || {};
      const now = safeRequest.now || new Date().toISOString();
      const expiresAt = nextExpiresAt(now, safeRequest.ttlMs);
      const result = await client.query(
        [
          'insert into worker_leases (lease_key, worker_type, owner_id, acquired_at, updated_at, expires_at)',
          'values ($1,$2,$3,$4,$4,$5)',
          'on conflict (lease_key) do update set',
          'worker_type = excluded.worker_type,',
          'owner_id = excluded.owner_id,',
          'acquired_at = case when worker_leases.owner_id = $3 then worker_leases.acquired_at else excluded.acquired_at end,',
          'updated_at = excluded.updated_at,',
          'expires_at = excluded.expires_at',
          'where worker_leases.owner_id = $3 or worker_leases.expires_at <= $4',
          'returning *'
        ].join(' '),
        [
          safeRequest.leaseKey,
          safeRequest.workerType,
          safeRequest.ownerId,
          now,
          expiresAt
        ]
      );
      if (result.rows[0]) {
        return { acquired: true, lease: rowToWorkerLease(result.rows[0]) };
      }
      const existing = await findLease(client, safeRequest.leaseKey);
      return { acquired: false, lease: existing };
    },

    async renewWorkerLease(request) {
      const safeRequest = request || {};
      const now = safeRequest.now || new Date().toISOString();
      const expiresAt = nextExpiresAt(now, safeRequest.ttlMs);
      const result = await client.query(
        [
          'update worker_leases set updated_at = $3, expires_at = $4',
          'where lease_key = $1 and owner_id = $2',
          'returning *'
        ].join(' '),
        [safeRequest.leaseKey, safeRequest.ownerId, now, expiresAt]
      );
      if (result.rows[0]) {
        return { renewed: true, lease: rowToWorkerLease(result.rows[0]) };
      }
      const existing = await findLease(client, safeRequest.leaseKey);
      return { renewed: false, lease: existing };
    },

    async releaseWorkerLease(request) {
      const safeRequest = request || {};
      const result = await client.query(
        'delete from worker_leases where lease_key = $1 and owner_id = $2 returning lease_key',
        [safeRequest.leaseKey, safeRequest.ownerId]
      );
      return { released: result.rows.length > 0 };
    },

    async listWorkerLeases(query) {
      const safeQuery = query || {};
      const params = [];
      const where = [];
      if (safeQuery.workerType) {
        params.push(safeQuery.workerType);
        where.push('worker_type = $' + params.length);
      }
      if (safeQuery.ownerId) {
        params.push(safeQuery.ownerId);
        where.push('owner_id = $' + params.length);
      }
      const sql = 'select * from worker_leases' +
        (where.length ? ' where ' + where.join(' and ') : '') +
        ' order by updated_at desc' +
        pushLimit(params, safeQuery.limit);
      const result = await client.query(sql, params);
      return result.rows.map(rowToWorkerLease);
    }
  };

  return assertWorkerLeaseRepository(repository);
}

async function findLease(client, leaseKey) {
  const result = await client.query('select * from worker_leases where lease_key = $1', [leaseKey]);
  return result.rows[0] ? rowToWorkerLease(result.rows[0]) : undefined;
}

function rowToWorkerLease(row) {
  return {
    leaseKey: row.lease_key,
    workerType: row.worker_type,
    ownerId: row.owner_id,
    acquiredAt: toIso(row.acquired_at),
    updatedAt: toIso(row.updated_at),
    expiresAt: toIso(row.expires_at)
  };
}

function nextExpiresAt(now, ttlMs) {
  const nowTime = Date.parse(now);
  const ttl = ttlMs || 5 * 60 * 1000;
  return new Date((Number.isNaN(nowTime) ? Date.now() : nowTime) + ttl).toISOString();
}

module.exports = {
  createPostgresWorkerLeaseRepository,
  rowToWorkerLease
};
