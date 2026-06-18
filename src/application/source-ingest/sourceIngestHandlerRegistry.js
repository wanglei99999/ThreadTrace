'use strict';

function createSourceIngestHandlerRegistry(handlers) {
  const byType = new Map();
  (handlers || []).forEach(function (handler) {
    const safeHandler = assertSourceIngestHandler(handler);
    byType.set(safeHandler.sourceType, safeHandler);
  });

  return {
    register(handler) {
      const safeHandler = assertSourceIngestHandler(handler);
      byType.set(safeHandler.sourceType, safeHandler);
      return this;
    },

    findHandler(sourceOrType) {
      const sourceType = typeof sourceOrType === 'string' ? sourceOrType : sourceOrType && sourceOrType.sourceType;
      return byType.get(sourceType);
    },

    listHandlers() {
      return Array.from(byType.values()).map(function (handler) {
        return {
          sourceType: handler.sourceType,
          description: handler.description,
          requiresAdapter: handler.requiresAdapter !== false,
          locationSchema: handler.locationSchema || {
            required: [],
            properties: {}
          },
          capabilities: handler.capabilities || {}
        };
      });
    }
  };
}

function assertSourceIngestHandler(handler) {
  if (!handler || typeof handler.sourceType !== 'string' || !handler.sourceType) {
    throw new Error('SourceIngestHandler must define sourceType.');
  }
  if (typeof handler.run !== 'function') {
    throw new Error('SourceIngestHandler must implement run(context).');
  }
  if (handler.locationSchema && !Array.isArray(handler.locationSchema.required)) {
    throw new Error('SourceIngestHandler locationSchema.required must be an array.');
  }
  return handler;
}

module.exports = {
  createSourceIngestHandlerRegistry,
  assertSourceIngestHandler
};
