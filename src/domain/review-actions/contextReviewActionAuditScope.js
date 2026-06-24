'use strict';

function auditSourceId(audit) {
  const request = audit && audit.request || {};
  const actionGate = request.actionGate || {};
  const actionPlan = actionGate.actionPlan || {};
  return audit && audit.sourceId ||
    request.sourceId ||
    actionGate.sourceId ||
    actionPlan.sourceId;
}

function auditSourceKey(audit) {
  const request = audit && audit.request || {};
  const actionGate = request.actionGate || {};
  const actionPlan = actionGate.actionPlan || {};
  return audit && audit.sourceKey ||
    request.sourceKey ||
    actionGate.sourceKey ||
    actionPlan.sourceKey;
}

module.exports = {
  auditSourceId,
  auditSourceKey
};
