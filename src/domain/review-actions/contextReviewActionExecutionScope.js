'use strict';

function executionSourceId(execution) {
  const request = execution && execution.request || {};
  const actionGate = request.actionGate || {};
  const actionPlan = actionGate.actionPlan || {};
  return execution && execution.sourceId ||
    request.sourceId ||
    actionGate.sourceId ||
    actionPlan.sourceId;
}

function executionSourceKey(execution) {
  const request = execution && execution.request || {};
  const actionGate = request.actionGate || {};
  const actionPlan = actionGate.actionPlan || {};
  return execution && execution.sourceKey ||
    request.sourceKey ||
    actionGate.sourceKey ||
    actionPlan.sourceKey;
}

module.exports = {
  executionSourceId,
  executionSourceKey
};
