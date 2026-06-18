'use strict';

const { evaluateTrackedSourceSchedule } = require('../../domain/scheduling/trackedSourceSchedule');
const { isStaleSourceRun } = require('./runTrackedSourceIngestTask');

function evaluateSourceRunSchedule(source, checkedAt, options) {
  const decision = evaluateTrackedSourceSchedule(source, checkedAt);
  if (decision.reason !== 'source-running') return decision;

  const safeOptions = options || {};
  if (!isStaleSourceRun(source.runState || {}, {
    now: checkedAt,
    staleAfterMs: safeOptions.sourceRunStaleAfterMs
  })) {
    return decision;
  }

  const recoverableSource = Object.assign({}, source, {
    runState: Object.assign({}, source.runState, {
      status: 'recovering-stale-running'
    })
  });
  const recoveredDecision = evaluateTrackedSourceSchedule(recoverableSource, checkedAt);
  if (!recoveredDecision.due) return recoveredDecision;
  return Object.assign({}, recoveredDecision, {
    reason: 'stale-source-running-' + recoveredDecision.reason
  });
}

module.exports = {
  evaluateSourceRunSchedule
};
