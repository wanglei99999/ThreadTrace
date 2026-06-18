'use strict';

const ngaSavedHtmlAdapter = require('./nga/ngaSavedHtmlAdapter');
const { assertForumAdapter } = require('./forumAdapter');

function createForumAdapterRegistry(initialAdapters) {
  const adapters = new Map();
  const registry = {
    register,
    get,
    list
  };

  (initialAdapters || []).forEach(function (adapter) {
    register(adapter);
  });

  function register(adapter) {
    const safeAdapter = assertForumAdapter(adapter);
    adapters.set(safeAdapter.sourceKey, safeAdapter);
    return registry;
  }

  function get(sourceKey) {
    const adapter = adapters.get(sourceKey);
    if (!adapter) {
      throw new Error('Unknown forum adapter: ' + sourceKey);
    }
    return adapter;
  }

  function list() {
    return Array.from(adapters.values()).map(function (adapter) {
      return {
        sourceKey: adapter.sourceKey,
        displayName: adapter.displayName || adapter.sourceKey
      };
    });
  }

  return registry;
}

function createDefaultForumAdapterRegistry() {
  return createForumAdapterRegistry([
    ngaSavedHtmlAdapter
  ]);
}

const defaultRegistry = createDefaultForumAdapterRegistry();

function getForumAdapter(sourceKey) {
  return defaultRegistry.get(sourceKey);
}

function listForumAdapters() {
  return defaultRegistry.list();
}

module.exports = {
  createForumAdapterRegistry,
  createDefaultForumAdapterRegistry,
  getForumAdapter,
  listForumAdapters
};
