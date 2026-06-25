'use strict';

const fs = require('fs');
const path = require('path');

function loadConnectorModules(options) {
  return loadConnectorModulesReport(options).modules;
}

function loadConnectorModulesReport(options) {
  const safeOptions = options || {};
  const modulePaths = safeOptions.modulePaths || [];
  const modules = [];
  const errors = [];

  modulePaths.forEach(function (modulePath) {
    const resolvedPath = path.resolve(safeOptions.cwd || process.cwd(), modulePath);
    try {
      if (safeOptions.reload === true) {
        delete require.cache[require.resolve(resolvedPath)];
      }
      const loadedModule = normalizeModuleExport(require(resolvedPath));
      const registration = applyConnectorModule(loadedModule, {
        modulePath: resolvedPath,
        forumAdapterRegistry: safeOptions.forumAdapterRegistry,
        sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
        runtimeConfig: safeOptions.runtimeConfig
      });
      registration.packageManifest = loadConnectorPackageManifest(resolvedPath);
      modules.push(registration);
    } catch (error) {
      errors.push({
        modulePath: resolvedPath,
        message: error && error.message ? error.message : String(error)
      });
      if (safeOptions.failFast === true) throw error;
    }
  });

  return {
    modules,
    errors
  };
}

function applyConnectorModule(connectorModule, context) {
  const registration = {
    modulePath: context.modulePath,
    forumAdapters: [],
    forumAdapterDetails: [],
    sourceIngestHandlers: [],
    sourceIngestHandlerDetails: []
  };
  const moduleValue = typeof connectorModule === 'function'
    ? connectorModule(buildContext(context, registration))
    : connectorModule;
  const normalized = normalizeModuleExport(moduleValue || connectorModule);

  if (normalized && typeof normalized.register === 'function') {
    normalized.register(buildContext(context, registration));
  }

  registerForumAdapters(toArray(normalized && (normalized.forumAdapters || normalized.adapters || normalized.forumAdapter)), context, registration);
  registerSourceIngestHandlers(toArray(normalized && (normalized.sourceIngestHandlers || normalized.handlers || normalized.sourceIngestHandler)), context, registration);

  return registration;
}

function buildContext(context, registration) {
  return {
    modulePath: context.modulePath,
    runtimeConfig: context.runtimeConfig,
    registerForumAdapter: function (adapter) {
      context.forumAdapterRegistry.register(adapter);
      registration.forumAdapters.push(adapter.sourceKey);
      registration.forumAdapterDetails.push(summarizeForumAdapter(adapter));
      return adapter;
    },
    registerSourceIngestHandler: function (handler) {
      context.sourceIngestHandlerRegistry.register(handler);
      registration.sourceIngestHandlers.push(handler.sourceType);
      registration.sourceIngestHandlerDetails.push(summarizeSourceIngestHandler(handler));
      return handler;
    }
  };
}

function registerForumAdapters(adapters, context, registration) {
  adapters.forEach(function (adapter) {
    context.forumAdapterRegistry.register(adapter);
    registration.forumAdapters.push(adapter.sourceKey);
    registration.forumAdapterDetails.push(summarizeForumAdapter(adapter));
  });
}

function registerSourceIngestHandlers(handlers, context, registration) {
  handlers.forEach(function (handler) {
    context.sourceIngestHandlerRegistry.register(handler);
    registration.sourceIngestHandlers.push(handler.sourceType);
    registration.sourceIngestHandlerDetails.push(summarizeSourceIngestHandler(handler));
  });
}

function summarizeForumAdapter(adapter) {
  return {
    sourceKey: adapter && adapter.sourceKey,
    displayName: adapter && adapter.displayName,
    hasParseSavedHtml: Boolean(adapter && typeof adapter.parseSavedHtml === 'function'),
    hasFetchThread: Boolean(adapter && typeof adapter.fetchThread === 'function'),
    capabilities: adapter && adapter.capabilities || {}
  };
}

function summarizeSourceIngestHandler(handler) {
  const locationSchema = handler && handler.locationSchema || {};
  return {
    sourceType: handler && handler.sourceType,
    description: handler && handler.description,
    requiresAdapter: handler ? handler.requiresAdapter !== false : true,
    hasRun: Boolean(handler && typeof handler.run === 'function'),
    locationSchema: {
      required: Array.isArray(locationSchema.required) ? locationSchema.required.slice() : [],
      properties: locationSchema.properties || {}
    },
    capabilities: handler && handler.capabilities || {}
  };
}

function loadConnectorPackageManifest(modulePath) {
  const packagePath = findNearestPackageJson(path.dirname(modulePath));
  if (!packagePath) {
    return {
      found: false
    };
  }
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const manifest = packageJson.threadtraceConnector || packageJson.threadtrace || packageJson.connector;
    if (!manifest) {
      return {
        found: false,
        packagePath
      };
    }
    return {
      found: true,
      packagePath,
      packageName: packageJson.name,
      packageVersion: packageJson.version,
      manifest
    };
  } catch (error) {
    return {
      found: false,
      packagePath,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function findNearestPackageJson(startDir) {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;
  while (current && current !== root) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    current = path.dirname(current);
  }
  const rootCandidate = path.join(root, 'package.json');
  return fs.existsSync(rootCandidate) ? rootCandidate : undefined;
}

function normalizeModuleExport(value) {
  if (value && value.__esModule && value.default) return value.default;
  if (value && value.default && !value.register && !value.forumAdapters && !value.sourceIngestHandlers) return value.default;
  return value;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = {
  loadConnectorModules,
  loadConnectorModulesReport,
  applyConnectorModule,
  loadConnectorPackageManifest
};
