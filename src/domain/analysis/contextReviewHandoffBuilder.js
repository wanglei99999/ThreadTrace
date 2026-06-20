'use strict';

const HANDOFF_VERSION = '1.0.0';

function buildContextReviewHandoff(input) {
  const safeInput = input || {};
  const tasks = safeInput.contextReviewTasks || [];
  const relatedEvidence = safeInput.relatedEvidence || [];
  const highPriorityTasks = tasks.filter(function (task) {
    return task.priority === 'high';
  });
  const evidencePackage = buildEvidencePackage(tasks, relatedEvidence);
  const status = handoffStatus(tasks, highPriorityTasks);

  return {
    version: HANDOFF_VERSION,
    status,
    taskCount: tasks.length,
    highPriorityTaskCount: highPriorityTasks.length,
    recommendedNextAction: recommendedNextAction({
      status,
      highPriorityTasks,
      tasks,
      evidencePackage
    }),
    downstreamHooks: [
      'manual-review',
      'llm-review',
      'evidence-persistence',
      'notification'
    ],
    evidencePackage,
    openTasks: tasks.slice(0, 8).map(compactTask)
  };
}

function handoffStatus(tasks, highPriorityTasks) {
  if (tasks.length === 0) return 'no-action';
  if (highPriorityTasks.length > 0) return 'action-required';
  return 'ready-for-review';
}

function recommendedNextAction(input) {
  if (input.status === 'no-action') {
    return '暂无核验任务，可直接阅读解读摘要和相关证据。';
  }
  const topTask = input.highPriorityTasks[0] || input.tasks[0];
  const floors = topTask && topTask.evidenceFloors && topTask.evidenceFloors.length > 0
    ? '，优先回看楼层 #' + topTask.evidenceFloors.join(' / #')
    : '';
  return '先处理“' + topTask.title + '”' + floors + '。';
}

function buildEvidencePackage(tasks, relatedEvidence) {
  const refs = [];
  tasks.forEach(function (task) {
    (task.evidenceRefs || []).forEach(function (ref) {
      refs.push(Object.assign({ taskId: task.taskId }, ref));
    });
  });
  relatedEvidence.slice(0, 6).forEach(function (item) {
    refs.push({
      source: 'related-evidence',
      floor: item.floor,
      author: item.author,
      authorId: item.authorId,
      publishedAt: item.publishedAt,
      confidence: item.confidence,
      excerpt: item.evidenceText
    });
  });

  const dedupedRefs = dedupeEvidenceRefs(refs).slice(0, 12);
  return {
    evidenceRefCount: dedupedRefs.length,
    floors: unique(dedupedRefs.map(function (ref) {
      return ref.floor;
    }).filter(function (floor) {
      return floor !== undefined && floor !== null;
    })).sort(function (a, b) {
      return a - b;
    }),
    refs: dedupedRefs
  };
}

function compactTask(task) {
  return {
    taskId: task.taskId,
    taskType: task.taskType,
    priority: task.priority,
    title: task.title,
    targetEntity: task.targetEntity,
    relationType: task.relationType,
    reasons: task.reasons || [],
    evidenceFloors: task.evidenceFloors || [],
    status: task.status
  };
}

function dedupeEvidenceRefs(refs) {
  const seen = new Set();
  return refs.filter(function (ref) {
    const key = [
      ref.source || 'unknown',
      ref.floor === undefined ? '' : ref.floor,
      ref.type || '',
      ref.evidenceLevel || '',
      ref.taskId || ''
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values) {
  return values.filter(function (value, index) {
    return values.indexOf(value) === index;
  });
}

module.exports = {
  buildContextReviewHandoff
};
