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

function parseWorkerLeaseKey(leaseKey) {
  const text = String(leaseKey || '').trim();
  const parts = text.split(':');
  if (parts[0] !== 'worker' || !parts[1]) {
    return {
      leaseKey: text,
      workerType: undefined,
      scope: {},
      scoped: false
    };
  }
  const scope = {};
  if (parts[2] === 'source-id' && parts[3]) {
    scope.sourceId = parts.slice(3).join(':');
  } else if (parts[2] === 'source-key' && parts[3]) {
    scope.sourceKey = parts.slice(3).join(':');
  }
  return {
    leaseKey: text,
    workerType: parts[1],
    scope,
    scoped: Boolean(scope.sourceId || scope.sourceKey)
  };
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
  parseWorkerLeaseKey,
  normalizeLeaseSegment,
  normalizeWorkerType
};
