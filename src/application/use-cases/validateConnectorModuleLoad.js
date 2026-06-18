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
  ];

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    valid: checks.every(function (item) { return item.status !== 'fail'; }),
    status: aggregateStatus(checks),
    modulePath: safeOptions.modulePath,
    checks,
    modules,
    errors
  };
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
