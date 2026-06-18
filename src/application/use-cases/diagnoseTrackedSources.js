'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');

async function diagnoseTrackedSources(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const handlerRegistry = safeOptions.sourceIngestHandlerRegistry;
  const getAdapter = safeOptions.getAdapter;
  const sources = await sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey,
    enabled: safeOptions.enabled,
    limit: safeOptions.limit || 100
  });
  const sourceDiagnostics = sources.map(function (source) {
    return diagnoseSource(source, {
      handlerRegistry,
      getAdapter
    });
  });

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateStatus(sourceDiagnostics.map(function (item) { return item.status; })),
    sourceCount: sourceDiagnostics.length,
    sources: sourceDiagnostics
  };
}

function diagnoseSource(source, context) {
  const handler = findHandler(context.handlerRegistry, source);
  const checks = [
    check('source.enabled', source.enabled === false ? 'warn' : 'ok', source.enabled !== false, 'Tracked source is enabled.'),
    check('source.location', hasUsableLocation(source, handler) ? 'ok' : 'fail', locationValue(source, handler), 'Tracked source has a usable location.'),
    check('source.handler', handler ? 'ok' : 'fail', source.sourceType || 'missing', 'Tracked source type has an ingest handler.')
  ];

  if (handler && handler.requiresAdapter !== false) {
    checks.push(resolveAdapterCheck(context.getAdapter, source));
  }

  return {
    sourceId: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName,
    enabled: source.enabled !== false,
    status: aggregateStatus(checks.map(function (item) { return item.status; })),
    checks
  };
}

function findHandler(handlerRegistry, source) {
  if (!handlerRegistry || typeof handlerRegistry.findHandler !== 'function') return undefined;
  return handlerRegistry.findHandler(source);
}

function resolveAdapterCheck(getAdapter, source) {
  if (typeof getAdapter !== 'function') {
    return check('source.adapter', 'fail', source.sourceKey || 'missing', 'Adapter resolver is not configured.');
  }
  try {
    const adapter = getAdapter(source.sourceKey);
    return check('source.adapter', adapter ? 'ok' : 'fail', source.sourceKey || 'missing', 'Forum adapter is registered.');
  } catch (error) {
    return check('source.adapter', 'fail', error && error.message ? error.message : String(error), 'Forum adapter is registered.');
  }
}

function hasUsableLocation(source, handler) {
  const location = source.location || {};
  const required = locationRequiredFields(handler);
  if (required.length > 0) {
    return required.every(function (field) {
      return location[field] !== undefined && location[field] !== null && location[field] !== '';
    });
  }
  return Object.keys(location).length > 0;
}

function locationValue(source, handler) {
  const location = source.location || {};
  const required = locationRequiredFields(handler);
  const missing = required.filter(function (field) {
    return location[field] === undefined || location[field] === null || location[field] === '';
  });
  if (missing.length > 0) return 'missing: ' + missing.join(',');
  return location.inputDir || location.url || JSON.stringify(location);
}

function locationRequiredFields(handler) {
  const schema = handler && handler.locationSchema;
  return schema && Array.isArray(schema.required) ? schema.required : [];
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  diagnoseTrackedSources
};
