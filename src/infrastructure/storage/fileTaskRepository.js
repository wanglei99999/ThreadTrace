'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertTaskRepository } = require('../../application/ports/taskRepository');

function createFileTaskRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'tasks'));

  const repository = {
    async saveTask(task) {
      const filePath = taskPath(baseDir, task.id);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(task, null, 2) + '\n', 'utf8');
    },

    async findTask(id) {
      try {
        const text = await fs.readFile(taskPath(baseDir, id), 'utf8');
        return JSON.parse(text);
      } catch (error) {
        if (error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async listTasks(query) {
      const safeQuery = query || {};
      const files = await listTaskFiles(baseDir);
      const tasks = [];

      for (const filePath of files) {
        const task = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (safeQuery.status && task.status !== safeQuery.status) continue;
        if (safeQuery.type && task.type !== safeQuery.type) continue;
        tasks.push(task);
      }

      return tasks
        .sort(function (a, b) {
          return String(b.createdAt).localeCompare(String(a.createdAt));
        })
        .slice(0, safeQuery.limit || tasks.length);
    }
  };

  return assertTaskRepository(repository);
}

function taskPath(baseDir, id) {
  return path.join(baseDir, safeSegment(id) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function listTaskFiles(baseDir) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries
      .filter(function (entry) {
        return entry.isFile() && /\.json$/i.test(entry.name);
      })
      .map(function (entry) {
        return path.join(baseDir, entry.name);
      });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

module.exports = {
  createFileTaskRepository
};
