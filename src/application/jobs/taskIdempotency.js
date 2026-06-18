'use strict';

async function findReusableCompletedTask(taskRepository, task) {
  const idempotencyKey = taskTraceValue(task, 'idempotencyKey');
  if (!idempotencyKey) return undefined;

  const tasks = await taskRepository.listTasks({
    type: task.type,
    idempotencyKey
  });
  const expectedInput = stripTrace(task.input);

  return tasks.find(function (candidate) {
    return candidate.status === 'completed' &&
      candidate.type === task.type &&
      stableJson(stripTrace(candidate.input)) === stableJson(expectedInput);
  });
}

function buildIdempotentReplay(task) {
  return {
    reused: true,
    taskId: task.id,
    idempotencyKey: taskTraceValue(task, 'idempotencyKey')
  };
}

function stripTrace(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const result = {};
  Object.keys(input).forEach(function (key) {
    if (key !== '_trace') result[key] = input[key];
  });
  return result;
}

function stableJson(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const sorted = {};
  Object.keys(value).sort().forEach(function (key) {
    sorted[key] = sortObject(value[key]);
  });
  return sorted;
}

function taskTraceValue(task, key) {
  return task && task.input && task.input._trace
    ? task.input._trace[key]
    : undefined;
}

module.exports = {
  findReusableCompletedTask,
  buildIdempotentReplay,
  stripTrace,
  stableJson
};
