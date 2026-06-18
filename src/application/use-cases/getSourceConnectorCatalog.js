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
      return {
        sourceType: handler.sourceType,
        description: handler.description,
        requiresAdapter: handler.requiresAdapter !== false,
        locationSchema: handler.locationSchema || {
          required: [],
          properties: {}
        },
        capabilities: handler.capabilities || {},
        compatibleSourceKeys: handler.requiresAdapter === false
          ? []
          : adapters.map(function (adapter) { return adapter.sourceKey; })
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

module.exports = {
  getSourceConnectorCatalog
};
