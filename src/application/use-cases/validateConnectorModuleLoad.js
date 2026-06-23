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
  ].concat(registrationContractChecks(modules));

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    valid: checks.every(function (item) { return item.status !== 'fail'; }),
    status: aggregateStatus(checks),
    modulePath: safeOptions.modulePath,
    checks,
    contractSummary: summarizeContracts(modules),
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
  validateConnectorModuleLoad
};
