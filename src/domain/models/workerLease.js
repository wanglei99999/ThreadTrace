'use strict';

function createWorkerLease(options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  return {
    leaseKey: safeOptions.leaseKey,
    workerType: safeOptions.workerType,
    ownerId: safeOptions.ownerId,
    acquiredAt: safeOptions.acquiredAt || now,
    updatedAt: now,
    expiresAt: safeOptions.expiresAt || expiresAt(now, safeOptions.ttlMs)
  };
}

function renewWorkerLease(lease, options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  return Object.assign({}, lease, {
    updatedAt: now,
    expiresAt: expiresAt(now, safeOptions.ttlMs)
  });
}

function isWorkerLeaseExpired(lease, now) {
  if (!lease || !lease.expiresAt) return true;
  const expiresTime = Date.parse(lease.expiresAt);
  const nowTime = Date.parse(now || new Date().toISOString());
  if (Number.isNaN(expiresTime) || Number.isNaN(nowTime)) return true;
  return expiresTime <= nowTime;
}

function expiresAt(now, ttlMs) {
  const nowTime = Date.parse(now);
  const ttl = ttlMs || 5 * 60 * 1000;
  return new Date((Number.isNaN(nowTime) ? Date.now() : nowTime) + ttl).toISOString();
}

module.exports = {
  createWorkerLease,
  renewWorkerLease,
  isWorkerLeaseExpired
};
