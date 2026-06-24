'use strict';

/**
 * Durable worker run records. Background workers write one record per run so
 * operations views can detect active, stale, failed, and recently successful
 * processes across file and PostgreSQL deployments.
 *
 * @typedef {Object} WorkerRunRecord
 * @property {string} id
 * @property {string} workerType
 * @property {string} workerId
 * @property {'running'|'completed'|'failed'|'skipped'} status
 * @property {{ sourceId?: string, sourceKey?: string }=} scope
 * @property {Object=} input
 * @property {Object=} progress
 * @property {Object=} output
 * @property {{ code?: string, message: string, stack?: string, details?: Object }=} error
 * @property {string} startedAt
 * @property {string} updatedAt
 * @property {string} heartbeatAt
 * @property {string=} finishedAt
 */

/**
 * @typedef {Object} WorkerRunRepository
 * @property {(run: WorkerRunRecord) => Promise<void>} saveWorkerRun
 * @property {(id: string) => Promise<WorkerRunRecord | undefined>} findWorkerRun
 * @property {(query?: { workerType?: string, status?: string, sourceId?: string, sourceKey?: string, limit?: number }) => Promise<WorkerRunRecord[]>} listWorkerRuns
 */

function assertWorkerRunRepository(repository) {
  if (!repository || typeof repository.saveWorkerRun !== 'function') {
    throw new Error('WorkerRunRepository must implement saveWorkerRun(run).');
  }
  if (typeof repository.findWorkerRun !== 'function') {
    throw new Error('WorkerRunRepository must implement findWorkerRun(id).');
  }
  if (typeof repository.listWorkerRuns !== 'function') {
    throw new Error('WorkerRunRepository must implement listWorkerRuns(query).');
  }
  return repository;
}

module.exports = {
  assertWorkerRunRepository
};
