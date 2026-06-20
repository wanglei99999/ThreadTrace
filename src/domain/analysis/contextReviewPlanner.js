'use strict';

function planContextReviewTasks(input) {
  const safeInput = input || {};
  const matches = safeInput.contextChainMatches || [];
  const relatedEvidence = safeInput.relatedEvidence || [];
  const tasks = [];

  matches.slice(0, 4).forEach(function (match, matchRank) {
    appendMatchReviewTasks(tasks, match, relatedEvidence, matchRank);
  });

  if (tasks.length === 0 && relatedEvidence.length > 0) {
    tasks.push(task({
      taskType: 'historical_evidence_review',
      priority: 'low',
      title: '回看相关历史证据',
      question: '未形成明确承接链时，先确认召回楼层是否提供足够上下文。',
      targetEntity: undefined,
      relationType: undefined,
      reasons: ['evidence_only_context'],
      evidenceRefs: evidenceRefsFromRelatedEvidence(relatedEvidence.slice(0, 3))
    }));
  }

  return dedupeTasks(tasks).slice(0, 8);
}

function appendMatchReviewTasks(tasks, match, relatedEvidence, matchRank) {
  const chain = match.chain || {};
  const entity = chain.entity || {};
  const targetEntity = entity.displayName || chain.key;
  const reasons = match.reviewReasons || [];
  const base = {
    targetEntity,
    relationType: match.relationType,
    relationFamily: match.relationFamily,
    matchRank,
    evidenceRefs: evidenceRefsFromMatch(match, relatedEvidence)
  };

  if (reasons.includes('new_post_has_implicit_reference')) {
    tasks.push(task(Object.assign({}, base, {
      taskType: 'implicit_reference_resolution',
      priority: 'high',
      title: '核验隐晦指代对象',
      question: '确认新发言里的“前面说的/方向/后面”等表达是否确实指向“' + targetEntity + '”。',
      reasons: ['new_post_has_implicit_reference']
    })));
  }

  if (reasons.includes('chain_latest_attitude_unknown')) {
    tasks.push(task(Object.assign({}, base, {
      taskType: 'latest_attitude_confirmation',
      priority: 'high',
      title: '确认历史链最新市场态度',
      question: '历史链最新态度不足以直接判断新发言是在延续还是转向，需要回看最近证据楼层。',
      reasons: ['chain_latest_attitude_unknown']
    })));
  }

  if (reasons.includes('relation_uses_inference') || match.relationEvidenceLevel === 'mixed' || match.relationEvidenceLevel === 'inferred') {
    tasks.push(task(Object.assign({}, base, {
      taskType: 'inference_boundary_review',
      priority: reasons.includes('chain_inference_heavy') ? 'high' : 'medium',
      title: '标注推断边界',
      question: '区分哪些结论来自原文明确指认，哪些来自相邻楼层、同作者上下文或隐晦承接。',
      reasons: ['relation_uses_inference'].concat(reasons.includes('chain_inference_heavy') ? ['chain_inference_heavy'] : [])
    })));
  }

  if (match.relationType === 'explicit_entity_attitude_candidate') {
    tasks.push(task(Object.assign({}, base, {
      taskType: 'explicit_entity_candidate_review',
      priority: 'medium',
      title: '核验直接实体观点候选',
      question: '新发言直接点名“' + targetEntity + '”，但仍需确认历史链能否支撑当前态度解读。',
      reasons: ['explicit_entity_attitude_candidate']
    })));
  }
}

function task(input) {
  const evidenceRefs = (input.evidenceRefs || []).slice(0, 4);
  return {
    taskId: [
      input.taskType,
      normalizeKey(input.targetEntity || 'context'),
      normalizeKey(input.relationType || 'evidence')
    ].join(':'),
    taskType: input.taskType,
    priority: input.priority,
    title: input.title,
    question: input.question,
    targetEntity: input.targetEntity,
    relationType: input.relationType,
    relationFamily: input.relationFamily,
    matchRank: typeof input.matchRank === 'number' ? input.matchRank : 999,
    reasons: unique(input.reasons || []),
    evidenceRefs,
    evidenceFloors: unique(evidenceRefs.map(function (ref) {
      return ref.floor;
    }).filter(function (floor) {
      return floor !== undefined && floor !== null;
    })),
    status: 'open'
  };
}

function evidenceRefsFromMatch(match, relatedEvidence) {
  const refs = [];
  const chain = match.chain || {};
  (chain.evidenceRefs || []).forEach(function (ref) {
    refs.push({
      source: 'opinion-chain',
      type: ref.type,
      evidenceLevel: ref.evidenceLevel,
      floor: ref.floor,
      author: ref.author,
      authorId: ref.authorId,
      publishedAt: ref.publishedAt,
      excerpt: ref.excerpt
    });
  });
  evidenceRefsFromRelatedEvidence(relatedEvidence).forEach(function (ref) {
    refs.push(ref);
  });
  return dedupeEvidenceRefs(refs).slice(0, 6);
}

function evidenceRefsFromRelatedEvidence(items) {
  return (items || []).slice(0, 4).map(function (item) {
    return {
      source: 'related-evidence',
      floor: item.floor,
      author: item.author,
      authorId: item.authorId,
      publishedAt: item.publishedAt,
      confidence: item.confidence,
      excerpt: item.evidenceText
    };
  });
}

function dedupeTasks(tasks) {
  const seen = new Set();
  return tasks.filter(function (item) {
    if (seen.has(item.taskId)) return false;
    seen.add(item.taskId);
    return true;
  }).sort(compareTaskPriority);
}

function compareTaskPriority(a, b) {
  return priorityRank(a.priority) - priorityRank(b.priority)
    || a.matchRank - b.matchRank
    || taskTypeRank(a.taskType) - taskTypeRank(b.taskType)
    || a.taskId.localeCompare(b.taskId);
}

function priorityRank(priority) {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function taskTypeRank(taskType) {
  if (taskType === 'implicit_reference_resolution') return 0;
  if (taskType === 'latest_attitude_confirmation') return 1;
  if (taskType === 'inference_boundary_review') return 2;
  if (taskType === 'explicit_entity_candidate_review') return 3;
  return 4;
}

function dedupeEvidenceRefs(refs) {
  const seen = new Set();
  return refs.filter(function (ref) {
    const key = [ref.source, ref.floor, ref.type || '', ref.evidenceLevel || ''].join(':');
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

function normalizeKey(value) {
  return String(value || 'unknown').toLowerCase().replace(/\s+/g, '-').replace(/[:|]/g, '-');
}

module.exports = {
  planContextReviewTasks
};
