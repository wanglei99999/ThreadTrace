'use strict';

function defineConnectorModule(options) {
  const safeOptions = options || {};
  const moduleDefinition = {};

  if (safeOptions.register !== undefined) {
    if (typeof safeOptions.register !== 'function') {
      throw new Error('ConnectorModule register must be a function.');
    }
    moduleDefinition.register = safeOptions.register;
  }

  const forumAdapters = toArray(safeOptions.forumAdapters || safeOptions.adapters || safeOptions.forumAdapter)
    .map(defineForumAdapter);
  const sourceIngestHandlers = toArray(safeOptions.sourceIngestHandlers || safeOptions.handlers || safeOptions.sourceIngestHandler)
    .map(defineSourceIngestHandler);

  if (forumAdapters.length > 0) moduleDefinition.forumAdapters = forumAdapters;
  if (sourceIngestHandlers.length > 0) moduleDefinition.sourceIngestHandlers = sourceIngestHandlers;
  if (safeOptions.metadata) moduleDefinition.metadata = Object.assign({}, safeOptions.metadata);

  return moduleDefinition;
}

function defineSourceIngestHandler(options) {
  const safeOptions = options || {};
  assertNonEmptyString(safeOptions.sourceType, 'SourceIngestHandler sourceType');
  assertNonEmptyString(safeOptions.description, 'SourceIngestHandler description');
  if (typeof safeOptions.run !== 'function') {
    throw new Error('SourceIngestHandler run must be a function.');
  }

  return Object.assign({}, safeOptions, {
    requiresAdapter: safeOptions.requiresAdapter !== false,
    locationSchema: defineLocationSchema(safeOptions.locationSchema),
    capabilities: Object.assign({}, safeOptions.capabilities || {})
  });
}

function defineForumAdapter(options) {
  const safeOptions = options || {};
  assertNonEmptyString(safeOptions.sourceKey, 'ForumAdapter sourceKey');
  assertNonEmptyString(safeOptions.displayName, 'ForumAdapter displayName');
  if (typeof safeOptions.parseSavedHtml !== 'function') {
    throw new Error('ForumAdapter parseSavedHtml must be a function.');
  }

  const adapter = Object.assign({}, safeOptions, {
    capabilities: Object.assign({}, safeOptions.capabilities || {})
  });
  if (safeOptions.fetchThread !== undefined && typeof safeOptions.fetchThread !== 'function') {
    throw new Error('ForumAdapter fetchThread must be a function when provided.');
  }
  return adapter;
}

function defineLocationSchema(options) {
  const safeOptions = options || {};
  const required = safeOptions.required || [];
  const properties = safeOptions.properties || {};

  if (!Array.isArray(required)) {
    throw new Error('LocationSchema required must be an array.');
  }
  if (!isPlainObject(properties)) {
    throw new Error('LocationSchema properties must be an object.');
  }

  required.forEach(function (field) {
    assertNonEmptyString(field, 'LocationSchema required field');
  });

  return {
    required: required.slice(),
    properties: Object.assign({}, properties)
  };
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(label + ' must be a non-empty string.');
  }
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

module.exports = {
  defineConnectorModule,
  defineSourceIngestHandler,
  defineForumAdapter,
  defineLocationSchema
};
