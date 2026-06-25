'use strict';

function validateConnectorModuleLoad(options) {
  const safeOptions = options || {};
  const report = safeOptions.report || {};
  const modules = report.modules || [];
  const errors = report.errors || [];
  const registrationCount = modules.reduce(function (total, moduleReport) {
    return total + (moduleReport.forumAdapters || []).length + (moduleReport.sourceIngestHandlers || []).length;
  }, 0);
  const checks = [
    check('connectorModule.path', safeOptions.modulePath ? 'ok' : 'fail', safeOptions.modulePath || 'missing', 'Connector module path is configured.'),
    check('connectorModule.load', errors.length === 0 ? 'ok' : 'fail', errors.length === 0 ? 'loaded' : errors[0].message, 'Connector module can be loaded.'),
    check('connectorModule.registrations', registrationCount > 0 ? 'ok' : 'fail', registrationCount, 'Connector module registers at least one adapter or source ingest handler.')
  ].concat(registrationContractChecks(modules), packageManifestChecks(modules));

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    valid: checks.every(function (item) { return item.status !== 'fail'; }),
    status: aggregateStatus(checks),
    modulePath: safeOptions.modulePath,
    checks,
    contractSummary: summarizeContracts(modules),
    packageManifests: summarizePackageManifests(modules),
    modules,
    errors
  };
}

function registrationContractChecks(modules) {
  const adapters = flatten(modules.map(function (moduleReport) {
    return moduleReport.forumAdapterDetails || [];
  }));
  const handlers = flatten(modules.map(function (moduleReport) {
    return moduleReport.sourceIngestHandlerDetails || [];
  }));
  const duplicateAdapters = duplicates(flatten(modules.map(function (moduleReport) {
    return moduleReport.forumAdapters || [];
  })));
  const duplicateHandlers = duplicates(flatten(modules.map(function (moduleReport) {
    return moduleReport.sourceIngestHandlers || [];
  })));
  const adapterFailures = adapters.filter(function (adapter) {
    return !adapter.sourceKey || !adapter.displayName || adapter.hasParseSavedHtml !== true;
  }).map(function (adapter) {
    return {
      sourceKey: adapter.sourceKey,
      missing: missingAdapterFields(adapter)
    };
  });
  const handlerFailures = handlers.filter(function (handler) {
    return !handler.sourceType || !handler.description || handler.hasRun !== true ||
      !handler.locationSchema || !isPlainObject(handler.locationSchema.properties);
  }).map(function (handler) {
    return {
      sourceType: handler.sourceType,
      missing: missingHandlerFields(handler)
    };
  });

  return [
    check(
      'connectorModule.uniqueRegistrations',
      duplicateAdapters.length || duplicateHandlers.length ? 'fail' : 'ok',
      {
        duplicateForumAdapters: duplicateAdapters,
        duplicateSourceIngestHandlers: duplicateHandlers
      },
      'Connector module registration keys are unique within the validation report.'
    ),
    check(
      'connectorModule.adapterContracts',
      adapterFailures.length > 0 ? 'fail' : 'ok',
      {
        adapterCount: adapters.length,
        failures: adapterFailures
      },
      adapters.length > 0
        ? 'Registered forum adapters expose required connector contract fields.'
        : 'Connector module does not register forum adapters.'
    ),
    check(
      'connectorModule.handlerContracts',
      handlerFailures.length > 0 ? 'fail' : 'ok',
      {
        handlerCount: handlers.length,
        failures: handlerFailures
      },
      handlers.length > 0
        ? 'Registered source ingest handlers expose required connector contract fields.'
        : 'Connector module does not register source ingest handlers.'
    )
  ];
}

function summarizeContracts(modules) {
  const adapters = flatten(modules.map(function (moduleReport) {
    return moduleReport.forumAdapterDetails || [];
  }));
  const handlers = flatten(modules.map(function (moduleReport) {
    return moduleReport.sourceIngestHandlerDetails || [];
  }));
  return {
    forumAdapterCount: adapters.length,
    sourceIngestHandlerCount: handlers.length,
    forumAdapters: adapters.map(function (adapter) {
      return {
        sourceKey: adapter.sourceKey,
        displayName: adapter.displayName,
        hasFetchThread: adapter.hasFetchThread === true,
        capabilities: adapter.capabilities || {}
      };
    }),
    sourceIngestHandlers: handlers.map(function (handler) {
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

function packageManifestChecks(modules) {
  const summaries = summarizePackageManifests(modules);
  if (summaries.length === 0) {
    return [
      check(
        'connectorPackage.manifest',
        'ok',
        { manifestCount: 0 },
        'Connector package manifest is optional for legacy modules.'
      )
    ];
  }

  const failures = summaries.filter(function (summary) {
    return summary.status === 'fail';
  });
  return [
    check(
      'connectorPackage.manifest',
      failures.length > 0 ? 'fail' : 'ok',
      {
        manifestCount: summaries.length,
        failures
      },
      'Connector package manifests match runtime registrations.'
    )
  ];
}

function summarizePackageManifests(modules) {
  return (modules || []).map(function (moduleReport) {
    const packageManifest = moduleReport.packageManifest || {};
    if (!packageManifest.found) return undefined;
    const manifest = packageManifest.manifest || {};
    const declaredSourceTypes = extractDeclaredSourceTypes(manifest);
    const declaredAdapters = extractDeclaredAdapters(manifest);
    const registeredSourceTypes = moduleReport.sourceIngestHandlers || [];
    const registeredAdapters = moduleReport.forumAdapters || [];
    const missingSourceTypes = declaredSourceTypes.filter(function (sourceType) {
      return !registeredSourceTypes.includes(sourceType);
    });
    const undeclaredSourceTypes = registeredSourceTypes.filter(function (sourceType) {
      return !declaredSourceTypes.includes(sourceType);
    });
    const missingAdapters = declaredAdapters.filter(function (sourceKey) {
      return !registeredAdapters.includes(sourceKey);
    });
    const undeclaredAdapters = registeredAdapters.filter(function (sourceKey) {
      return !declaredAdapters.includes(sourceKey);
    });
    const requiredFailures = requiredManifestFailures(manifest);
    const status = missingSourceTypes.length || undeclaredSourceTypes.length ||
      missingAdapters.length || undeclaredAdapters.length || requiredFailures.length
      ? 'fail'
      : 'ok';
    return {
      status,
      modulePath: moduleReport.modulePath,
      packagePath: packageManifest.packagePath,
      packageName: packageManifest.packageName,
      packageVersion: packageManifest.packageVersion,
      manifestVersion: manifest.version,
      packageType: manifest.packageType,
      displayName: manifest.displayName,
      categories: Array.isArray(manifest.categories) ? manifest.categories.slice() : [],
      declaredSourceTypes,
      registeredSourceTypes,
      declaredAdapters,
      registeredAdapters,
      missingSourceTypes,
      undeclaredSourceTypes,
      missingAdapters,
      undeclaredAdapters,
      requiredFailures,
      capabilities: manifest.capabilities || {},
      rollout: manifest.rollout
    };
  }).filter(Boolean);
}

function extractDeclaredSourceTypes(manifest) {
  return (manifest.sourceTypes || []).map(function (item) {
    return typeof item === 'string' ? item : item && item.sourceType;
  }).filter(Boolean);
}

function extractDeclaredAdapters(manifest) {
  return (manifest.adapters || manifest.forumAdapters || []).map(function (item) {
    return typeof item === 'string' ? item : item && item.sourceKey;
  }).filter(Boolean);
}

function requiredManifestFailures(manifest) {
  const failures = [];
  if (!manifest.version) failures.push('version');
  if (!manifest.displayName) failures.push('displayName');
  if (!Array.isArray(manifest.sourceTypes) || manifest.sourceTypes.length === 0) failures.push('sourceTypes');
  (manifest.sourceTypes || []).forEach(function (item, index) {
    const sourceType = typeof item === 'string' ? item : item && item.sourceType;
    if (!sourceType) failures.push('sourceTypes[' + index + '].sourceType');
  });
  return failures;
}

function missingAdapterFields(adapter) {
  const missing = [];
  if (!adapter.sourceKey) missing.push('sourceKey');
  if (!adapter.displayName) missing.push('displayName');
  if (adapter.hasParseSavedHtml !== true) missing.push('parseSavedHtml');
  return missing;
}

function missingHandlerFields(handler) {
  const missing = [];
  if (!handler.sourceType) missing.push('sourceType');
  if (!handler.description) missing.push('description');
  if (handler.hasRun !== true) missing.push('run');
  if (!handler.locationSchema) missing.push('locationSchema');
  if (!handler.locationSchema || !isPlainObject(handler.locationSchema.properties)) {
    missing.push('locationSchema.properties');
  }
  return missing;
}

function duplicates(values) {
  const counts = new Map();
  values.filter(Boolean).forEach(function (value) {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries()).filter(function (entry) {
    return entry[1] > 1;
  }).map(function (entry) {
    return entry[0];
  });
}

function flatten(items) {
  return items.reduce(function (result, item) {
    return result.concat(item || []);
  }, []);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  validateConnectorModuleLoad,
  summarizePackageManifests
};
