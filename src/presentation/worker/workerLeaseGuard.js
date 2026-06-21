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
    let result;
    try {
      result = await repository.renewWorkerLease({
        leaseKey,
        ownerId,
        ttlMs
      });
    } catch (error) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[worker] worker lease renew failed: ' + (error && error.message ? error.message : error));
      }
      throw error;
    }
    if (result && result.renewed) return Object.assign({ leaseKey, ownerId }, result);
    const error = createWorkerLeaseLostError({
      leaseKey,
      ownerId,
      lease: result && result.lease
    });
    if (logger && typeof logger.warn === 'function') {
      logger.warn('[worker] worker lease lost: ' + error.message);
    }
    throw error;
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

function createWorkerLeaseLostError(details) {
  const safeDetails = details || {};
  const lease = safeDetails.lease;
  const owner = lease && lease.ownerId ? lease.ownerId : 'none';
  const error = new Error('Worker lease lost for ' + safeDetails.leaseKey + '; current owner is ' + owner + '.');
  error.code = 'worker_lease_lost';
  error.details = {
    leaseKey: safeDetails.leaseKey,
    ownerId: safeDetails.ownerId,
    currentOwnerId: lease && lease.ownerId,
    expiresAt: lease && lease.expiresAt
  };
  return error;
}

function defaultWorkerId(workerType) {
  return [workerType || 'worker', os.hostname(), process.pid].join(':');
}

module.exports = {
  createWorkerLeaseLostError,
  createWorkerLeaseGuard
};
