'use strict';

/**
 * Repository port for forum/thread sources that ThreadTrace can ingest or
 * monitor.
 *
 * @typedef {Object} SourceRepository
 * @property {(source: Object) => Promise<void>} saveSource
 * @property {(id: string) => Promise<Object|undefined>} findSource
 * @property {(query?: { sourceKey?: string, enabled?: boolean, limit?: number }) => Promise<Object[]>} listSources
 * @property {(request: { sourceId: string, now?: string, staleAfterMs?: number }) => Promise<{ acquired: boolean, source?: Object, reason?: string }>=} acquireSourceRun
 */

function assertSourceRepository(repository) {
  if (!repository || typeof repository.saveSource !== 'function') {
    throw new Error('SourceRepository must implement saveSource(source).');
  }
  if (typeof repository.findSource !== 'function') {
    throw new Error('SourceRepository must implement findSource(id).');
  }
  if (typeof repository.listSources !== 'function') {
    throw new Error('SourceRepository must implement listSources(query).');
  }
  return repository;
}

module.exports = {
  assertSourceRepository
};
