'use strict';

/**
 * Task storage port. The first implementation is file-based; production can
 * later switch to PostgreSQL, Redis, or a queue-backed scheduler.
 *
 * @typedef {Object} TaskRecord
 * @property {string} id
 * @property {string} type
 * @property {'queued'|'running'|'completed'|'failed'} status
 * @property {Object} input
 * @property {Object=} output
 * @property {{ message: string, stack?: string }=} error
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string=} startedAt
 * @property {string=} finishedAt
 */

/**
 * @typedef {Object} TaskRepository
 * @property {(task: TaskRecord) => Promise<void>} saveTask
 * @property {(id: string) => Promise<TaskRecord | undefined>} findTask
 * @property {(query?: { status?: string, type?: string, limit?: number }) => Promise<TaskRecord[]>} listTasks
 */

function assertTaskRepository(repository) {
  if (!repository || typeof repository.saveTask !== 'function') {
    throw new Error('TaskRepository must implement saveTask(task).');
  }
  if (typeof repository.findTask !== 'function') {
    throw new Error('TaskRepository must implement findTask(id).');
  }
  if (typeof repository.listTasks !== 'function') {
    throw new Error('TaskRepository must implement listTasks(query).');
  }
  return repository;
}

module.exports = {
  assertTaskRepository
};
