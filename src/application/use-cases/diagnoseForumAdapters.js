'use strict';

async function diagnoseForumAdapters(options) {
  const safeOptions = options || {};
  const registry = assertAdapterRegistry(safeOptions.forumAdapterRegistry);
  const listedAdapters = registry.list();
  const samples = safeOptions.samples || {};
  const adapters = listedAdapters.map(function (listed) {
    return diagnoseAdapter(listed, registry, samples[listed.sourceKey]);
  });

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateStatus(adapters.map(function (adapter) { return adapter.status; })),
    adapterCount: adapters.length,
    adapters
  };
}

function diagnoseAdapter(listedAdapter, registry, sample) {
  const listedSourceKey = listedAdapter && listedAdapter.sourceKey;
  const checks = [
    check('adapter.sourceKey', listedSourceKey ? 'ok' : 'fail', listedSourceKey || 'missing', 'Adapter has a stable sourceKey.'),
    check('adapter.displayName', listedAdapter && listedAdapter.displayName ? 'ok' : 'warn', listedAdapter && listedAdapter.displayName || 'missing', 'Adapter has a display name for operators.')
  ];
  let adapter;

  try {
    adapter = registry.get(listedSourceKey);
    checks.push(check('adapter.registryLookup', 'ok', listedSourceKey, 'Adapter can be resolved from the registry.'));
  } catch (error) {
    checks.push(check('adapter.registryLookup', 'fail', errorMessage(error), 'Adapter can be resolved from the registry.'));
  }

  if (adapter) {
    checks.push(check('adapter.parseSavedHtml', typeof adapter.parseSavedHtml === 'function' ? 'ok' : 'fail', typeof adapter.parseSavedHtml, 'Adapter implements parseSavedHtml(html, context).'));
    checks.push(check('adapter.sourceKeyMatch', adapter.sourceKey === listedSourceKey ? 'ok' : 'fail', adapter.sourceKey || 'missing', 'Resolved adapter sourceKey matches registry metadata.'));
    if (sample) {
      checks.push(parseSampleCheck(adapter, sample));
    }
  }

  return {
    sourceKey: listedSourceKey,
    displayName: listedAdapter && listedAdapter.displayName,
    status: aggregateStatus(checks.map(function (item) { return item.status; })),
    checks
  };
}

function parseSampleCheck(adapter, sample) {
  try {
    const result = adapter.parseSavedHtml(sample.html || '', sample.context || {});
    if (!result || result.sourceKey !== adapter.sourceKey || !Array.isArray(result.posts)) {
      return check('adapter.sampleParse', 'fail', result && result.sourceKey || 'invalid-result', 'Adapter sample parse returns a canonical ThreadSnapshot.');
    }
    return check('adapter.sampleParse', 'ok', result.sourceThreadId || 'parsed', 'Adapter sample parse returns a canonical ThreadSnapshot.');
  } catch (error) {
    return check('adapter.sampleParse', 'fail', errorMessage(error), 'Adapter sample parse returns a canonical ThreadSnapshot.');
  }
}

function assertAdapterRegistry(registry) {
  if (!registry || typeof registry.list !== 'function' || typeof registry.get !== 'function') {
    throw new Error('diagnoseForumAdapters requires a registry with list() and get(sourceKey).');
  }
  return registry;
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

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

module.exports = {
  diagnoseForumAdapters
};
