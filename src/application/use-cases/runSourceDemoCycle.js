'use strict';

const { assertTaskRepository } = require('../ports/taskRepository');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');

async function runSourceDemoCycle(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const generatedAt = safeOptions.now || new Date().toISOString();
  const traceId = safeOptions.traceId || buildTraceId(safeOptions, generatedAt);
  assertFunction(safeOptions.runDueSourceInsightPipelineTasks, 'runSourceDemoCycle requires runDueSourceInsightPipelineTasks(request).');
  assertFunction(safeOptions.getSourceOperationsDrilldown, 'runSourceDemoCycle requires getSourceOperationsDrilldown(request).');

  let task = createTaskRecord('source-demo-cycle', {
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    provider: safeOptions.provider || 'mock',
    limit: safeOptions.limit || 10,
    acknowledgeEvents: safeOptions.acknowledgeEvents === true,
    executeAcknowledgement: safeOptions.executeAcknowledgement === true,
    generatedAt
  }, {
    requestId: safeOptions.requestId,
    traceId,
    idempotencyKey: safeOptions.idempotencyKey
  });
  await taskRepository.saveTask(task);
  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const pipeline = await safeOptions.runDueSourceInsightPipelineTasks({
      sourceId: safeOptions.sourceId,
      sourceKey: safeOptions.sourceKey || safeOptions.forum,
      provider: safeOptions.provider || 'mock',
      limit: safeOptions.limit || 10,
      now: safeOptions.now,
      traceId,
      baseReportType: safeOptions.baseReportType,
      semanticEnrichmentEnabled: safeOptions.semanticEnrichmentEnabled,
      semanticSkipIfUnchanged: safeOptions.semanticSkipIfUnchanged,
      sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: safeOptions.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: safeOptions.sourceFailureMaxRetryBackoffMs,
      requestId: safeOptions.requestId,
      idempotencyKey: safeOptions.idempotencyKey
    });
    const primarySource = resolvePrimarySource(safeOptions, pipeline);
    const drilldown = primarySource
      ? await safeOptions.getSourceOperationsDrilldown(Object.assign({}, primarySource, {
        limit: safeOptions.drilldownLimit || 20,
        now: safeOptions.now,
        sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
        sourceFailureRetryBackoffMs: safeOptions.sourceFailureRetryBackoffMs,
        sourceFailureMaxRetryBackoffMs: safeOptions.sourceFailureMaxRetryBackoffMs
      }))
      : undefined;
    const sourceChangedEvents = listSourceChangedEvents(drilldown);
    const acknowledgement = safeOptions.acknowledgeEvents === true
      ? await acknowledgeCycleEvents(safeOptions, primarySource, sourceChangedEvents)
      : undefined;
    const finalDrilldown = acknowledgement && acknowledgement.executed && primarySource
      ? await safeOptions.getSourceOperationsDrilldown(Object.assign({}, primarySource, {
        limit: safeOptions.drilldownLimit || 20,
        now: safeOptions.now
      }))
      : drilldown;
    const finalSourceChangedEvents = listSourceChangedEvents(finalDrilldown);
    const output = buildCycleOutput({
      generatedAt,
      traceId,
      pipeline,
      primarySource,
      drilldown: finalDrilldown,
      sourceChangedEvents: finalSourceChangedEvents.length > 0 ? finalSourceChangedEvents : sourceChangedEvents,
      acknowledgement
    });

    task = markTaskCompleted(task, summarizeTaskOutput(output));
    await taskRepository.saveTask(task);
    return Object.assign({
      task
    }, output);
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

async function acknowledgeCycleEvents(options, primarySource, sourceChangedEvents) {
  if (sourceChangedEvents.length === 0) {
    return {
      status: 'noop',
      dryRun: options.executeAcknowledgement !== true,
      executed: false,
      requestedCount: 0,
      eventCount: 0,
      candidateCount: 0,
      acknowledgedCount: 0,
      skippedCount: 0,
      results: []
    };
  }
  assertFunction(options.acknowledgeNotificationEvents, 'runSourceDemoCycle requires acknowledgeNotificationEvents(request) when acknowledgeEvents=true.');
  return options.acknowledgeNotificationEvents({
    eventIds: sourceChangedEvents.map(function (event) { return event.id; }),
    type: 'source-changed',
    sourceId: primarySource && primarySource.sourceId,
    sourceKey: primarySource && primarySource.sourceKey,
    acknowledged: false,
    acknowledgedBy: options.acknowledgedBy || 'demo-cycle',
    note: options.acknowledgementNote || 'Handled by source demo cycle.',
    now: options.now,
    dryRun: options.executeAcknowledgement !== true,
    execute: options.executeAcknowledgement === true
  });
}

function buildCycleOutput(input) {
  const pipeline = input.pipeline || {};
  const drilldown = input.drilldown;
  const status = resolveCycleStatus({
    pipeline,
    sourceChangedEvents: input.sourceChangedEvents,
    acknowledgement: input.acknowledgement
  });
  return {
    generatedAt: input.generatedAt,
    status,
    traceId: input.traceId,
    primarySource: input.primarySource,
    summary: {
      sourceCount: pipeline.sourceCount || 0,
      dueCount: pipeline.dueCount || 0,
      completedCount: pipeline.completedCount || 0,
      failedCount: pipeline.failedCount || 0,
      sourceChangedEventCount: input.sourceChangedEvents.length,
      openEventCount: drilldown && drilldown.health && drilldown.health.events
        ? drilldown.health.events.unacknowledged
        : undefined,
      acknowledgementStatus: input.acknowledgement && input.acknowledgement.status
    },
    closure: buildClosureReport({
      status,
      pipeline,
      primarySource: input.primarySource,
      drilldown,
      sourceChangedEvents: input.sourceChangedEvents,
      acknowledgement: input.acknowledgement
    }),
    pipeline,
    sourceChangedEvents: input.sourceChangedEvents,
    acknowledgement: input.acknowledgement,
    drilldown,
    nextActions: buildNextActions(status, input.primarySource, input.sourceChangedEvents, input.acknowledgement)
  };
}

function summarizeTaskOutput(output) {
  return {
    status: output.status,
    traceId: output.traceId,
    primarySource: output.primarySource,
    summary: output.summary,
    closure: output.closure && {
      status: output.closure.status,
      readyForDailyUse: output.closure.readyForDailyUse,
      summary: output.closure.summary
    },
    pipelineTaskId: output.pipeline && output.pipeline.task && output.pipeline.task.id,
    sourceChangedEventIds: output.sourceChangedEvents.map(function (event) { return event.id; }),
    acknowledgementStatus: output.acknowledgement && output.acknowledgement.status,
    drilldownStatus: output.drilldown && output.drilldown.status
  };
}

function resolveCycleStatus(input) {
  const pipeline = input.pipeline || {};
  if ((pipeline.failedCount || 0) > 0) return 'fail';
  if (input.acknowledgement && input.acknowledgement.status === 'preview') return 'review';
  if ((pipeline.dueCount || 0) === 0) return 'noop';
  if (input.sourceChangedEvents.length === 0) return 'warn';
  return 'ok';
}

function buildClosureReport(input) {
  const steps = [
    buildPipelineClosureStep(input.pipeline),
    buildPrimarySourceClosureStep(input.primarySource),
    buildSemanticClosureStep(input.pipeline),
    buildEventClosureStep(input.sourceChangedEvents),
    buildDrilldownClosureStep(input.drilldown, input.sourceChangedEvents),
    buildAcknowledgementClosureStep(input.acknowledgement, input.sourceChangedEvents)
  ];
  const summary = summarizeClosureSteps(steps);
  const status = summary.failed > 0
    ? 'fail'
    : (summary.warning > 0 || summary.noop > 0 ? 'review' : 'ok');
  return {
    status,
    readyForDailyUse: status === 'ok',
    summary,
    steps,
    recommendedNextAction: buildClosureNextAction(status, steps)
  };
}

function buildPipelineClosureStep(pipeline) {
  const safePipeline = pipeline || {};
  const failedCount = safePipeline.failedCount || 0;
  const completedCount = safePipeline.completedCount || 0;
  const dueCount = safePipeline.dueCount || 0;
  let status = 'ok';
  let summary = 'Due source insight pipeline completed.';
  if (failedCount > 0) {
    status = 'fail';
    summary = 'At least one due source insight pipeline failed.';
  } else if (dueCount === 0 || completedCount === 0) {
    status = 'noop';
    summary = 'No due source insight pipeline completed in this cycle.';
  }
  return closureStep('pipeline', 'Due insight pipeline', status, summary, [
    evidence('task', safePipeline.task && safePipeline.task.id),
    evidence('sources', 'total=' + (safePipeline.sourceCount || 0) + ', due=' + dueCount + ', completed=' + completedCount + ', failed=' + failedCount)
  ], status === 'ok' ? undefined : 'Run due source pipelines or inspect skipped/failed source rows.');
}

function buildPrimarySourceClosureStep(primarySource) {
  const sourceLabel = formatScopeLabel(primarySource);
  return closureStep(
    'primary-source',
    'Source scope',
    primarySource ? 'ok' : 'warn',
    primarySource ? 'The cycle resolved a primary source scope.' : 'The cycle did not resolve a primary source scope.',
    [evidence('scope', sourceLabel)],
    primarySource ? undefined : 'Register or select a source before running the demo cycle.'
  );
}

function buildSemanticClosureStep(pipeline) {
  const results = pipeline && pipeline.results || [];
  const statuses = results.map(function (item) {
    return item && item.semantic && item.semantic.status;
  }).filter(Boolean);
  const completed = statuses.filter(function (status) { return status === 'completed'; }).length;
  const failed = statuses.filter(function (status) { return status === 'failed'; }).length;
  let status = 'ok';
  let summary = 'Semantic enrichment completed for at least one source result.';
  if (failed > 0) {
    status = 'fail';
    summary = 'Semantic enrichment failed for at least one source result.';
  } else if (completed === 0) {
    status = 'warn';
    summary = 'No completed semantic enrichment result was recorded.';
  }
  return closureStep('semantic-enrichment', 'Semantic enrichment', status, summary, [
    evidence('statuses', statuses.length ? statuses.join(',') : 'none')
  ], status === 'ok' ? undefined : 'Check LLM provider readiness and semantic enrichment settings.');
}

function buildEventClosureStep(sourceChangedEvents) {
  const events = sourceChangedEvents || [];
  return closureStep(
    'source-changed-event',
    'Source changed event',
    events.length > 0 ? 'ok' : 'warn',
    events.length > 0 ? 'The cycle produced source-changed notification evidence.' : 'No source-changed notification event was produced.',
    [
      evidence('count', String(events.length)),
      evidence('eventIds', events.map(function (event) { return event.id; }).filter(Boolean).join(',') || 'none')
    ],
    events.length > 0 ? undefined : 'Inspect pipeline cursor changes and notification event synthesis.'
  );
}

function buildDrilldownClosureStep(drilldown, sourceChangedEvents) {
  const events = sourceChangedEvents || [];
  const recentEvents = drilldown && drilldown.recent && drilldown.recent.events || [];
  const eventIds = new Set(events.map(function (event) { return event.id; }).filter(Boolean));
  const timelineHit = recentEvents.some(function (event) {
    return event && eventIds.has(event.id);
  });
  const sourceFound = Boolean(drilldown && drilldown.sourceFound);
  const status = sourceFound && (events.length === 0 || timelineHit) ? (events.length > 0 ? 'ok' : 'warn') : 'warn';
  return closureStep(
    'operator-drilldown',
    'Operator drill-down',
    status,
    status === 'ok'
      ? 'Source operations drill-down includes the generated event in the timeline.'
      : (sourceFound ? 'Source operations drill-down loaded, but event timeline evidence is incomplete.' : 'Source operations drill-down did not find the source.'),
    [
      evidence('sourceFound', String(sourceFound)),
      evidence('timelineEventMatched', String(timelineHit)),
      evidence('recentEventCount', String(recentEvents.length))
    ],
    status === 'ok' ? undefined : 'Open the source drill-down and verify task/event timeline evidence.'
  );
}

function buildAcknowledgementClosureStep(acknowledgement, sourceChangedEvents) {
  const events = sourceChangedEvents || [];
  const acknowledgedEvents = events.filter(function (event) { return Boolean(event.acknowledgedAt); });
  if (events.length === 0) {
    return closureStep('operator-acknowledgement', 'Operator acknowledgement', 'warn', 'No generated event was available for acknowledgement.', [
      evidence('events', '0')
    ], 'Generate a source-changed event before closing the loop.');
  }
  if (acknowledgedEvents.length === events.length) {
    return closureStep('operator-acknowledgement', 'Operator acknowledgement', 'ok', 'All generated source-changed events are acknowledged.', [
      evidence('acknowledged', acknowledgedEvents.length + '/' + events.length),
      evidence('acknowledgedBy', acknowledgedEvents.map(function (event) { return event.acknowledgedBy; }).filter(Boolean).join(',') || 'unknown')
    ]);
  }
  if (!acknowledgement) {
    return closureStep('operator-acknowledgement', 'Operator acknowledgement', 'warn', 'Generated events are still awaiting operator acknowledgement.', [
      evidence('openEvents', String(events.length - acknowledgedEvents.length))
    ], 'Review and acknowledge the generated source-changed events.');
  }
  return closureStep(
    'operator-acknowledgement',
    'Operator acknowledgement',
    'warn',
    acknowledgement.status === 'preview'
      ? 'Acknowledgement was previewed but not executed.'
      : 'Acknowledgement did not close every generated event.',
    [
      evidence('ackStatus', acknowledgement.status || 'unknown'),
      evidence('acknowledged', (acknowledgement.acknowledgedCount || 0) + '/' + events.length),
      evidence('candidates', String(acknowledgement.candidateCount || 0))
    ],
    'Execute acknowledgement after operator review.'
  );
}

function summarizeClosureSteps(steps) {
  const requiredSteps = steps.filter(function (step) { return step.required !== false; });
  const total = requiredSteps.length;
  const completed = requiredSteps.filter(function (step) { return step.status === 'ok'; }).length;
  const failed = requiredSteps.filter(function (step) { return step.status === 'fail'; }).length;
  const noop = requiredSteps.filter(function (step) { return step.status === 'noop'; }).length;
  const warning = requiredSteps.filter(function (step) { return step.status === 'warn'; }).length;
  return {
    total,
    completed,
    warning,
    noop,
    failed,
    readinessScore: total === 0 ? 0 : Math.round((completed / total) * 100),
    missingStepKeys: requiredSteps.filter(function (step) {
      return step.status !== 'ok';
    }).map(function (step) { return step.key; })
  };
}

function buildClosureNextAction(status, steps) {
  if (status === 'ok') return 'The demo cycle is closed; keep it scheduled and monitor source operations.';
  const nextStep = steps.find(function (step) {
    return step.status === 'fail' || step.status === 'warn' || step.status === 'noop';
  });
  return nextStep && nextStep.nextAction || 'Review the demo cycle evidence and close remaining warnings.';
}

function closureStep(key, title, status, summary, evidenceItems, nextAction) {
  const result = {
    key,
    title,
    status,
    required: true,
    summary,
    evidence: (evidenceItems || []).filter(function (item) {
      return item && item.value !== undefined && item.value !== null && item.value !== '';
    })
  };
  if (nextAction) result.nextAction = nextAction;
  return result;
}

function evidence(key, value) {
  return {
    key,
    value
  };
}

function resolvePrimarySource(options, pipeline) {
  const safeOptions = options || {};
  const firstResult = pipeline && pipeline.results && pipeline.results[0];
  const firstSkipped = pipeline && pipeline.skipped && pipeline.skipped[0];
  const source = firstResult && firstResult.source || firstSkipped && firstSkipped.source || {};
  const sourceId = safeOptions.sourceId || source.id || source.sourceId;
  const sourceKey = safeOptions.sourceKey || safeOptions.forum || source.sourceKey;
  if (!sourceId && !sourceKey) return undefined;
  return {
    sourceId,
    sourceKey
  };
}

function listSourceChangedEvents(drilldown) {
  const events = drilldown && drilldown.recent && drilldown.recent.events || [];
  return events.filter(function (event) {
    return event && event.type === 'source-changed';
  }).map(function (event) {
    return {
      id: event.id,
      type: event.type,
      severity: event.severity,
      sourceId: event.sourceId,
      sourceKey: event.sourceKey,
      title: event.title,
      summary: event.summary,
      createdAt: event.createdAt,
      deliveryStatus: event.deliveryStatus,
      acknowledgedAt: event.acknowledgedAt,
      acknowledgedBy: event.acknowledgedBy,
      taskId: event.taskId
    };
  });
}

function buildNextActions(status, primarySource, sourceChangedEvents, acknowledgement) {
  if (status === 'noop') {
    return [{
      key: 'demo-cycle.wait',
      severity: 'info',
      summary: 'No due source was available for this demo cycle.',
      commands: ['node src/presentation/cli/threadtrace.js source-schedule']
    }];
  }
  if (status === 'fail') {
    return [{
      key: 'demo-cycle.inspect',
      severity: 'critical',
      summary: 'At least one due source insight pipeline failed; inspect the source drill-down timeline.',
      commands: [sourceDrilldownCommand(primarySource)]
    }];
  }
  if (acknowledgement && acknowledgement.status === 'preview') {
    return [{
      key: 'demo-cycle.acknowledge',
      severity: 'info',
      summary: 'Review the source-changed event acknowledgement preview, then execute acknowledgement when handled.',
      commands: sourceChangedEvents.map(function (event) {
        return 'node src/presentation/cli/threadtrace.js ack-event --event-id ' + event.id + ' --by demo-cycle';
      })
    }];
  }
  return [{
    key: 'demo-cycle.review',
    severity: 'info',
    summary: 'Review the generated source-changed event and source operations timeline.',
    commands: [sourceDrilldownCommand(primarySource)]
  }];
}

function sourceDrilldownCommand(primarySource) {
  if (primarySource && primarySource.sourceId) {
    return 'node src/presentation/cli/threadtrace.js source-drilldown --source-id ' + primarySource.sourceId;
  }
  if (primarySource && primarySource.sourceKey) {
    return 'node src/presentation/cli/threadtrace.js source-drilldown --source-key ' + primarySource.sourceKey;
  }
  return 'node src/presentation/cli/threadtrace.js operations-overview';
}

function formatScopeLabel(scope) {
  const safeScope = scope || {};
  return [safeScope.sourceId, safeScope.sourceKey].filter(Boolean).join(' / ') || 'none';
}

function buildTraceId(options, generatedAt) {
  const scope = options.sourceId || options.sourceKey || options.forum || 'all';
  return ['source-demo-cycle', scope, generatedAt].join(':');
}

function assertFunction(value, message) {
  if (typeof value !== 'function') throw new Error(message);
}

module.exports = {
  runSourceDemoCycle
};
