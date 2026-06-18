'use strict';

/**
 * Raw forum page evidence storage. These records preserve crawler output before
 * parser or analysis logic transforms it.
 *
 * @typedef {Object} RawThreadPageRepository
 * @property {(page: Object) => Promise<void>} saveRawThreadPage
 * @property {(query: { sourceKey: string, contentSha1: string }) => Promise<Object|undefined>} findRawThreadPageByHash
 * @property {(query?: { sourceKey?: string, sourceThreadId?: string, sourceUrl?: string, limit?: number }) => Promise<Object[]>} listRawThreadPages
 */

function assertRawThreadPageRepository(repository) {
  if (!repository || typeof repository.saveRawThreadPage !== 'function') {
    throw new Error('RawThreadPageRepository must implement saveRawThreadPage(page).');
  }
  if (typeof repository.findRawThreadPageByHash !== 'function') {
    throw new Error('RawThreadPageRepository must implement findRawThreadPageByHash(query).');
  }
  if (typeof repository.listRawThreadPages !== 'function') {
    throw new Error('RawThreadPageRepository must implement listRawThreadPages(query).');
  }
  return repository;
}

module.exports = {
  assertRawThreadPageRepository
};
