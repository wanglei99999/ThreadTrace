'use strict';

function getSourceOnboardingPreflight(options) {
  const safeOptions = options || {};
  const catalog = safeOptions.catalog || {};
  const connectorReadiness = safeOptions.connectorReadiness || {};
  const sourceType = safeOptions.sourceType || (safeOptions.sourceValidation && safeOptions.sourceValidation.source && safeOptions.sourceValidation.source.sourceType);
  const sourceKey = safeOptions.sourceKey || safeOptions.forum ||
    (safeOptions.sourceValidation && safeOptions.sourceValidation.source && safeOptions.sourceValidation.source.sourceKey);
  const catalogSourceType = findCatalogSourceType(catalog, sourceType);
  const connector = findConnector(connectorReadiness, sourceType);
  const contractSummary = summarizeContract(safeOptions.threadSnapshotContract);
  const steps = [
    step('catalog.sourceType', catalogSourceType ? 'ok' : 'fail', 'Requested source type is registered in the connector catalog.', {
      sourceType,
      supported: Boolean(catalogSourceType),
      compatibleSourceKeys: catalogSourceType ? catalogSourceType.compatibleSourceKeys || [] : []
    }),
    step('connectors.readiness', connectorReadinessStatus(connector, connectorReadiness), 'Connector readiness is acceptable for the requested source type.', {
      sourceType,
      connectorStatus: connector && connector.status,
      moduleErrorCount: connectorReadiness.modules ? connectorReadiness.modules.errorCount || 0 : 0
    }),
    step('threadSnapshot.contract', contractSummary.version ? 'ok' : 'fail', 'ThreadSnapshot JSON contract is available for external sources.', contractSummary)
  ];

  if (safeOptions.sourceValidation) {
    steps.push(step('source.registrationDraft', sourceValidationStatus(safeOptions.sourceValidation), 'Tracked source draft can be registered.', {
      valid: safeOptions.sourceValidation.valid,
      sourceId: safeOptions.sourceValidation.source && safeOptions.sourceValidation.source.id,
      error: safeOptions.sourceValidation.error,
      checks: safeOptions.sourceValidation.checks || []
    }));
  }

  if (safeOptions.threadJsonValidation) {
    steps.push(step('threadJson.contractValidation', threadJsonValidationStatus(safeOptions.threadJsonValidation), 'Normalized thread JSON input satisfies the ThreadSnapshot contract.', {
      valid: safeOptions.threadJsonValidation.valid,
      thread: safeOptions.threadJsonValidation.thread,
      error: safeOptions.threadJsonValidation.error,
      checks: safeOptions.threadJsonValidation.checks || []
    }));
  }

  return {
    generatedAt: safeOptions.now || catalog.generatedAt || connectorReadiness.generatedAt || new Date().toISOString(),
    status: aggregateStatus(steps.map(function (item) { return item.status; })),
    sourceKey,
    sourceType,
    steps,
    catalog: {
      sourceType: catalogSourceType,
      sourceTypeCount: (catalog.sourceTypes || []).length,
      adapterCount: (catalog.adapters || []).length
    },
    connectorReadiness,
    sourceValidation: safeOptions.sourceValidation,
    threadJsonValidation: safeOptions.threadJsonValidation,
    threadSnapshotContract: contractSummary
  };
}

function findCatalogSourceType(catalog, sourceType) {
  return (catalog.sourceTypes || []).find(function (item) {
    return item.sourceType === sourceType;
  });
}

function findConnector(readiness, sourceType) {
  return (readiness.connectors || []).find(function (item) {
    return item.sourceType === sourceType;
  });
}

function connectorReadinessStatus(connector, readiness) {
  const moduleErrorCount = readiness && readiness.modules ? readiness.modules.errorCount || 0 : 0;
  if (!connector || moduleErrorCount > 0) return 'fail';
  return connector.status || 'fail';
}

function sourceValidationStatus(sourceValidation) {
  if (!sourceValidation.valid) return 'fail';
  return sourceValidation.status || 'ok';
}

function threadJsonValidationStatus(threadJsonValidation) {
  if (!threadJsonValidation.valid) return 'fail';
  return threadJsonValidation.status || 'ok';
}

function summarizeContract(contract) {
  const schema = contract && contract.schema ? contract.schema : {};
  return {
    version: contract && contract.version,
    required: Array.isArray(schema.required) ? schema.required : [],
    schemaType: schema.type
  };
}

function step(key, status, summary, evidence) {
  return {
    key,
    status,
    summary,
    evidence: evidence || {}
  };
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getSourceOnboardingPreflight
};
