'use strict';

/**
 * Storage port for canonical thread snapshots.
 *
 * Infrastructure implementations may use PostgreSQL, SQLite, files, or object
 * storage, but application use cases should depend on this shape only.
 *
 * @typedef {Object} ThreadRepository
 * @property {(snapshot: import('../../domain/models/threadSnapshot').ThreadSnapshot) => Promise<void>} saveSnapshot
 * @property {(query: { sourceKey: string, sourceThreadId: string }) => Promise<import('../../domain/models/threadSnapshot').ThreadSnapshot | undefined>} findSnapshot
 * @property {(query: { sourceKey?: string, authorId?: string, limit?: number }) => Promise<import('../../domain/models/threadSnapshot').ThreadSnapshot[]>} listSnapshots
 */

function assertThreadRepository(repository) {
  if (!repository || typeof repository.saveSnapshot !== 'function') {
    throw new Error('ThreadRepository must implement saveSnapshot(snapshot).');
  }
  if (typeof repository.findSnapshot !== 'function') {
    throw new Error('ThreadRepository must implement findSnapshot(query).');
  }
  if (typeof repository.listSnapshots !== 'function') {
    throw new Error('ThreadRepository must implement listSnapshots(query).');
  }
  return repository;
}

module.exports = {
  assertThreadRepository
};
