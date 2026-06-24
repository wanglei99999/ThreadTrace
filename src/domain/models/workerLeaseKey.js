'use strict';

function buildWorkerLeaseKey(workerType, scope) {
  const type = normalizeWorkerType(workerType);
  const safeScope = scope || {};
  const sourceId = normalizeLeaseSegment(safeScope.sourceId);
  if (sourceId) return ['worker', type, 'source-id', sourceId].join(':');
  const sourceKey = normalizeLeaseSegment(safeScope.sourceKey || safeScope.forum);
  if (sourceKey) return ['worker', type, 'source-key', sourceKey].join(':');
  return ['worker', type].join(':');
}

function normalizeWorkerType(value) {
  return normalizeLeaseSegment(value) || 'worker';
}

function normalizeLeaseSegment(value) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  return text.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || undefined;
}

module.exports = {
  buildWorkerLeaseKey,
  normalizeLeaseSegment,
  normalizeWorkerType
};
