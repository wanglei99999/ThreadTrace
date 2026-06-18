'use strict';

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
      const loadedModule = normalizeModuleExport(require(resolvedPath));
      const registration = applyConnectorModule(loadedModule, {
        modulePath: resolvedPath,
        forumAdapterRegistry: safeOptions.forumAdapterRegistry,
        sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
        runtimeConfig: safeOptions.runtimeConfig
      });
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
    sourceIngestHandlers: []
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
      return adapter;
    },
    registerSourceIngestHandler: function (handler) {
      context.sourceIngestHandlerRegistry.register(handler);
      registration.sourceIngestHandlers.push(handler.sourceType);
      return handler;
    }
  };
}

function registerForumAdapters(adapters, context, registration) {
  adapters.forEach(function (adapter) {
    context.forumAdapterRegistry.register(adapter);
    registration.forumAdapters.push(adapter.sourceKey);
  });
}

function registerSourceIngestHandlers(handlers, context, registration) {
  handlers.forEach(function (handler) {
    context.sourceIngestHandlerRegistry.register(handler);
    registration.sourceIngestHandlers.push(handler.sourceType);
  });
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
  applyConnectorModule
};
