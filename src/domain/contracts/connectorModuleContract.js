'use strict';

function getConnectorModuleContract() {
  return {
    version: '1.0.0',
    name: 'ThreadTrace Connector Module',
    description: 'External module contract for registering forum adapters and source ingest handlers at runtime.',
    moduleFormats: [
      'CommonJS module exporting an object',
      'CommonJS module exporting a function(context)',
      'ESM transpiled default export loaded through CommonJS interop'
    ],
    exports: {
      objectShape: {
        optional: ['register', 'forumAdapters', 'adapters', 'forumAdapter', 'sourceIngestHandlers', 'handlers', 'sourceIngestHandler']
      },
      registerFunction: {
        signature: 'register(context) -> void',
        contextRef: '#/context'
      },
      functionExport: {
        signature: 'module.exports = function(context) -> connectorModuleObject'
      }
    },
    context: {
      modulePath: 'Absolute path of the loaded connector module.',
      runtimeConfig: 'Normalized ThreadTrace runtime configuration.',
      registerForumAdapter: 'registerForumAdapter(adapter) -> adapter',
      registerSourceIngestHandler: 'registerSourceIngestHandler(handler) -> handler'
    },
    sdk: {
      module: 'src/connectors/connectorSdk',
      helpers: [
        'defineConnectorModule(options)',
        'defineSourceIngestHandler(options)',
        'defineNormalizedThreadJsonHandler(options)',
        'defineForumAdapter(options)',
        'defineLocationSchema(options)'
      ],
      description: 'Optional authoring helpers that validate and normalize connector modules before runtime registration.'
    },
    forumAdapter: {
      required: ['sourceKey', 'displayName', 'parseSavedHtml'],
      optional: ['capabilities', 'fetchThread'],
      notes: [
        'parseSavedHtml(html, context) must return a canonical ThreadSnapshot.',
        'sourceKey should be stable because it is stored on tracked sources and snapshots.'
      ]
    },
    sourceIngestHandler: {
      required: ['sourceType', 'description', 'locationSchema', 'run'],
      optional: ['requiresAdapter', 'capabilities'],
      notes: [
        'sourceType should be stable because it is stored on tracked sources.',
        'requiresAdapter=false is recommended for API-native, queue-native, or already-normalized sources.',
        'run(context) should return the same task result shape as built-in source ingest handlers.'
      ]
    },
    registrationReport: {
      modulePath: 'Absolute module path.',
      forumAdapters: 'Registered forum adapter sourceKey values.',
      forumAdapterDetails: 'Registered forum adapter contract metadata safe for diagnostics.',
      sourceIngestHandlers: 'Registered source ingest handler sourceType values.',
      sourceIngestHandlerDetails: 'Registered source ingest handler contract metadata safe for diagnostics.',
      packageManifest: 'Optional threadtraceConnector package.json metadata loaded next to the module entrypoint.'
    },
    packageManifest: {
      packageJsonField: 'threadtraceConnector',
      required: ['version', 'displayName', 'sourceTypes'],
      sourceTypeRequired: ['sourceType'],
      optional: ['packageType', 'categories', 'adapters', 'capabilities', 'rollout'],
      notes: [
        'When present, declared sourceTypes and adapters must match runtime registrations.',
        'Use package metadata for marketplace, rollout, onboarding, and operations UI surfaces.'
      ]
    },
    validation: {
      requiredChecks: [
        'connectorModule.path',
        'connectorModule.load',
        'connectorModule.registrations',
        'connectorModule.uniqueRegistrations',
        'connectorModule.adapterContracts',
        'connectorModule.handlerContracts',
        'connectorPackage.manifest'
      ],
      contractSummary: 'Validation responses include registered adapter and source-ingest handler metadata for release review.'
    },
    diagnostics: {
      readiness: 'GET /api/connectors/readiness and connector-readiness report loaded modules and load errors.',
      runtime: 'GET /api/runtime/diagnostics reports connector module load failures as configuration failures.',
      runbook: 'GET /api/operations/runbook includes a critical action when configured modules fail to load.'
    },
    example: [
      "'use strict';",
      "const path = require('path');",
      "const threadTraceRoot = process.env.THREADTRACE_ROOT || process.cwd();",
      "const { defineConnectorModule, defineNormalizedThreadJsonHandler } = require(path.join(threadTraceRoot, 'src/connectors/connectorSdk'));",
      'module.exports = defineConnectorModule({',
      '  sourceIngestHandlers: [defineNormalizedThreadJsonHandler({',
      "    sourceType: 'external-feed',",
      "    description: 'Ingest an external feed into ThreadTrace.',",
      "    inputFileField: 'threadSnapshotFile'",
      "    capabilities: { acceptsCanonicalSnapshot: true }",
      '  })]',
      '});'
    ].join('\n')
  };
}

module.exports = {
  getConnectorModuleContract
};
