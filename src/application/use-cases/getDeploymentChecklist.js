'use strict';

function getDeploymentChecklist(options) {
  const safeOptions = options || {};
  const diagnostics = safeOptions.diagnostics || {};
  const adapterDiagnostics = safeOptions.adapterDiagnostics || {};
  const notificationDiagnostics = safeOptions.notificationDiagnostics || {};
  const sourceDiagnostics = safeOptions.sourceDiagnostics || {};
  const readiness = safeOptions.readiness || {};
  const items = [
    item('runtime.configuration', 'runtime', diagnostics.status || 'fail', 'Runtime configuration and resource diagnostics are available.', {
      generatedAt: diagnostics.generatedAt,
      storageMode: diagnostics.configuration && diagnostics.configuration.storageMode
    }),
    item('resources.storage', 'resources', aggregateChecks(diagnostics.checks, /^resources\./), 'Primary storage resources are reachable.', {
      checks: selectCheckKeys(diagnostics.checks, /^resources\./)
    }),
    item('adapters.contract', 'adapters', adapterDiagnostics.status || 'fail', 'Forum adapters satisfy the ThreadTrace adapter contract.', {
      adapterCount: adapterDiagnostics.adapterCount
    }),
    item('sources.ingestConfiguration', 'sources', sourceDiagnostics.status || 'fail', 'Tracked sources have usable locations, handlers, and adapters.', {
      sourceCount: sourceDiagnostics.sourceCount
    }),
    item('workers.readiness', 'workers', readiness.status || 'fail', 'Background workers and leases are ready for production traffic.', {
      checks: selectCheckKeys(readiness.checks, /^workers\.|^workerLeases\./)
    }),
    item('notifications.channel', 'notifications', aggregateChecks(notificationDiagnostics.checks, /^notifications\./), 'Notification delivery channel is configured and locally valid.', {
      channel: notificationDiagnostics.channel,
      checks: selectCheckKeys(notificationDiagnostics.checks, /^notifications\./)
    }),
    item('notifications.outbox', 'notifications', aggregateChecks(readiness.checks, /^events\./), 'Notification outbox has no recent delivery failures.', {
      checks: selectCheckKeys(readiness.checks, /^events\./)
    }),
    item('llm.configuration', 'llm', aggregateChecks(diagnostics.checks, /^config\.llm\./), 'LLM provider configuration is ready for the selected provider.', {
      provider: diagnostics.configuration && diagnostics.configuration.llm && diagnostics.configuration.llm.provider,
      checks: selectCheckKeys(diagnostics.checks, /^config\.llm\./)
    })
  ];

  return {
    generatedAt: safeOptions.now || diagnostics.generatedAt || readiness.generatedAt || new Date().toISOString(),
    status: aggregateStatuses(items.map(function (check) { return check.status; })),
    items,
    diagnostics,
    adapterDiagnostics,
    notificationDiagnostics,
    sourceDiagnostics,
    readiness
  };
}

function item(key, area, status, summary, evidence) {
  return {
    key,
    area,
    status,
    summary,
    evidence: evidence || {}
  };
}

function aggregateChecks(checks, pattern) {
  const selected = (checks || []).filter(function (check) {
    return pattern.test(check.key);
  });
  if (selected.length === 0) return 'warn';
  return aggregateStatuses(selected.map(function (check) { return check.status; }));
}

function selectCheckKeys(checks, pattern) {
  return (checks || []).filter(function (check) {
    return pattern.test(check.key);
  }).map(function (check) {
    return {
      key: check.key,
      status: check.status,
      summary: check.summary
    };
  });
}

function aggregateStatuses(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getDeploymentChecklist
};
