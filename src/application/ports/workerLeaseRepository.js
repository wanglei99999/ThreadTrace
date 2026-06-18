'use strict';

/**
 * Cross-process worker lease port. A lease coordinates background workers that
 * may run in several processes or hosts. PostgreSQL implementations should
 * acquire leases atomically; file implementations are intended for local
 * single-host deployments.
 *
 * @typedef {Object} WorkerLease
 * @property {string} leaseKey
 * @property {string} workerType
 * @property {string} ownerId
 * @property {string} acquiredAt
 * @property {string} updatedAt
 * @property {string} expiresAt
 */

/**
 * @typedef {Object} WorkerLeaseRepository
 * @property {(request: { leaseKey: string, workerType: string, ownerId: string, ttlMs?: number, now?: string }) => Promise<{ acquired: boolean, lease?: WorkerLease }>} acquireWorkerLease
 * @property {(request: { leaseKey: string, ownerId: string, ttlMs?: number, now?: string }) => Promise<{ renewed: boolean, lease?: WorkerLease }>} renewWorkerLease
 * @property {(request: { leaseKey: string, ownerId: string }) => Promise<{ released: boolean }>} releaseWorkerLease
 * @property {(query?: { workerType?: string, ownerId?: string, limit?: number }) => Promise<WorkerLease[]>} listWorkerLeases
 */

function assertWorkerLeaseRepository(repository) {
  if (!repository || typeof repository.acquireWorkerLease !== 'function') {
    throw new Error('WorkerLeaseRepository must implement acquireWorkerLease(request).');
  }
  if (typeof repository.renewWorkerLease !== 'function') {
    throw new Error('WorkerLeaseRepository must implement renewWorkerLease(request).');
  }
  if (typeof repository.releaseWorkerLease !== 'function') {
    throw new Error('WorkerLeaseRepository must implement releaseWorkerLease(request).');
  }
  if (typeof repository.listWorkerLeases !== 'function') {
    throw new Error('WorkerLeaseRepository must implement listWorkerLeases(query).');
  }
  return repository;
}

module.exports = {
  assertWorkerLeaseRepository
};
