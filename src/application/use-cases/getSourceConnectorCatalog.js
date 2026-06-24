'use strict';

function getSourceConnectorCatalog(options) {
  const safeOptions = options || {};
  const handlerRegistry = safeOptions.sourceIngestHandlerRegistry;
  const forumAdapterRegistry = safeOptions.forumAdapterRegistry;
  const handlers = handlerRegistry && typeof handlerRegistry.listHandlers === 'function'
    ? handlerRegistry.listHandlers()
    : [];
  const adapters = forumAdapterRegistry && typeof forumAdapterRegistry.list === 'function'
    ? forumAdapterRegistry.list()
    : [];

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    sourceTypes: handlers.map(function (handler) {
      const locationSchema = getLocationSchema(handler);
      const requiresAdapter = handler.requiresAdapter !== false;
      const compatibleSourceKeys = requiresAdapter
        ? adapters.map(function (adapter) { return adapter.sourceKey; })
        : [];
      return {
        sourceType: handler.sourceType,
        description: handler.description,
        requiresAdapter,
        locationSchema,
        capabilities: handler.capabilities || {},
        compatibleSourceKeys,
        onboardingRecipe: buildOnboardingRecipe({
          handler,
          locationSchema,
          requiresAdapter,
          compatibleSourceKeys
        })
      };
    }),
    adapters: adapters.map(function (adapter) {
      return {
        sourceKey: adapter.sourceKey,
        displayName: adapter.displayName,
        capabilities: adapter.capabilities || {}
      };
    })
  };
}

function getLocationSchema(handler) {
  return handler.locationSchema || {
    required: [],
    properties: {}
  };
}

function buildOnboardingRecipe(options) {
  const safeOptions = options || {};
  const handler = safeOptions.handler || {};
  const locationSchema = safeOptions.locationSchema || getLocationSchema(handler);
  const properties = locationSchema.properties || {};
  const requiredLocationFields = Array.isArray(locationSchema.required)
    ? locationSchema.required.slice()
    : [];
  const propertyNames = Object.keys(properties);
  const optionalLocationFields = propertyNames.filter(function (name) {
    return !requiredLocationFields.includes(name);
  });
  const sourceKeyPlaceholder = safeOptions.compatibleSourceKeys && safeOptions.compatibleSourceKeys[0] || '<source-key>';
  const sourceType = handler.sourceType;

  return {
    sourceType,
    requiresAdapter: safeOptions.requiresAdapter,
    requiredLocationFields,
    optionalLocationFields,
    compatibleSourceKeys: safeOptions.compatibleSourceKeys || [],
    adapterGuidance: buildAdapterGuidance(safeOptions.requiresAdapter, safeOptions.compatibleSourceKeys || []),
    recommendedFlow: buildRecommendedFlow(sourceType, sourceKeyPlaceholder),
    rolloutManifestTemplate: buildRolloutManifestTemplate({
      sourceType,
      sourceKey: sourceKeyPlaceholder,
      locationTemplate: buildLocationTemplate(properties, requiredLocationFields, optionalLocationFields)
    })
  };
}

function buildAdapterGuidance(requiresAdapter, compatibleSourceKeys) {
  if (!requiresAdapter) {
    return {
      required: false,
      summary: 'This source type consumes canonical ThreadTrace data and does not need a forum adapter.'
    };
  }
  return {
    required: true,
    compatibleSourceKeys: compatibleSourceKeys.slice(),
    summary: compatibleSourceKeys.length > 0
      ? 'Select one compatible sourceKey before preflight.'
      : 'Register a compatible forum adapter before this source type can run.'
  };
}

function buildRecommendedFlow(sourceType, sourceKeyPlaceholder) {
  const sourceArgs = '--forum ' + sourceKeyPlaceholder + ' --source-type ' + sourceType + ' --location-file <file>';
  return [
    {
      key: 'catalog',
      phase: 'discover',
      summary: 'Inspect registered source types, adapters, and onboarding recipes.',
      cli: 'node src/presentation/cli/threadtrace.js connector-catalog',
      api: 'GET /api/connectors/catalog'
    },
    {
      key: 'preflight',
      phase: 'validate',
      summary: 'Validate connector coverage, source draft fields, and optional module loading before registration.',
      cli: 'node src/presentation/cli/threadtrace.js source-onboarding-preflight ' + sourceArgs,
      api: 'POST /api/sources/onboarding/preflight'
    },
    {
      key: 'dry-run',
      phase: 'simulate',
      summary: 'Run the ingest handler against isolated repositories before scheduling the source.',
      cli: 'node src/presentation/cli/threadtrace.js source-ingest-dry-run ' + sourceArgs,
      api: 'POST /api/sources/ingest/dry-run'
    },
    {
      key: 'rollout-plan',
      phase: 'plan',
      summary: 'Evaluate rollout manifest, resources, deployment gate, and worker topology.',
      cli: 'node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file <file>',
      api: 'POST /api/operations/rollout-manifest-plan'
    },
    {
      key: 'apply',
      phase: 'release',
      summary: 'Apply the approved manifest after dry-run and deployment gates are acceptable.',
      cli: 'node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file <file> --execute true',
      api: 'POST /api/operations/rollout-manifest/apply'
    }
  ];
}

function buildRolloutManifestTemplate(options) {
  const safeOptions = options || {};
  return {
    version: '1.0',
    name: safeOptions.sourceKey + '-' + safeOptions.sourceType + '-rollout',
    source: {
      sourceKey: safeOptions.sourceKey,
      sourceType: safeOptions.sourceType,
      displayName: '<display-name>',
      location: safeOptions.locationTemplate || {}
    },
    ingest: {
      dryRun: true
    },
    workers: {
      topology: 'operations-worker',
      sourceTaskMode: 'ingest'
    }
  };
}

function buildLocationTemplate(properties, requiredLocationFields, optionalLocationFields) {
  return requiredLocationFields.concat(optionalLocationFields).reduce(function (result, field) {
    result[field] = placeholderForLocationField(field, properties[field] || {});
    return result;
  }, {});
}

function placeholderForLocationField(field, property) {
  if (field === 'inputDir') return 'D:/path/to/saved-html-directory';
  if (field === 'inputFile') return 'D:/path/to/thread-snapshot.json';
  if (field === 'url' || property.format === 'uri') return 'https://example.test/thread';
  if (property.format === 'path') return 'D:/path/to/' + field;
  return '<' + field + '>';
}

module.exports = {
  getSourceConnectorCatalog
};
