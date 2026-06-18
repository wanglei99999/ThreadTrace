'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertSourceRepository } = require('../ports/sourceRepository');
const {
  DEFAULT_SOURCE_RUN_STALE_AFTER_MS,
  isTrackedSourceRunStale
} = require('../../domain/models/trackedSource');

async function setTrackedSourceEnabled(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const sourceId = safeOptions.sourceId;
  if (!sourceId) {
    throw createApplicationError('source_id_required', 'Source lifecycle update requires sourceId.', {
      statusCode: 400
    });
  }
  if (typeof safeOptions.enabled !== 'boolean') {
    throw createApplicationError('source_enabled_required', 'Source lifecycle update requires enabled.', {
      statusCode: 400
    });
  }
  const source = await sourceRepository.findSource(sourceId);
  if (!source) {
    throw createApplicationError('source_not_found', 'Unknown tracked source: ' + sourceId, {
      statusCode: 404,
      details: {
        sourceId
      }
    });
  }

  const execute = safeOptions.execute === true;
  const dryRun = !execute;
  const guard = buildDisableGuard(source, safeOptions);
  if (guard.blocked) {
    throw createApplicationError('source_disable_running', 'Tracked source is currently running: ' + sourceId, {
      statusCode: 409,
      details: {
        sourceId,
        runStatus: guard.runStatus,
        lastStartedAt: guard.lastStartedAt,
        staleAfterMs: guard.staleAfterMs,
        forced: guard.forced
      }
    });
  }
  const updatedSource = Object.assign({}, source, {
    enabled: safeOptions.enabled,
    updatedAt: safeOptions.now || new Date().toISOString()
  });
  const changed = (source.enabled !== false) !== safeOptions.enabled;
  if (execute && changed) {
    await sourceRepository.saveSource(updatedSource);
  }

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: 'ok',
    dryRun,
    executed: execute,
    changed,
    guard,
    sourceBefore: sourceSummary(source),
    sourceAfter: sourceSummary(updatedSource)
  };
}

function buildDisableGuard(source, options) {
  const safeOptions = options || {};
  const targetEnabled = safeOptions.enabled === true;
  const runState = (source && source.runState) || {};
  const staleAfterMs = resolveSourceRunStaleAfterMs(safeOptions);
  const running = targetEnabled === false && runState.status === 'running';
  const stale = running ? isTrackedSourceRunStale(runState, {
    now: safeOptions.now,
    staleAfterMs
  }) : false;
  const forced = safeOptions.force === true;

  return {
    running,
    stale,
    forced,
    blocked: running && !stale && !forced,
    runStatus: runState.status,
    lastStartedAt: runState.lastStartedAt,
    staleAfterMs
  };
}

function resolveSourceRunStaleAfterMs(options) {
  const safeOptions = options || {};
  const configured = safeOptions.sourceRunStaleAfterMs === undefined
    ? safeOptions.staleAfterMs
    : safeOptions.sourceRunStaleAfterMs;
  if (configured === undefined) return DEFAULT_SOURCE_RUN_STALE_AFTER_MS;
  const parsed = Number(configured);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SOURCE_RUN_STALE_AFTER_MS;
}

function sourceSummary(source) {
  if (!source) return undefined;
  return {
    id: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName,
    enabled: source.enabled !== false,
    updatedAt: source.updatedAt
  };
}

module.exports = {
  setTrackedSourceEnabled,
  buildDisableGuard,
  resolveSourceRunStaleAfterMs,
  sourceSummary
};
