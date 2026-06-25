'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
const { diagnoseSource } = require('./diagnoseTrackedSources');
const { getSourceConnectorCatalog } = require('./getSourceConnectorCatalog');

async function getSourceTypeReadiness(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const connectorModuleReport = safeOptions.connectorModuleReport || {
    modules: safeOptions.connectorModules || [],
    errors: safeOptions.connectorModuleErrors || []
  };
  const catalog = getSourceConnectorCatalog({
    sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
    forumAdapterRegistry: safeOptions.forumAdapterRegistry,
    modulePath: safeOptions.modulePath,
    now: safeOptions.now
  });
  const sources = await sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey,
    enabled: safeOptions.enabled,
    limit: safeOptions.limit || 200
  });
  const diagnostics = sources.map(function (source) {
    return diagnoseSource(source, {
      handlerRegistry: safeOptions.sourceIngestHandlerRegistry,
      getAdapter: safeOptions.getAdapter
    });
  });
  const catalogByType = new Map((catalog.sourceTypes || []).map(function (item) {
    return [item.sourceType, item];
  }));
  const diagnosticGroups = groupDiagnosticsBySourceType(diagnostics);
  const sourceTypes = (catalog.sourceTypes || []).map(function (sourceType) {
    return summarizeSourceType(sourceType, diagnosticGroups.get(sourceType.sourceType) || [], catalogByType);
  });
  let unknownSourceTypes = summarizeUnknownSourceTypes(diagnosticGroups, catalogByType);
  if (safeOptions.sourceType) {
    const sourceTypeFilter = String(safeOptions.sourceType);
    unknownSourceTypes = unknownSourceTypes.filter(function (item) {
      return item.sourceType === sourceTypeFilter;
    });
  }
  const filteredSourceTypes = safeOptions.sourceType
    ? sourceTypes.filter(function (item) {
      return item.sourceType === safeOptions.sourceType;
    })
    : sourceTypes;
  const allStatuses = filteredSourceTypes.map(function (item) { return item.status; }).concat(unknownSourceTypes.map(function () { return 'fail'; }));
  if ((connectorModuleReport.errors || []).length > 0) {
    allStatuses.push('fail');
  }
  if (safeOptions.sourceType && filteredSourceTypes.length === 0 && unknownSourceTypes.length === 0) {
    allStatuses.push('warn');
  }

  return {
    generatedAt: safeOptions.now || catalog.generatedAt,
    status: aggregateStatus(allStatuses),
    summary: {
      sourceTypeCount: filteredSourceTypes.length,
      readySourceTypeCount: filteredSourceTypes.filter(function (item) { return item.status === 'ok'; }).length,
      warnSourceTypeCount: filteredSourceTypes.filter(function (item) { return item.status === 'warn'; }).length,
      failSourceTypeCount: filteredSourceTypes.filter(function (item) { return item.status === 'fail'; }).length,
      unknownSourceTypeCount: unknownSourceTypes.length,
      sourceCount: safeOptions.sourceType
        ? diagnostics.filter(function (item) { return item.sourceType === safeOptions.sourceType; }).length
        : diagnostics.length,
      enabledSourceCount: safeOptions.sourceType
        ? diagnostics.filter(function (item) {
          return item.sourceType === safeOptions.sourceType && item.enabled;
        }).length
        : diagnostics.filter(function (item) { return item.enabled; }).length
    },
    sourceTypes: filteredSourceTypes,
    unknownSourceTypes,
    nextActions: dedupeActions(filteredSourceTypes.concat(unknownSourceTypes).flatMap(function (item) {
      return item.nextActions || [];
    })),
    modules: {
      count: (connectorModuleReport.modules || []).length,
      errorCount: (connectorModuleReport.errors || []).length,
      modules: connectorModuleReport.modules || [],
      errors: connectorModuleReport.errors || []
    },
    catalog: {
      generatedAt: catalog.generatedAt,
      adapterCount: (catalog.adapters || []).length
    }
  };
}

function summarizeSourceType(sourceType, diagnostics, catalogByType) {
  const sortedDiagnostics = diagnostics.slice().sort(compareDiagnostics);
  const enabledCount = sortedDiagnostics.filter(function (diagnostic) {
    return diagnostic.enabled;
  }).length;
  const statusCounts = countStatuses(sortedDiagnostics);
  const readyStatus = resolveSourceTypeStatus(sourceType, sortedDiagnostics);
  const hasSources = sortedDiagnostics.length > 0;
  const checks = [
    check('sourceType.catalog', 'ok', sourceType.sourceType, 'Source type is registered in the catalog.'),
    check(
      'sourceType.adapterCoverage',
      sourceType.requiresAdapter && (sourceType.compatibleSourceKeys || []).length === 0 ? 'fail' : 'ok',
      sourceType.requiresAdapter ? sourceType.compatibleSourceKeys || [] : [],
      sourceType.requiresAdapter ? 'Source type has compatible adapter coverage.' : 'Source type does not require an adapter.'
    ),
    check(
      'sourceType.inventory',
      hasSources ? (enabledCount > 0 ? readyStatus : 'warn') : 'warn',
      sortedDiagnostics.length,
      hasSources ? 'Tracked sources exist for this source type.' : 'No tracked sources are registered for this source type yet.'
    )
  ];
  if (hasSources && enabledCount === 0) {
    checks.push(check('sourceType.enabledCoverage', 'warn', enabledCount, 'Tracked sources exist but all are disabled.'));
  }

  return {
    sourceType: sourceType.sourceType,
    description: sourceType.description,
    requiresAdapter: sourceType.requiresAdapter,
    compatibleSourceKeys: sourceType.compatibleSourceKeys,
    capabilities: sourceType.capabilities,
    locationSchema: sourceType.locationSchema,
    onboardingRecipe: sourceType.onboardingRecipe,
    status: aggregateStatus(checks.map(function (item) { return item.status; }).concat(statusCounts.fail > 0 ? ['fail'] : [], !hasSources ? ['warn'] : [])),
    sourceCount: sortedDiagnostics.length,
    enabledSourceCount: enabledCount,
    statusCounts,
    checks,
    sources: sortedDiagnostics.slice(0, 10),
    nextActions: buildSourceTypeNextActions(sourceType, sortedDiagnostics, hasSources)
  };
}

function summarizeUnknownSourceTypes(groups, catalogByType) {
  return Array.from(groups.entries()).filter(function (entry) {
    return !catalogByType.has(entry[0]);
  }).map(function (entry) {
    const sourceType = entry[0] || 'unknown';
    const diagnostics = entry[1].slice().sort(compareDiagnostics);
    const statusCounts = countStatuses(diagnostics);
    return {
      sourceType,
      description: 'Tracked sources exist for an unregistered source type.',
      requiresAdapter: true,
      compatibleSourceKeys: [],
      capabilities: {},
      locationSchema: {
        required: [],
        properties: {}
      },
      status: 'fail',
      sourceCount: diagnostics.length,
      enabledSourceCount: diagnostics.filter(function (diagnostic) {
        return diagnostic.enabled;
      }).length,
      statusCounts,
      checks: [
        check('sourceType.catalog', 'fail', sourceType, 'Source type is not registered in the catalog.'),
        check('sourceType.inventory', diagnostics.length > 0 ? 'fail' : 'warn', diagnostics.length, 'Tracked sources use an unknown source type.')
      ],
      sources: diagnostics.slice(0, 10),
      nextActions: buildUnknownSourceTypeNextActions(sourceType, diagnostics)
    };
  });
}

function buildSourceTypeNextActions(sourceType, diagnostics, hasSources) {
  if (!hasSources) {
    return [{
      key: 'sourceType.register',
      severity: 'warning',
      summary: 'Register a tracked source for ' + sourceType.sourceType + ' when this source type should be active.',
      commands: [
        'node src/presentation/cli/threadtrace.js source-onboarding-preflight --source-type ' + sourceType.sourceType + ' --location-file <file>',
        'node src/presentation/cli/threadtrace.js register-source --source-type ' + sourceType.sourceType + ' --location-file <file>'
      ]
    }];
  }
  return diagnostics.flatMap(function (diagnostic) {
    return (diagnostic.nextActions || []).slice(0, 3);
  });
}

function buildUnknownSourceTypeNextActions(sourceType, diagnostics) {
  return [{
    key: 'sourceType.register',
    severity: 'critical',
    summary: 'Source type ' + sourceType + ' is not in the catalog; load the connector module or register a matching handler.',
    commands: [
      'node src/presentation/cli/threadtrace.js connector-catalog --module-path <file>',
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>',
      'node src/presentation/cli/threadtrace.js source-onboarding-preflight --source-type ' + sourceType + ' --module-path <file> --location-file <file>'
    ]
  }].concat((diagnostics || []).flatMap(function (diagnostic) {
    return (diagnostic.nextActions || []).slice(0, 2);
  }));
}

function resolveSourceTypeStatus(sourceType, diagnostics) {
  if (sourceType.requiresAdapter && (sourceType.compatibleSourceKeys || []).length === 0) return 'fail';
  if (diagnostics.length === 0) return 'warn';
  if (diagnostics.some(function (diagnostic) { return diagnostic.status === 'fail'; })) return 'fail';
  if (diagnostics.some(function (diagnostic) { return diagnostic.status === 'warn'; })) return 'warn';
  return 'ok';
}

function groupDiagnosticsBySourceType(diagnostics) {
  return diagnostics.reduce(function (map, diagnostic) {
    const key = diagnostic.sourceType || 'unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(diagnostic);
    return map;
  }, new Map());
}

function compareDiagnostics(left, right) {
  const statusDiff = statusRank(left.status) - statusRank(right.status);
  if (statusDiff !== 0) return statusDiff;
  return String(left.displayName || left.sourceKey || left.sourceId || '').localeCompare(String(right.displayName || right.sourceKey || right.sourceId || ''));
}

function countStatuses(items) {
  return {
    ok: items.filter(function (item) { return item.status === 'ok'; }).length,
    warn: items.filter(function (item) { return item.status === 'warn'; }).length,
    fail: items.filter(function (item) { return item.status === 'fail'; }).length
  };
}

function dedupeActions(actions) {
  const seen = new Set();
  return (actions || []).filter(function (action) {
    const key = action.key + '|' + action.summary + '|' + (action.commands || []).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  if ((statuses || []).some(function (status) { return status === 'fail'; })) return 'fail';
  if ((statuses || []).some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

function statusRank(status) {
  if (status === 'fail') return 3;
  if (status === 'warn') return 2;
  return 1;
}

module.exports = {
  getSourceTypeReadiness
};
