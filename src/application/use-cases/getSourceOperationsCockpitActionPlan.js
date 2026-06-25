'use strict';

const { createApplicationError } = require('../errors/applicationError');

function getSourceOperationsCockpitActionPlan(options) {
  const safeOptions = options || {};
  const cockpit = safeOptions.sourceOperationsCockpit || safeOptions.cockpit || {};
  const item = selectCockpitItem(cockpit.queue || [], safeOptions);
  const generatedAt = safeOptions.now || cockpit.generatedAt || new Date().toISOString();
  const actions = buildActions(item, safeOptions);
  return {
    generatedAt,
    status: actions.some(function (action) { return action.mode === 'execute'; }) ? 'actionable' : 'review',
    selectedItem: item,
    summary: {
      actionCount: actions.length,
      viewCount: actions.filter(function (action) { return action.mode === 'view'; }).length,
      dryRunCount: actions.filter(function (action) { return action.mode === 'dry-run'; }).length,
      executeCount: actions.filter(function (action) { return action.mode === 'execute'; }).length,
      destructiveCount: actions.filter(function (action) { return action.destructive === true; }).length
    },
    actions,
    recommendedNextAction: recommendNextAction(item, actions),
    inputs: {
      requestedRank: safeOptions.rank,
      requestedItemId: safeOptions.itemId,
      cockpitGeneratedAt: cockpit.generatedAt
    }
  };
}

function selectCockpitItem(queue, options) {
  if (!queue.length) {
    throw createApplicationError('source_cockpit_queue_empty', 'Source operations cockpit has no queue items to plan.', {
      statusCode: 404
    });
  }
  const itemId = options.itemId || options.id;
  if (itemId) {
    const item = queue.find(function (candidate) {
      return candidate.id === itemId;
    });
    if (!item) {
      throw createApplicationError('source_cockpit_item_not_found', 'Requested source operations cockpit item was not found.', {
        statusCode: 404,
        details: {
          itemId
        }
      });
    }
    return item;
  }
  const rank = Number(options.rank || 1);
  const item = queue.find(function (candidate) {
    return Number(candidate.rank) === rank;
  }) || queue[Math.max(0, Math.min(queue.length - 1, rank - 1))];
  if (!item) {
    throw createApplicationError('source_cockpit_item_not_found', 'Requested source operations cockpit rank was not found.', {
      statusCode: 404,
      details: {
        rank
      }
    });
  }
  return item;
}

function buildActions(item, options) {
  const source = item.source || {};
  const actions = [];
  if (item.scope === 'source-type' || item.sourceType) {
    actions.push(sourceTypeDrilldownAction(item));
    actions.push(sourceTypeAlertPreviewAction(item));
    actions.push(sourceTypeDuePipelineAction(item, options));
    return actions.concat(commandActions(item));
  }
  if (source.id || source.sourceKey) {
    actions.push(sourceDrilldownAction(source));
  }
  if (source.id) {
    actions.push(sourceIngestAction(source));
    actions.push(sourceInsightAction(source, options));
    if (shouldOfferFailureReset(item)) {
      actions.push(sourceFailureResetPreviewAction(source));
      actions.push(sourceFailureResetExecuteAction(source));
    }
    if (source.enabled === false) {
      actions.push(sourceEnablePreviewAction(source));
      actions.push(sourceEnableExecuteAction(source));
    }
  }
  if (item.kind === 'source-attention' || item.kind === 'due-source') {
    actions.push(sourceAttentionAlertPreviewAction(source));
  }
  if (item.kind === 'runbook') {
    actions.push(runbookAlertPreviewAction(source));
  }
  return actions.concat(commandActions(item));
}

function sourceDrilldownAction(source) {
  const query = new URLSearchParams();
  if (source.id) query.set('sourceId', source.id);
  if (source.sourceKey) query.set('sourceKey', source.sourceKey);
  query.set('limit', '50');
  return action({
    key: 'source.drilldown',
    label: 'Open source drill-down',
    mode: 'view',
    severity: 'info',
    summary: 'Inspect this source across schedule, tasks, events, workers, leases, and timeline.',
    api: {
      method: 'GET',
      path: '/api/operations/source-drilldown?' + query.toString()
    },
    command: scopedCommand('node src/presentation/cli/threadtrace.js source-drilldown', source)
  });
}

function sourceIngestAction(source) {
  return action({
    key: 'source.run-ingest',
    label: 'Run source ingest',
    mode: 'execute',
    severity: 'info',
    summary: 'Run collection for this one source through the existing durable source ingest task.',
    api: {
      method: 'POST',
      path: '/api/sources/' + encodeURIComponent(source.id) + '/tasks/ingest',
      body: {}
    },
    command: 'node src/presentation/cli/threadtrace.js run-source --source-id ' + quoteCommandValue(source.id),
    confirmationRequired: true
  });
}

function sourceInsightAction(source, options) {
  const provider = options.provider || 'mock';
  return action({
    key: 'source.run-insight',
    label: 'Run source insight',
    mode: 'execute',
    severity: 'info',
    summary: 'Run ingest plus analysis and semantic enrichment for this one source.',
    api: {
      method: 'POST',
      path: '/api/sources/' + encodeURIComponent(source.id) + '/tasks/insight-pipeline',
      body: {
        provider
      }
    },
    command: 'node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id ' + quoteCommandValue(source.id) + ' --provider ' + quoteCommandValue(provider),
    confirmationRequired: true
  });
}

function sourceFailureResetPreviewAction(source) {
  return action({
    key: 'source.failure-reset.preview',
    label: 'Preview failure reset',
    mode: 'dry-run',
    severity: 'warning',
    summary: 'Preview clearing failed source state and scheduling an immediate retry.',
    api: {
      method: 'POST',
      path: '/api/sources/' + encodeURIComponent(source.id) + '/failure/reset',
      body: {
        execute: false,
        retryNow: true,
        resetBy: 'operator'
      }
    },
    command: 'node src/presentation/cli/threadtrace.js reset-source-failure --source-id ' + quoteCommandValue(source.id) + ' --retry-now true'
  });
}

function sourceFailureResetExecuteAction(source) {
  return action({
    key: 'source.failure-reset.execute',
    label: 'Retry now',
    mode: 'execute',
    severity: 'warning',
    summary: 'Clear failed source state and schedule an immediate retry.',
    api: {
      method: 'POST',
      path: '/api/sources/' + encodeURIComponent(source.id) + '/failure/reset',
      body: {
        execute: true,
        retryNow: true,
        resetBy: 'operator'
      }
    },
    command: 'node src/presentation/cli/threadtrace.js reset-source-failure --source-id ' + quoteCommandValue(source.id) + ' --retry-now true --execute true',
    destructive: true,
    confirmationRequired: true
  });
}

function sourceEnablePreviewAction(source) {
  return action({
    key: 'source.enable.preview',
    label: 'Preview enable',
    mode: 'dry-run',
    severity: 'info',
    summary: 'Preview enabling this disabled source.',
    api: {
      method: 'POST',
      path: '/api/sources/' + encodeURIComponent(source.id) + '/enable',
      body: {
        execute: false
      }
    },
    command: 'node src/presentation/cli/threadtrace.js enable-source --source-id ' + quoteCommandValue(source.id)
  });
}

function sourceEnableExecuteAction(source) {
  return action({
    key: 'source.enable.execute',
    label: 'Enable source',
    mode: 'execute',
    severity: 'info',
    summary: 'Enable this tracked source.',
    api: {
      method: 'POST',
      path: '/api/sources/' + encodeURIComponent(source.id) + '/enable',
      body: {
        execute: true
      }
    },
    command: 'node src/presentation/cli/threadtrace.js enable-source --source-id ' + quoteCommandValue(source.id) + ' --execute true',
    confirmationRequired: true
  });
}

function sourceAttentionAlertPreviewAction(source) {
  return action({
    key: 'source-attention.events.preview',
    label: 'Preview source alert',
    mode: 'dry-run',
    severity: 'warning',
    summary: 'Preview notification outbox events for this source attention item.',
    api: {
      method: 'POST',
      path: '/api/operations/source-attention/events',
      body: compactObject({
        sourceId: source.id,
        sourceKey: source.sourceKey,
        execute: false,
        priorityScoreThreshold: 70,
        resolveStale: true
      })
    },
    command: scopedCommand('node src/presentation/cli/threadtrace.js synthesize-source-attention-events --priority-score-threshold 70', source)
  });
}

function runbookAlertPreviewAction(source) {
  return action({
    key: 'runbook.events.preview',
    label: 'Preview runbook alert',
    mode: 'dry-run',
    severity: 'warning',
    summary: 'Preview notification outbox events for active runbook actions.',
    api: {
      method: 'POST',
      path: '/api/operations/runbook/events',
      body: compactObject({
        sourceId: source.id,
        sourceKey: source.sourceKey,
        execute: false,
        resolveStale: true,
        includeRunbook: true
      })
    },
    command: scopedCommand('node src/presentation/cli/threadtrace.js synthesize-runbook-events', source)
  });
}

function sourceTypeDrilldownAction(item) {
  const query = new URLSearchParams();
  query.set('sourceType', item.sourceType || 'unknown');
  query.set('limit', '50');
  query.set('includeSourceTypeOperations', 'true');
  return action({
    key: 'source-type.drilldown',
    label: 'Open type drill-down',
    mode: 'view',
    severity: 'info',
    summary: 'Inspect all sources, workers, tasks, events, and pressure for this connector family.',
    api: {
      method: 'GET',
      path: '/api/operations/source-type-drilldown?' + query.toString()
    },
    command: 'node src/presentation/cli/threadtrace.js source-type-drilldown --source-type ' + quoteCommandValue(item.sourceType || 'unknown')
  });
}

function sourceTypeAlertPreviewAction(item) {
  return action({
    key: 'source-type-operations.events.preview',
    label: 'Preview type alert',
    mode: 'dry-run',
    severity: 'warning',
    summary: 'Preview notification outbox events for this connector-family pressure.',
    api: {
      method: 'POST',
      path: '/api/operations/source-type-operations/events',
      body: {
        sourceType: item.sourceType,
        execute: false,
        priorityScoreThreshold: 70,
        resolveStale: true
      }
    },
    command: 'node src/presentation/cli/threadtrace.js synthesize-source-type-operations-events --source-type ' + quoteCommandValue(item.sourceType || 'unknown') + ' --priority-score-threshold 70'
  });
}

function sourceTypeDuePipelineAction(item, options) {
  const provider = options.provider || 'mock';
  return action({
    key: 'source-type.run-due-insight',
    label: 'Run due insight for type',
    mode: 'execute',
    severity: 'info',
    summary: 'Run due insight pipelines only for this connector family.',
    api: {
      method: 'POST',
      path: '/api/sources/tasks/insight-pipeline-due',
      body: {
        sourceType: item.sourceType,
        provider
      }
    },
    command: 'node src/presentation/cli/threadtrace.js run-due-source-insight-pipelines --source-type ' + quoteCommandValue(item.sourceType || 'unknown') + ' --provider ' + quoteCommandValue(provider),
    confirmationRequired: true
  });
}

function commandActions(item) {
  return (item.relatedCommands || []).filter(function (command) {
    return command && command !== item.recommendedCommand;
  }).slice(0, 2).map(function (command, index) {
    return action({
      key: 'manual.command.' + (index + 1),
      label: 'Copy related command',
      mode: 'manual',
      severity: 'info',
      summary: 'A related command from the underlying report.',
      command
    });
  });
}

function shouldOfferFailureReset(item) {
  const text = [
    item.recommendedNextAction,
    item.recommendedCommand,
    item.summary
  ].concat(item.relatedCommands || []).join(' ');
  return /reset-source-failure|retry-now|failure|retry wait|backoff/i.test(text);
}

function recommendNextAction(item, actions) {
  const primary = actions.find(function (actionItem) {
    return actionItem.mode === 'dry-run';
  }) || actions.find(function (actionItem) {
    return actionItem.mode === 'view';
  }) || actions[0];
  if (!primary) return 'No source operations action is available for this queue item.';
  return 'Start with "' + primary.label + '" for ' + (item.title || item.id || 'this queue item') + '.';
}

function action(input) {
  return Object.assign({
    destructive: false,
    confirmationRequired: false
  }, input);
}

function scopedCommand(base, source) {
  const parts = [base];
  if (source && source.id) parts.push('--source-id ' + quoteCommandValue(source.id));
  if (source && source.sourceKey) parts.push('--source-key ' + quoteCommandValue(source.sourceKey));
  return parts.join(' ');
}

function compactObject(value) {
  return Object.keys(value || {}).reduce(function (result, key) {
    if (value[key] !== undefined && value[key] !== '') result[key] = value[key];
    return result;
  }, {});
}

function quoteCommandValue(value) {
  return '"' + String(value || '').replace(/"/g, '\\"') + '"';
}

module.exports = {
  getSourceOperationsCockpitActionPlan,
  selectCockpitItem
};
