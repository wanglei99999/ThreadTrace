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
    const output = buildCycleOutput({
      generatedAt,
      traceId,
      pipeline,
      primarySource,
      drilldown: finalDrilldown,
      sourceChangedEvents,
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
