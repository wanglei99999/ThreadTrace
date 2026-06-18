'use strict';

const os = require('os');

function createWorkerLeaseGuard(options) {
  const safeOptions = options || {};
  const repository = safeOptions.workerLeaseRepository;
  const logger = safeOptions.logger || console;
  const workerType = safeOptions.workerType;
  const ownerId = safeOptions.workerId || defaultWorkerId(workerType);
  const leaseKey = safeOptions.leaseKey || 'worker:' + workerType;
  const ttlMs = safeOptions.leaseTtlMs || 5 * 60 * 1000;

  async function acquire() {
    if (!repository) {
      return {
        acquired: true,
        disabled: true,
        leaseKey,
        ownerId
      };
    }
    try {
      const result = await repository.acquireWorkerLease({
        leaseKey,
        workerType,
        ownerId,
        ttlMs
      });
      return Object.assign({
        leaseKey,
        ownerId
      }, result);
    } catch (error) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[worker] worker lease acquire failed: ' + (error && error.message ? error.message : error));
      }
      throw error;
    }
  }

  async function renew() {
    if (!repository) return { renewed: true, disabled: true };
    return repository.renewWorkerLease({
      leaseKey,
      ownerId,
      ttlMs
    });
  }

  async function release() {
    if (!repository) return { released: true, disabled: true };
    try {
      return await repository.releaseWorkerLease({
        leaseKey,
        ownerId
      });
    } catch (error) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[worker] worker lease release failed: ' + (error && error.message ? error.message : error));
      }
      return { released: false, error };
    }
  }

  return {
    acquire,
    renew,
    release,
    leaseKey,
    ownerId
  };
}

function defaultWorkerId(workerType) {
  return [workerType || 'worker', os.hostname(), process.pid].join(':');
}

module.exports = {
  createWorkerLeaseGuard
};
