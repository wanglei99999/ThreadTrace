'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
const { diagnoseSource } = require('./diagnoseTrackedSources');
const { getSourceConnectorCatalog } = require('./getSourceConnectorCatalog');

async function getConnectorReadiness(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const catalog = getSourceConnectorCatalog({
    sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
    forumAdapterRegistry: safeOptions.forumAdapterRegistry,
    now: safeOptions.now
  });
  const sources = await sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey,
    enabled: safeOptions.enabled,
    limit: safeOptions.limit || 100
  });
  const sourceDiagnostics = sources.map(function (source) {
    return diagnoseSource(source, {
      handlerRegistry: safeOptions.sourceIngestHandlerRegistry,
      getAdapter: safeOptions.getAdapter
    });
  });
  const connectors = catalog.sourceTypes.map(function (sourceType) {
    const diagnostics = sourceDiagnostics.filter(function (diagnostic) {
      return diagnostic.sourceType === sourceType.sourceType;
    });
    return summarizeConnector(sourceType, diagnostics);
  });
  const modules = summarizeConnectorModules(safeOptions.connectorModules, safeOptions.connectorModuleErrors);

  return {
    generatedAt: safeOptions.now || catalog.generatedAt,
    status: aggregateStatus(connectors.map(function (connector) { return connector.status; }).concat(modules.errorCount > 0 ? ['fail'] : [])),
    connectorCount: connectors.length,
    sourceCount: sources.length,
    modules,
    connectors,
    adapters: catalog.adapters
  };
}

function summarizeConnectorModules(connectorModules, connectorModuleErrors) {
  const modules = (connectorModules || []).map(function (connectorModule) {
    const forumAdapterDetails = connectorModule.forumAdapterDetails || [];
    const sourceIngestHandlerDetails = connectorModule.sourceIngestHandlerDetails || [];
    return {
      modulePath: connectorModule.modulePath,
      forumAdapters: connectorModule.forumAdapters || [],
      forumAdapterDetails,
      sourceIngestHandlers: connectorModule.sourceIngestHandlers || [],
      sourceIngestHandlerDetails,
      contractSummary: summarizeModuleContracts(forumAdapterDetails, sourceIngestHandlerDetails),
      packageManifest: summarizePackageManifest(connectorModule.packageManifest)
    };
  });
  return {
    count: modules.length,
    errorCount: (connectorModuleErrors || []).length,
    errors: connectorModuleErrors || [],
    modules
  };
}

function summarizePackageManifest(packageManifest) {
  const safePackageManifest = packageManifest || {};
  if (!safePackageManifest.found) {
    return {
      found: false,
      packagePath: safePackageManifest.packagePath
    };
  }
  const manifest = safePackageManifest.manifest || {};
  return {
    found: true,
    packagePath: safePackageManifest.packagePath,
    packageName: safePackageManifest.packageName,
    packageVersion: safePackageManifest.packageVersion,
    manifestVersion: manifest.version,
    displayName: manifest.displayName,
    packageType: manifest.packageType,
    categories: manifest.categories || [],
    sourceTypes: (manifest.sourceTypes || []).map(function (sourceType) {
      return typeof sourceType === 'string' ? { sourceType } : sourceType;
    }),
    capabilities: manifest.capabilities || {},
    rollout: manifest.rollout
  };
}

function summarizeModuleContracts(forumAdapterDetails, sourceIngestHandlerDetails) {
  return {
    forumAdapterCount: forumAdapterDetails.length,
    sourceIngestHandlerCount: sourceIngestHandlerDetails.length,
    forumAdapters: forumAdapterDetails.map(function (adapter) {
      return {
        sourceKey: adapter.sourceKey,
        displayName: adapter.displayName,
        hasFetchThread: adapter.hasFetchThread === true,
        capabilities: adapter.capabilities || {}
      };
    }),
    sourceIngestHandlers: sourceIngestHandlerDetails.map(function (handler) {
      return {
        sourceType: handler.sourceType,
        description: handler.description,
        requiresAdapter: handler.requiresAdapter !== false,
        requiredLocationFields: handler.locationSchema && handler.locationSchema.required || [],
        capabilities: handler.capabilities || {}
      };
    })
  };
}

function summarizeConnector(sourceType, diagnostics) {
  const checks = [
    check('connector.handler', 'ok', sourceType.sourceType, 'Source ingest handler is registered.'),
    check(
      'connector.adapterCoverage',
      sourceType.requiresAdapter && sourceType.compatibleSourceKeys.length === 0 ? 'fail' : 'ok',
      sourceType.requiresAdapter ? sourceType.compatibleSourceKeys : [],
      sourceType.requiresAdapter ? 'Connector has compatible forum adapters.' : 'Connector does not require a forum adapter.'
    ),
    check(
      'connector.configuredSources',
      aggregateStatus(diagnostics.map(function (diagnostic) { return diagnostic.status; })),
      diagnostics.length,
      'Configured tracked sources for this connector are valid.'
    )
  ];

  return {
    sourceType: sourceType.sourceType,
    description: sourceType.description,
    status: aggregateStatus(checks.map(function (item) { return item.status; })),
    requiresAdapter: sourceType.requiresAdapter,
    compatibleSourceKeys: sourceType.compatibleSourceKeys,
    capabilities: sourceType.capabilities,
    locationSchema: sourceType.locationSchema,
    sourceCount: diagnostics.length,
    enabledSourceCount: diagnostics.filter(function (diagnostic) { return diagnostic.enabled; }).length,
    statusCounts: countStatuses(diagnostics),
    checks,
    sources: diagnostics
  };
}

function countStatuses(items) {
  return {
    ok: items.filter(function (item) { return item.status === 'ok'; }).length,
    warn: items.filter(function (item) { return item.status === 'warn'; }).length,
    fail: items.filter(function (item) { return item.status === 'fail'; }).length
  };
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
  getConnectorReadiness,
  summarizeConnector,
  summarizeConnectorModules,
  summarizePackageManifest
};
