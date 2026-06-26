'use strict';

const state = {
  adapters: [],
  sourceTypes: [],
  connectorPackages: [],
  connectorModuleErrors: [],
  currentView: 'history',
  rolloutManifestDraft: undefined,
  onboardingRecipeManifestDraft: undefined,
  loadedConnectorPackageManifestDraft: undefined,
  sourceTypeReadiness: undefined
};

const views = {
  history: {
    title: '历史分析',
    subtitle: '解析保存页目录，生成作者、实体、观点和证据概览。',
    mode: 'Evidence intake',
    focus: 'Local archive'
  },
  context: {
    title: '新发言解读',
    subtitle: '输入一条新发言，召回相关历史楼层和匹配理由。',
    mode: 'Context restore',
    focus: 'Author lens'
  },
  search: {
    title: '历史检索',
    subtitle: '先把保存页写入本地证据索引，再按关键词检索可引用的历史发言。',
    mode: 'Evidence recall',
    focus: 'Floor index'
  },
  system: {
    title: '系统状态',
    subtitle: '查看 API、适配器和本地服务状态。',
    mode: 'Operations deck',
    focus: 'Runtime + sources'
  }
};

document.addEventListener('DOMContentLoaded', function () {
  bindNavigation();
  bindForms();
  document.getElementById('refreshAdaptersButton').addEventListener('click', loadAdapters);
  document.getElementById('enrichHistoryButton').addEventListener('click', enrichHistoryDirectory);
  document.getElementById('refreshAuthorIntelligenceButton').addEventListener('click', loadAuthorIntelligence);
  document.getElementById('authorIntelligenceResult').addEventListener('click', handleAuthorIntelligenceAction);
  document.getElementById('historyCockpit').addEventListener('click', handleHistoryCockpitAction);
  document.getElementById('refreshTasksButton').addEventListener('click', loadTasks);
  document.getElementById('refreshSourcesButton').addEventListener('click', loadSources);
  document.getElementById('refreshSourceOperationsButton').addEventListener('click', loadSourceOperations);
  document.getElementById('refreshAutomationReadinessButton').addEventListener('click', loadAutomationReadiness);
  const automationReadinessResult = document.getElementById('automationReadinessResult');
  if (automationReadinessResult) automationReadinessResult.addEventListener('click', handleAutomationReadinessAction);
  const automationActionResult = document.getElementById('automationActionResult');
  if (automationActionResult) automationActionResult.addEventListener('click', handleAutomationActionResult);
  document.getElementById('runLlmReadinessButton').addEventListener('click', runLlmReadiness);
  document.getElementById('runLlmPreflightButton').addEventListener('click', runLlmPreflight);
  document.getElementById('runLlmEvaluationButton').addEventListener('click', runLlmEvaluation);
  document.getElementById('runDemoCycleButton').addEventListener('click', runDemoCycle);
  document.getElementById('loadConnectorModuleCatalogButton').addEventListener('click', loadConnectorModuleCatalogFromOnboardingForm);
  document.getElementById('onboardingResult').addEventListener('click', handleOnboardingAction);
  document.getElementById('sourceOnboardingRecipe').addEventListener('click', handleOnboardingAction);
  document.getElementById('rolloutReadinessResult').addEventListener('click', handleRolloutReadinessAction);
  document.getElementById('refreshEventsButton').addEventListener('click', loadEvents);
  document.getElementById('refreshReviewResultsButton').addEventListener('click', loadContextReviewResults);
  document.getElementById('refreshReviewActionPlanButton').addEventListener('click', loadContextReviewResultActionPlan);
  document.getElementById('refreshReviewActionGateButton').addEventListener('click', loadContextReviewResultActionGate);
  document.getElementById('runReviewActionApplyButton').addEventListener('click', runContextReviewActionApply);
  document.getElementById('refreshReviewActionAuditsButton').addEventListener('click', loadContextReviewActionAudits);
  document.getElementById('refreshReviewActionExecutionsButton').addEventListener('click', loadContextReviewActionExecutions);
  document.getElementById('refreshReviewActionExecutorDiagnosticsButton').addEventListener('click', loadContextReviewActionExecutorDiagnostics);
  document.getElementById('synthesizeReviewResultEventsButton').addEventListener('click', function () {
    synthesizeReviewResultEvents(false);
  });
  document.getElementById('createReviewResultEventsButton').addEventListener('click', async function () {
    if (!window.confirm('Create notification events from attention-worthy review results?')) return;
    await synthesizeReviewResultEvents(true);
  });
  document.getElementById('refreshRawPagesButton').addEventListener('click', loadRawPages);
  document.getElementById('dispatchEventsButton').addEventListener('click', dispatchEvents);
  document.getElementById('previewAckEventsButton').addEventListener('click', function () {
    acknowledgeVisibleEvents(false);
  });
  document.getElementById('ackVisibleEventsButton').addEventListener('click', function () {
    acknowledgeVisibleEvents(true);
  });
  document.getElementById('previewEventArchiveButton').addEventListener('click', function () {
    archiveHandledEvents(false);
  });
  document.getElementById('archiveEventsButton').addEventListener('click', function () {
    archiveHandledEvents(true);
  });
  document.getElementById('runSourcesButton').addEventListener('click', runAllSources);
  document.getElementById('runDueSourcesButton').addEventListener('click', runDueSources);
  document.getElementById('runDuePipelinesButton').addEventListener('click', runDuePipelines);
  document.getElementById('runRolloutReadinessButton').addEventListener('click', runVisibleRolloutReadinessChecks);
  document.getElementById('crawlUrlButton').addEventListener('click', crawlThreadUrl);
  loadAdapters();
  loadConnectorCatalog();
  renderHistoryCockpitStandby();
  bindSourceOnboardingRecipePreview();
  initializeCurrentViewFromLocation();
  window.addEventListener('hashchange', initializeCurrentViewFromLocation);
});

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach(function (button) {
    button.addEventListener('click', function () {
      setView(button.dataset.view);
    });
  });
}

function bindForms() {
  document.getElementById('analyzeForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('historyResult', function () {
      return requestJson('/api/analyze-directory', {
        forum: form.get('forum'),
        inputDir: form.get('inputDir')
      });
    }, renderHistoryReport);
    scrollResultIntoView('historyResult');
  });

  document.getElementById('contextForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('contextResult', function () {
      return requestJson('/api/interpret-text', {
        forum: form.get('forum'),
        inputDir: form.get('inputDir'),
        authorId: form.get('authorId'),
        author: form.get('author'),
        text: form.get('text')
      });
    }, renderContextReport);
    scrollResultIntoView('contextResult');
  });

  document.getElementById('taskForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('taskResult', function () {
      return requestJson('/api/tasks/ingest-directory', {
        inputDir: form.get('inputDir')
      });
    }, renderTaskRunResult);
    await loadSystemStatus();
    await loadTasks();
  });

  document.getElementById('sourceForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('sourceResult', function () {
      return requestJson('/api/sources', {
        forum: form.get('forum'),
        displayName: form.get('displayName'),
        inputDir: form.get('inputDir'),
        intervalMinutes: Number(form.get('intervalMinutes')) || undefined
      });
    }, renderSourceSaveResult);
    await loadSystemStatus();
    await loadSources();
    await loadSourceOperations();
  });

  document.getElementById('threadUrlForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('sourceResult', function () {
      return requestJson('/api/sources', {
        forum: form.get('forum'),
        sourceType: 'thread-url',
        displayName: form.get('displayName'),
        url: form.get('url'),
        intervalMinutes: Number(form.get('intervalMinutes')) || undefined,
        startPage: parsePositiveInteger(form.get('startPage')),
        pageCount: parsePositiveInteger(form.get('pageCount'))
      });
    }, renderSourceSaveResult);
    await loadSystemStatus();
    await loadSources();
    await loadSourceOperations();
  });

  document.getElementById('sourceOnboardingForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('onboardingResult', function () {
      return requestJson('/api/sources/onboarding/preflight', buildSourceOnboardingRequest(form), {
        acceptErrorStatus: true
      });
    }, renderSourceOnboardingPreflight);
  });

  document.getElementById('connectorModuleValidationForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('connectorModuleResult', function () {
      return requestJson('/api/connectors/modules/validate', {
        modulePath: form.get('modulePath')
      }, {
        acceptErrorStatus: true
      });
    }, renderConnectorModuleValidation);
  });

  document.getElementById('sourceDryRunForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('sourceDryRunResult', function () {
      return requestJson('/api/sources/ingest/dry-run', buildSourceOnboardingRequest(form), {
        acceptErrorStatus: true
      });
    }, renderSourceIngestDryRun);
  });

  document.getElementById('connectorRolloutForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request = buildSourceOnboardingRequest(form);
    request.dryRunIngest = form.get('dryRunIngest') === 'true';
    await renderAsync('connectorRolloutResult', function () {
      return requestJson('/api/connectors/rollout-plan', request, {
        acceptErrorStatus: true
      });
    }, renderConnectorRolloutPlan);
  });

  document.getElementById('workerTopologyForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams({
      topology: form.get('topology'),
      sourceTaskMode: form.get('sourceTaskMode')
    });
    appendOptionalQuery(query, 'sourceKey', form.get('sourceKey'));
    appendOptionalQuery(query, 'sourceId', form.get('sourceId'));
    await renderAsync('workerTopologyResult', function () {
      return fetchJson('/api/operations/worker-topology-plan?' + query.toString(), {
        acceptErrorStatus: true
      });
    }, renderWorkerTopologyPlan);
  });

  document.getElementById('rolloutManifestForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('rolloutManifestResult', function () {
      return requestJson('/api/operations/rollout-manifest-plan', parseManifestJson(form.get('manifestJson')), {
        acceptErrorStatus: true
      });
    }, renderRolloutManifestPlan);
  });

  document.getElementById('resourceProvisioningForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('resourceProvisioningResult', function () {
      return requestJson('/api/operations/resource-provisioning-plan', parseManifestJson(form.get('manifestJson')), {
        acceptErrorStatus: true
      });
    }, renderResourceProvisioningPlan);
  });

  document.getElementById('deploymentGateForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const request = appendDeploymentGateOptions(parseManifestJson(new FormData(form).get('manifestJson')), form);
    await renderAsync('deploymentGateResult', function () {
      return requestJson('/api/deployment/gate', request, {
        acceptErrorStatus: true
      });
    }, renderDeploymentGateReport);
  });

  document.getElementById('rolloutApplyForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request = parseManifestJson(form.get('manifestJson'));
    request.execute = form.get('execute') === 'true';
    await runRolloutApplyRequest(request);
  });

  document.getElementById('eventFilterForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    await loadEvents();
  });

  document.getElementById('contextReviewResultForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('contextReviewResultResult', function () {
      return requestJson('/api/context-review-results', {
        result: parseContextReviewResultJson(form.get('resultJson'))
      }, {
        acceptErrorStatus: true
      });
    }, renderContextReviewResultSubmission);
    await loadContextReviewResults();
  });

  document.getElementById('sourceResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action="run-source"],button[data-action="run-source-pipeline"]');
    if (!button) return;
    await runSourceTaskFromButton(button, 'taskResult');
  });

  document.getElementById('taskResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'load-trace-context') {
      await loadTaskTraceContextFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-task-detail') {
      await loadTaskDetailFromButton(button);
    }
  });

  document.getElementById('sourceOperationsResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (isCopyCommandAction(button)) {
      await copyCommandFromButton(button);
      return;
    }
    if (button.dataset.action === 'synthesize-runbook-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Create notification events from current runbook actions?')) return;
      await synthesizeRunbookEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-source-attention-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Create notification events from current source attention items?')) return;
      await synthesizeSourceAttentionEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-source-type-operations-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Create notification events from current source type operations?')) return;
      await synthesizeSourceTypeOperationsEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'reset-source-failure') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Reset this source failure state and retry now?')) return;
      await resetSourceFailureFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'set-source-enabled') {
      await setSourceEnabledFromButton(button);
      return;
    }
    if (button.dataset.action === 'set-source-schedule') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Configure this source schedule?')) return;
      await setSourceScheduleFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'load-source-drilldown') {
      await loadSourceOperationsDrilldownFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-collection-health') {
      await loadSourceCollectionHealthFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-cockpit-action-plan') {
      await loadSourceCockpitActionPlanFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-type-drilldown') {
      await loadSourceTypeOperationsDrilldownFromButton(button);
      return;
    }
    if (button.dataset.action === 'run-due-sources' || button.dataset.action === 'run-due-pipelines') {
      await runDueCollectionFromButton(button);
      return;
    }
    if (button.dataset.action === 'run-source' || button.dataset.action === 'run-source-pipeline') {
      await runSourceTaskFromButton(button, 'sourceOperationActionResult');
    }
  });

  document.getElementById('sourceOperationActionResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'load-trace-context') {
      await loadTaskTraceContextFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-task-detail') {
      await loadTaskDetailFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-drilldown') {
      await loadSourceOperationsDrilldownFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-collection-health') {
      await loadSourceCollectionHealthFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-type-drilldown') {
      await loadSourceTypeOperationsDrilldownFromButton(button);
      return;
    }
    if (button.dataset.action === 'run-due-sources' || button.dataset.action === 'run-due-pipelines') {
      await runDueCollectionFromButton(button);
      return;
    }
    if (button.dataset.action === 'run-source' || button.dataset.action === 'run-source-pipeline') {
      await runSourceTaskFromButton(button, 'sourceOperationActionResult');
      return;
    }
    if (button.dataset.action === 'reset-source-failure') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Reset this source failure state and retry now?')) return;
      await resetSourceFailureFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'set-source-enabled') {
      await setSourceEnabledFromButton(button);
      return;
    }
    if (button.dataset.action === 'set-source-schedule') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Configure this source schedule?')) return;
      await setSourceScheduleFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-source-attention-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Create notification events from this source attention item?')) return;
      await synthesizeSourceAttentionEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-source-type-operations-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Create notification events from this source type operations item?')) return;
      await synthesizeSourceTypeOperationsEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-runbook-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Create notification events from runbook actions?')) return;
      await synthesizeRunbookEventsFromButton(button, execute);
    }
  });

  document.getElementById('rolloutApplyResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'load-trace-context') {
      await loadTaskTraceContextFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-drilldown') {
      await loadSourceOperationsDrilldownFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-collection-health') {
      await loadSourceCollectionHealthFromButton(button);
      return;
    }
    if (button.dataset.action === 'set-source-enabled') {
      await setSourceEnabledFromButton(button);
    }
  });

  document.getElementById('rawPageResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action="replay-raw-page"]');
    if (!button) return;
    await renderAsync('taskResult', function () {
      return requestJson('/api/raw-pages/tasks/ingest', {
        forum: button.dataset.sourceKey,
        contentSha1: button.dataset.contentSha1
      });
    }, renderRawPageReplayResult);
    await loadSystemStatus();
    await loadTasks();
  });

  document.getElementById('eventResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'load-event-detail') {
      await loadEventDetailFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-task-detail') {
      await loadTaskDetailFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-drilldown') {
      await loadSourceOperationsDrilldownFromButton(button);
      return;
    }
    if (button.dataset.action === 'load-source-collection-health') {
      await loadSourceCollectionHealthFromButton(button);
      return;
    }
    if (button.dataset.action === 'prepare-event-action-intent') {
      await prepareEventActionIntentFromButton(button);
      return;
    }
    if (button.dataset.action === 'execute-event-action') {
      await executeEventActionFromButton(button);
      return;
    }
    if (button.dataset.action !== 'ack-event') return;
    await renderAsync('eventResult', function () {
      return requestJson('/api/events/' + encodeURIComponent(button.dataset.eventId) + '/ack', {
        acknowledgedBy: 'web'
      });
    }, renderEventAckResult);
    await loadSystemStatus();
    await loadEvents();
  });

  document.getElementById('indexForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('searchResult', function () {
      return requestJson('/api/index-directory', {
        forum: form.get('forum'),
        inputDir: form.get('inputDir')
      });
    }, renderIndexResult);
  });

  document.getElementById('searchForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await renderAsync('searchResult', function () {
      return requestJson('/api/search', {
        text: form.get('text'),
        limit: Number(form.get('limit')) || 8
      });
    }, renderSearchResults);
  });
}

async function enrichHistoryDirectory() {
  const form = new FormData(document.getElementById('analyzeForm'));
  await renderAsync('historyResult', function () {
    return requestJson('/api/enrich-directory', {
      forum: form.get('forum'),
      inputDir: form.get('inputDir'),
      provider: 'mock'
    });
  }, renderHistoryReport);
}

async function loadAuthorIntelligence() {
  const form = new FormData(document.getElementById('analyzeForm'));
  const query = new URLSearchParams({
    sourceKey: form.get('forum') || '',
    limit: '100',
    timelineLimit: '30',
    reviewQueueLimit: '20'
  });
  await renderAsync('authorIntelligenceResult', function () {
    return fetchJson('/api/intelligence/authors?' + query.toString(), {
      acceptErrorStatus: true
    });
  }, renderAuthorIntelligenceDashboard);
}

async function handleAuthorIntelligenceAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'sync-author-review-queue') {
    const form = new FormData(document.getElementById('analyzeForm'));
    await renderAsync('authorIntelligenceResult', function () {
      return requestJson('/api/intelligence/author-review-queue/sync', {
        sourceKey: form.get('forum') || '',
        limit: 100,
        timelineLimit: 30,
        reviewQueueLimit: 20
      }, {
        acceptErrorStatus: true
      });
    }, renderAuthorReviewQueueResult);
    return;
  }
  if (action === 'load-author-review-queue') {
    await loadAuthorReviewQueue();
    return;
  }
  if (action === 'synthesize-author-review-queue-events') {
    const execute = button.dataset.execute === 'true';
    if (execute && !window.confirm('Create notification events from open author review queue items?')) return;
    await synthesizeAuthorReviewQueueEventsFromButton(button, execute);
    return;
  }
  if (action === 'set-author-review-status') {
    await requestJson('/api/intelligence/author-review-queue/' + encodeURIComponent(button.dataset.itemId) + '/status', {
      status: button.dataset.status,
      reviewedBy: 'web'
    }, {
      acceptErrorStatus: true
    });
    await loadAuthorReviewQueue();
  }
}

async function loadAuthorReviewQueue() {
  const form = new FormData(document.getElementById('analyzeForm'));
  const query = new URLSearchParams({
    sourceKey: form.get('forum') || '',
    status: 'open',
    limit: '50'
  });
  await renderAsync('authorIntelligenceResult', function () {
    return fetchJson('/api/intelligence/author-review-queue?' + query.toString(), {
      acceptErrorStatus: true
    });
  }, renderAuthorReviewQueueResult);
}

async function synthesizeAuthorReviewQueueEventsFromButton(button, execute) {
  const form = new FormData(document.getElementById('analyzeForm'));
  await renderAsync('authorIntelligenceResult', function () {
    return requestJson('/api/intelligence/author-review-queue/events', {
      sourceKey: form.get('forum') || '',
      status: 'open',
      execute,
      resolveStale: true,
      limit: Number(button.dataset.limit) || 50
    }, {
      acceptErrorStatus: true
    });
  }, renderAuthorReviewQueueEventSynthesis);
  await loadEvents();
}

function buildSourceOnboardingRequest(form) {
  const sourceType = form.get('sourceType') || 'saved-html-directory';
  const locationValue = String(form.get('locationValue') || '').trim();
  const location = parseOptionalLocationJson(form.get('locationJson'));
  const locationField = inferLocationField(sourceType, locationValue);
  const request = {
    forum: form.get('forum'),
    sourceType,
    displayName: form.get('displayName'),
    modulePath: String(form.get('modulePath') || '').trim() || undefined
  };
  if (location) {
    request.location = location;
  } else if (locationField === 'url') {
    request.url = locationValue;
  } else if (locationField === 'inputFile') {
    request.inputFile = locationValue;
  } else if (locationField && locationField !== 'inputDir') {
    request.location = {};
    request.location[locationField] = locationValue;
  } else {
    request.inputDir = locationValue || form.get('inputDir');
  }
  return request;
}

async function handleAutomationReadinessAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (isCopyCommandAction(button)) {
    await copyCommandFromButton(button);
    return;
  }
  if (button.dataset.action === 'refresh-automation-readiness') {
    await loadAutomationReadiness();
    return;
  }
  if (button.dataset.action === 'run-llm-readiness') {
    await runLlmReadiness(resolveAutomationActionTarget());
    return;
  }
  if (button.dataset.action === 'run-llm-preflight') {
    await runLlmPreflight(resolveAutomationActionTarget());
    return;
  }
  if (button.dataset.action === 'run-llm-evaluation') {
    await runLlmEvaluation(resolveAutomationActionTarget());
    return;
  }
  if (button.dataset.action === 'run-demo-cycle') {
    await runDemoCycle(resolveAutomationActionTarget());
    return;
  }
  if (button.dataset.action === 'set-source-schedule') {
    const execute = button.dataset.execute === 'true';
    if (execute && !window.confirm('Configure this source schedule?')) return;
    await setSourceScheduleFromButton(button, execute, resolveAutomationActionTarget());
    return;
  }
  if (button.dataset.action === 'focus-automation-panel') {
    focusAutomationPanel(button.dataset.targetPanel);
    return;
  }
  if (button.dataset.action === 'run-automation-attention-action') {
    await runAutomationAttentionAction(button);
  }
}

async function handleAutomationActionResult(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (isCopyCommandAction(button)) {
    await copyCommandFromButton(button);
    return;
  }
  if (button.dataset.action === 'load-trace-context') {
    await loadTaskTraceContextFromButton(button);
    return;
  }
  if (button.dataset.action === 'load-task-detail') {
    await loadTaskDetailFromButton(button);
  }
}

function resolveAutomationActionTarget() {
  return document.getElementById('automationActionResult')
    ? 'automationActionResult'
    : 'sourceOperationActionResult';
}

async function handleOnboardingAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  try {
    if (button.dataset.action === 'load-rollout-manifest-draft') {
      fillRolloutManifestForms(state.rolloutManifestDraft);
      return;
    }
    if (button.dataset.action === 'load-onboarding-recipe-manifest') {
      useOnboardingRecipeManifest();
      return;
    }
    if (button.dataset.action === 'preflight-onboarding-recipe-manifest') {
      await preflightSourceOnboardingManifest(getCurrentOnboardingRecipeManifest());
      return;
    }
    if (button.dataset.action === 'preflight-loaded-connector-package-manifest') {
      await preflightSourceOnboardingManifest(getRolloutManifestFormManifest() || state.loadedConnectorPackageManifestDraft);
      return;
    }
    if (button.dataset.action === 'preflight-rollout-manifest-draft') {
      await preflightSourceOnboardingManifest(state.rolloutManifestDraft);
      return;
    }
    if (button.dataset.action === 'run-rollout-readiness-checks') {
      await runRolloutReadinessChecks(resolveRolloutChecksManifest(button));
      return;
    }
    if (button.dataset.action === 'use-connector-package') {
      fillSourceOnboardingFromConnectorPackage({
        packageName: button.dataset.packageName,
        modulePath: button.dataset.modulePath,
        sourceType: button.dataset.sourceType
      });
      return;
    }
    if (button.dataset.action === 'load-connector-package-manifest') {
      await loadConnectorPackageRecommendedManifest({
        packageName: button.dataset.packageName,
        modulePath: button.dataset.modulePath,
        sourceType: button.dataset.sourceType
      });
    }
  } catch (error) {
    renderError('onboardingResult', error);
  }
}

function useOnboardingRecipeManifest() {
  const manifest = getCurrentOnboardingRecipeManifest();
  fillSourceOnboardingFromManifest(manifest);
  fillRolloutManifestForms(manifest);
}

async function preflightSourceOnboardingManifest(manifest) {
  if (!manifest) {
    renderError('onboardingResult', new Error('No rollout manifest is available for preflight.'));
    return;
  }
  await renderAsync('onboardingResult', function () {
    return requestJson('/api/sources/onboarding/preflight', {
      manifest
    }, {
      acceptErrorStatus: true
    });
  }, renderSourceOnboardingPreflight);
}

function getCurrentOnboardingRecipeManifest() {
  const form = document.getElementById('sourceOnboardingForm');
  if (!form) return state.onboardingRecipeManifestDraft;
  const sourceType = String(form.elements.sourceType && form.elements.sourceType.value || '').trim();
  const sourceKey = String(form.elements.forum && form.elements.forum.value || '').trim();
  const sourceTypeSpec = findSourceTypeSpec(sourceType);
  if (!sourceTypeSpec || !sourceTypeSpec.onboardingRecipe) return state.onboardingRecipeManifestDraft;
  const connectorPackage = findConnectorPackageForSourceType(
    sourceTypeSpec.sourceType,
    sourceTypeSpec.package && sourceTypeSpec.package.packageName
  );
  return buildOnboardingRecipeManifest(sourceTypeSpec.onboardingRecipe.rolloutManifestTemplate, sourceKey, {
    connectorPackage
  });
}

function getRolloutManifestFormManifest() {
  const textarea = document.querySelector('#rolloutManifestForm textarea[name="manifestJson"]');
  if (!textarea || !String(textarea.value || '').trim()) return undefined;
  return parseManifestJson(textarea.value);
}

function resolveRolloutChecksManifest(button) {
  if (button && button.closest('#sourceOnboardingRecipe')) return getCurrentOnboardingRecipeManifest();
  if (button && button.closest('#onboardingResult') && state.rolloutManifestDraft) return state.rolloutManifestDraft;
  return getRolloutManifestFormManifest() || state.rolloutManifestDraft || state.loadedConnectorPackageManifestDraft;
}

async function runVisibleRolloutReadinessChecks() {
  try {
    await runRolloutReadinessChecks(getRolloutManifestFormManifest());
  } catch (error) {
    renderError('rolloutReadinessResult', error);
  }
}

async function runRolloutReadinessChecks(manifest) {
  if (!manifest) {
    renderError('rolloutReadinessResult', new Error('Rollout manifest JSON is required.'));
    return;
  }
  fillRolloutManifestForms(manifest);
  setLoading('rolloutReadinessResult', 'Running rollout checks...');
  const checks = await Promise.all([
    runManifestCheck({
      key: 'manifestPlan',
      title: 'Manifest plan',
      url: '/api/operations/rollout-manifest-plan',
      targetId: 'rolloutManifestResult',
      renderer: renderRolloutManifestPlan,
      manifest
    }),
    runManifestCheck({
      key: 'resourceProvisioning',
      title: 'Resource provisioning',
      url: '/api/operations/resource-provisioning-plan',
      targetId: 'resourceProvisioningResult',
      renderer: renderResourceProvisioningPlan,
      manifest
    }),
    runManifestCheck({
      key: 'deploymentGate',
      title: 'Deployment gate',
      url: '/api/deployment/gate',
      targetId: 'deploymentGateResult',
      renderer: renderDeploymentGateReport,
      manifest: appendDeploymentGateOptions(manifest)
    })
  ]);
  document.getElementById('rolloutReadinessResult').innerHTML = renderRolloutReadinessChecks({
    manifest,
    checks
  });
}

async function runRolloutApplyDryRun(manifest) {
  if (!manifest) {
    renderError('rolloutApplyResult', new Error('Rollout manifest JSON is required for apply dry-run.'));
    return;
  }
  const request = clonePlainObject(manifest);
  request.execute = false;
  fillRolloutManifestForms(request);
  const executeSelect = document.querySelector('#rolloutApplyForm select[name="execute"]');
  if (executeSelect) executeSelect.value = 'false';
  setLoading('rolloutApplyResult', 'Running apply dry-run...');
  try {
    await runRolloutApplyRequest(request);
  } catch (error) {
    renderError('rolloutApplyResult', error);
  }
}

async function runRolloutApplyRequest(request) {
  const safeRequest = clonePlainObject(request);
  try {
    if (safeRequest.execute) {
      const proceed = await preflightRolloutApplyExecution(safeRequest);
      if (!proceed) return;
    }
    await renderAsync('rolloutApplyResult', function () {
      return requestJson('/api/operations/rollout-manifest/apply', safeRequest, {
        acceptErrorStatus: true
      });
    }, renderRolloutManifestApply);
    await loadSources();
    await loadSourceOperations();
  } catch (error) {
    renderError('rolloutApplyResult', error);
  }
}

async function preflightRolloutApplyExecution(request) {
  setLoading('rolloutApplyResult', 'Checking deployment gate before execute...');
  const gate = await requestJson('/api/deployment/gate', request, {
    acceptErrorStatus: true
  });
  const blocking = isBlockingRolloutExecutionGate(gate);
  if (blocking) {
    document.getElementById('rolloutApplyResult').innerHTML = renderRolloutApplyExecutionGate(gate, {
      decision: 'blocked'
    });
    if (document.getElementById('deploymentGateResult')) {
      document.getElementById('deploymentGateResult').innerHTML = renderDeploymentGateReport(gate);
    }
    return false;
  }
  const warning = isWarningRolloutExecutionGate(gate);
  document.getElementById('rolloutApplyResult').innerHTML = renderRolloutApplyExecutionGate(gate, {
    decision: warning ? 'awaiting-confirmation' : 'cleared'
  });
  if (document.getElementById('deploymentGateResult')) {
    document.getElementById('deploymentGateResult').innerHTML = renderDeploymentGateReport(gate);
  }
  if (!warning) return true;
  const confirmed = window.confirm('Deployment gate returned warnings. Continue with execute=true and create a rollout apply audit task?');
  if (!confirmed) {
    document.getElementById('rolloutApplyResult').innerHTML = renderRolloutApplyExecutionGate(gate, {
      decision: 'cancelled'
    });
  }
  return confirmed;
}

function isBlockingRolloutExecutionGate(gate) {
  if (!gate) return true;
  if (gate.status === 'fail' || gate.status === 'critical') return true;
  return (gate.gates || []).some(function (item) {
    return item.status === 'fail' || item.status === 'critical';
  });
}

function isWarningRolloutExecutionGate(gate) {
  if (!gate) return true;
  if (gate.status === 'warn' || gate.status === 'warning') return true;
  return (gate.gates || []).some(function (item) {
    return item.status === 'warn' || item.status === 'warning';
  }) || (gate.nextActions || []).length > 0;
}

async function runManifestCheck(options) {
  const target = document.getElementById(options.targetId);
  if (target) setLoading(options.targetId, 'Running ' + options.title + '...');
  try {
    const result = await requestJson(options.url, options.manifest, {
      acceptErrorStatus: true
    });
    if (target) target.innerHTML = options.renderer(result);
    return {
      key: options.key,
      title: options.title,
      status: result.status || 'ok',
      result
    };
  } catch (error) {
    if (target) renderError(options.targetId, error);
    return {
      key: options.key,
      title: options.title,
      status: 'fail',
      error
    };
  }
}

function setLoading(targetId, message) {
  const target = document.getElementById(targetId);
  if (target) target.innerHTML = renderFeedbackState('loading', message || 'Loading...');
}

async function handleRolloutReadinessAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (isCopyCommandAction(button)) {
    await copyCommandFromButton(button);
    return;
  }
  if (button.dataset.action === 'load-source-drilldown') {
    await loadSourceOperationsDrilldownFromButton(button);
    return;
  }
  if (button.dataset.action === 'load-source-collection-health') {
    await loadSourceCollectionHealthFromButton(button);
    return;
  }
  if (button.dataset.action === 'load-source-type-drilldown') {
    await loadSourceTypeOperationsDrilldownFromButton(button);
    return;
  }
  if (button.dataset.action === 'run-rollout-apply-dry-run') {
    await runRolloutApplyDryRun(getRolloutManifestFormManifest() || state.rolloutManifestDraft || state.loadedConnectorPackageManifestDraft);
    return;
  }
}

function fillRolloutManifestForms(manifest) {
  if (!manifest) return;
  const text = JSON.stringify(manifest, null, 2);
  [
    'rolloutManifestForm',
    'resourceProvisioningForm',
    'deploymentGateForm',
    'rolloutApplyForm'
  ].forEach(function (formId) {
    const textarea = document.querySelector('#' + formId + ' textarea[name="manifestJson"]');
    if (textarea) textarea.value = text;
  });
}

function fillSourceOnboardingFromConnectorPackage(selection) {
  const safeSelection = selection || {};
  const connectorPackage = findConnectorPackageForSourceType(
    safeSelection.sourceType,
    safeSelection.packageName,
    safeSelection.modulePath
  );
  const sourceTypeInfo = findConnectorPackageSourceType(connectorPackage, safeSelection.sourceType);
  const sourceType = safeSelection.sourceType || sourceTypeInfo && sourceTypeInfo.sourceType;
  const form = document.getElementById('sourceOnboardingForm');
  if (!form || !sourceType) return;
  if (form.elements.sourceType) form.elements.sourceType.value = sourceType;
  if (form.elements.modulePath && (safeSelection.modulePath || connectorPackage && connectorPackage.modulePath)) {
    form.elements.modulePath.value = safeSelection.modulePath || connectorPackage.modulePath;
  }
  if (form.elements.displayName) {
    form.elements.displayName.value = sourceTypeInfo && sourceTypeInfo.displayName ||
      connectorPackage && connectorPackage.displayName ||
      sourceType;
  }
  const adapter = connectorPackage && connectorPackage.adapters && connectorPackage.adapters[0];
  if (adapter && adapter.sourceKey && form.elements.forum) form.elements.forum.value = adapter.sourceKey;
  renderSourceOnboardingRecipeFromForm();
  if (state.onboardingRecipeManifestDraft) fillRolloutManifestForms(state.onboardingRecipeManifestDraft);
}

function fillSourceOnboardingFromManifest(manifest, fallbackModulePath) {
  const form = document.getElementById('sourceOnboardingForm');
  const source = manifest && manifest.source || {};
  if (!form || !source) return;
  if (form.elements.forum && source.sourceKey) form.elements.forum.value = source.sourceKey;
  if (form.elements.sourceType && source.sourceType) form.elements.sourceType.value = source.sourceType;
  if (form.elements.displayName && source.displayName) form.elements.displayName.value = source.displayName;
  const modulePath = manifest && manifest.connector && manifest.connector.modulePath || fallbackModulePath;
  if (form.elements.modulePath && modulePath) form.elements.modulePath.value = modulePath;
  const location = source.location || legacySourceLocation(source);
  if (location && typeof location === 'object' && !Array.isArray(location)) {
    if (form.elements.locationJson) form.elements.locationJson.value = JSON.stringify(location, null, 2);
    if (form.elements.inputDir && location.inputDir) form.elements.inputDir.value = location.inputDir;
    if (form.elements.locationValue) form.elements.locationValue.value = preferredLocationValue(location);
  }
}

async function loadConnectorPackageRecommendedManifest(selection) {
  const safeSelection = selection || {};
  fillSourceOnboardingFromConnectorPackage(safeSelection);
  const connectorPackage = findConnectorPackageForSourceType(
    safeSelection.sourceType,
    safeSelection.packageName,
    safeSelection.modulePath
  );
  const modulePath = safeSelection.modulePath || connectorPackage && connectorPackage.modulePath;
  const query = new URLSearchParams();
  if (modulePath) query.set('modulePath', modulePath);
  if (safeSelection.packageName || connectorPackage && connectorPackage.packageName) {
    query.set('packageName', safeSelection.packageName || connectorPackage.packageName);
  }
  if (safeSelection.sourceType) query.set('sourceType', safeSelection.sourceType);
  const result = await fetchJson('/api/connectors/packages/recommended-manifest?' + query.toString(), {
    acceptErrorStatus: true
  });
  if (result.error) throw new Error(result.error.message || 'Recommended manifest could not be loaded.');
  fillSourceOnboardingFromManifest(result.manifest, modulePath);
  renderSourceOnboardingRecipeFromForm();
  state.onboardingRecipeManifestDraft = result.manifest;
  state.loadedConnectorPackageManifestDraft = result.manifest;
  fillRolloutManifestForms(result.manifest);
  const target = document.getElementById('onboardingResult');
  target.innerHTML = panel('Recommended manifest loaded', [
    metric('Package', result.packageName || 'unknown'),
    metric('Source type', result.sourceType || 'unknown'),
    metric('Manifest path', result.manifestPath || result.recommendedManifest || 'unknown'),
    '<div class="button-group source-op-buttons">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="preflight-loaded-connector-package-manifest">Preflight manifest</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-rollout-readiness-checks">Run rollout checks</button>' +
    '</div>'
  ].join(''), 'wide');
  const preflightButton = target.querySelector('button[data-action="preflight-loaded-connector-package-manifest"]');
  if (preflightButton) {
    preflightButton.addEventListener('click', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      try {
        await preflightSourceOnboardingManifest(getRolloutManifestFormManifest() || result.manifest);
      } catch (error) {
        renderError('onboardingResult', error);
      }
    });
  }
  const rolloutChecksButton = target.querySelector('button[data-action="run-rollout-readiness-checks"]');
  if (rolloutChecksButton) {
    rolloutChecksButton.addEventListener('click', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      try {
        await runRolloutReadinessChecks(getRolloutManifestFormManifest() || result.manifest);
      } catch (error) {
        renderError('rolloutReadinessResult', error);
      }
    });
  }
}

function legacySourceLocation(source) {
  const result = {};
  ['inputDir', 'inputFile', 'url'].forEach(function (field) {
    if (source && source[field]) result[field] = source[field];
  });
  return Object.keys(result).length > 0 ? result : undefined;
}

function preferredLocationValue(location) {
  const preferredFields = ['inputFile', 'url', 'feedUrl', 'inputDir'];
  for (let index = 0; index < preferredFields.length; index += 1) {
    const value = location[preferredFields[index]];
    if (typeof value === 'string' && value.trim()) return value;
  }
  const firstStringField = Object.keys(location).find(function (field) {
    return typeof location[field] === 'string' && location[field].trim();
  });
  return firstStringField ? location[firstStringField] : '';
}

function parseOptionalLocationJson(value) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Location JSON must be an object.');
  }
  return parsed;
}

function parsePositiveInteger(value) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function inferLocationField(sourceType, locationValue) {
  const type = String(sourceType || '');
  const value = String(locationValue || '').trim();
  const sourceTypeSpec = findSourceTypeSpec(type);
  const requiredFields = sourceTypeSpec && sourceTypeSpec.locationSchema && sourceTypeSpec.locationSchema.required || [];
  if (requiredFields.length === 1) return requiredFields[0];
  if (type === 'thread-url') return 'url';
  if (type === 'normalized-thread-json') return 'inputFile';
  if (!value) return 'inputDir';
  if (/\b(json|normalized)\b/i.test(type)) return 'inputFile';
  if (/^https?:\/\//i.test(value)) return /\bfeed\b/i.test(type) ? 'feedUrl' : 'url';
  return 'inputDir';
}

function findSourceTypeSpec(sourceType) {
  return (state.sourceTypes || []).find(function (item) {
    return item.sourceType === sourceType;
  });
}

function findConnectorPackageForSourceType(sourceType, packageName, modulePath) {
  const packages = state.connectorPackages || [];
  return packages.find(function (connectorPackage) {
    if (!connectorPackage) return false;
    if (packageName && connectorPackage.packageName !== packageName) return false;
    if (modulePath && connectorPackage.modulePath !== modulePath) return false;
    if (sourceType && !findConnectorPackageSourceType(connectorPackage, sourceType)) return false;
    return true;
  }) || packages.find(function (connectorPackage) {
    if (!sourceType || !findConnectorPackageSourceType(connectorPackage, sourceType)) return false;
    return !packageName || connectorPackage.packageName === packageName;
  });
}

function findConnectorPackageSourceType(connectorPackage, sourceType) {
  if (!connectorPackage) return undefined;
  const sourceTypes = connectorPackage.sourceTypes || [];
  if (!sourceType) return sourceTypes[0];
  return sourceTypes.find(function (item) {
    return item && item.sourceType === sourceType;
  });
}

function bindSourceOnboardingRecipePreview() {
  const form = document.getElementById('sourceOnboardingForm');
  if (!form) return;
  ['forum', 'sourceType'].forEach(function (name) {
    const field = form.elements[name];
    if (!field) return;
    field.addEventListener('input', renderSourceOnboardingRecipeFromForm);
    field.addEventListener('change', renderSourceOnboardingRecipeFromForm);
  });
  renderSourceOnboardingRecipeFromForm();
}

function renderSourceOnboardingRecipeFromForm() {
  const target = document.getElementById('sourceOnboardingRecipe');
  const form = document.getElementById('sourceOnboardingForm');
  if (!target || !form) return;
  const sourceType = String(form.elements.sourceType && form.elements.sourceType.value || '').trim();
  const sourceKey = String(form.elements.forum && form.elements.forum.value || '').trim();
  const sourceTypeSpec = findSourceTypeSpec(sourceType);
  if (!sourceTypeSpec || !sourceTypeSpec.onboardingRecipe) {
    state.onboardingRecipeManifestDraft = undefined;
    target.innerHTML = panel('Source onboarding recipe', '<div class="muted">Select a registered source type.</div>', 'wide');
    return;
  }
  target.innerHTML = renderSourceOnboardingRecipe(sourceTypeSpec, sourceKey);
}

function parseManifestJson(value) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error('Rollout manifest JSON is required.');
  }
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Rollout manifest JSON must be an object.');
  }
  return parsed;
}

function appendDeploymentGateOptions(manifest, form) {
  const request = clonePlainObject(manifest || {});
  const sourceForm = form || document.getElementById('deploymentGateForm');
  const modeControl = sourceForm && typeof sourceForm.querySelector === 'function'
    ? sourceForm.querySelector('select[name="llmReadinessMode"]')
    : undefined;
  const providerControl = sourceForm && typeof sourceForm.querySelector === 'function'
    ? sourceForm.querySelector('select[name="provider"]')
    : undefined;
  const mode = modeControl ? modeControl.value : sourceForm && typeof sourceForm.get === 'function' ? sourceForm.get('llmReadinessMode') : undefined;
  const provider = providerControl ? providerControl.value : sourceForm && typeof sourceForm.get === 'function' ? sourceForm.get('provider') : undefined;
  if (mode && mode !== 'configuration') {
    request.llmReadinessMode = mode;
    request.deployment = Object.assign({}, request.deployment || {}, {
      llmReadinessMode: mode
    });
  }
  if (provider) {
    request.provider = provider;
    request.deployment = Object.assign({}, request.deployment || {}, {
      llmProvider: provider
    });
  }
  return request;
}

function parseContextReviewResultJson(value) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error('Context review result JSON is required.');
  }
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Context review result JSON must be an object.');
  }
  return parsed;
}

function initializeCurrentViewFromLocation() {
  const viewName = normalizeViewName(window.location.hash ? window.location.hash.slice(1) : '');
  if (viewName && viewName !== state.currentView) setView(viewName, { syncHash: false });
}

function normalizeViewName(viewName) {
  return views[viewName] ? viewName : undefined;
}

function setView(viewName, options) {
  const safeViewName = normalizeViewName(viewName);
  if (!safeViewName) return;
  const safeOptions = options || {};
  if (safeOptions.syncHash !== false && window.location && window.history) {
    const nextHash = '#' + safeViewName;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }
  state.currentView = safeViewName;
  document.querySelectorAll('.nav-item').forEach(function (button) {
    button.classList.toggle('active', button.dataset.view === safeViewName);
  });
  document.querySelectorAll('.view-panel').forEach(function (panel) {
    panel.classList.add('hidden');
  });
  document.getElementById(safeViewName + 'View').classList.remove('hidden');
  const view = views[safeViewName];
  document.getElementById('viewTitle').textContent = view.title;
  document.getElementById('viewSubtitle').textContent = view.subtitle;
  document.getElementById('viewMode').textContent = view.mode;
  document.getElementById('viewFocus').textContent = view.focus;
  if (safeViewName === 'history') renderHistoryCockpitStandby();
  if (safeViewName === 'system') {
    loadSystemStatus();
    loadAutomationReadiness();
  }
}

async function loadAdapters() {
  try {
    const result = await fetchJson('/adapters');
    state.adapters = result.adapters || [];
    fillSuggestionLists();
    fillAdapterSelect('historyForum');
    fillAdapterSelect('contextForum');
    fillAdapterSelect('searchForum');
    fillAdapterSelect('sourceForum');
    fillAdapterSelect('threadUrlForum');
    fillAdapterSelect('onboardingForum');
    fillAdapterSelect('dryRunForum');
    fillAdapterSelect('rolloutForum');
    renderSourceOnboardingRecipeFromForm();
  } catch (error) {
    renderError('historyResult', error);
  }
}

async function loadConnectorCatalog(options) {
  const safeOptions = options || {};
  try {
    const query = new URLSearchParams();
    if (safeOptions.modulePath) query.set('modulePath', safeOptions.modulePath);
    const result = await fetchJson('/api/connectors/catalog' + (query.toString() ? '?' + query.toString() : ''), {
      acceptErrorStatus: true
    });
    state.connectorPackages = mergeConnectorPackageLists(state.connectorPackages, result.packages || []);
    state.connectorModuleErrors = result.moduleErrors || [];
    state.sourceTypes = mergeSourceTypeLists(state.sourceTypes, result.sourceTypes || []);
    fillSuggestionLists();
    renderSourceOnboardingRecipeFromForm();
  } catch (error) {
    state.connectorPackages = state.connectorPackages || [];
    state.connectorModuleErrors = state.connectorModuleErrors || [];
    state.sourceTypes = state.sourceTypes || [];
    renderSourceOnboardingRecipeFromForm();
  }
}

async function loadConnectorModuleCatalogFromOnboardingForm() {
  const form = document.getElementById('sourceOnboardingForm');
  if (!form) return;
  const modulePath = String(form.elements.modulePath && form.elements.modulePath.value || '').trim();
  await loadConnectorCatalog({
    modulePath
  });
}

function fillAdapterSelect(id) {
  const field = document.getElementById(id);
  if (!field) return;
  if (field.tagName === 'INPUT') {
    if (!field.value && state.adapters[0]) field.value = state.adapters[0].sourceKey;
    fillSuggestionLists();
    return;
  }
  field.innerHTML = '';
  state.adapters.forEach(function (adapter) {
    const option = document.createElement('option');
    option.value = adapter.sourceKey;
    option.textContent = adapter.displayName + ' (' + adapter.sourceKey + ')';
    field.appendChild(option);
  });
}

function fillSuggestionLists() {
  const forumSuggestions = document.getElementById('forumSuggestions');
  const sourceTypeSuggestions = document.getElementById('sourceTypeSuggestions');
  if (forumSuggestions) {
    forumSuggestions.innerHTML = '';
    (state.adapters || []).forEach(function (adapter) {
      const option = document.createElement('option');
      option.value = adapter.sourceKey;
      option.label = adapter.displayName + ' (' + adapter.sourceKey + ')';
      forumSuggestions.appendChild(option);
    });
  }
  if (sourceTypeSuggestions) {
    sourceTypeSuggestions.innerHTML = '';
    (state.sourceTypes || []).forEach(function (sourceType) {
      const option = document.createElement('option');
      option.value = sourceType.sourceType;
      option.label = sourceType.description || sourceType.sourceType;
      sourceTypeSuggestions.appendChild(option);
    });
  }
}

function mergeSourceTypeLists(current, incoming) {
  const result = [];
  const bySourceType = new Map();
  (current || []).concat(incoming || []).forEach(function (item) {
    if (!item || !item.sourceType) return;
    bySourceType.set(item.sourceType, Object.assign({}, bySourceType.get(item.sourceType) || {}, item));
  });
  bySourceType.forEach(function (item) {
    result.push(item);
  });
  return result;
}

function mergeConnectorPackageLists(current, incoming) {
  const result = [];
  const byPackage = new Map();
  (current || []).concat(incoming || []).forEach(function (item) {
    if (!item || !item.packageName) return;
    byPackage.set(item.packageName + '|' + (item.modulePath || ''), Object.assign({}, byPackage.get(item.packageName + '|' + (item.modulePath || '')) || {}, item));
  });
  byPackage.forEach(function (item) {
    result.push(item);
  });
  return result;
}

async function loadSystemStatus() {
  const target = document.getElementById('systemStatus');
  target.innerHTML = renderSystemStatusDashboard(createSystemStatusFallbackReport());
  try {
    const overview = createOperationalOverviewFallback(new Error('Operational overview is deferred from first paint.'));
    const [
      health,
      adapters,
      openApi,
      adapterDiagnostics,
      diagnostics,
      sourceDiagnostics,
      deploymentChecklist,
      operationsReadiness,
      operationsRunbook,
      notificationDiagnostics
    ] = await Promise.all([
      fetchJson('/health'),
      fetchJson('/adapters'),
      fetchJson('/openapi.json'),
      fetchJson('/api/adapters/diagnostics', { acceptErrorStatus: true }),
      fetchJson('/api/runtime/diagnostics', { acceptErrorStatus: true }),
      fetchJson('/api/sources/diagnostics?limit=100', { acceptErrorStatus: true }),
      fetchJson('/api/deployment/checklist?limit=100', { acceptErrorStatus: true }),
      fetchJson('/api/operations/readiness?limit=100', { acceptErrorStatus: true }),
      fetchJson('/api/operations/runbook?limit=100', { acceptErrorStatus: true }),
      fetchJson('/api/notifications/diagnostics', { acceptErrorStatus: true })
    ]);
    diagnostics.configuration = diagnostics.configuration || {};
    diagnostics.configuration.workers = diagnostics.configuration.workers || {};
    diagnostics.configuration.llm = diagnostics.configuration.llm || {};
    overview.sources = overview.sources || {};
    overview.tasks = overview.tasks || {};
    overview.events = overview.events || {};
    overview.workers = overview.workers || {};
    overview.rawPages = overview.rawPages || {};
    target.innerHTML = renderSystemStatusDashboard({
      health,
      adapters,
      openApi,
      overview,
      adapterDiagnostics,
      diagnostics,
      sourceDiagnostics,
      deploymentChecklist,
      operationsReadiness,
      operationsRunbook,
      notificationDiagnostics
    });
    document.getElementById('runbookResult').innerHTML = renderOperationsReadiness(operationsReadiness) + renderWorkerRunOverview(overview.workers) + renderWorkerLeaseOverview(overview.workers && overview.workers.leases) + renderOperationsRunbook(operationsRunbook);
  } catch (error) {
    if (!target.querySelector('.system-runtime-hero')) {
      target.innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
    }
  }
}

function createSystemStatusFallbackReport() {
  const diagnostics = {
    status: 'warn',
    generatedAt: new Date().toISOString(),
    configuration: {
      workers: {
        sourceTaskMode: 'ingest'
      },
      llm: {
        provider: 'checking'
      }
    },
    checks: [
      { key: 'resources.inputDir', status: 'standby' },
      { key: 'resources.storeDir', status: 'standby' }
    ]
  };
  return {
    health: {
      ok: true
    },
    adapters: {
      adapters: []
    },
    openApi: {
      openapi: 'checking',
      paths: {}
    },
    overview: createOperationalOverviewFallback(new Error('Operational overview is deferred from first paint.')),
    adapterDiagnostics: {
      status: 'warn',
      adapterCount: 0
    },
    diagnostics,
    sourceDiagnostics: {
      status: 'warn',
      sourceCount: 0
    },
    deploymentChecklist: {
      status: 'warn',
      items: []
    },
    operationsReadiness: {
      status: 'warn',
      checks: []
    },
    operationsRunbook: {
      status: 'warn',
      actionCount: 0,
      actions: []
    },
    notificationDiagnostics: {
      status: 'warn',
      channel: 'checking',
      checks: [
        { key: 'notifications.channel', status: 'standby' }
      ]
    }
  };
}

function renderSystemStatusDashboard(report) {
  const health = report.health || {};
  const adapters = report.adapters || {};
  const openApi = report.openApi || {};
  const overview = report.overview || {};
  const diagnostics = report.diagnostics || {};
  const config = diagnostics.configuration || {};
  const workersConfig = config.workers || {};
  const llmConfig = config.llm || {};
  const adapterDiagnostics = report.adapterDiagnostics || {};
  const sourceDiagnostics = report.sourceDiagnostics || {};
  const deploymentChecklist = report.deploymentChecklist || {};
  const operationsReadiness = report.operationsReadiness || {};
  const operationsRunbook = report.operationsRunbook || {};
  const notificationDiagnostics = report.notificationDiagnostics || {};
  const sources = overview.sources || {};
  const tasks = overview.tasks || {};
  const events = overview.events || {};
  const workers = overview.workers || {};
  const rawPages = overview.rawPages || {};
  const authorQueue = overview.authorReviewQueue || {};
  const variant = systemStatusVariant(report);
  const resourceSignals = systemResourceSignals(config, diagnostics);
  return [
    '<article class="system-runtime-hero ' + statusClassName(variant) + '">',
    '<section class="system-runtime-main">',
    '<div class="system-runtime-header">',
    '<span class="system-runtime-label">Runtime pulse</span>',
    statusBadge(systemStatusLabel(variant), variant),
    '</div>',
    '<h3>' + escapeHtml(systemStatusHeadline(variant, operationsRunbook, deploymentChecklist, operationsReadiness)) + '</h3>',
    '<p>' + escapeHtml([
      'service=' + (health.ok ? 'running' : 'attention'),
      'storage=' + (overview.storageMode || config.storageMode || 'unknown'),
      'sourceMode=' + (workersConfig.sourceTaskMode || 'unknown'),
      'generated=' + (overview.generatedAt || diagnostics.generatedAt || deploymentChecklist.generatedAt || 'pending')
    ].join(' | ')) + '</p>',
    '</section>',
    '<aside class="system-runtime-pressure">',
    systemRuntimeSignal('Sources', String(sources.enabled || 0) + '/' + String(sources.total || 0), 'due ' + String(sources.due || 0) + ' | failed ' + String(sources.failed || 0), sourcePressureVariant(sources)),
    systemRuntimeSignal('Tasks', 'running ' + String(tasks.running || 0), 'failed ' + String(tasks.failed || 0) + ' | total ' + String(tasks.total || 0), taskPressureVariant(tasks)),
    systemRuntimeSignal('Events', 'pending ' + String(events.pending || 0), 'failed ' + String(events.failed || 0) + ' | open ' + String(events.unacknowledged || 0), eventPressureVariant(events, {})),
    systemRuntimeSignal('Workers', 'running ' + String(workers.running || 0), 'stale ' + String(workers.stale || 0) + ' | leases ' + String(workers.leases && workers.leases.active || 0), workerPressureVariant(workers)),
    '</aside>',
    '<section class="system-runtime-stack">',
    systemRuntimeMini('Readiness', readinessStatusSummary(operationsReadiness), statusVariant(operationsReadiness.status)),
    systemRuntimeMini('Runbook', (operationsRunbook.status || 'unknown') + ' | actions ' + String(operationsRunbook.actionCount || 0), statusVariant(operationsRunbook.status)),
    systemRuntimeMini('Overview', overview.warning ? 'deferred' : 'live', overview.warning ? 'warn' : 'ok'),
    systemRuntimeMini('Deploy', deploymentChecklist.status || 'unknown', statusVariant(deploymentChecklist.status)),
    systemRuntimeMini('LLM', llmConfig.provider || 'unknown', statusVariant(diagnostics.status)),
    systemRuntimeMini('Adapters', (adapterDiagnostics.status || 'unknown') + ' | ' + String(adapterDiagnostics.adapterCount || (adapters.adapters || []).length || 0), statusVariant(adapterDiagnostics.status)),
    systemRuntimeMini('Sources config', (sourceDiagnostics.status || 'unknown') + ' | ' + String(sourceDiagnostics.sourceCount || 0), statusVariant(sourceDiagnostics.status)),
    systemRuntimeMini('Notify', diagnosticStatus(notificationDiagnostics, 'notifications.channel') + ' | ' + (notificationDiagnostics.channel || 'unknown'), statusVariant(diagnosticStatus(notificationDiagnostics, 'notifications.channel'))),
    resourceSignals.map(function (signal) {
      return systemRuntimeMini(signal.label, signal.value, statusVariant(signal.value));
    }).join(''),
    '</section>',
    '<section class="system-runtime-foot">',
    '<span>System surface</span>',
    '<strong>' + escapeHtml([
      'API ' + (openApi.openapi || 'unknown'),
      'paths ' + String(Object.keys(openApi.paths || {}).length),
      'rawPages ' + String(rawPages.total || 0)
    ].join(' | ')) + '</strong>',
    '<small>' + escapeHtml([
      'authorQueue=' + authorReviewQueueStatusSummary(authorQueue),
      'reviewActions=' + reviewActionStatusSummary(overview.reviewActions),
      'eventActions=' + eventActionStatusSummary(overview.notificationEventActions)
    ].join(' | ')) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function systemStatusVariant(report) {
  const overview = report.overview || {};
  const health = report.health || {};
  const statuses = [
    health.ok ? 'ok' : 'fail',
    report.diagnostics && report.diagnostics.status,
    report.deploymentChecklist && report.deploymentChecklist.status,
    report.operationsReadiness && report.operationsReadiness.status,
    report.operationsRunbook && report.operationsRunbook.status,
    overview.status,
    report.adapterDiagnostics && report.adapterDiagnostics.status,
    report.sourceDiagnostics && report.sourceDiagnostics.status
  ];
  if ((overview.events && overview.events.failed || 0) > 0) statuses.push('fail');
  if ((overview.tasks && overview.tasks.failed || 0) > 0) statuses.push('warn');
  if ((overview.workers && overview.workers.stale || 0) > 0) statuses.push('warn');
  if ((overview.sources && overview.sources.total || 0) === 0) statuses.push('warn');
  if (statuses.some(function (status) { return statusVariant(status) === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return statusVariant(status) === 'warn'; })) return 'warn';
  if (statuses.some(Boolean)) return 'ok';
  return 'muted';
}

function systemStatusLabel(variant) {
  if (variant === 'fail') return 'action';
  if (variant === 'warn') return 'watch';
  if (variant === 'ok') return 'steady';
  return 'pending';
}

function systemStatusHeadline(variant, runbook, deploymentChecklist, readiness) {
  if (variant === 'fail') return 'Runtime needs operator attention before the next cycle.';
  if (variant === 'warn') {
    const action = (runbook.actions || []).find(function (item) {
      return item.severity === 'critical' || item.severity === 'warning';
    });
    if (action && action.summary) return action.summary;
    const checklist = (deploymentChecklist.items || []).find(function (item) {
      return item.status === 'fail' || item.status === 'warn';
    });
    if (checklist && checklist.summary) return checklist.summary;
    const readinessCheck = (readiness.checks || []).find(function (item) {
      return item.status === 'fail' || item.status === 'warn';
    });
    if (readinessCheck && readinessCheck.summary) return readinessCheck.summary;
    return 'Runtime is usable, with a few signals worth watching.';
  }
  if (variant === 'ok') return 'Runtime is steady and ready for daily source work.';
  return 'Runtime telemetry is loading.';
}

function systemRuntimeSignal(label, value, detail, variant) {
  return '<div class="system-runtime-signal ' + statusClassName(variant) + '">' +
    '<span>' + escapeHtml(label) + '</span>' +
    '<strong>' + escapeHtml(value) + '</strong>' +
    '<small>' + escapeHtml(detail || '') + '</small>' +
    '</div>';
}

function systemRuntimeMini(label, value, variant) {
  return '<div class="system-runtime-mini ' + statusClassName(variant) + '">' +
    '<span>' + escapeHtml(label) + '</span>' +
    '<strong>' + escapeHtml(value || 'unknown') + '</strong>' +
    '</div>';
}

function systemResourceSignals(config, diagnostics) {
  if ((config.storageMode || '') === 'postgres') {
    return [{ label: 'Postgres', value: diagnosticStatus(diagnostics, 'resources.postgres') }];
  }
  return [
    { label: 'Input dir', value: diagnosticStatus(diagnostics, 'resources.inputDir') },
    { label: 'Store dir', value: diagnosticStatus(diagnostics, 'resources.storeDir') }
  ];
}

function renderHistoryCockpitStandby() {
  const target = document.getElementById('historyCockpit');
  if (!target) return;
  target.innerHTML = renderHistoryCockpit({
    overview: createOperationalOverviewFallback(new Error('Operational overview is deferred from first paint.')),
    cockpit: {
      status: 'warn',
      generatedAt: 'standby'
    },
    eventOverview: {},
    diagnostics: {
      status: 'warn',
      configuration: {
        storageMode: 'standby',
        llm: {
          provider: 'standby'
        }
      }
    },
    deploymentChecklist: {}
  });
}

async function loadHistoryCockpit() {
  const target = document.getElementById('historyCockpit');
  if (!target) return;
  await renderAsync('historyCockpit', function () {
    return Promise.all([
      Promise.resolve(createOperationalOverviewFallback(new Error('Operational overview is deferred from history first paint.'))),
      fetchJson('/api/operations/source-cockpit?limit=100&cockpitLimit=5', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/events/overview?limit=50', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/runtime/diagnostics', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/deployment/checklist?limit=100', {
        acceptErrorStatus: true
      })
    ]).then(function (results) {
      return {
        overview: results[0] || {},
        cockpit: results[1] || {},
        eventOverview: results[2] || {},
        diagnostics: results[3] || {},
        deploymentChecklist: results[4] || {}
      };
    });
  }, renderHistoryCockpit);
}

function handleHistoryCockpitAction(event) {
  const button = event.target.closest('button[data-action],button[data-view]');
  if (!button) return;
  if (button.dataset.action === 'refresh-history-cockpit') {
    loadHistoryCockpit();
    return;
  }
  if (button.dataset.view) setView(button.dataset.view);
}

function renderHistoryCockpit(report) {
  const overview = report.overview || {};
  const cockpit = report.cockpit || {};
  const diagnostics = report.diagnostics || {};
  const deploymentChecklist = report.deploymentChecklist || {};
  const eventOverview = report.eventOverview || {};
  const sources = overview.sources || {};
  const tasks = overview.tasks || {};
  const events = overview.events || {};
  const workers = overview.workers || {};
  const rawPages = overview.rawPages || {};
  const authorQueue = overview.authorReviewQueue || {};
  const variant = historyCockpitVariant(report);
  const generatedAt = overview.generatedAt || cockpit.generatedAt || diagnostics.generatedAt || deploymentChecklist.generatedAt || 'not generated yet';
  const nextAction = historyCockpitNextAction(cockpit, eventOverview, deploymentChecklist);
  return [
    '<section class="cockpit-hero ' + cockpitClassName(variant) + '">',
    '<div class="cockpit-hero-copy">',
    '<span class="cockpit-kicker">ThreadTrace cockpit</span>',
    '<h3>今日情报驾驶舱</h3>',
    '<p>打开后先看采集、提醒和任务压力；每个异常都应该能继续钻到来源、证据和审计记录。</p>',
    '</div>',
    '<div class="cockpit-hero-status">',
    '<span>当前判断</span>',
    '<strong>' + escapeHtml(historyCockpitLabel(variant)) + '</strong>',
    '<small>' + escapeHtml(nextAction) + '</small>',
    '</div>',
    '<div class="cockpit-command-row">',
    '<button class="inline-button" type="button" data-action="refresh-history-cockpit">刷新驾驶舱</button>',
    '<button class="inline-button secondary-inline-button" type="button" data-view="system">进入系统台</button>',
    '</div>',
    '<small class="cockpit-generated">Updated ' + escapeHtml(generatedAt) + '</small>',
    '</section>',
    cockpitQueueCard(cockpit, deploymentChecklist, eventOverview),
    cockpitCard('Sources', String(sources.enabled || 0) + '/' + String(sources.total || 0), 'due ' + String(sources.due || 0) + ' | failed ' + String(sources.failed || 0), sourcePressureVariant(sources)),
    cockpitCard('Tasks', 'running ' + String(tasks.running || 0), 'failed ' + String(tasks.failed || 0) + ' | total ' + String(tasks.total || 0), taskPressureVariant(tasks)),
    cockpitCard('Outbox', 'pending ' + String(events.pending || eventOverview.pendingCount || 0), 'failed ' + String(events.failed || eventOverview.failedCount || 0) + ' | open ' + String(events.unacknowledged || eventOverview.unacknowledgedCount || 0), eventPressureVariant(events, eventOverview)),
    cockpitCard('Workers', 'running ' + String(workers.running || 0), 'stale ' + String(workers.stale || 0) + ' | leases ' + String(workers.leases && workers.leases.active || 0), workerPressureVariant(workers)),
    cockpitCard('Evidence', String(rawPages.total || 0), 'raw pages | latest ' + (rawPages.latestFetchedAt || 'none'), (rawPages.total || 0) > 0 ? 'ok' : 'muted'),
    cockpitCard('LLM', diagnostics.configuration && diagnostics.configuration.llm ? diagnostics.configuration.llm.provider : 'unknown', 'storage ' + (overview.storageMode || diagnostics.configuration && diagnostics.configuration.storageMode || 'unknown'), statusVariant(diagnostics.status)),
    cockpitCard('Review', 'open ' + String(authorQueue.openCount || 0), 'high ' + String(authorQueue.highPriorityOpenCount || 0) + ' | sources ' + compactCountMap(authorQueue.openBySourceKey), (authorQueue.highPriorityOpenCount || 0) > 0 ? 'warn' : 'muted')
  ].join('');
}

function cockpitCard(title, value, detail, variant) {
  return '<article class="cockpit-card ' + cockpitClassName(variant) + '">' +
    '<span>' + escapeHtml(title) + '</span>' +
    '<strong>' + escapeHtml(value) + '</strong>' +
    '<small>' + escapeHtml(detail || '') + '</small>' +
    '</article>';
}

function cockpitQueueCard(cockpit, deploymentChecklist, eventOverview) {
  const queue = cockpit.queue || [];
  const checklistItems = (deploymentChecklist.items || []).filter(function (item) {
    return item.status === 'fail' || item.status === 'warn';
  });
  const rows = queue.slice(0, 4).map(function (item) {
    return cockpitQueueRow(
      '#' + (item.rank || '?') + ' ' + (item.title || item.id || 'Queue item'),
      [item.kind, item.scope, item.recommendedNextAction].filter(Boolean).join(' | '),
      attentionStatusVariant(item.severity)
    );
  }).concat(checklistItems.slice(0, Math.max(0, 4 - queue.length)).map(function (item) {
    return cockpitQueueRow(item.key || 'deployment check', item.summary || item.status || 'needs attention', statusVariant(item.status));
  }));
  if (rows.length === 0 && eventOverview.recommendedNextAction) {
    rows.push(cockpitQueueRow('Outbox recommendation', eventOverview.recommendedNextAction, statusVariant(eventOverview.status)));
  }
  return '<article class="cockpit-card cockpit-queue-card ' + cockpitClassName(statusVariant(cockpit.status || deploymentChecklist.status || eventOverview.status)) + '">' +
    '<div class="cockpit-card-head"><span>Operator queue</span>' + statusBadge(cockpit.status || deploymentChecklist.status || eventOverview.status || 'quiet', statusVariant(cockpit.status || deploymentChecklist.status || eventOverview.status)) + '</div>' +
    (rows.length ? rows.join('') : '<div class="cockpit-queue-empty">队列平稳。可以继续做历史分析或接入新来源。</div>') +
    '</article>';
}

function cockpitQueueRow(title, detail, variant) {
  return '<div class="cockpit-queue-row">' +
    '<span>' + escapeHtml(title) + '</span>' +
    '<small>' + escapeHtml(detail || '') + '</small>' +
    '<i class="' + cockpitClassName(variant) + '"></i>' +
    '</div>';
}

function cockpitClassName(variant) {
  if (variant === 'ok') return 'cockpit-ok';
  if (variant === 'warn') return 'cockpit-warn';
  if (variant === 'fail') return 'cockpit-fail';
  return 'cockpit-muted';
}

function historyCockpitVariant(report) {
  const overview = report.overview || {};
  const statuses = [
    report.deploymentChecklist && report.deploymentChecklist.status,
    report.cockpit && report.cockpit.status,
    report.diagnostics && report.diagnostics.status,
    report.eventOverview && report.eventOverview.status
  ];
  if ((overview.tasks && overview.tasks.failed || 0) > 0) statuses.push('warn');
  if ((overview.events && overview.events.failed || 0) > 0) statuses.push('warn');
  if ((overview.workers && overview.workers.stale || 0) > 0) statuses.push('warn');
  if ((overview.sources && overview.sources.total || 0) === 0) statuses.push('warn');
  if (statuses.some(function (status) { return statusVariant(status) === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return statusVariant(status) === 'warn'; })) return 'warn';
  if (statuses.some(Boolean)) return 'ok';
  return 'muted';
}

function historyCockpitLabel(variant) {
  if (variant === 'fail') return '需要处理';
  if (variant === 'warn') return '有信号待看';
  if (variant === 'ok') return '系统平稳';
  return '等待数据';
}

function historyCockpitNextAction(cockpit, eventOverview, deploymentChecklist) {
  const next = (cockpit.nextActions || [])[0];
  if (next && next.summary) return next.summary;
  const checklistAttention = (deploymentChecklist.items || []).find(function (item) {
    return item.status === 'fail' || item.status === 'warn';
  });
  if (checklistAttention) return checklistAttention.summary || checklistAttention.key;
  if (eventOverview && eventOverview.recommendedNextAction) return eventOverview.recommendedNextAction;
  return '先分析 example，建立今天的证据面。';
}

function sourcePressureVariant(sources) {
  if ((sources.failed || 0) > 0) return 'fail';
  if ((sources.due || 0) > 0 || (sources.total || 0) === 0) return 'warn';
  return 'ok';
}

function taskPressureVariant(tasks) {
  if ((tasks.failed || 0) > 0) return 'warn';
  if ((tasks.running || 0) > 0) return 'ok';
  return 'muted';
}

function eventPressureVariant(events, eventOverview) {
  if ((events.failed || eventOverview.failedCount || 0) > 0) return 'fail';
  if ((events.pending || eventOverview.pendingCount || eventOverview.unacknowledgedCount || 0) > 0) return 'warn';
  return 'ok';
}

function workerPressureVariant(workers) {
  if ((workers.stale || 0) > 0) return 'warn';
  if ((workers.running || 0) > 0) return 'ok';
  return 'muted';
}

function diagnosticStatus(diagnostics, key) {
  const item = (diagnostics.checks || []).find(function (check) {
    return check.key === key;
  });
  return item ? item.status : 'unknown';
}

function readinessStatusSummary(readiness) {
  const checks = readiness && readiness.checks || [];
  const failing = checks.filter(function (check) {
    return check.status === 'fail';
  }).length;
  const warning = checks.filter(function (check) {
    return check.status === 'warn';
  }).length;
  return (readiness && readiness.status || 'unknown') + ' | fail ' + failing + ' | warn ' + warning;
}

async function loadTasks() {
  await renderAsync('taskResult', function () {
    return Promise.all([
      fetchJson('/api/tasks?limit=10'),
      fetchJson('/api/sources/tasks/insight-pipeline-runs?limit=10')
    ]).then(function (results) {
      return {
        tasks: results[0].tasks || [],
        pipelineRuns: results[1].runs || []
      };
    });
  }, renderTaskList);
}

async function loadSources() {
  await renderAsync('sourceResult', function () {
    return Promise.all([
      fetchJson('/api/sources?limit=10'),
      fetchJson('/api/sources/diagnostics?limit=100', {
        acceptErrorStatus: true
      })
    ]).then(function (results) {
      return {
        sources: results[0].sources || [],
        diagnostics: results[1]
      };
    });
  }, renderSourceOpsList);
}

async function loadSourceOperations() {
  await renderAsync('sourceOperationsResult', function () {
    return Promise.all([
      fetchJson('/api/operations/source-cockpit?limit=100&cockpitLimit=12', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/sources/lifecycle?limit=100', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/sources/schedule?limit=100', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/operations/runbook?limit=100', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/operations/source-attention?limit=100', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/operations/source-type-operations?limit=100', {
        acceptErrorStatus: true
      }),
      fetchJson('/api/connectors/source-type-readiness?limit=200', {
        acceptErrorStatus: true
      })
    ]).then(function (results) {
      return {
        cockpit: results[0],
        lifecycle: results[1],
        schedule: results[2],
        runbook: results[3],
        attention: results[4],
        sourceTypeOperations: results[5],
        sourceTypeReadiness: results[6]
      };
    });
  }, renderSourceOperations);
}

async function loadAutomationReadiness() {
  const targetId = document.getElementById('automationReadinessResult')
    ? 'automationReadinessResult'
    : 'sourceOperationsResult';
  await renderAsync(targetId, function () {
    const query = new URLSearchParams({
      limit: '100',
      cockpitLimit: '12',
      sourceTaskMode: 'insight-pipeline',
      llmReadinessMode: 'configuration'
    });
    query.set('notificationLimit', '100');
    query.set('auditLimit', '100');
    query.set('executionLimit', '20');
    return fetchJson('/api/operations/automation-cockpit?' + query.toString(), {
      acceptErrorStatus: true
    });
  }, renderAutomationReadinessPlan, {
    loadingMessage: 'Refreshing automation cockpit...'
  });
}

async function loadEvents() {
  await renderAsync('eventResult', function () {
    const query = buildEventQuery();
    return Promise.all([
      fetchJson('/api/events?' + query.toString()),
      fetchJson('/api/events/overview?' + query.toString()),
      fetchJson('/api/events/synthesis-policy')
    ]).then(function (results) {
      return {
        events: results[0].events || [],
        overview: results[1],
        policy: results[2]
      };
    });
  }, renderEventList);
}

async function loadContextReviewResults() {
  await renderAsync('contextReviewResultOverview', function () {
    return Promise.all([
      fetchJson('/api/context-review-results/overview?limit=50'),
      fetchJson('/api/context-review-results?limit=10'),
      fetchJson('/api/context-review-results/action-plan?limit=50'),
      fetchJson('/api/context-review-results/action-gate?limit=50'),
      fetchJson('/api/context-review-results/action-audits/overview?limit=100'),
      fetchJson('/api/context-review-results/action-audits?limit=10')
    ]).then(function (results) {
      return {
        overview: results[0],
        reviewResults: results[1].reviewResults || [],
        actionPlan: results[2],
        actionGate: results[3],
        actionAuditOverview: results[4],
        actionAudits: results[5]
      };
    });
  }, renderContextReviewResultOverview);
}

async function loadContextReviewResultActionPlan() {
  await renderAsync('contextReviewResultResult', function () {
    return fetchJson('/api/context-review-results/action-plan?limit=50');
  }, renderContextReviewResultActionPlan);
}

async function loadContextReviewResultActionGate() {
  await renderAsync('contextReviewResultResult', function () {
    return fetchJson('/api/context-review-results/action-gate?limit=50');
  }, renderContextReviewResultActionGate);
}

async function loadContextReviewActionAudits() {
  await renderAsync('contextReviewResultResult', function () {
    return Promise.all([
      fetchJson('/api/context-review-results/action-audits/overview?limit=100'),
      fetchJson('/api/context-review-results/action-audits?limit=20')
    ]).then(function (results) {
      return {
        overview: results[0],
        audits: results[1].audits || []
      };
    });
  }, renderContextReviewActionAuditPanel);
}

async function loadContextReviewActionExecutions() {
  await renderAsync('contextReviewResultResult', function () {
    return fetchJson('/api/context-review-results/action-executions?limit=20', {
      acceptErrorStatus: true
    });
  }, renderContextReviewActionExecutionPanel);
}

async function loadContextReviewActionExecutorDiagnostics() {
  await renderAsync('contextReviewResultResult', function () {
    return fetchJson('/api/context-review-results/action-executor/diagnostics?limit=100', {
      acceptErrorStatus: true
    });
  }, renderContextReviewActionExecutorDiagnostics);
}

async function runContextReviewActionApply() {
  await renderAsync('contextReviewResultResult', function () {
    return requestJson('/api/context-review-results/action-tasks/apply', {
      execute: false,
      limit: 50
    }, {
      acceptErrorStatus: true
    });
  }, renderContextReviewActionApplyResult);
  await loadSystemStatus();
  await loadTasks();
  await loadContextReviewResults();
}

function buildEventQuery() {
  const query = new URLSearchParams();
  const form = eventFilterFormData();
  const acknowledged = form ? String(form.get('acknowledged') || '') : 'false';
  const deliveryStatus = form ? String(form.get('deliveryStatus') || '').trim() : '';
  const type = form ? String(form.get('type') || '').trim() : '';
  const sourceKey = form ? String(form.get('sourceKey') || '').trim() : '';
  const sourceId = form ? String(form.get('sourceId') || '').trim() : '';
  query.set('limit', String(normalizeEventLimit(form ? form.get('limit') : 10)));
  if (acknowledged === 'true' || acknowledged === 'false') query.set('acknowledged', acknowledged);
  if (deliveryStatus) query.set('deliveryStatus', deliveryStatus);
  if (type) query.set('type', type);
  if (sourceKey) query.set('sourceKey', sourceKey);
  if (sourceId) query.set('sourceId', sourceId);
  return query;
}

function appendOptionalQuery(query, key, value) {
  const text = String(value || '').trim();
  if (text) query.set(key, text);
}

async function loadTaskTraceContextFromButton(button) {
  const query = new URLSearchParams();
  appendOptionalQuery(query, 'taskId', button.dataset.taskId);
  appendOptionalQuery(query, 'requestId', button.dataset.requestId);
  appendOptionalQuery(query, 'traceId', button.dataset.traceId);
  appendOptionalQuery(query, 'idempotencyKey', button.dataset.idempotencyKey);
  query.set('limit', button.dataset.limit || '20');
  if (!query.get('taskId') && !query.get('requestId') && !query.get('traceId') && !query.get('idempotencyKey')) {
    renderError('taskResult', new Error('No trace metadata is available for this task.'));
    return;
  }
  await renderAsync('taskResult', function () {
    return fetchJson('/api/operations/trace-context?' + query.toString(), {
      acceptErrorStatus: true
    });
  }, renderTaskTraceContext);
}

async function loadTaskDetailFromButton(button) {
  const taskId = button.dataset.taskId;
  if (!taskId) {
    renderError('taskResult', new Error('No task id is available.'));
    return;
  }
  await renderAsync('taskResult', function () {
    return fetchJson('/api/tasks/' + encodeURIComponent(taskId) + '?traceLimit=' + encodeURIComponent(button.dataset.traceLimit || '20'), {
      acceptErrorStatus: true
    });
  }, renderTaskDetail);
}

async function loadEventDetailFromButton(button) {
  const eventId = button.dataset.eventId;
  if (!eventId) {
    renderError('eventResult', new Error('No event id is available.'));
    return;
  }
  await renderAsync('eventResult', function () {
    return fetchJson('/api/events/' + encodeURIComponent(eventId), {
      acceptErrorStatus: true
    });
  }, renderNotificationEventDetail);
}

async function prepareEventActionIntentFromButton(button) {
  const eventId = button.dataset.eventId;
  const actionKey = button.dataset.actionKey;
  if (!eventId || !actionKey) {
    renderError('eventResult', new Error('Event id and action key are required for action dry-run.'));
    return;
  }
  await renderAsync('eventResult', function () {
    return requestJson('/api/events/' + encodeURIComponent(eventId) + '/actions/intent', {
      actionKey,
      actor: 'web',
      reason: 'event-detail-dry-run'
    }, {
      acceptErrorStatus: true
    });
  }, renderNotificationEventActionIntent);
}

async function executeEventActionFromButton(button) {
  const eventId = button.dataset.eventId;
  const actionKey = button.dataset.actionKey;
  if (!eventId || !actionKey) {
    renderError('eventResult', new Error('Event id and action key are required for action execution.'));
    return;
  }
  if (!window.confirm('Execute ' + actionKey + ' for this notification event?')) return;
  await renderAsync('eventResult', function () {
    return requestJson('/api/events/' + encodeURIComponent(eventId) + '/actions/execute', {
      actionKey,
      actor: 'web',
      reason: 'event-detail-execute',
      execute: true
    }, {
      acceptErrorStatus: true
    });
  }, renderNotificationEventActionIntent);
  await loadSystemStatus();
  await loadEvents();
}

function eventFilterFormData() {
  const formElement = document.getElementById('eventFilterForm');
  return formElement ? new FormData(formElement) : undefined;
}

function normalizeEventLimit(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1) return 10;
  return Math.min(Math.floor(limit), 100);
}

function buildEventSourceScopeRequest() {
  const form = eventFilterFormData();
  const sourceKey = form ? String(form.get('sourceKey') || '').trim() : '';
  const sourceId = form ? String(form.get('sourceId') || '').trim() : '';
  const request = {
    limit: normalizeEventLimit(form ? form.get('limit') : 10)
  };
  if (sourceKey) request.sourceKey = sourceKey;
  if (sourceId) request.sourceId = sourceId;
  return request;
}

function buildEventDispatchRequest() {
  return buildEventSourceScopeRequest();
}

function buildVisibleEventAckRequest(execute) {
  const form = eventFilterFormData();
  const deliveryStatus = form ? String(form.get('deliveryStatus') || '').trim() : '';
  const type = form ? String(form.get('type') || '').trim() : '';
  const request = Object.assign(buildEventSourceScopeRequest(), {
    acknowledged: false,
    acknowledgedBy: 'web',
    note: 'Acknowledged from the web event filter.',
    dryRun: execute !== true,
    execute: execute === true
  });
  if (deliveryStatus) request.deliveryStatus = deliveryStatus;
  if (type) request.type = type;
  return request;
}

function buildEventArchiveRequest(execute) {
  const form = eventFilterFormData();
  const type = form ? String(form.get('type') || '').trim() : '';
  const scope = buildEventSourceScopeRequest();
  const request = {
    execute: execute === true,
    deliveryStatuses: ['delivered', 'resolved'],
    requireAcknowledged: true,
    olderThanDays: 30,
    archiveLimit: scope.limit,
    scanLimit: 500,
    archivedBy: 'web',
    reason: 'Archived from the web event filter.'
  };
  if (type) request.type = type;
  if (scope.sourceKey) request.sourceKey = scope.sourceKey;
  if (scope.sourceId) request.sourceId = scope.sourceId;
  return request;
}

async function loadRawPages() {
  await renderAsync('rawPageResult', function () {
    return fetchJson('/api/raw-pages?limit=10');
  }, renderRawPageList);
}

async function crawlThreadUrl() {
  const form = new FormData(document.getElementById('threadUrlForm'));
  await renderAsync('rawPageResult', function () {
    return crawlThreadUrlWindow({
      forum: form.get('forum'),
      url: form.get('url'),
      startPage: parsePositiveInteger(form.get('startPage')) || 1,
      pageCount: parsePositiveInteger(form.get('pageCount')) || 1
    });
  }, renderRawPageFetchWindowResult);
  await loadSystemStatus();
  await loadRawPages();
}

async function crawlThreadUrlWindow(request) {
  const results = [];
  for (let offset = 0; offset < request.pageCount; offset += 1) {
    const page = request.startPage + offset;
    const result = await requestJson('/api/crawl-page', {
      forum: request.forum,
      url: request.url,
      page
    });
    results.push({
      page,
      result
    });
  }
  return {
    startPage: request.startPage,
    pageCount: request.pageCount,
    results
  };
}

async function runAllSources() {
  await renderAsync('taskResult', function () {
    return requestJson('/api/sources/tasks/ingest', {});
  }, renderSourceBatchRunResult);
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadAutomationReadiness();
  await loadEvents();
  await loadRawPages();
}

async function runDueSources() {
  await renderAsync('taskResult', function () {
    return requestJson('/api/sources/tasks/ingest-due', {});
  }, renderDueSourceBatchRunResult);
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadEvents();
  await loadRawPages();
}

async function runDuePipelines() {
  await renderAsync('taskResult', function () {
    return requestJson('/api/sources/tasks/insight-pipeline-due', {
      provider: 'mock'
    });
  }, renderDueSourcePipelineBatchRunResult);
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadEvents();
  await loadRawPages();
}

async function runLlmPreflight(targetId) {
  const resolvedTargetId = targetId || 'sourceOperationActionResult';
  await renderAsync(resolvedTargetId, function () {
    return requestJson('/api/llm/preflight', {});
  }, function (result) {
    return renderAutomationActionResult('LLM preflight', {
      status: result.status,
      mode: result.provider || 'provider',
      subject: result.task || result.traceId || 'schema check',
      changed: result.validation && result.validation.status,
      next: firstNextActionSummary(result.nextActions)
    }, renderLlmPreflightReport(result));
  }, automationActionRenderOptions(resolvedTargetId, 'Running LLM preflight...'));
  await loadSystemStatus();
  await loadAutomationReadiness();
  refocusAutomationActionResult(resolvedTargetId);
}

async function runLlmReadiness(targetId) {
  const resolvedTargetId = targetId || 'sourceOperationActionResult';
  await renderAsync(resolvedTargetId, function () {
    return requestJson('/api/llm/readiness', {
      llmReadinessMode: 'configuration'
    }, {
      acceptErrorStatus: true
    });
  }, function (result) {
    const readiness = result.readiness || {};
    return renderAutomationActionResult('LLM readiness', {
      status: result.status,
      mode: result.mode || 'configuration',
      subject: result.provider || 'provider',
      changed: readiness.realProviderCandidate ? 'real provider' : 'mock/default',
      next: firstNextActionSummary(result.nextActions)
    }, renderLlmReadinessProfile(result));
  }, automationActionRenderOptions(resolvedTargetId, 'Checking LLM readiness...'));
  await loadSystemStatus();
  await loadAutomationReadiness();
  refocusAutomationActionResult(resolvedTargetId);
}

async function runLlmEvaluation(targetId) {
  const resolvedTargetId = targetId || 'sourceOperationActionResult';
  await renderAsync(resolvedTargetId, function () {
    return requestJson('/api/llm/evaluate', {});
  }, function (result) {
    const summary = result.summary || {};
    return renderAutomationActionResult('LLM evaluate', {
      status: result.status,
      mode: result.provider || 'provider',
      subject: String(result.sampleCount || 0) + ' samples',
      changed: 'warn=' + String(summary.warn || 0) + ' fail=' + String(summary.fail || 0),
      next: firstNextActionSummary(result.nextActions)
    }, renderLlmEvaluationReport(result));
  }, automationActionRenderOptions(resolvedTargetId, 'Evaluating LLM quality gates...'));
  await loadSystemStatus();
  await loadAutomationReadiness();
  refocusAutomationActionResult(resolvedTargetId);
}

async function runDemoCycle(targetId) {
  const form = new FormData(document.getElementById('sourceForm'));
  const request = {
    provider: 'mock',
    limit: 10,
    drilldownLimit: 20
  };
  if (form.get('forum')) request.sourceKey = form.get('forum');
  const resolvedTargetId = targetId || 'sourceOperationActionResult';
  await renderAsync(resolvedTargetId, function () {
    return requestJson('/api/demo/source-cycle', request, {
      acceptErrorStatus: true
    });
  }, function (result) {
    const summary = result.summary || {};
    return renderAutomationActionResult('Demo cycle', {
      status: result.status,
      mode: 'mock',
      subject: formatSourceScope(result.primarySource),
      changed: 'completed=' + String(summary.completedCount || 0) + ' failed=' + String(summary.failedCount || 0),
      next: firstNextActionSummary(result.nextActions)
    }, renderSourceDemoCycleReport(result));
  }, automationActionRenderOptions(resolvedTargetId, 'Running demo automation cycle...'));
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadAutomationReadiness();
  await loadEvents();
  await loadRawPages();
  refocusAutomationActionResult(resolvedTargetId);
}

async function runDueCollectionFromButton(button) {
  const isPipeline = button.dataset.action === 'run-due-pipelines';
  const limit = Number(button.dataset.limit);
  const request = {};
  if (Number.isFinite(limit) && limit > 0) request.limit = Math.floor(limit);
  if (button.dataset.sourceId) request.sourceId = button.dataset.sourceId;
  if (button.dataset.sourceKey) request.sourceKey = button.dataset.sourceKey;
  if (button.dataset.sourceType) request.sourceType = button.dataset.sourceType;
  if (isPipeline) request.provider = button.dataset.provider || 'mock';
  await renderAsync('sourceOperationActionResult', function () {
    return requestJson(isPipeline ? '/api/sources/tasks/insight-pipeline-due' : '/api/sources/tasks/ingest-due', request, {
      acceptErrorStatus: true
    });
  }, isPipeline ? renderDueSourcePipelineBatchRunResult : renderDueSourceBatchRunResult);
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadEvents();
  await loadRawPages();
}

async function loadSourceCockpitActionPlanFromButton(button) {
  const query = new URLSearchParams();
  if (button.dataset.rank) query.set('rank', button.dataset.rank);
  if (button.dataset.itemId) query.set('itemId', button.dataset.itemId);
  if (button.dataset.sourceId) query.set('sourceId', button.dataset.sourceId);
  if (button.dataset.sourceKey) query.set('sourceKey', button.dataset.sourceKey);
  if (button.dataset.sourceType) query.set('sourceType', button.dataset.sourceType);
  query.set('limit', button.dataset.limit || '100');
  query.set('cockpitLimit', button.dataset.cockpitLimit || '12');
  query.set('provider', button.dataset.provider || 'mock');
  await renderAsync('sourceOperationActionResult', function () {
    return fetchJson('/api/operations/source-cockpit/action-plan?' + query.toString(), {
      acceptErrorStatus: true
    });
  }, renderSourceCockpitActionPlan);
}

async function runSourceTaskFromButton(button, targetId) {
  const isPipeline = button.dataset.action === 'run-source-pipeline';
  await renderAsync(targetId, function () {
    const taskPath = isPipeline ? '/tasks/insight-pipeline' : '/tasks/ingest';
    return requestJson('/api/sources/' + encodeURIComponent(button.dataset.sourceId) + taskPath, {
      provider: 'mock'
    });
  }, isPipeline ? renderSourcePipelineRunResult : renderSourceTaskRunResult);
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadEvents();
  await loadRawPages();
}

async function setSourceEnabledFromButton(button) {
  const sourceId = button.dataset.sourceId;
  const enabled = button.dataset.enabled === 'true';
  const execute = button.dataset.execute === 'true';
  const operation = enabled ? 'enable' : 'disable';
  if (execute && !window.confirm((enabled ? 'Enable' : 'Disable') + ' this tracked source?')) return;
  await renderAsync('sourceOperationActionResult', function () {
    return requestJson('/api/sources/' + encodeURIComponent(sourceId) + '/' + operation, {
      execute
    });
  }, renderSourceLifecycleUpdateResult);
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadAutomationReadiness();
}

async function resetSourceFailureFromButton(button, execute) {
  const sourceId = button.dataset.sourceId;
  await renderAsync('sourceOperationActionResult', function () {
    return requestJson('/api/sources/' + encodeURIComponent(sourceId) + '/failure/reset', {
      execute,
      retryNow: button.dataset.retryNow === 'true',
      resetBy: 'web'
    });
  }, renderSourceFailureResetResult);
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadAutomationReadiness();
}

async function setSourceScheduleFromButton(button, execute, targetId) {
  const sourceId = button.dataset.sourceId;
  const resolvedTargetId = targetId || 'sourceOperationActionResult';
  await renderAsync(resolvedTargetId, function () {
    return requestJson('/api/sources/' + encodeURIComponent(sourceId) + '/schedule', {
      execute,
      intervalMinutes: Number(button.dataset.intervalMinutes) || 60,
      runNow: button.dataset.runNow !== 'false',
      scheduleEnabled: button.dataset.scheduleEnabled === 'false' ? false : true
    });
  }, function (result) {
    const update = result.result || result;
    const before = update.sourceBefore || {};
    const after = update.sourceAfter || {};
    const schedule = after.schedule || {};
    const rendered = renderSourceScheduleUpdateResult(result);
    if (resolvedTargetId !== 'automationActionResult') return rendered;
    return renderAutomationActionResult('Source schedule', {
      status: update.status,
      mode: update.dryRun ? 'Preview only' : 'Apply',
      subject: (after.displayName || before.displayName || after.id || before.id || sourceId),
      changed: update.changed ? 'Changed' : 'No change',
      next: schedule.nextRunAt || 'next run unchanged'
    }, rendered);
  }, automationActionRenderOptions(resolvedTargetId, execute ? 'Applying source schedule...' : 'Previewing source schedule...'));
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
  await loadAutomationReadiness();
  refocusAutomationActionResult(resolvedTargetId);
}

async function loadSourceOperationsDrilldownFromButton(button) {
  const query = new URLSearchParams();
  appendOptionalQuery(query, 'sourceId', button.dataset.sourceId);
  appendOptionalQuery(query, 'sourceKey', button.dataset.sourceKey);
  query.set('limit', button.dataset.limit || '50');
  await renderAsync('sourceOperationActionResult', function () {
    return fetchJson('/api/operations/source-drilldown?' + query.toString(), {
      acceptErrorStatus: true
    });
  }, renderSourceOperationsDrilldown);
}

async function loadSourceCollectionHealthFromButton(button) {
  const query = new URLSearchParams();
  appendOptionalQuery(query, 'sourceId', button.dataset.sourceId);
  appendOptionalQuery(query, 'sourceKey', button.dataset.sourceKey);
  query.set('limit', button.dataset.limit || '50');
  await renderAsync('sourceOperationActionResult', function () {
    return fetchJson('/api/operations/source-collection-health?' + query.toString(), {
      acceptErrorStatus: true
    });
  }, renderSourceCollectionHealthProfile);
}

async function loadSourceTypeOperationsDrilldownFromButton(button) {
  const query = new URLSearchParams();
  appendOptionalQuery(query, 'sourceType', button.dataset.sourceType);
  appendOptionalQuery(query, 'sourceKey', button.dataset.sourceKey);
  query.set('limit', button.dataset.limit || '50');
  query.set('scanLimit', button.dataset.scanLimit || '250');
  await renderAsync('sourceOperationActionResult', function () {
    return fetchJson('/api/operations/source-type-drilldown?' + query.toString(), {
      acceptErrorStatus: true
    });
  }, renderSourceTypeOperationsDrilldown);
}

async function synthesizeRunbookEventsFromButton(button, execute) {
  await renderAsync('sourceOperationActionResult', function () {
    return requestJson('/api/operations/runbook/events', {
      execute,
      limit: Number(button.dataset.limit) || 100,
      sourceId: button.dataset.sourceId || undefined,
      sourceKey: button.dataset.sourceKey || undefined
    });
  }, renderRunbookNotificationEventResult);
  await loadSystemStatus();
  await loadSourceOperations();
  await loadEvents();
}

async function synthesizeSourceAttentionEventsFromButton(button, execute) {
  await renderAsync('sourceOperationActionResult', function () {
    return requestJson('/api/operations/source-attention/events', {
      execute,
      limit: Number(button.dataset.limit) || 100,
      attentionLimit: Number(button.dataset.attentionLimit) || 100,
      priorityScoreThreshold: Number(button.dataset.priorityScoreThreshold) || 70,
      sourceId: button.dataset.sourceId || undefined,
      sourceKey: button.dataset.sourceKey || undefined
    });
  }, renderSourceAttentionNotificationEventResult);
  await loadSystemStatus();
  await loadSourceOperations();
  await loadEvents();
}

async function synthesizeSourceTypeOperationsEventsFromButton(button, execute) {
  await renderAsync('sourceOperationActionResult', function () {
    return requestJson('/api/operations/source-type-operations/events', {
      execute,
      limit: Number(button.dataset.limit) || 100,
      sourceTypeLimit: Number(button.dataset.sourceTypeLimit) || 100,
      attentionLimit: Number(button.dataset.attentionLimit) || 100,
      priorityScoreThreshold: Number(button.dataset.priorityScoreThreshold) || 70,
      includeReadinessWarnings: button.dataset.includeReadinessWarnings === 'true',
      sourceType: button.dataset.sourceType || undefined,
      sourceKey: button.dataset.sourceKey || undefined
    });
  }, renderSourceTypeOperationsNotificationEventResult);
  await loadSystemStatus();
  await loadSourceOperations();
  await loadEvents();
}

async function synthesizeReviewResultEvents(execute) {
  await renderAsync('contextReviewResultResult', function () {
    return requestJson('/api/context-review-results/events', {
      execute: execute === true,
      limit: 50
    });
  }, renderContextReviewResultEventSynthesis);
  await loadContextReviewResults();
  await loadEvents();
}

async function dispatchEvents() {
  const dispatchRequest = buildEventDispatchRequest();
  const target = document.getElementById('eventResult');
  target.innerHTML = renderFeedbackState('loading', 'Dispatching notification events...');
  try {
    const result = await requestJson('/api/events/dispatch', dispatchRequest);
    await loadSystemStatus();
    await loadEvents();
    const refreshedTarget = document.getElementById('eventResult');
    refreshedTarget.innerHTML = renderEventDispatchResult(Object.assign({ filters: dispatchRequest }, result)) + refreshedTarget.innerHTML;
  } catch (error) {
    renderError('eventResult', error);
  }
}

async function acknowledgeVisibleEvents(execute) {
  const request = buildVisibleEventAckRequest(execute);
  if (execute && !window.confirm('Acknowledge up to ' + request.limit + ' open notification events in the current filter?')) return;
  const target = document.getElementById('eventResult');
  target.innerHTML = renderFeedbackState('loading', execute ? 'Acknowledging events...' : 'Previewing acknowledgement candidates...');
  try {
    const result = await requestJson('/api/events/ack', request);
    await loadSystemStatus();
    await loadEvents();
    const refreshedTarget = document.getElementById('eventResult');
    refreshedTarget.innerHTML = renderEventBatchAckResult(result) + refreshedTarget.innerHTML;
  } catch (error) {
    renderError('eventResult', error);
  }
}

async function archiveHandledEvents(execute) {
  const request = buildEventArchiveRequest(execute);
  if (execute && !window.confirm('Archive handled notification events older than 30 days in the current filter?')) return;
  const target = document.getElementById('eventResult');
  target.innerHTML = renderFeedbackState('loading', 'Checking event archive policy...');
  try {
    const result = await requestJson('/api/events/archive', request);
    await loadEvents();
    const refreshedTarget = document.getElementById('eventResult');
    refreshedTarget.innerHTML = renderEventArchiveResult(result) + refreshedTarget.innerHTML;
  } catch (error) {
    renderError('eventResult', error);
  }
}

async function renderAsync(targetId, task, renderer, options) {
  const safeOptions = options || {};
  const target = document.getElementById(targetId);
  if (safeOptions.focus) focusResultTarget(targetId);
  target.setAttribute('aria-busy', 'true');
  target.innerHTML = renderFeedbackState('loading', safeOptions.loadingMessage || 'Working...');
  try {
    const result = await task();
    target.innerHTML = renderer(result);
    if (safeOptions.focus) focusResultTarget(targetId);
  } catch (error) {
    renderError(targetId, error);
    if (safeOptions.focus) focusResultTarget(targetId);
  } finally {
    target.setAttribute('aria-busy', 'false');
  }
}

function scrollResultIntoView(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  target.scrollIntoView({
    block: 'start',
    behavior: motion
  });
}

function automationActionRenderOptions(targetId, loadingMessage) {
  return {
    focus: targetId === 'automationActionResult',
    loadingMessage: loadingMessage || 'Running automation action...'
  };
}

function renderAutomationActionResult(action, meta, content) {
  const safeMeta = meta || {};
  const summary = [
    '<div class="automation-action-summary">',
    '<div class="summary-strip">',
    summaryTile('Action', action || 'Automation', 'info'),
    summaryTile('Status', safeMeta.status || 'unknown', statusVariant(safeMeta.status)),
    summaryTile('Mode', safeMeta.mode || 'check'),
    summaryTile('Changed', safeMeta.changed || 'n/a', statusVariant(safeMeta.changed)),
    '</div>',
    '<div class="automation-action-summary-line">',
    '<span><strong>' + escapeHtml(safeMeta.subject || 'ThreadTrace cockpit') + '</strong>',
    '<small>' + escapeHtml(safeMeta.next || 'Review the detailed report below.') + '</small></span>',
    statusBadge(safeMeta.status || 'unknown', statusVariant(safeMeta.status)),
    '</div>',
    '</div>'
  ].join('');
  return panel('Last action', summary, 'wide automation-action-summary-panel') + content;
}

function firstNextActionSummary(actions) {
  const first = (actions || []).find(Boolean);
  if (!first) return 'No follow-up command required.';
  return first.summary || first.command || first.key || 'Review generated follow-up commands.';
}

function refocusAutomationActionResult(targetId) {
  if (targetId === 'automationActionResult') focusResultTarget(targetId);
}

function focusResultTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.classList.remove('result-focus-pulse');
  scrollResultIntoView(targetId);
  window.setTimeout(function () {
    target.classList.add('result-focus-pulse');
  }, 0);
}

function renderHistoryReport(report) {
  const panels = [
    renderHistoryReportHero(report),
    renderPrimaryAuthorProfile(report.primaryAuthorProfile),
    renderEvidenceReliability(report.evidenceReliability),
    panel('实体线索', tagList((report.entityCandidates || []).slice(0, 12).map(function (entity) {
      return entity.displayName + ' · ' + entity.mentions.length;
    }))),
    panel('观点候选', evidenceList((report.opinionCandidates || []).slice(0, 8).map(function (opinion) {
      return '#' + opinion.floor + ' ' + opinion.attitude + ' · ' + opinion.confidence;
    }))),
    panel('观点链', evidenceList((report.opinionChains || []).slice(0, 8).map(formatOpinionChainSummary)), 'wide'),
    panel('隐晦表达', evidenceList((report.implicitReferenceCandidates || []).slice(0, 8).map(formatImplicitReferenceSummary)), 'wide'),
    panel('关系候选', evidenceList((report.relationCandidates || []).slice(0, 8).map(function (relation) {
      return '#' + relation.sourceFloor + ' -> ' + (relation.targetFloor !== undefined ? '#' + relation.targetFloor : relation.targetPostId || relation.targetThreadId);
    }))),
    panel('高信号楼层', evidenceList((report.evidenceCandidates.highSignalPosts || []).slice(0, 8).map(function (item) {
      return '#' + item.floor + ' ' + item.author + '：' + item.excerpt;
    })), 'wide')
  ];
  if (report.semanticInsights) {
    panels.push(renderSemanticInsights(report.semanticInsights));
  }
  return panels.join('');
}

function renderHistoryReportHero(report) {
  const thread = report.thread || {};
  const reliability = report.evidenceReliability || {};
  const primary = report.primaryAuthorProfile || {};
  const author = primary.author || {};
  const signals = [
    report.entityCandidates ? report.entityCandidates.length + ' entities' : undefined,
    report.opinionCandidates ? report.opinionCandidates.length + ' opinions' : undefined,
    report.opinionChains ? report.opinionChains.length + ' chains' : undefined,
    report.implicitReferenceCandidates ? report.implicitReferenceCandidates.length + ' implicit refs' : undefined
  ].filter(Boolean);
  return [
    '<article class="history-report-hero">',
    '<div class="history-report-main">',
    '<span class="history-report-kicker">Evidence report</span>',
    '<h3>' + escapeHtml(thread.title || 'Untitled thread') + '</h3>',
    '<p>' + escapeHtml(reliability.summary || '已完成保存页解析，下面可以继续查看作者、实体、观点链和原文证据。') + '</p>',
    '<div class="history-report-tags">' + tagList(signals) + '</div>',
    '</div>',
    '<div class="history-report-facts">',
    historyFact('Posts', thread.parsedPostCount || 0),
    historyFact('Authors', (report.authorStats || []).length),
    historyFact('Pages', thread.totalPages || 'unknown'),
    historyFact('Reliability', reliability.status || 'unknown'),
    '</div>',
    '<div class="history-report-author">',
    '<span>Primary author</span>',
    '<strong>' + escapeHtml(author.displayName || author.sourceAuthorId || 'unknown') + '</strong>',
    '<small>' + escapeHtml([primary.postCount ? primary.postCount + ' posts' : undefined, primary.opinionCount ? primary.opinionCount + ' opinions' : undefined, formatStanceSummary(primary.stanceSummary)].filter(Boolean).join(' | ')) + '</small>',
    '</div>',
    '</article>'
  ].join('');
}

function historyFact(label, value) {
  return '<div class="history-fact"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function renderPrimaryAuthorProfile(profile) {
  if (!profile) {
    return panel('主作者画像', '<div class="muted">暂无</div>');
  }
  return panel('主作者画像', [
    metric('作者', profile.author.displayName),
    metric('楼层', profile.postCount + ' · #' + profile.firstFloor + ' - #' + profile.lastFloor),
    metric('观点', profile.opinionCount),
    metric('态度', formatStanceSummary(profile.stanceSummary)),
    '<div class="reason-tags tag-list">' + (profile.focusEntities || []).slice(0, 6).map(function (item) {
      return '<span class="tag">' + escapeHtml(item.entity.displayName + ' · ' + item.mentionCount + ' · ' + item.latestAttitude) + '</span>';
    }).join('') + '</div>',
    evidenceList((profile.evidenceGaps || []).slice(0, 4).map(function (gap) {
      return gap.entity.displayName + ' · ' + gap.reason + ' · #' + gap.firstFloor + '-' + gap.lastFloor;
    }))
  ].join(''));
}

function renderEvidenceReliability(reliability) {
  if (!reliability) {
    return panel('证据可靠性', '<div class="muted">暂无</div>');
  }
  return panel('证据可靠性', [
    metric('状态', reliability.status),
    metric('明确/推断', reliability.explicitCount + ' / ' + reliability.inferredCount),
    metric('隐晦表达', reliability.implicitReferenceCount),
    metric('明确占比', reliability.explicitRatio),
    evidenceList((reliability.cautions || []).slice(0, 4))
  ].join(''));
}

function renderAuthorIntelligenceDashboard(dashboard) {
  return [
    renderAuthorIntelligenceHero(dashboard),
    panel('Source review pressure', renderAuthorSourceReviewPressureRows(dashboard.sourceReviewPressure || []), 'wide'),
    panel('Review queue', renderAuthorReviewQueueRows(dashboard.reviewQueue || []), 'wide'),
    panel('重点作者', renderAuthorIntelligenceRows(dashboard.authors || []), 'wide'),
    panel('聚焦实体', renderAuthorEntityRows(dashboard.focusEntities || []), 'wide'),
    panel('观点时间线', renderOpinionTimelineRows(dashboard.opinionTimeline || []), 'wide'),
    panel('证据缺口', renderAuthorEvidenceGapRows(dashboard.evidenceGaps || []), 'wide'),
    panel('高信号证据', renderAuthorEvidenceRows(dashboard.evidence || []), 'wide')
  ].join('');
}

function renderAuthorIntelligenceHero(dashboard) {
  const summary = dashboard.summary || {};
  const authors = dashboard.authors || [];
  const topPressure = (dashboard.sourceReviewPressure || [])[0] || {};
  const status = dashboard.status || 'unknown';
  const queueCount = summary.reviewQueueCount || 0;
  const gapCount = summary.evidenceGapCount || 0;
  const nextAction = dashboard.recommendedNextAction || dashboard.message || 'Review author signals and sync the open queue.';
  return [
    '<article class="author-intel-hero">',
    '<section class="author-intel-main">',
    '<div class="author-intel-header">',
    '<span class="author-intel-label">Author radar</span>',
    statusBadge(status, statusVariant(status)),
    '</div>',
    '<h3>' + escapeHtml(nextAction) + '</h3>',
    '<p>' + escapeHtml(authorIntelligenceScope(dashboard) + ' | ' + (dashboard.revisionMode || 'latest-per-thread') + ' | reports=' + (dashboard.reportCount || 0) + ' | revisions=' + (dashboard.reportRevisionCount || 0)) + '</p>',
    '<div class="author-intel-actions button-group">' +
      '<button class="inline-button" type="button" data-action="sync-author-review-queue">Sync queue</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">Open queue</button>' +
      '<a class="inline-button secondary-inline-button" href="' + escapeHtml(authorIntelligenceMarkdownHref(dashboard)) + '" target="_blank" rel="noreferrer">Markdown</a>' +
    '</div>',
    '</section>',
    '<aside class="author-intel-signals">',
    authorIntelSignal('Authors', summary.authorCount || 0, (summary.authorCount || 0) > 0 ? 'ok' : 'muted'),
    authorIntelSignal('Opinions', summary.opinionCount || 0, (summary.opinionCount || 0) > 0 ? 'ok' : 'muted'),
    authorIntelSignal('Entities', summary.focusEntityCount || 0, (summary.focusEntityCount || 0) > 0 ? 'ok' : 'muted'),
    authorIntelSignal('Gaps', gapCount, gapCount > 0 ? 'warn' : 'ok'),
    authorIntelSignal('Queue', queueCount, queueCount > 0 ? 'warn' : 'ok'),
    authorIntelSignal('Threads', summary.threadCount || 0, (summary.threadCount || 0) > 0 ? 'ok' : 'muted'),
    '</aside>',
    '<section class="author-intel-focus">',
    '<span>Focus authors</span>',
    renderAuthorIntelFocusRows(authors),
    '</section>',
    '<section class="author-intel-review">',
    '<span>Review pressure</span>',
    '<strong>' + escapeHtml(queueCount + ' queue / ' + gapCount + ' gaps') + '</strong>',
    '<small>' + escapeHtml([
      formatStanceSummary(summary.reviewQueuePriorityCounts),
      formatStanceSummary(summary.reviewQueueTypeCounts),
      topPressure.sourceKey ? 'top source=' + topPressure.sourceKey : undefined,
      topPressure.recommendedNextAction
    ].filter(Boolean).join(' | ')) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function authorIntelSignal(label, value, variant) {
  return '<div class="author-intel-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function renderAuthorIntelFocusRows(authors) {
  if (!authors || authors.length === 0) {
    return '<div class="author-intel-empty">No author signals yet.</div>';
  }
  return authors.slice(0, 3).map(function (item) {
    const author = item.author || {};
    const focus = (item.topFocusEntities || []).slice(0, 3).map(function (entity) {
      return entity.entity && entity.entity.displayName ? entity.entity.displayName : entity.key;
    }).filter(Boolean).join(' / ');
    return '<div class="author-intel-focus-row">' +
      '<strong>' + escapeHtml(author.displayName || author.sourceAuthorId || item.key || 'unknown') + '</strong>' +
      '<small>' + escapeHtml(['posts=' + (item.postCount || 0), 'opinions=' + (item.opinionCount || 0), 'gaps=' + (item.evidenceGapCount || 0), focus].filter(Boolean).join(' | ')) + '</small>' +
      '</div>';
  }).join('');
}

function authorIntelligenceScope(dashboard) {
  const parts = [
    dashboard.sourceKey || 'all-sources',
    dashboard.sourceThreadId ? 'thread=' + dashboard.sourceThreadId : undefined
  ];
  const filter = dashboard.authorFilter || {};
  if (filter.authorId || filter.displayName) {
    parts.push('author=' + (filter.displayName || filter.authorId));
  }
  return parts.filter(Boolean).join(' · ');
}

function authorIntelligenceMarkdownHref(dashboard) {
  const query = new URLSearchParams({
    sourceKey: dashboard.sourceKey || '',
    limit: String(dashboard.windowLimit || 100),
    timelineLimit: '30',
    reviewQueueLimit: '20'
  });
  if (dashboard.sourceThreadId) query.set('sourceThreadId', dashboard.sourceThreadId);
  if (dashboard.revisionMode === 'all-revisions') query.set('includeReportRevisions', 'true');
  const filter = dashboard.authorFilter || {};
  if (filter.authorId) query.set('authorId', filter.authorId);
  if (filter.displayName) query.set('author', filter.displayName);
  return '/api/intelligence/authors/markdown?' + query.toString();
}

function renderAuthorSourceReviewPressureRows(items) {
  if (items.length === 0) return '<div class="muted">No source review pressure</div>';
  return items.slice(0, 12).map(function (item) {
    const details = [
      'threads=' + (item.threadCount || 0),
      'authors=' + (item.authorCount || 0),
      'opinions=' + (item.opinionCount || 0),
      'gaps=' + (item.evidenceGapCount || 0),
      'queue=' + (item.reviewQueueCount || 0),
      'high=' + (item.highPriorityReviewQueueCount || 0),
      item.latestGeneratedAt ? 'latest=' + item.latestGeneratedAt : undefined
    ].filter(Boolean).join(' · ');
    const typeSummary = formatStanceSummary(item.reviewQueueTypeCounts);
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.sourceKey || 'unknown-source') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(typeSummary) + '</small>' +
      '<small>' + escapeHtml(item.recommendedNextAction || '') + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      statusBadge((item.highPriorityReviewQueueCount || 0) > 0 ? 'review' : 'ok', (item.highPriorityReviewQueueCount || 0) > 0 ? 'warn' : 'ok') +
      renderSourceDrilldownButton({ sourceKey: item.sourceKey }) +
      '</span></div>';
  }).join('');
}

function renderAuthorReviewQueueRowsLegacy(items) {
  if (items.length === 0) return '<div class="muted">暂无审核队列</div>';
  return items.slice(0, 12).map(function (item) {
    const ref = (item.refs || [])[0] || {};
    const sourceKey = item.sourceKey || ref.sourceKey || item.thread && item.thread.sourceKey;
    const details = [
      sourceKey ? 'source=' + sourceKey : undefined,
      item.type,
      item.reason,
      item.score === undefined ? undefined : 'score=' + item.score,
      ref.sourceThreadId ? 'thread=' + ref.sourceThreadId : undefined,
      ref.floor === undefined ? undefined : '#' + ref.floor
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.title || item.key || 'review item') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.summary || '') + '</small>' +
      '<small>' + escapeHtml(item.nextAction || '') + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      statusBadge(item.priority || 'unknown', item.priority === 'high' ? 'warn' : 'muted') +
      renderSourceDrilldownButtonForScope({ sourceKey }) +
      '</span></div>';
  }).join('');
}

function renderAuthorReviewQueueResult(result) {
  const summary = result.summary || {};
  const openCount = summary.openCount || 0;
  return [
    renderAuthorReviewQueueHero(result),
    panel('Source hotspots', renderAuthorReviewQueueSourceHotspots(summary.sourceHotspots || []), 'wide'),
    panel('Open items', renderDurableAuthorReviewQueueRows(result.items || []), 'wide')
  ].join('');
}

function renderAuthorReviewQueueHero(result) {
  const summary = result.summary || {};
  const openCount = summary.openCount || 0;
  const highCount = summary.byPriority && summary.byPriority.high || 0;
  const sourceCounts = Object.keys(summary.openBySourceKey || {}).length > 0 ? summary.openBySourceKey : summary.bySourceKey;
  const sourceCount = Object.keys(sourceCounts || {}).length;
  const hotspots = summary.sourceHotspots || [];
  const alertDisabled = openCount > 0 ? '' : ' disabled';
  const sync = result.createdCount === undefined ? undefined : 'created=' + (result.createdCount || 0) + ' / updated=' + (result.updatedCount || 0);
  const status = result.status || (openCount > 0 ? 'review' : 'ok');
  return [
    '<article class="review-queue-hero">',
    '<section class="review-queue-main">',
    '<div class="review-queue-header">',
    '<span class="review-queue-label">Review queue</span>',
    statusBadge(status, openCount > 0 ? 'warn' : statusVariant(status)),
    '</div>',
    '<h3>' + escapeHtml(result.recommendedNextAction || 'No open author review work.') + '</h3>',
    '<p>' + escapeHtml([
      'status=' + (result.status || 'ok'),
      'priority=' + formatStanceSummary(summary.byPriority),
      'type=' + formatStanceSummary(summary.byType),
      sync
    ].filter(Boolean).join(' | ')) + '</p>',
    '<div class="review-queue-actions button-group">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">Refresh open queue</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="false" data-limit="50">Alert check</button>' +
      '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="true" data-limit="50"' + alertDisabled + '>Create alerts</button>' +
    '</div>',
    '</section>',
    '<aside class="review-queue-signals">',
    reviewQueueSignal('Items', result.itemCount || 0, (result.itemCount || 0) > 0 ? 'ok' : 'muted'),
    reviewQueueSignal('Open', openCount, openCount > 0 ? 'warn' : 'ok'),
    reviewQueueSignal('High', highCount, highCount > 0 ? 'warn' : 'ok'),
    reviewQueueSignal('Sources', sourceCount, sourceCount > 0 ? 'warn' : 'muted'),
    '</aside>',
    '<section class="review-queue-hotspots">',
    '<span>Source hotspots</span>',
    renderReviewQueueHotspotRows(hotspots),
    '</section>',
    '<section class="review-queue-foot">',
    '<span>Queue mix</span>',
    '<strong>' + escapeHtml(formatStanceSummary(summary.byStatus)) + '</strong>',
    '<small>' + escapeHtml('source=' + formatStanceSummary(sourceCounts)) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function reviewQueueSignal(label, value, variant) {
  return '<div class="review-queue-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function renderReviewQueueHotspotRows(items) {
  if (!items || items.length === 0) {
    return '<div class="review-queue-empty">No source hotspots.</div>';
  }
  return items.slice(0, 3).map(function (item) {
    return '<div class="review-queue-hotspot-row">' +
      '<strong>' + escapeHtml(item.sourceKey || 'unknown-source') + '</strong>' +
      '<small>' + escapeHtml([
        'items=' + (item.itemCount || 0),
        'open=' + (item.openCount || 0),
        'high=' + (item.highPriorityOpenCount || 0),
        formatStanceSummary(item.byType)
      ].filter(Boolean).join(' | ')) + '</small>' +
      '</div>';
  }).join('');
}

function renderAuthorReviewQueueSourceHotspots(items) {
  if (items.length === 0) return '<div class="muted">No source hotspots</div>';
  return items.slice(0, 12).map(function (item) {
    const details = [
      'items=' + (item.itemCount || 0),
      'open=' + (item.openCount || 0),
      'high=' + (item.highPriorityOpenCount || 0),
      item.latestUpdatedAt ? 'latest=' + item.latestUpdatedAt : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.sourceKey || 'unknown-source') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(formatStanceSummary(item.byType)) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      statusBadge((item.highPriorityOpenCount || 0) > 0 ? 'review' : 'open', (item.highPriorityOpenCount || 0) > 0 ? 'warn' : 'muted') +
      renderSourceDrilldownButtonForScope({ sourceKey: item.sourceKey }) +
      '</span></div>';
  }).join('');
}

function renderAuthorReviewQueueEventSynthesis(result) {
  const rows = result.results || [];
  return [
    panel('Author queue alert synthesis', [
      metric('Mode', result.dryRun ? 'dry-run' : 'execute'),
      metric('Items', result.itemCount || 0),
      metric('Actions', result.actionCount || 0),
      metric('Created', result.createdCount || 0),
      metric('Updated', result.updatedCount || 0),
      metric('Resolved', result.resolvedCount || 0),
      metric('Reopened', result.reopenedCount || 0),
      metric('Skipped', result.skippedCount || 0),
      metric('Next', result.recommendedNextAction || 'none'),
      '<span class="button-group">' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">Back to queue</button>' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="false" data-limit="50">Run check again</button>' +
      '</span>'
    ].join(''), 'wide'),
    panel('Event preview', evidenceList(rows.map(function (item) {
      const event = item.event || {};
      const reason = item.reason ? ' | ' + item.reason : '';
      return item.status + ' | ' + (item.itemId || 'unknown-item') + ' | ' + (event.id || 'no-event') + ' | ' + (event.severity || 'unknown') + reason;
    })), 'wide')
  ].join('');
}

function renderDurableAuthorReviewQueueRowsLegacy(items) {
  if (items.length === 0) return '<div class="muted">No durable queue items</div>';
  return items.slice(0, 30).map(function (item) {
    const ref = (item.refs || [])[0] || {};
    const sourceKey = item.sourceKey || ref.sourceKey;
    const details = [
      item.id,
      sourceKey ? 'source=' + sourceKey : undefined,
      item.type,
      item.reason,
      item.sourceThreadId || ref.sourceThreadId ? 'thread=' + (item.sourceThreadId || ref.sourceThreadId) : undefined,
      item.floor === undefined && ref.floor === undefined ? undefined : '#' + (item.floor === undefined ? ref.floor : item.floor),
      'seen=' + (item.seenCount || 0)
    ].filter(Boolean).join(' · ');
    const controls = '<span class="button-group source-op-buttons">' +
      renderSourceDrilldownButtonForScope({ sourceKey }) +
      (item.status === 'open'
        ? '<button class="inline-button secondary-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="confirmed">Confirm</button><button class="inline-button warning-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="ignored">Ignore</button>'
        : statusBadge(item.status || 'unknown', item.status === 'confirmed' ? 'ok' : 'muted')) +
      '</span>';
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.title || item.id) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.summary || '') + '</small>' +
      '<small>' + escapeHtml(item.nextAction || '') + '</small>' +
      '</span>' +
      controls +
      '</div>';
  }).join('');
}

function renderAuthorIntelligenceRowsLegacy(authors) {
  if (authors.length === 0) return '<div class="muted">暂无作者情报</div>';
  return authors.slice(0, 12).map(function (item) {
    const author = item.author || {};
    const intelligence = item.intelligence || {};
    const sourceKey = item.sourceKey || author.sourceKey;
    const focus = (item.topFocusEntities || []).slice(0, 4).map(function (entity) {
      return entity.entity && entity.entity.displayName ? entity.entity.displayName + '/' + entity.latestAttitude : entity.key;
    }).join(' · ');
    const details = [
      sourceKey ? 'source=' + sourceKey : undefined,
      'posts=' + (item.postCount || 0),
      'opinions=' + (item.opinionCount || 0),
      'threads=' + (item.threadCount || 0),
      item.dominantStance ? 'stance=' + item.dominantStance : undefined,
      item.averageOpinionConfidence === undefined ? undefined : 'confidence=' + item.averageOpinionConfidence,
      'primary=' + (item.primaryThreadCount || 0),
      'gaps=' + (item.evidenceGapCount || 0)
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(author.displayName || author.sourceAuthorId || item.key) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(intelligence.summary || focus || formatStanceSummary(item.stanceSummary)) + '</small>' +
      (focus ? '<small>' + escapeHtml(focus) + '</small>' : '') +
      '</span><span class="button-group source-op-buttons">' +
      statusBadge(intelligence.evidenceStatus || (item.evidenceGapCount > 0 ? 'needs-review' : 'ready'), intelligence.evidenceStatus === 'needs-review' ? 'warn' : 'ok') +
      renderSourceDrilldownButtonForScope({ sourceKey }) +
      '</span></div>';
  }).join('');
}

function renderAuthorReviewQueueRows(items) {
  if (items.length === 0) return '<div class="muted">No author review queue yet.</div>';
  return items.slice(0, 12).map(function (item) {
    const ref = (item.refs || [])[0] || {};
    const sourceKey = item.sourceKey || ref.sourceKey || (item.thread && item.thread.sourceKey);
    const threadRef = ref.sourceThreadId ? 'thread ' + ref.sourceThreadId : undefined;
    const floorRef = ref.floor === undefined ? undefined : '#' + ref.floor;
    return '<div class="author-review-row ' + (item.priority === 'high' ? 'is-hot' : '') + '">' +
      '<section class="author-review-identity">' +
        '<span class="author-review-source">' + escapeHtml(sourceKey || 'all-sources') + '</span>' +
        '<strong>' + escapeHtml(item.title || item.key || 'review item') + '</strong>' +
        '<small>' + escapeHtml([item.type, item.reason].filter(Boolean).join(' / ') || 'author signal') + '</small>' +
      '</section>' +
      '<section class="author-review-brief">' +
        '<p>' + escapeHtml(item.summary || item.reason || 'Needs operator review before downstream action.') + '</p>' +
        '<div class="author-review-chips">' +
          authorMetaChip('priority', item.priority || 'unknown', item.priority === 'high' ? 'warn' : 'muted') +
          authorMetaChip('score', item.score === undefined ? undefined : item.score, item.score >= 0.8 ? 'warn' : 'info') +
          authorMetaChip('thread', threadRef, 'info') +
          authorMetaChip('floor', floorRef, 'muted') +
        '</div>' +
        '<small>' + escapeHtml(item.nextAction || 'Open source scope and validate the evidence chain.') + '</small>' +
      '</section>' +
      '<section class="author-review-actions button-group source-op-buttons">' +
        statusBadge(item.priority || 'unknown', item.priority === 'high' ? 'warn' : 'muted') +
        renderSourceDrilldownButtonForScope({ sourceKey }) +
      '</section>' +
    '</div>';
  }).join('');
}

function renderDurableAuthorReviewQueueRows(items) {
  if (items.length === 0) return '<div class="muted">No durable queue items</div>';
  return items.slice(0, 30).map(function (item) {
    const ref = (item.refs || [])[0] || {};
    const sourceKey = item.sourceKey || ref.sourceKey;
    const threadRef = item.sourceThreadId || ref.sourceThreadId;
    const floorRef = item.floor === undefined && ref.floor === undefined ? undefined : '#' + (item.floor === undefined ? ref.floor : item.floor);
    const controls = '<section class="author-review-actions button-group source-op-buttons">' +
      renderSourceDrilldownButtonForScope({ sourceKey }) +
      (item.status === 'open'
        ? '<button class="inline-button secondary-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="confirmed">Confirm</button><button class="inline-button warning-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="ignored">Ignore</button>'
        : statusBadge(item.status || 'unknown', item.status === 'confirmed' ? 'ok' : 'muted')) +
      '</section>';
    return '<div class="author-review-row durable-review-row ' + (item.priority === 'high' ? 'is-hot' : '') + '">' +
      '<section class="author-review-identity">' +
        '<span class="author-review-source">' + escapeHtml(sourceKey || 'unknown-source') + '</span>' +
        '<strong>' + escapeHtml(item.title || item.id) + '</strong>' +
        '<small>' + escapeHtml([item.type, item.reason].filter(Boolean).join(' / ') || item.id) + '</small>' +
      '</section>' +
      '<section class="author-review-brief">' +
        '<p>' + escapeHtml(item.summary || 'Open queue item waiting for operator judgement.') + '</p>' +
        '<div class="author-review-chips">' +
          authorMetaChip('status', item.status || 'unknown', item.status === 'open' ? 'warn' : 'muted') +
          authorMetaChip('seen', item.seenCount || 0, (item.seenCount || 0) > 1 ? 'info' : 'muted') +
          authorMetaChip('thread', threadRef ? 'thread ' + threadRef : undefined, 'info') +
          authorMetaChip('floor', floorRef, 'muted') +
        '</div>' +
        '<small>' + escapeHtml(item.nextAction || 'Confirm, ignore, or drill into the source scope.') + '</small>' +
      '</section>' +
      controls +
      '</div>';
  }).join('');
}

function renderAuthorIntelligenceRows(authors) {
  if (authors.length === 0) return '<div class="muted">No author intelligence yet.</div>';
  return authors.slice(0, 12).map(function (item) {
    const author = item.author || {};
    const intelligence = item.intelligence || {};
    const sourceKey = item.sourceKey || author.sourceKey;
    const focusEntities = (item.topFocusEntities || []).slice(0, 4).map(function (entity) {
      return entity.entity && entity.entity.displayName ? entity.entity.displayName + ' / ' + entity.latestAttitude : entity.key;
    }).filter(Boolean);
    const focus = focusEntities.join(' | ');
    const confidence = item.averageOpinionConfidence === undefined ? undefined : item.averageOpinionConfidence;
    return '<div class="author-signal-row">' +
      '<section class="author-signal-identity">' +
        '<span class="author-review-source">' + escapeHtml(sourceKey || 'unknown-source') + '</span>' +
        '<strong>' + escapeHtml(author.displayName || author.sourceAuthorId || item.key || 'unknown author') + '</strong>' +
        '<small>' + escapeHtml([author.sourceAuthorId, item.dominantStance ? 'stance=' + item.dominantStance : undefined].filter(Boolean).join(' / ') || 'author profile') + '</small>' +
      '</section>' +
      '<section class="author-signal-brief">' +
        '<p>' + escapeHtml(intelligence.summary || focus || formatStanceSummary(item.stanceSummary) || 'No summary generated yet.') + '</p>' +
        '<div class="author-signal-metrics">' +
          authorMetaChip('posts', item.postCount || 0, 'info') +
          authorMetaChip('opinions', item.opinionCount || 0, 'ok') +
          authorMetaChip('threads', item.threadCount || 0, 'muted') +
          authorMetaChip('confidence', confidence, confidence >= 0.8 ? 'ok' : 'muted') +
          authorMetaChip('primary', item.primaryThreadCount || 0, 'info') +
          authorMetaChip('gaps', item.evidenceGapCount || 0, item.evidenceGapCount > 0 ? 'warn' : 'ok') +
        '</div>' +
        (focusEntities.length > 0 ? '<div class="author-signal-focus">' + focusEntities.map(function (entry) {
          return '<span>' + escapeHtml(entry) + '</span>';
        }).join('') + '</div>' : '') +
      '</section>' +
      '<section class="author-signal-actions button-group source-op-buttons">' +
        statusBadge(intelligence.evidenceStatus || (item.evidenceGapCount > 0 ? 'needs-review' : 'ready'), intelligence.evidenceStatus === 'needs-review' ? 'warn' : 'ok') +
        renderSourceDrilldownButtonForScope({ sourceKey }) +
      '</section>' +
      '</div>';
  }).join('');
}

function authorMetaChip(label, value, variant) {
  if (value === undefined || value === null || value === '') return '';
  return '<span class="author-meta-chip ' + statusClassName(variant || 'muted') + '"><b>' + escapeHtml(label) + '</b>' + escapeHtml(value) + '</span>';
}

function renderAuthorEntityRowsLegacy(entities) {
  if (entities.length === 0) return '<div class="muted">暂无聚焦实体</div>';
  return entities.slice(0, 12).map(function (item) {
    const entity = item.entity || {};
    const levels = item.evidenceLevels || {};
    const details = [
      'mentions=' + (item.mentionCount || 0),
      'authorOpinions=' + (item.primaryAuthorOpinionCount || 0),
      'threads=' + (item.threadCount || 0),
      'explicit=' + (levels.explicit || 0),
      'inferred=' + (levels.inferred || 0)
    ].join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(entity.displayName || item.key) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' +
      statusBadge(item.latestAttitude || 'unknown', statusVariant(item.latestAttitude)) +
      '</div>';
  }).join('');
}

function renderOpinionTimelineRowsLegacy(items) {
  if (items.length === 0) return '<div class="muted">暂无观点时间线</div>';
  return items.slice(0, 16).map(function (item) {
    const thread = item.thread || {};
    const author = item.author || {};
    const details = [
      thread.sourceThreadId ? 'thread=' + thread.sourceThreadId : undefined,
      item.publishedAt,
      item.scope,
      item.horizon,
      item.confidence === undefined ? undefined : 'confidence=' + item.confidence
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml('#' + item.floor + ' · ' + (author.displayName || author.sourceAuthorId || 'unknown')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.evidenceText || '') + '</small>' +
      '</span>' +
      statusBadge(item.attitude || 'unknown', statusVariant(item.attitude)) +
      '</div>';
  }).join('');
}

function renderAuthorEvidenceGapRowsLegacy(gaps) {
  if (gaps.length === 0) return '<div class="muted">暂无证据缺口</div>';
  return gaps.slice(0, 12).map(function (gap) {
    const entity = gap.entity || {};
    const thread = gap.thread || {};
    const details = [
      thread.sourceThreadId ? 'thread=' + thread.sourceThreadId : undefined,
      '#' + gap.firstFloor + '-#' + gap.lastFloor,
      gap.reason
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(entity.displayName || gap.key || 'unknown-entity') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(gap.summary || '') + '</small>' +
      '</span>' +
      statusBadge('gap', 'warn') +
      '</div>';
  }).join('');
}

function renderAuthorEvidenceRowsLegacy(items) {
  if (items.length === 0) return '<div class="muted">暂无高信号证据</div>';
  return items.slice(0, 12).map(function (item) {
    const thread = item.thread || {};
    const author = item.author || {};
    const details = [
      thread.sourceThreadId ? 'thread=' + thread.sourceThreadId : undefined,
      item.publishedAt,
      item.score === undefined ? undefined : 'score=' + item.score
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml('#' + item.floor + ' · ' + (author.displayName || author.sourceAuthorId || 'unknown')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.excerpt || '') + '</small>' +
      '</span>' +
      statusBadge('evidence', 'ok') +
      '</div>';
  }).join('');
}

function renderAuthorEntityRows(entities) {
  if (entities.length === 0) return '<div class="muted">No focus entities yet.</div>';
  return entities.slice(0, 12).map(function (item) {
    const entity = item.entity || {};
    const levels = item.evidenceLevels || {};
    return '<div class="author-evidence-row entity-signal-row">' +
      '<section class="author-evidence-anchor">' +
        '<span class="author-review-source">entity</span>' +
        '<strong>' + escapeHtml(entity.displayName || item.key || 'unknown entity') + '</strong>' +
        '<small>' + escapeHtml(item.latestAttitude || 'unknown stance') + '</small>' +
      '</section>' +
      '<section class="author-evidence-brief">' +
        '<p>' + escapeHtml(formatStanceSummary(item.attitudeCounts) || 'Entity is present in the current author window.') + '</p>' +
        '<div class="author-evidence-chips">' +
          authorMetaChip('mentions', item.mentionCount || 0, 'info') +
          authorMetaChip('author opinions', item.primaryAuthorOpinionCount || 0, 'ok') +
          authorMetaChip('threads', item.threadCount || 0, 'muted') +
          authorMetaChip('explicit', levels.explicit || 0, (levels.explicit || 0) > 0 ? 'ok' : 'muted') +
          authorMetaChip('inferred', levels.inferred || 0, (levels.inferred || 0) > 0 ? 'warn' : 'muted') +
        '</div>' +
      '</section>' +
      '<section class="author-evidence-status">' +
        statusBadge(item.latestAttitude || 'unknown', statusVariant(item.latestAttitude)) +
      '</section>' +
      '</div>';
  }).join('');
}

function renderOpinionTimelineRows(items) {
  if (items.length === 0) return '<div class="muted">No opinion timeline yet.</div>';
  return items.slice(0, 16).map(function (item) {
    const thread = item.thread || {};
    const author = item.author || {};
    return '<div class="author-evidence-row opinion-timeline-row">' +
      '<section class="author-evidence-anchor">' +
        '<span class="author-review-source">' + escapeHtml(thread.sourceKey || 'timeline') + '</span>' +
        '<strong>' + escapeHtml('#' + item.floor + ' / ' + (author.displayName || author.sourceAuthorId || 'unknown')) + '</strong>' +
        '<small>' + escapeHtml(item.publishedAt || 'time unknown') + '</small>' +
      '</section>' +
      '<section class="author-evidence-brief">' +
        '<p>' + escapeHtml(item.evidenceText || 'No evidence text captured for this opinion.') + '</p>' +
        '<div class="author-evidence-chips">' +
          authorMetaChip('thread', thread.sourceThreadId ? 'thread ' + thread.sourceThreadId : undefined, 'info') +
          authorMetaChip('scope', item.scope, 'muted') +
          authorMetaChip('horizon', item.horizon, 'muted') +
          authorMetaChip('confidence', item.confidence, item.confidence >= 0.8 ? 'ok' : 'muted') +
        '</div>' +
      '</section>' +
      '<section class="author-evidence-status">' +
        statusBadge(item.attitude || 'unknown', statusVariant(item.attitude)) +
      '</section>' +
      '</div>';
  }).join('');
}

function renderAuthorEvidenceGapRows(gaps) {
  if (gaps.length === 0) return '<div class="muted">No evidence gaps.</div>';
  return gaps.slice(0, 12).map(function (gap) {
    const entity = gap.entity || {};
    const thread = gap.thread || {};
    return '<div class="author-evidence-row evidence-gap-row">' +
      '<section class="author-evidence-anchor">' +
        '<span class="author-review-source">' + escapeHtml(thread.sourceKey || 'gap') + '</span>' +
        '<strong>' + escapeHtml(entity.displayName || gap.key || 'unknown entity') + '</strong>' +
        '<small>' + escapeHtml('#' + gap.firstFloor + '-#' + gap.lastFloor) + '</small>' +
      '</section>' +
      '<section class="author-evidence-brief">' +
        '<p>' + escapeHtml(gap.summary || gap.reason || 'This entity needs stronger evidence before automation.') + '</p>' +
        '<div class="author-evidence-chips">' +
          authorMetaChip('thread', thread.sourceThreadId ? 'thread ' + thread.sourceThreadId : undefined, 'info') +
          authorMetaChip('reason', gap.reason, 'warn') +
          authorMetaChip('first', gap.firstFloor === undefined ? undefined : '#' + gap.firstFloor, 'muted') +
          authorMetaChip('last', gap.lastFloor === undefined ? undefined : '#' + gap.lastFloor, 'muted') +
        '</div>' +
      '</section>' +
      '<section class="author-evidence-status">' +
        statusBadge('gap', 'warn') +
      '</section>' +
      '</div>';
  }).join('');
}

function renderAuthorEvidenceRows(items) {
  if (items.length === 0) return '<div class="muted">No high-signal evidence yet.</div>';
  return items.slice(0, 12).map(function (item) {
    const thread = item.thread || {};
    const author = item.author || {};
    return '<div class="author-evidence-row high-signal-row">' +
      '<section class="author-evidence-anchor">' +
        '<span class="author-review-source">' + escapeHtml(thread.sourceKey || 'evidence') + '</span>' +
        '<strong>' + escapeHtml('#' + item.floor + ' / ' + (author.displayName || author.sourceAuthorId || 'unknown')) + '</strong>' +
        '<small>' + escapeHtml(item.publishedAt || 'time unknown') + '</small>' +
      '</section>' +
      '<section class="author-evidence-brief">' +
        '<p>' + escapeHtml(item.excerpt || 'Evidence excerpt is not available.') + '</p>' +
        '<div class="author-evidence-chips">' +
          authorMetaChip('thread', thread.sourceThreadId ? 'thread ' + thread.sourceThreadId : undefined, 'info') +
          authorMetaChip('score', item.score, item.score >= 0.8 ? 'ok' : 'muted') +
          authorMetaChip('floor', item.floor === undefined ? undefined : '#' + item.floor, 'muted') +
        '</div>' +
      '</section>' +
      '<section class="author-evidence-status">' +
        statusBadge('evidence', 'ok') +
      '</section>' +
      '</div>';
  }).join('');
}

function formatStanceSummary(summary) {
  const keys = Object.keys(summary || {});
  if (keys.length === 0) return '暂无';
  return keys.sort().map(function (key) {
    return key + ' ' + summary[key];
  }).join(' / ');
}

function formatOpinionChainSummary(chain) {
  const entity = chain.entity || {};
  const levels = chain.evidenceLevels || {};
  return [
    entity.displayName || chain.key,
    '观点 ' + chain.opinionCount,
    '主作者 ' + chain.primaryAuthorOpinionCount,
    '最新 ' + (chain.latestAttitude || 'unknown'),
    '变化 ' + (chain.latestChange ? chain.latestChange.changeType : '暂无'),
    '明确 ' + (levels.explicit || 0),
    '推断 ' + (levels.inferred || 0),
    '置信度 ' + chain.confidence
  ].join(' · ');
}

function formatImplicitReferenceSummary(candidate) {
  const entities = (candidate.nearbyEntities || []).slice(0, 3).map(function (entity) {
    return entity.displayName + '/' + entity.evidenceLevel + '/#' + entity.floor;
  }).join(', ') || '暂无对象';
  return [
    '#' + candidate.floor,
    candidate.label,
    candidate.phrase,
    '置信度 ' + candidate.confidence,
    entities
  ].join(' · ');
}

function renderContextReport(report) {
  return [
    renderContextVerdictHero(report),
    renderInterpretationSummary(report.interpretationSummary),
    panel('新发言', [
      metric('内容', report.newPost.contentText),
      metric('实体', (report.newEntities || []).map(function (entity) { return entity.displayName; }).join(', ') || '暂无'),
      metric('观点', (report.newOpinions || []).map(function (opinion) { return opinion.attitude + ' · ' + opinion.confidence; }).join(', ') || '暂无'),
      metric('隐晦表达', (report.newImplicitReferences || []).map(function (item) { return item.label + ' · ' + item.phrase; }).join(', ') || '暂无')
    ].join('')),
    renderContextMatchSummary(report.contextMatchSummary),
    panel('承接观点链', evidenceList((report.contextChainMatches || []).map(formatContextChainMatch)), 'wide'),
    renderContextReviewHandoff(report.contextReviewHandoff),
    panel('核验任务', evidenceList((report.contextReviewTasks || []).map(formatContextReviewTask)), 'wide'),
    panel('相关历史证据', evidenceList((report.relatedEvidence || []).map(function (item) {
      return '#' + item.floor + ' ' + item.author + ' · ' + item.confidence + '：' + item.reasons.join(', ');
    })), 'wide')
  ].join('');
}

function renderContextVerdictHero(report) {
  const summary = report.interpretationSummary || {};
  const match = report.contextMatchSummary || {};
  const handoff = report.contextReviewHandoff || {};
  const post = report.newPost || {};
  const evidencePackage = handoff.evidencePackage || {};
  const floors = (evidencePackage.floors || []).length > 0 ? '#' + evidencePackage.floors.slice(0, 6).join(' / #') : 'none';
  const reviewCount = match.reviewRequiredCount || 0;
  const taskCount = handoff.taskCount || (report.contextReviewTasks || []).length || 0;
  const highPriorityCount = handoff.highPriorityTaskCount || 0;
  const tags = [
    summary.evidenceLevel ? 'evidence ' + summary.evidenceLevel : undefined,
    summary.confidence !== undefined ? 'confidence ' + summary.confidence : undefined,
    match.topEntity ? 'entity ' + match.topEntity : undefined,
    match.topRelationType ? 'relation ' + match.topRelationType : undefined
  ].filter(Boolean);
  const reviewTone = highPriorityCount > 0 || reviewCount > 0 ? 'warn' : statusVariant(summary.status || match.status || handoff.status);
  return [
    '<article class="context-verdict-hero">',
    '<section class="context-verdict-main">',
    '<div class="context-verdict-header">',
    '<span class="context-verdict-label">Context verdict</span>',
    statusBadge(summary.status || match.status || 'interpreted', reviewTone),
    '</div>',
    '<h3>' + escapeHtml(summary.summary || '已完成语境召回，等待进一步核验。') + '</h3>',
    '<p>' + escapeHtml(post.contentText || '暂无新发言内容。') + '</p>',
    '<div class="context-verdict-tags">' + tagList(tags) + '</div>',
    '</section>',
    '<aside class="context-verdict-rail">',
    contextVerdictSignal('Matches', match.total || (report.contextChainMatches || []).length || 0, statusVariant(match.status)),
    contextVerdictSignal('Review', reviewCount, reviewCount > 0 ? 'warn' : 'ok'),
    contextVerdictSignal('Tasks', taskCount, taskCount > 0 ? 'warn' : 'muted'),
    contextVerdictSignal('Floors', floors, floors === 'none' ? 'muted' : 'ok'),
    '</aside>',
    '<section class="context-verdict-next">',
    '<span>Next action</span>',
    '<strong>' + escapeHtml(handoff.recommendedNextAction || 'Inspect matched evidence and decide whether to create review work.') + '</strong>',
    '<small>' + escapeHtml(highPriorityCount > 0 ? highPriorityCount + ' high priority review tasks' : 'No high priority review tasks') + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function contextVerdictSignal(label, value, variant) {
  return '<div class="context-verdict-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function renderContextReviewHandoff(handoff) {
  if (!handoff) {
    return panel('核验交接', '<div class="muted">暂无</div>', 'wide');
  }
  const evidencePackage = handoff.evidencePackage || {};
  const floors = (evidencePackage.floors || []).length > 0 ? '#' + evidencePackage.floors.join(' / #') : '暂无';
  return panel('核验交接', [
    metric('状态', handoff.status),
    metric('任务/高优', handoff.taskCount + ' / ' + handoff.highPriorityTaskCount),
    metric('证据楼层', floors),
    metric('下一步', handoff.recommendedNextAction)
  ].join(''), 'wide');
}

function renderContextMatchSummary(summary) {
  if (!summary) {
    return panel('承接概览', '<div class="muted">暂无</div>');
  }
  return panel('承接概览', [
    metric('状态', summary.status),
    metric('匹配/复核', summary.total + ' / ' + summary.reviewRequiredCount),
    metric('Top 对象', summary.topEntity || '暂无'),
    metric('Top 关系', summary.topRelationType || '暂无'),
    evidenceList((summary.reviewReasons || []).slice(0, 4).map(function (item) {
      return item.reason + ' · ' + item.count;
    }))
  ].join(''));
}

function renderInterpretationSummary(summary) {
  if (!summary) {
    return panel('解读摘要', '<div class="muted">暂无</div>', 'wide');
  }
  return panel('解读摘要', [
    metric('状态', summary.status),
    metric('证据级别', summary.evidenceLevel),
    metric('置信度', summary.confidence),
    metric('结论', summary.summary)
  ].join(''), 'wide');
}

function formatContextChainMatch(match) {
  const chain = match.chain || {};
  const entity = chain.entity || {};
  return [
    entity.displayName || chain.key,
    match.relationType,
    match.relationFamily || 'unknown',
    '证据 ' + (match.relationEvidenceLevel || 'unknown'),
    '置信度 ' + match.confidence,
    chain.latestAttitude || 'unknown',
    match.relationSummary,
    match.reviewRequired ? '需复核 ' + (match.reviewReasons || []).join(',') : '无需复核'
  ].join(' · ');
}

function formatContextReviewTask(task) {
  const floors = (task.evidenceFloors || []).length > 0 ? '楼层 #' + task.evidenceFloors.join('/#') : '暂无楼层';
  return [
    '[' + task.priority + ']',
    task.title,
    task.targetEntity || '暂无对象',
    floors,
    task.question
  ].join(' · ');
}

function renderIndexResult(result) {
  return [
    panel('索引已更新', [
      metric('论坛', result.sourceKey),
      metric('主题', result.title),
      metric('主题 ID', result.sourceThreadId),
      metric('文档数', result.indexedDocumentCount)
    ].join(''), 'wide')
  ].join('');
}

function renderSearchResults(result) {
  const results = result.results || [];
  return [
    panel('证据命中', renderSearchHitRows(results), 'wide search-results-panel')
  ].join('');
}

function renderSearchHitRows(results) {
  if (!results.length) return emptySignal('No matching evidence yet.', 'Search');
  return results.map(function (item) {
    const metadata = item.metadata || {};
    const floor = metadata.floor !== undefined && metadata.floor !== null ? '#' + metadata.floor : '#?';
    const author = metadata.author || metadata.authorId || 'unknown author';
    const score = item.score !== undefined && item.score !== null ? item.score : 'n/a';
    return '<div class="search-hit-row">' +
      '<div class="search-hit-meta">' +
      '<span>' + escapeHtml(floor) + '</span>' +
      '<strong>' + escapeHtml(author) + '</strong>' +
      '<small>score ' + escapeHtml(score) + '</small>' +
      '</div>' +
      '<p>' + escapeHtml(item.text || '') + '</p>' +
      '</div>';
  }).join('');
}

function renderTaskRunResult(result) {
  return panel('任务完成', [
    metric('任务 ID', result.task.id),
    metric('状态', result.task.status),
    metric('主题', result.task.output ? result.task.output.title : ''),
    metric('楼层', result.task.output ? result.task.output.parsedPostCount : '')
  ].join(''), 'wide');
}

function renderSourceSaveResult(result) {
  return panel(result.created ? '来源已创建' : '来源已更新', [
    metric('来源 ID', result.source.id),
    metric('论坛', result.source.sourceKey),
    metric('类型', result.source.sourceType),
    metric('名称', result.source.displayName)
  ].join(''), 'wide');
}

function renderSourceOnboardingRecipe(sourceTypeSpec, selectedSourceKey) {
  const recipe = sourceTypeSpec.onboardingRecipe || {};
  const compatibleSourceKeys = recipe.compatibleSourceKeys || [];
  const sourceKey = selectedSourceKey || compatibleSourceKeys[0] || '<source-key>';
  const connectorPackage = findConnectorPackageForSourceType(
    sourceTypeSpec.sourceType,
    sourceTypeSpec.package && sourceTypeSpec.package.packageName
  );
  const manifest = buildOnboardingRecipeManifest(recipe.rolloutManifestTemplate, sourceKey, {
    connectorPackage
  });
  state.onboardingRecipeManifestDraft = manifest;
  const requiredFields = recipe.requiredLocationFields || [];
  const optionalFields = recipe.optionalLocationFields || [];
  const adapterSummary = recipe.adapterGuidance && recipe.adapterGuidance.summary || (recipe.requiresAdapter ? 'Adapter required.' : 'Adapter not required.');
  const compatibleLabel = compatibleSourceKeys.length > 0 ? compatibleSourceKeys.join(', ') : 'none';
  return renderConnectorCatalogPanels(sourceTypeSpec).concat([
    panel('Source onboarding recipe', [
      metric('Source type', sourceTypeSpec.sourceType),
      metric('Adapter', recipe.requiresAdapter ? 'required' : 'not required'),
      metric('Location fields', requiredFields.length + ' required / ' + optionalFields.length + ' optional'),
      metric('Compatible keys', compatibleLabel)
    ].join('')),
    panel('Adapter guidance', [
      '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(recipe.requiresAdapter ? 'Forum adapter' : 'Canonical source') + '</strong>' +
      '<small>' + escapeHtml(adapterSummary) + '</small>' +
      '</span>' + statusBadge(recipe.requiresAdapter ? 'adapter' : 'direct', recipe.requiresAdapter && compatibleSourceKeys.length === 0 ? 'warning' : 'ok') + '</div>'
    ].join('')),
    panel('Location fields', renderRecipeLocationRows(sourceTypeSpec, requiredFields, optionalFields), 'wide'),
    panel('Recommended flow', renderRecipeFlowRows(recipe.recommendedFlow || []), 'wide'),
    panel('Rollout manifest template', [
      '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(manifest.name || 'manifest') + '</strong>' +
      '<small>' + escapeHtml((manifest.source && manifest.source.sourceKey || 'unknown') + ' | ' + (manifest.source && manifest.source.sourceType || 'unknown')) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-onboarding-recipe-manifest">Use template</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="preflight-onboarding-recipe-manifest">Preflight template</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-rollout-readiness-checks">Run rollout checks</button>' +
      '</span></div>',
      '<pre>' + escapeHtml(JSON.stringify(manifest, null, 2)) + '</pre>'
    ].join(''), 'wide')
  ]).join('');
}

function renderConnectorCatalogPanels(sourceTypeSpec) {
  const panels = [];
  if (sourceTypeSpec.package) {
    panels.push(panel('Connector package', [
      renderConnectorPackageSummary(sourceTypeSpec.package),
      renderConnectorPackageCategories(sourceTypeSpec.package.categories),
      metric('Recommended manifest', sourceTypeSpec.package.rollout && sourceTypeSpec.package.rollout.recommendedManifest || 'none'),
      renderConnectorPackageUseButtons(sourceTypeSpec.package, sourceTypeSpec.sourceType)
    ].join(''), 'wide'));
  } else if ((state.connectorPackages || []).length > 0) {
    panels.push(panel('Connector packages', renderConnectorPackageCatalogRows(state.connectorPackages), 'wide'));
  }
  if ((state.connectorModuleErrors || []).length > 0) {
    panels.push(panel('Connector module errors', evidenceList(state.connectorModuleErrors.map(function (error) {
      return (error.modulePath || 'unknown-module') + ' | ' + (error.message || 'load failed');
    })), 'wide'));
  }
  return panels;
}

function renderConnectorPackageSummary(connectorPackage) {
  const packageSourceType = connectorPackage.sourceType || {};
  return [
    '<div class="action-row ops-row"><span>',
    '<strong>' + escapeHtml(connectorPackage.displayName || connectorPackage.packageName || 'Connector package') + '</strong>',
    '<small>' + escapeHtml([
      connectorPackage.packageName,
      connectorPackage.packageVersion ? 'version=' + connectorPackage.packageVersion : undefined,
      connectorPackage.packageType ? 'type=' + connectorPackage.packageType : undefined,
      packageSourceType.kind ? 'kind=' + packageSourceType.kind : undefined
    ].filter(Boolean).join(' | ')) + '</small>',
    '<small>' + escapeHtml(packageSourceType.description || packageSourceType.displayName || '') + '</small>',
    '</span>' + statusBadge('package', 'ok') + '</div>'
  ].join('');
}

function renderConnectorPackageCategories(categories) {
  if (!categories || categories.length === 0) return tagList(['uncategorized']);
  return tagList(categories.map(function (category) {
    return 'category:' + category;
  }));
}

function renderConnectorPackageCatalogRows(packages) {
  if (!packages.length) return '<div class="muted">No connector package metadata loaded.</div>';
  return packages.map(function (connectorPackage) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(connectorPackage.displayName || connectorPackage.packageName || 'Connector package') + '</strong>' +
      '<small>' + escapeHtml([
        connectorPackage.packageName,
        connectorPackage.packageType,
        (connectorPackage.categories || []).join(',')
      ].filter(Boolean).join(' | ')) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderConnectorPackageUseButtons(connectorPackage) +
      statusBadge('package', 'ok') +
      '</span></div>';
  }).join('');
}

function renderConnectorPackageUseButtons(connectorPackage, selectedSourceType) {
  if (!connectorPackage) return '';
  const sourceTypes = selectedSourceType
    ? [{ sourceType: selectedSourceType }]
    : connectorPackage.sourceTypes || [];
  return sourceTypes.filter(function (item) {
    return item && item.sourceType;
  }).map(function (item) {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="use-connector-package"' +
      ' data-package-name="' + escapeHtml(connectorPackage.packageName || '') + '"' +
      ' data-module-path="' + escapeHtml(connectorPackage.modulePath || '') + '"' +
      ' data-source-type="' + escapeHtml(item.sourceType || '') + '">Use package</button>' +
      renderConnectorPackageManifestButton(connectorPackage, item.sourceType);
  }).join('');
}

function renderConnectorPackageManifestButton(connectorPackage, sourceType) {
  if (!connectorPackage || !connectorPackage.rollout || !connectorPackage.rollout.recommendedManifest) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-connector-package-manifest"' +
    ' data-package-name="' + escapeHtml(connectorPackage.packageName || '') + '"' +
    ' data-module-path="' + escapeHtml(connectorPackage.modulePath || '') + '"' +
    ' data-source-type="' + escapeHtml(sourceType || '') + '">Load manifest</button>';
}

function buildOnboardingRecipeManifest(template, sourceKey, options) {
  const safeOptions = options || {};
  const manifest = clonePlainObject(template || {});
  manifest.version = manifest.version || '1.0';
  manifest.source = manifest.source || {};
  manifest.source.sourceKey = sourceKey || manifest.source.sourceKey || '<source-key>';
  manifest.source.displayName = manifest.source.displayName || '<display-name>';
  if (manifest.name) {
    manifest.name = manifest.name.replace(/^<source-key>/, manifest.source.sourceKey);
  } else {
    manifest.name = manifest.source.sourceKey + '-' + (manifest.source.sourceType || 'source') + '-rollout';
  }
  manifest.ingest = manifest.ingest || { dryRun: true };
  manifest.workers = manifest.workers || {
    topology: 'operations-worker',
    sourceTaskMode: 'ingest'
  };
  if (safeOptions.connectorPackage && safeOptions.connectorPackage.modulePath) {
    manifest.connector = Object.assign({}, manifest.connector || {}, {
      modulePath: safeOptions.connectorPackage.modulePath
    });
  }
  return manifest;
}

function clonePlainObject(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function renderRecipeLocationRows(sourceTypeSpec, requiredFields, optionalFields) {
  const fields = requiredFields.concat(optionalFields);
  const properties = sourceTypeSpec.locationSchema && sourceTypeSpec.locationSchema.properties || {};
  if (fields.length === 0) return '<div class="muted">No location fields</div>';
  return fields.map(function (field) {
    const property = properties[field] || {};
    const required = requiredFields.includes(field);
    const detail = [
      property.type,
      property.format,
      property.description
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(field) + '</strong>' +
      '<small>' + escapeHtml(detail || 'location value') + '</small>' +
      '</span>' + statusBadge(required ? 'required' : 'optional', required ? 'warning' : 'muted') + '</div>';
  }).join('');
}

function renderRecipeFlowRows(flow) {
  if (!flow.length) return '<div class="muted">No recommended flow</div>';
  return flow.map(function (step) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml((step.phase || 'step') + ' | ' + (step.key || 'unknown')) + '</strong>' +
      '<small>' + escapeHtml(step.summary || '') + '</small>' +
      '<small>' + escapeHtml([step.cli, step.api].filter(Boolean).join(' | ')) + '</small>' +
      '</span>' + statusBadge(step.key || 'step', 'muted') + '</div>';
  }).join('');
}

function renderSourceOnboardingPreflight(result) {
  state.rolloutManifestDraft = result.rolloutManifestDraft;
  const steps = result.steps || [];
  const failedSteps = steps.filter(function (step) {
    return step.status === 'fail';
  });
  const panels = [
    panel('来源接入预检', [
      metric('状态', result.status),
      metric('论坛', result.sourceKey || 'unknown'),
      metric('来源类型', result.sourceType || 'unknown'),
      metric('步骤', steps.length),
      metric('失败', failedSteps.length)
    ].join('')),
    panel('预检步骤', evidenceList(steps.map(function (step) {
      return step.status + ' · ' + step.key + ' · ' + step.summary;
    })), 'wide')
  ];
  if ((result.nextActions || []).length > 0) {
    panels.push(panel('Onboarding next actions', evidenceList((result.nextActions || []).map(function (action) {
      const commands = action.commands || (action.command ? [action.command] : []);
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' evidence=' + detail.evidenceSummary : '');
      }).join(' | ');
      return action.severity + ' | ' + action.key + ' | ' + action.summary + ' | ' + commands.join(' | ') + (action.evidenceSummary ? ' evidence=' + action.evidenceSummary : '') + (details ? ' details=' + details : '');
    })), 'wide'));
  }
  if (result.sourceValidation && result.sourceValidation.source) {
    panels.push(panel('来源草稿', [
      metric('来源 ID', result.sourceValidation.source.id),
      metric('可保存', result.sourceValidation.valid ? 'yes' : 'no'),
      metric('诊断', result.sourceValidation.status)
    ].join('')));
  }
  if (result.rolloutManifestDraft) {
    panels.push(panel('Rollout manifest draft', [
      '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(result.rolloutManifestDraft.name || 'manifest') + '</strong>' +
      '<small>' + escapeHtml((result.rolloutManifestDraft.source && result.rolloutManifestDraft.source.sourceKey || 'unknown') + ' | ' + (result.rolloutManifestDraft.source && result.rolloutManifestDraft.source.sourceType || 'unknown')) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-rollout-manifest-draft">Use draft</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="preflight-rollout-manifest-draft">Preflight draft</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-rollout-readiness-checks">Run rollout checks</button>' +
      '</span></div>',
      '<pre>' + escapeHtml(JSON.stringify(result.rolloutManifestDraft, null, 2)) + '</pre>'
    ].join(''), 'wide'));
  }
  if (result.connectorModuleValidation) {
    rememberConnectorContractSourceTypes(result.connectorModuleValidation.contractSummary);
    rememberConnectorPackageManifests(result.connectorModuleValidation.packageManifests);
    panels.push(panel('Connector 模块', [
      renderConnectorContractTiles(result.connectorModuleValidation.contractSummary),
      metric('可加载', result.connectorModuleValidation.valid ? 'yes' : 'no'),
      metric('状态', result.connectorModuleValidation.status),
      metric('模块', result.connectorModuleValidation.modulePath || 'missing'),
      metric('错误', (result.connectorModuleValidation.errors || []).length)
    ].join('')));
    if (hasConnectorContractDetails(result.connectorModuleValidation.contractSummary)) {
      panels.push(panel('Connector contract summary', renderConnectorContractSummary(result.connectorModuleValidation.contractSummary), 'wide'));
    }
    if ((result.connectorModuleValidation.packageManifests || []).length > 0) {
      panels.push(panel('Connector packages', renderConnectorPackageManifestRows(result.connectorModuleValidation.packageManifests), 'wide'));
    }
    const failureRows = connectorContractFailureRows(result.connectorModuleValidation.checks || []);
    if (failureRows.length > 0) {
      panels.push(panel('Connector contract failures', evidenceList(failureRows), 'wide'));
    }
  }
  if (result.threadJsonValidation) {
    panels.push(panel('ThreadSnapshot JSON', [
      metric('可导入', result.threadJsonValidation.valid ? 'yes' : 'no'),
      metric('状态', result.threadJsonValidation.status),
      metric('主题', result.threadJsonValidation.thread ? result.threadJsonValidation.thread.sourceThreadId : ''),
      metric('楼层', result.threadJsonValidation.thread ? result.threadJsonValidation.thread.postCount : '')
    ].join('')));
  }
  return panels.join('');
}

function renderConnectorModuleValidation(result) {
  rememberConnectorContractSourceTypes(result.contractSummary);
  rememberConnectorPackageManifests(result.packageManifests);
  const modules = result.modules || [];
  const errors = result.errors || [];
  const registrationCount = modules.reduce(function (total, item) {
    return total + (item.forumAdapters || []).length + (item.sourceIngestHandlers || []).length;
  }, 0);
  const panels = [
    panel('Connector 模块验证', [
      renderConnectorContractTiles(result.contractSummary),
      metric('状态', result.status),
      metric('可加载', result.valid ? 'yes' : 'no'),
      metric('模块', result.modulePath || 'missing'),
      metric('注册项', registrationCount),
      metric('错误', errors.length)
    ].join('')),
    panel('Contract checks', renderConnectorCheckRows(result.checks || []), 'wide')
  ];
  if (hasConnectorContractDetails(result.contractSummary)) {
    panels.push(panel('Contract summary', renderConnectorContractSummary(result.contractSummary), 'wide'));
  }
  if ((result.packageManifests || []).length > 0) {
    panels.push(panel('Connector packages', renderConnectorPackageManifestRows(result.packageManifests), 'wide'));
  }
  const failureRows = connectorContractFailureRows(result.checks || []);
  if (failureRows.length > 0) {
    panels.push(panel('Contract failures', evidenceList(failureRows), 'wide'));
  }
  if (modules.length > 0) {
    panels.push(panel('注册结果', evidenceList(modules.map(function (item) {
      return item.modulePath + ' · adapters=' + (item.forumAdapters || []).join(',') + ' · handlers=' + (item.sourceIngestHandlers || []).join(',');
    })), 'wide'));
  }
  if (errors.length > 0) {
    panels.push(panel('加载错误', evidenceList(errors.map(function (error) {
      return error.modulePath + ' · ' + error.message;
    })), 'wide'));
  }
  return panels.join('');
}

function renderConnectorCheckRows(checks) {
  if (!checks || checks.length === 0) return '<div class="muted">No checks</div>';
  return checks.map(function (check) {
    const value = formatCheckValue(check.value);
    const detail = value ? '<small>' + escapeHtml(value) + '</small>' : '';
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(check.key || 'check') + '</strong>' +
      '<small>' + escapeHtml(check.summary || '') + '</small>' +
      detail +
      '</span>' +
      statusBadge(check.status || 'unknown', statusVariant(check.status)) +
      '</div>';
  }).join('');
}

function renderConnectorContractTiles(summary) {
  if (!summary) return '';
  return '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Adapters', summary.forumAdapterCount || 0, (summary.forumAdapterCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Handlers', summary.sourceIngestHandlerCount || 0, (summary.sourceIngestHandlerCount || 0) > 0 ? 'ok' : 'muted')
  ].join('') + '</div>';
}

function hasConnectorContractDetails(summary) {
  if (!summary) return false;
  return (summary.forumAdapters || []).length > 0 || (summary.sourceIngestHandlers || []).length > 0;
}

function rememberConnectorContractSourceTypes(summary) {
  if (!summary || !(summary.sourceIngestHandlers || []).length) return;
  const known = new Set((state.sourceTypes || []).map(function (item) {
    return item.sourceType;
  }));
  (summary.sourceIngestHandlers || []).forEach(function (handler) {
    if (!handler.sourceType || known.has(handler.sourceType)) return;
    known.add(handler.sourceType);
    state.sourceTypes.push({
      sourceType: handler.sourceType,
      description: handler.description || handler.sourceType,
      requiresAdapter: handler.requiresAdapter !== false,
      locationSchema: {
        required: handler.requiredLocationFields || [],
        properties: {}
      },
      capabilities: handler.capabilities || {}
    });
  });
  fillSuggestionLists();
}

function rememberConnectorPackageManifests(packageManifests) {
  if (!packageManifests || packageManifests.length === 0) return;
  const known = new Set((state.connectorPackages || []).map(function (item) {
    return item.packageName + '|' + item.modulePath;
  }));
  packageManifests.forEach(function (item) {
    if (!item || !item.packageName) return;
    const key = item.packageName + '|' + item.modulePath;
    if (known.has(key)) return;
    known.add(key);
    state.connectorPackages.push({
      modulePath: item.modulePath,
      packagePath: item.packagePath,
      packageName: item.packageName,
      packageVersion: item.packageVersion,
      displayName: item.displayName,
      packageType: item.packageType,
      categories: item.categories || [],
      capabilities: item.capabilities || {},
      rollout: item.rollout,
      sourceTypes: (item.declaredSourceTypes || []).map(function (sourceType) {
        return {
          sourceType
        };
      })
    });
  });
}

function renderConnectorPackageManifestRows(packageManifests) {
  if (!packageManifests || packageManifests.length === 0) return '<div class="muted">No connector package manifests.</div>';
  return packageManifests.map(function (item) {
    const details = [
      item.packageName,
      item.packageVersion ? 'version=' + item.packageVersion : undefined,
      item.packageType ? 'type=' + item.packageType : undefined,
      (item.categories || []).length ? 'categories=' + item.categories.join(',') : undefined,
      (item.declaredSourceTypes || []).length ? 'sourceTypes=' + item.declaredSourceTypes.join(',') : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.displayName || item.packageName || 'Connector package') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.rollout && item.rollout.recommendedManifest ? 'recommendedManifest=' + item.rollout.recommendedManifest : 'recommendedManifest=none') + '</small>' +
      '</span>' + statusBadge(item.status || 'unknown', statusVariant(item.status)) + '</div>';
  }).join('');
}

function renderConnectorContractSummary(summary) {
  if (!hasConnectorContractDetails(summary)) return '<div class="muted">No contract details</div>';
  const adapterRows = (summary.forumAdapters || []).map(function (adapter) {
    const capabilities = formatCapabilities(adapter.capabilities);
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(adapter.sourceKey || 'missing-sourceKey') + '</strong>' +
      '<small>' + escapeHtml((adapter.displayName || 'missing displayName') + ' | fetchThread=' + (adapter.hasFetchThread ? 'yes' : 'no')) + '</small>' +
      '<small>' + escapeHtml(capabilities ? 'capabilities=' + capabilities : 'capabilities=none') + '</small>' +
      '</span>' +
      statusBadge('adapter', 'ok') +
      '</div>';
  });
  const handlerRows = (summary.sourceIngestHandlers || []).map(function (handler) {
    const location = (handler.requiredLocationFields || []).join(',') || 'none';
    const capabilities = formatCapabilities(handler.capabilities);
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(handler.sourceType || 'missing-sourceType') + '</strong>' +
      '<small>' + escapeHtml((handler.description || 'missing description') + ' | requiresAdapter=' + handler.requiresAdapter) + '</small>' +
      '<small>' + escapeHtml('requiredLocation=' + location + (capabilities ? ' | capabilities=' + capabilities : '')) + '</small>' +
      '</span>' +
      statusBadge('handler', 'ok') +
      '</div>';
  });
  return adapterRows.concat(handlerRows).join('');
}

function connectorContractFailureRows(checks) {
  return (checks || []).filter(function (check) {
    return check.status === 'fail' && check.value && typeof check.value === 'object';
  }).reduce(function (rows, check) {
    const value = check.value || {};
    if (Array.isArray(value.duplicateForumAdapters) && value.duplicateForumAdapters.length > 0) {
      rows.push(check.key + ' | duplicate adapters: ' + value.duplicateForumAdapters.join(','));
    }
    if (Array.isArray(value.duplicateSourceIngestHandlers) && value.duplicateSourceIngestHandlers.length > 0) {
      rows.push(check.key + ' | duplicate handlers: ' + value.duplicateSourceIngestHandlers.join(','));
    }
    (value.failures || []).forEach(function (failure) {
      rows.push(check.key + ' | ' + (failure.sourceKey || failure.sourceType || 'unknown') + ' missing: ' + (failure.missing || []).join(','));
    });
    return rows;
  }, []);
}

function renderSourceIngestDryRun(result) {
  const checks = result.checks || [];
  const panels = [
    panel('Source ingest dry-run', [
      metric('Status', result.status),
      metric('Dry run', result.dryRun ? 'yes' : 'no'),
      metric('Source', result.source ? result.source.sourceKey + ' / ' + result.source.sourceType : 'unknown'),
      metric('Thread', result.thread ? result.thread.sourceThreadId : 'none'),
      metric('Posts', result.thread ? result.thread.postCount : 0)
    ].join('')),
    panel('Isolated writes', [
      metric('Snapshots', result.repositoryWrites ? result.repositoryWrites.threadSnapshots : 0),
      metric('Reports', result.repositoryWrites ? result.repositoryWrites.reports : 0),
      metric('Tasks', result.repositoryWrites ? result.repositoryWrites.tasks : 0),
      metric('Raw pages', result.repositoryWrites ? result.repositoryWrites.rawThreadPages : 0)
    ].join('')),
    panel('Dry-run checks', evidenceList(checks.map(function (check) {
      return check.status + ' 路 ' + check.key + ' 路 ' + check.summary;
    })), 'wide')
  ];
  if (result.error) {
    panels.push(panel('Dry-run error', [
      metric('Code', result.error.code || 'error'),
      metric('Message', result.error.message)
    ].join(''), 'wide'));
  }
  return panels.join('');
}

function renderConnectorRolloutPlan(result) {
  const steps = result.steps || [];
  const actions = result.nextActions || [];
  const moduleValidation = result.connectorModuleValidation;
  if (moduleValidation) {
    rememberConnectorContractSourceTypes(moduleValidation.contractSummary);
    rememberConnectorPackageManifests(moduleValidation.packageManifests);
  }
  const panels = [
    panel('Connector rollout plan', [
      moduleValidation ? renderConnectorContractTiles(moduleValidation.contractSummary) : '',
      metric('Status', result.status),
      metric('Source', (result.sourceKey || 'unknown') + ' / ' + (result.sourceType || 'unknown')),
      metric('Module', result.modulePath || 'not provided'),
      metric('Steps', steps.length)
    ].join('')),
    panel('Rollout steps', evidenceList(steps.map(function (step) {
      return step.status + ' 路 ' + step.key + ' 路 ' + step.summary;
    })), 'wide')
  ];
  if (result.sourceIngestDryRun) {
    panels.push(panel('Ingest dry-run', [
      metric('Status', result.sourceIngestDryRun.status),
      metric('Thread', result.sourceIngestDryRun.thread ? result.sourceIngestDryRun.thread.sourceThreadId : 'none'),
      metric('Posts', result.sourceIngestDryRun.thread ? result.sourceIngestDryRun.thread.postCount : 0)
    ].join('')));
  }
  if (moduleValidation && hasConnectorContractDetails(moduleValidation.contractSummary)) {
    panels.push(panel('Connector contract summary', renderConnectorContractSummary(moduleValidation.contractSummary), 'wide'));
  }
  if (moduleValidation && (moduleValidation.packageManifests || []).length > 0) {
    panels.push(panel('Connector packages', renderConnectorPackageManifestRows(moduleValidation.packageManifests), 'wide'));
  }
  if (moduleValidation) {
    const failureRows = connectorContractFailureRows(moduleValidation.checks || []);
    if (failureRows.length > 0) {
      panels.push(panel('Connector contract failures', evidenceList(failureRows), 'wide'));
    }
  }
  if (actions.length > 0) {
    panels.push(panel('Next actions', evidenceList(actions.map(function (action) {
      return action.severity + ' 路 ' + action.key + ' 路 ' + action.command;
    })), 'wide'));
  }
  return panels.join('');
}

function renderWorkerTopologyPlan(result) {
  const workers = result.workers || [];
  const checks = result.checks || [];
  return [
    panel('Worker topology plan', [
      metric('Status', result.status),
      metric('Topology', result.topology),
      metric('Storage', result.storageMode),
      metric('Source mode', result.sourceTaskMode),
      metric('Scope', formatEventSourceScope(result.scope || {
        sourceKey: result.sourceKey,
        sourceId: result.sourceId
      }))
    ].join('')),
    panel('Workers', evidenceList(workers.map(function (worker) {
      return worker.workerType + ' 路 ' + worker.scale + ' 路 ' + worker.leaseKey + ' 路 ' + worker.command;
    })), 'wide'),
    panel('Topology checks', evidenceList(checks.map(function (check) {
      return check.status + ' 路 ' + check.key + ' 路 ' + check.summary;
    })), 'wide')
  ].join('');
}

function renderRolloutManifestPlan(result) {
  const steps = result.steps || [];
  const actions = result.nextActions || [];
  const panels = [
    panel('Rollout manifest plan', [
      metric('Status', result.status),
      metric('Manifest', (result.name || 'unnamed') + ' / ' + (result.manifestVersion || '1.0')),
      metric('Source', (result.sourceKey || 'unknown') + ' / ' + (result.sourceType || 'unknown')),
      metric('Module', result.modulePath || 'not provided')
    ].join('')),
    panel('Manifest steps', evidenceList(steps.map(function (step) {
      return step.status + ' 路 ' + step.key + ' 路 ' + step.summary;
    })), 'wide')
  ];
  if (result.connectorRolloutPlan) {
    panels.push(panel('Connector rollout', [
      metric('Status', result.connectorRolloutPlan.status),
      metric('Steps', (result.connectorRolloutPlan.steps || []).length),
      metric('Next actions', (result.connectorRolloutPlan.nextActions || []).length)
    ].join('')));
  }
  if (result.workerTopologyPlan) {
    panels.push(panel('Worker topology', [
      metric('Status', result.workerTopologyPlan.status),
      metric('Topology', result.workerTopologyPlan.topology),
      metric('Workers', (result.workerTopologyPlan.workers || []).length)
    ].join('')));
  }
  if (actions.length > 0) {
    panels.push(panel('Manifest actions', evidenceList(actions.map(function (action) {
      const related = (action.relatedCommands || []).length > 0 ? ' -> ' + action.relatedCommands.join(' | ') : '';
      return action.severity + ' 路 ' + action.key + ' 路 ' + action.command + related;
    })), 'wide'));
  }
  return panels.join('');
}

function renderResourceProvisioningPlan(result) {
  const resources = result.resources || [];
  const actions = result.nextActions || [];
  const panels = [
    panel('Resource provisioning plan', [
      metric('Status', result.status),
      metric('Storage', result.environment ? result.environment.storageMode : 'unknown'),
      metric('Source', result.environment ? (result.environment.sourceKey || 'unknown') + ' / ' + (result.environment.sourceType || 'unknown') : 'unknown'),
      metric('LLM', result.environment ? result.environment.llmProvider || 'unknown' : 'unknown')
    ].join('')),
    panel('Resources', evidenceList(resources.map(function (item) {
      const env = item.env && item.env.length > 0 ? ' env=' + item.env.join(',') : '';
      const evidence = item.evidenceSummary ? ' evidence=' + item.evidenceSummary : '';
      const drift = item.schemaDrift && item.schemaDrift.status !== 'ok' ? ' drift=' + schemaDriftSummary(item.schemaDrift) : '';
      return item.status + ' 路 ' + item.area + ' 路 ' + item.key + ' 路 ' + (item.required ? 'required' : 'optional') + ' 路 ' + item.summary + env + evidence + drift;
    })), 'wide')
  ];
  if (actions.length > 0) {
    panels.push(panel('Resource actions', evidenceList(actions.map(function (action) {
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' evidence=' + detail.evidenceSummary : '');
      }).join(' | ');
      return action.severity + ' 路 ' + action.key + ' 路 ' + action.summary + ' 路 ' + (action.commands || []).join(' | ') + (details ? ' details=' + details : '');
    })), 'wide'));
  }
  return panels.join('');
}

function renderDeploymentGateReport(result) {
  const gates = result.gates || [];
  const actions = result.nextActions || [];
  const panels = [
    panel('Deployment gate', [
      metric('Status', result.status),
      metric('Gates', result.gateCount || gates.length),
      metric('Next actions', actions.length)
    ].join('')),
    panel('Gate results', evidenceList(gates.map(function (gate) {
      return gate.status + ' 路 ' + gate.area + ' 路 ' + gate.key + ' 路 ' + gate.summary;
    })), 'wide')
  ];
  const llmSummary = renderDeploymentGateLlmSummary(result);
  if (llmSummary) panels.push(llmSummary);
  if (actions.length > 0) {
    panels.push(panel('Gate actions', evidenceList(actions.map(function (action) {
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' evidence=' + detail.evidenceSummary : '');
      }).join(' | ');
      return action.severity + ' 路 ' + action.key + ' 路 ' + action.summary + ' 路 ' + (action.commands || []).join(' | ') + (details ? ' details=' + details : '');
    })), 'wide'));
  }
  return panels.join('');
}

function renderDeploymentGateLlmSummary(result) {
  const checklist = result && result.deploymentChecklist || {};
  const items = checklist.items || [];
  const llmItems = items.filter(function (item) {
    return item.area === 'llm';
  });
  if (llmItems.length === 0) return '';
  const evaluation = checklist.llmEvaluation || {};
  const preflight = checklist.llmPreflight || {};
  const summary = evaluation.summary || {};
  const configStatus = checklistStatusForItem(llmItems, 'llm.configuration') || 'unknown';
  const preflightStatus = preflight.status || checklistStatusForItem(llmItems, 'llm.preflight') || 'not run';
  const evaluationStatus = evaluation.status || checklistStatusForItem(llmItems, 'llm.semanticEvaluation') || 'not run';
  return panel('LLM readiness', [
    '<div class="summary-strip">',
    summaryTile('Config', configStatus, statusVariant(configStatus)),
    summaryTile('Preflight', preflightStatus, statusVariant(preflight.status)),
    summaryTile('Evaluation', evaluationStatus, statusVariant(evaluation.status)),
    summaryTile('Samples', String(evaluation.sampleCount || 0)),
    summaryTile('Warn', String(summary.warn || 0), (summary.warn || 0) > 0 ? 'warn' : 'ok'),
    '</div>',
    metric('Provider', evaluation.provider || preflight.provider || llmProviderFromItems(llmItems) || 'unknown'),
    metric('Mode', evaluation.status ? 'evaluation' : preflight.status ? 'preflight' : 'configuration'),
    evidenceList(llmItems.map(function (item) {
      const evidence = item.evidence || {};
      const sampleText = evidence.sampleCount ? ' samples=' + evidence.sampleCount : '';
      const traceText = evidence.traceId ? ' trace=' + evidence.traceId : '';
      return item.status + ' | ' + item.key + ' | ' + item.summary + sampleText + traceText;
    }))
  ].join(''), 'wide');
}

function checklistStatusForItem(items, key) {
  const item = (items || []).find(function (candidate) {
    return candidate.key === key;
  });
  return item && item.status;
}

function llmProviderFromItems(items) {
  const item = (items || []).find(function (candidate) {
    return candidate.evidence && candidate.evidence.provider;
  });
  return item && item.evidence && item.evidence.provider;
}

function renderRolloutApplyExecutionGate(result, options) {
  const safeOptions = options || {};
  const gates = result && result.gates || [];
  const actions = result && result.nextActions || [];
  const decision = safeOptions.decision || 'unknown';
  const panels = [
    panel('Apply execution gate', [
      metric('Decision', decision),
      metric('Gate status', result && result.status || 'unknown'),
      metric('Mode', 'execute=true'),
      metric('Gates', result && (result.gateCount || gates.length) || 0),
      metric('Next actions', actions.length),
      metric('Audit', decision === 'cleared' || decision === 'awaiting-confirmation' ? 'rollout apply task will be recorded after execute' : 'no apply task was submitted')
    ].join('')),
    panel('Gate results', evidenceList(gates.map(function (gate) {
      return gate.status + ' 璺?' + gate.area + ' 璺?' + gate.key + ' 璺?' + gate.summary;
    })), 'wide')
  ];
  if (actions.length > 0) {
    panels.push(panel('Gate actions before execute', evidenceList(actions.map(function (action) {
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' evidence=' + detail.evidenceSummary : '');
      }).join(' | ');
      return action.severity + ' 璺?' + action.key + ' 璺?' + action.summary + ' 璺?' + (action.commands || []).join(' | ') + (details ? ' details=' + details : '');
    })), 'wide'));
  }
  return panels.join('');
}

function renderRolloutReadinessChecks(result) {
  const manifest = result.manifest || {};
  const source = manifest.source || {};
  const connector = manifest.connector || {};
  const checks = result.checks || [];
  const status = aggregateCheckStatus(checks);
  const nextActionCount = checks.reduce(function (count, check) {
    return count + ((check.result && check.result.nextActions || []).length);
  }, 0);
  const panels = [
    panel('Rollout readiness', [
      '<div class="summary-strip event-summary-strip">' + [
        summaryTile('Status', status, statusVariant(status)),
        summaryTile('Checks', String(checks.length)),
        summaryTile('Actions', String(nextActionCount), nextActionCount > 0 ? 'warn' : 'ok'),
        summaryTile('Source', source.sourceType || 'unknown', statusVariant(status))
      ].join('') + '</div>',
      metric('Manifest', manifest.name || 'unnamed'),
      metric('Source', (source.sourceKey || source.forum || 'unknown') + ' / ' + (source.sourceType || 'unknown')),
      metric('Module', connector.modulePath || source.modulePath || 'not provided'),
      renderRolloutReadinessOpsButtons(source)
    ].join(''), 'wide'),
    panel('Readiness checks', evidenceList(checks.map(function (check) {
      const actionCount = check.result && check.result.nextActions ? check.result.nextActions.length : 0;
      const detail = check.error ? check.error.message : ('actions=' + actionCount);
      return check.status + ' | ' + check.key + ' | ' + check.title + ' | ' + detail;
    })), 'wide')
  ];
  const actionRows = renderRolloutReadinessActionRows(checks);
  if (actionRows) {
    panels.push(panel('Readiness next actions', actionRows, 'wide'));
  }
  return panels.join('');
}

function renderRolloutReadinessOpsButtons(source) {
  const sourceKey = source.sourceKey || source.forum || '';
  const sourceType = source.sourceType || '';
  if (!sourceKey && !sourceType) return '';
  return '<div class="button-group source-op-buttons">' +
    renderSourceDrilldownButtonForScope({ sourceKey }) +
    renderSourceTypeDrilldownButton({ sourceKey, sourceType }) +
    '<button class="inline-button secondary-inline-button" type="button" data-action="run-rollout-apply-dry-run">Apply dry-run</button>' +
    '</div>';
}

function renderSourceTypeDrilldownButton(scope) {
  const safeScope = scope || {};
  if (!safeScope.sourceType) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-type-drilldown"' +
    ' data-source-type="' + escapeHtml(safeScope.sourceType || '') + '"' +
    ' data-source-key="' + escapeHtml(safeScope.sourceKey || '') + '"' +
    ' data-limit="50" data-scan-limit="250">Type ops</button>';
}

function renderRolloutReadinessActionRows(checks) {
  const rows = [];
  (checks || []).forEach(function (check) {
    (check.result && check.result.nextActions || []).forEach(function (action) {
      const commands = action.commands || (action.command ? [action.command] : []);
      rows.push('<div class="action-row ops-row"><span>' +
        '<strong>' + escapeHtml(check.key + ' | ' + (action.severity || 'info') + ' | ' + (action.key || 'action')) + '</strong>' +
        '<small>' + escapeHtml(action.summary || action.command || '') + '</small>' +
        renderReadinessCommandRows(commands) +
        '</span>' + statusBadge(action.severity || 'info', action.severity === 'critical' ? 'fail' : statusVariant(action.severity)) + '</div>');
    });
  });
  return rows.join('');
}

function renderReadinessCommandRows(commands) {
  if (!commands || commands.length === 0) return '';
  return '<div class="lifecycle-command-list">' + commands.map(function (command) {
    return '<div class="lifecycle-command-row">' +
      '<code>' + escapeHtml(command) + '</code>' +
      '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="copy-lifecycle-command">Copy</button>' +
      '</div>';
  }).join('') + '</div>';
}

function aggregateCheckStatus(checks) {
  if ((checks || []).some(function (check) { return check.status === 'fail' || check.status === 'critical'; })) return 'fail';
  if ((checks || []).some(function (check) { return check.status === 'warn' || check.status === 'warning'; })) return 'warn';
  if ((checks || []).some(function (check) { return check.status !== 'ok'; })) return 'warn';
  return 'ok';
}

function renderRolloutManifestApply(result) {
  const report = result.report || result;
  const steps = report.steps || [];
  const actions = report.nextActions || [];
  const panels = [
    panel('Rollout manifest apply', [
      metric('Status', report.status),
      metric('Task', result.task ? result.task.id : 'none'),
      metric('Mode', report.dryRun ? 'dry-run' : 'execute'),
      metric('Applied', report.applied ? 'yes' : 'no'),
      metric('Source', report.sourceDraft ? (report.sourceDraft.sourceKey || 'unknown') + ' / ' + (report.sourceDraft.sourceType || 'unknown') : 'missing'),
      renderTaskTraceButton(result.task)
    ].join('')),
    panel('Apply steps', evidenceList(steps.map(function (step) {
      return step.status + ' 路 ' + step.key + ' 路 ' + step.summary;
    })), 'wide')
  ];
  if (report.registration && report.registration.source) {
    panels.push(panel('Registered source', [
      metric('Source ID', report.registration.source.id),
      metric('Created', report.registration.created ? 'yes' : 'no'),
      metric('Name', report.registration.source.displayName),
      renderRolloutApplyOperationButtons(report)
    ].join('')));
  }
  if (report.rollbackPlan) {
    panels.push(panel('Rollback plan', [
      metric('Available', report.rollbackPlan.available ? 'yes' : 'no'),
      metric('Mode', report.rollbackPlan.mode || 'unknown'),
      metric('Source ID', report.rollbackPlan.sourceId || 'after execute'),
      metric('Summary', report.rollbackPlan.summary || ''),
      renderRolloutRollbackButtons(report),
      evidenceList(report.rollbackPlan.commands || [])
    ].join(''), 'wide'));
  }
  if (actions.length > 0) {
    panels.push(panel('Apply actions', evidenceList(actions.map(function (action) {
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' evidence=' + detail.evidenceSummary : '');
      }).join(' | ');
      return action.severity + ' 路 ' + action.key + ' 路 ' + action.summary + ' 路 ' + (action.commands || []).join(' | ') + (details ? ' details=' + details : '');
    })), 'wide'));
  }
  return panels.join('');
}

function renderRolloutApplyOperationButtons(report) {
  const source = report && report.registration && report.registration.source || {};
  const sourceId = source.id || report && report.rollbackPlan && report.rollbackPlan.sourceId;
  const sourceKey = source.sourceKey || report && report.sourceDraft && (report.sourceDraft.sourceKey || report.sourceDraft.forum);
  if (!sourceId && !sourceKey) return '';
  return '<div class="button-group source-op-buttons">' +
    renderSourceDrilldownButtonForScope({
      sourceId,
      sourceKey
    }) +
    '</div>';
}

function renderRolloutRollbackButtons(report) {
  const rollbackPlan = report && report.rollbackPlan || {};
  const sourceId = rollbackPlan.sourceId || report && report.registration && report.registration.source && report.registration.source.id;
  if (!rollbackPlan.available || !sourceId) return '';
  const safeSourceId = escapeHtml(sourceId);
  return '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + safeSourceId + '" data-enabled="false" data-execute="false">Rollback check</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + safeSourceId + '" data-enabled="false" data-execute="true">Rollback disable</button>';
}

function renderTaskTraceButton(task) {
  const button = renderTaskTraceButtonControl(task);
  return button ? '<div class="button-group source-op-buttons">' + button + '</div>' : '';
}

function renderTaskTraceButtonControl(task, label) {
  const trace = taskTraceMetadata(task);
  if (!task || (!task.id && !trace.requestId && !trace.traceId && !trace.idempotencyKey)) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-trace-context"' +
    ' data-task-id="' + escapeHtml(task && task.id || '') + '"' +
    ' data-task-type="' + escapeHtml(task && task.type || '') + '"' +
    ' data-request-id="' + escapeHtml(trace.requestId || '') + '"' +
    ' data-trace-id="' + escapeHtml(trace.traceId || '') + '"' +
    ' data-idempotency-key="' + escapeHtml(trace.idempotencyKey || '') + '"' +
    ' data-limit="20">' + escapeHtml(label || 'Trace') + '</button>';
}

function renderTaskDetailButton(task) {
  const button = renderTaskDetailButtonControl(task);
  return button ? '<div class="button-group source-op-buttons">' + button + '</div>' : '';
}

function renderTaskDetailButtonControl(task, label) {
  if (!task || !task.id) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-task-detail" data-task-id="' +
    escapeHtml(task.id) + '" data-trace-limit="20">' + escapeHtml(label || 'Detail') + '</button>';
}

function taskTraceMetadata(task) {
  return task && (task.trace || task.input && task.input._trace) || {};
}

function renderSourceTaskRunResult(result) {
  return panel('来源任务完成', [
    metric('来源 ID', result.sourceId),
    metric('任务 ID', result.task.id),
    metric('状态', result.task.status),
    metric('主题', result.task.output ? result.task.output.title : '')
  ].join(''), 'wide');
}

function renderSourcePipelineRunResult(result) {
  return panel('来源洞察流水线完成', [
    metric('来源 ID', result.sourceId),
    metric('任务 ID', result.task.id),
    metric('状态', result.task.status),
    metric('导入任务', result.ingest.task.id),
    metric('变化', result.ingest.cursorDiff.changed ? '是' : '否'),
    metric('新增楼层', result.ingest.cursorDiff.newPostCount),
    metric('语义状态', result.semantic.status + (result.semantic.reason ? ' / ' + result.semantic.reason : ''))
  ].join(''), 'wide');
}

function renderSourceBatchRunResult(result) {
  return panel('Source batch run', [
    metric('Sources', result.sourceCount),
    metric('Completed', result.completedCount),
    metric('Failed', result.failedCount),
    renderBatchTaskControls(result.task),
    renderSourceOperationResultRows(result.results || [])
  ].join(''), 'wide');
}

function renderDueSourceBatchRunResult(result) {
  return panel('Due source batch run', [
    metric('Batch task', result.task && result.task.id || 'none'),
    metric('Task status', result.task && result.task.status || 'unknown'),
    metric('Sources', result.sourceCount),
    metric('Due', result.dueCount),
    metric('Skipped', result.skippedCount),
    metric('Completed', result.completedCount),
    metric('Failed', result.failedCount),
    metric('Checked', result.checkedAt || 'unknown'),
    metric('Finished', result.finishedAt || 'unknown'),
    renderBatchTaskControls(result.task),
    renderDueBatchEvidence(result.evidence),
    renderSourceOperationResultRows(result.results || []),
    renderSourceOperationSkippedRows(result.skipped || [])
  ].join(''), 'wide');
}

function renderDueSourcePipelineBatchRunResult(result) {
  return panel('Due source insight batch run', [
    metric('Batch task', result.task && result.task.id || 'none'),
    metric('Task status', result.task && result.task.status || 'unknown'),
    metric('Sources', result.sourceCount),
    metric('Due', result.dueCount),
    metric('Skipped', result.skippedCount),
    metric('Completed', result.completedCount),
    metric('Failed', result.failedCount),
    metric('Checked', result.checkedAt || 'unknown'),
    metric('Finished', result.finishedAt || 'unknown'),
    renderBatchTaskControls(result.task),
    renderDueBatchEvidence(result.evidence),
    renderSourceOperationResultRows(result.results || []),
    renderSourceOperationSkippedRows(result.skipped || [])
  ].join(''), 'wide');
}

function renderDueBatchEvidence(evidence) {
  if (!evidence) return '';
  const summary = evidence.summary || {};
  const batch = evidence.batch || {};
  const timeline = evidence.timeline || [];
  return [
    '<div class="summary-strip">',
    summaryTile('Evidence', batch.taskId || 'none', batch.taskId ? 'ok' : 'muted'),
    summaryTile('Replayable', String(summary.replayableCount || 0), (summary.replayableCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Timeline', String(timeline.length), timeline.length > 0 ? 'ok' : 'muted'),
    summaryTile('Backoff', String(summary.backoffSkippedCount || 0), (summary.backoffSkippedCount || 0) > 0 ? 'warn' : 'ok'),
    '</div>',
    timeline.slice(0, 8).map(function (item) {
      const details = [
        item.scheduleReason,
        item.taskId ? 'task=' + item.taskId : undefined,
        item.changed === undefined ? undefined : 'changed=' + item.changed,
        item.newPostCount === undefined ? undefined : 'new=' + item.newPostCount,
        item.semanticStatus ? 'semantic=' + item.semanticStatus : undefined,
        item.retryAt ? 'retry=' + item.retryAt : undefined
      ].filter(Boolean).join(' | ');
      return '<div class="action-row"><span><strong>' + escapeHtml(item.kind || 'evidence') + '</strong><small>' + escapeHtml([item.sourceId, item.sourceKey].filter(Boolean).join(' / ')) + '</small><small>' + escapeHtml(details) + '</small></span>' + statusBadge(item.status || 'unknown', statusVariant(item.status)) + '</div>';
    }).join('')
  ].join('');
}

function renderLlmReadinessProfile(profile) {
  const readiness = profile.readiness || {};
  const configuration = profile.configuration || {};
  return [
    panel('LLM readiness profile', [
      '<div class="summary-strip">',
      summaryTile('Status', profile.status || 'unknown', statusVariant(profile.status)),
      summaryTile('Mode', profile.mode || 'configuration'),
      summaryTile('Provider', profile.provider || 'unknown', readiness.mockMode ? 'warn' : 'ok'),
      summaryTile('Real', readiness.realProviderCandidate ? 'yes' : 'no', readiness.realProviderCandidate ? 'ok' : 'warn'),
      summaryTile('Preflight', readiness.preflightPassed ? 'ok' : 'not run', readiness.preflightPassed ? 'ok' : 'muted'),
      summaryTile('Evaluation', readiness.evaluationPassed ? 'ok' : 'not run', readiness.evaluationPassed ? 'ok' : 'muted'),
      '</div>',
      metric('API key', configuration.apiKeyConfigured ? 'configured' : 'not configured'),
      metric('Model', configuration.modelConfigured ? 'configured' : 'not configured'),
      metric('Base URL', configuration.baseUrlConfigured ? 'configured' : 'default'),
      metric('Timeout', configuration.timeoutMs || 'default')
    ].join(''), 'wide'),
    panel('LLM readiness checks', evidenceList((profile.checks || []).map(function (check) {
      return check.status + ' | ' + check.area + ' | ' + check.key + ' | ' + check.summary;
    })), 'wide'),
    panel('LLM readiness actions', renderNextActionRows(profile.nextActions || []), 'wide automation-action-command-panel')
  ].join('');
}

function renderLlmPreflightReport(report) {
  const validation = report.validation || {};
  const usage = report.usage || {};
  const preview = report.outputPreview || {};
  return [
    panel('LLM preflight', [
      '<div class="summary-strip">',
      summaryTile('Status', report.status || 'unknown', statusVariant(report.status)),
      summaryTile('Provider', report.provider || 'unknown', report.provider === 'mock' ? 'muted' : 'ok'),
      summaryTile('Validation', validation.status || 'not-run', statusVariant(validation.status)),
      summaryTile('Schema', report.schemaVersion || 'unknown', validation.status === 'ok' ? 'ok' : 'muted'),
      '</div>',
      metric('Trace', report.traceId || 'none'),
      metric('Task', report.task || 'unknown'),
      metric('Usage', formatLlmUsage(usage)),
      metric('Output', preview.summary || 'none'),
      report.error ? metric('Error', report.error.message || 'unknown') : ''
    ].join(''), 'wide'),
    panel('LLM preflight checks', evidenceList((report.checks || []).map(function (check) {
      return check.status + ' | ' + check.key + ' | ' + check.summary;
    })), 'wide'),
    panel('LLM preflight actions', renderNextActionRows(report.nextActions || []), 'wide automation-action-command-panel')
  ].join('');
}

function renderLlmEvaluationReport(report) {
  const summary = report.summary || {};
  return [
    panel('LLM evaluation', [
      '<div class="summary-strip">',
      summaryTile('Status', report.status || 'unknown', statusVariant(report.status)),
      summaryTile('Provider', report.provider || 'unknown', report.provider === 'mock' ? 'muted' : 'ok'),
      summaryTile('Samples', String(report.sampleCount || 0)),
      summaryTile('Warn', String(summary.warn || 0), (summary.warn || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Fail', String(summary.fail || 0), (summary.fail || 0) > 0 ? 'fail' : 'ok'),
      '</div>',
      metric('Trace', report.traceId || 'none'),
      metric('Task', report.task || 'unknown'),
      metric('Schema', report.schemaVersion || 'unknown')
    ].join(''), 'wide'),
    panel('LLM evaluation samples', evidenceList((report.results || []).map(formatLlmEvaluationSampleRow)), 'wide'),
    panel('LLM evaluation actions', renderNextActionRows(report.nextActions || []), 'wide automation-action-command-panel')
  ].join('');
}

function formatLlmEvaluationSampleRow(result) {
  const preview = result.outputPreview || {};
  const warnings = (result.qualityChecks || []).filter(function (check) {
    return check.status !== 'ok';
  }).map(function (check) {
    return check.key + '=' + check.status;
  }).join(', ');
  return [
    result.status || 'unknown',
    result.id || 'sample',
    result.title || '',
    result.validation ? 'validation=' + result.validation.status : 'validation=not-run',
    'refs=' + (preview.evidenceRefCount || 0),
    'entities=' + (preview.entityInsightCount || 0),
    'opinions=' + (preview.opinionInsightCount || 0),
    formatLlmUsage(result.usage || {}),
    warnings || result.error && result.error.message || ''
  ].filter(Boolean).join(' | ');
}

function renderSourceDemoCycleReport(report) {
  const summary = report.summary || {};
  const pipeline = report.pipeline || {};
  const acknowledgement = report.acknowledgement || {};
  return [
    panel('Demo cycle', [
      '<div class="summary-strip">',
      summaryTile('Status', report.status || 'unknown', statusVariant(report.status)),
      summaryTile('Due', summary.dueCount || 0, summary.dueCount > 0 ? 'ok' : 'muted'),
      summaryTile('Completed', summary.completedCount || 0, summary.failedCount > 0 ? 'warn' : 'ok'),
      summaryTile('Events', summary.sourceChangedEventCount || 0, summary.sourceChangedEventCount > 0 ? 'ok' : 'muted'),
      '</div>',
      metric('Task', report.task && report.task.id || 'none'),
      metric('Trace', report.traceId || 'none'),
      metric('Primary source', formatSourceScope(report.primarySource)),
      metric('Open events', summary.openEventCount === undefined ? 'unknown' : summary.openEventCount),
      metric('Ack', acknowledgement.status || 'not-run'),
      renderBatchTaskControls(pipeline.task)
    ].join(''), 'wide'),
    panel('Demo cycle pipeline', [
      metric('Batch task', pipeline.task && pipeline.task.id || 'none'),
      metric('Sources', pipeline.sourceCount || 0),
      metric('Skipped', pipeline.skippedCount || 0),
      metric('Failed', pipeline.failedCount || 0),
      renderSourceOperationResultRows(pipeline.results || []),
      renderSourceOperationSkippedRows(pipeline.skipped || [])
    ].join(''), 'wide'),
    panel('Source changed events', renderDemoCycleEvents(report.sourceChangedEvents || []), 'wide'),
    acknowledgement.status ? panel('Acknowledgement', renderDemoCycleAcknowledgement(acknowledgement), 'wide') : '',
    report.closure ? panel('Demo cycle closure', renderDemoCycleClosure(report.closure), 'wide') : '',
    report.drilldown ? panel('Demo cycle drilldown', [
      metric('Status', report.drilldown.status || 'unknown'),
      metric('Latest event', report.drilldown.health && report.drilldown.health.events && report.drilldown.health.events.latest ? report.drilldown.health.events.latest.id : 'none'),
      metric('Latest task', report.drilldown.health && report.drilldown.health.tasks && report.drilldown.health.tasks.latest ? report.drilldown.health.tasks.latest.id : 'none'),
      renderSourceDrilldownButtonForScope(report.primarySource || {})
    ].join(''), 'wide') : '',
    panel('Demo cycle actions', renderNextActionRows(report.nextActions || []), 'wide automation-action-command-panel')
  ].join('');
}

function renderNextActionRows(actions) {
  if (!actions || actions.length === 0) return '<div class="muted">No follow-up commands.</div>';
  return '<div class="automation-action-command-list">' + actions.map(function (action) {
    const commands = action.commands || (action.command ? [action.command] : []);
    const details = (action.details || []).map(function (detail) {
      return detail.key + (detail.evidenceSummary ? ' evidence=' + detail.evidenceSummary : '');
    }).join(' | ');
    return '<div class="action-row ops-row automation-action-command-row">' +
      '<span>' +
      '<strong>' + escapeHtml((action.severity || 'info') + ' | ' + (action.key || 'action')) + '</strong>' +
      '<small>' + escapeHtml(action.summary || action.command || '') + '</small>' +
      (action.evidenceSummary ? '<small>' + escapeHtml('evidence=' + action.evidenceSummary) + '</small>' : '') +
      (details ? '<small>' + escapeHtml('details=' + details) + '</small>' : '') +
      renderReadinessCommandRows(commands) +
      '</span>' +
      statusBadge(action.severity || 'info', action.severity === 'critical' ? 'fail' : statusVariant(action.severity)) +
      '</div>';
  }).join('') + '</div>';
}

function renderDemoCycleClosure(closure) {
  const summary = closure.summary || {};
  const steps = closure.steps || [];
  return [
    '<div class="summary-strip">',
    summaryTile('Status', closure.status || 'unknown', statusVariant(closure.status)),
    summaryTile('Ready', closure.readyForDailyUse ? 'yes' : 'no', closure.readyForDailyUse ? 'ok' : 'warn'),
    summaryTile('Score', String(summary.readinessScore || 0)),
    summaryTile('Done', String(summary.completed || 0) + '/' + String(summary.total || 0), summary.completed === summary.total ? 'ok' : 'warn'),
    summaryTile('Missing', String((summary.missingStepKeys || []).length), (summary.missingStepKeys || []).length > 0 ? 'warn' : 'ok'),
    '</div>',
    metric('Next', closure.recommendedNextAction || 'none'),
    '<div class="source-operation-result-list">',
    steps.map(renderDemoCycleClosureStep).join(''),
    '</div>'
  ].join('');
}

function renderDemoCycleClosureStep(step) {
  const evidenceText = (step.evidence || []).map(function (item) {
    return item.key + '=' + item.value;
  }).join(' | ');
  return '<div class="action-row ops-row"><span>' +
    '<strong>' + escapeHtml(step.title || step.key || 'Closure step') + '</strong>' +
    '<small>' + escapeHtml(step.summary || '') + '</small>' +
    (evidenceText ? '<small>' + escapeHtml(evidenceText) + '</small>' : '') +
    (step.nextAction ? '<small>' + escapeHtml('next=' + step.nextAction) + '</small>' : '') +
    '</span>' +
    statusBadge(step.status || 'unknown', statusVariant(step.status)) +
    '</div>';
}

function renderDemoCycleEvents(events) {
  if (!events.length) return '<div class="muted">No source-changed event was generated in this cycle.</div>';
  return '<div class="source-operation-result-list">' + events.map(function (event) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(event.title || event.id || 'source-changed') + '</strong>' +
      '<small>' + escapeHtml([event.id, event.deliveryStatus || 'pending', event.acknowledgedAt ? 'ack=' + event.acknowledgedAt : 'open'].filter(Boolean).join(' | ')) + '</small>' +
      '<small>' + escapeHtml(event.summary || '') + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderEventDetailButtonControl(event) +
      (event.acknowledgedAt ? '' : '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id || '') + '">Acknowledge</button>') +
      renderEventTaskDetailButton(event) +
      '</span></div>';
  }).join('') + '</div>';
}

function renderDemoCycleAcknowledgement(result) {
  return [
    '<div class="summary-strip">',
    summaryTile('Status', result.status || 'unknown', statusVariant(result.status)),
    summaryTile('Candidates', result.candidateCount || 0, result.candidateCount > 0 ? 'warn' : 'muted'),
    summaryTile('Acknowledged', result.acknowledgedCount || 0, result.acknowledgedCount > 0 ? 'ok' : 'muted'),
    summaryTile('Skipped', result.skippedCount || 0, result.skippedCount > 0 ? 'warn' : 'muted'),
    '</div>',
    evidenceList((result.results || []).map(function (item) {
      return (item.status || 'unknown') + ' | ' + (item.eventId || '') + (item.reason ? ' | ' + item.reason : '');
    }))
  ].join('');
}

function formatSourceScope(scope) {
  const safeScope = scope || {};
  return [safeScope.sourceId, safeScope.sourceKey].filter(Boolean).join(' / ') || 'all sources';
}

function formatLlmUsage(usage) {
  const parts = [];
  if (usage.inputTokens !== undefined) parts.push('input=' + usage.inputTokens);
  if (usage.outputTokens !== undefined) parts.push('output=' + usage.outputTokens);
  if (usage.prompt_tokens !== undefined) parts.push('prompt=' + usage.prompt_tokens);
  if (usage.completion_tokens !== undefined) parts.push('completion=' + usage.completion_tokens);
  if (usage.total_tokens !== undefined) parts.push('total=' + usage.total_tokens);
  return parts.length ? parts.join(' | ') : 'none';
}

function renderBatchTaskControls(task) {
  if (!task) return '';
  return '<div class="button-group source-op-buttons batch-task-controls">' +
    renderTaskDetailButtonControl(task, 'Batch task') +
    renderTaskTraceButtonControl(task, 'Batch trace') +
    '</div>';
}

function renderSourceOperationResultRows(results) {
  if (!results || results.length === 0) return '<div class="muted">No source operation results.</div>';
  return '<div class="source-operation-result-list">' + results.map(function (item) {
    const source = item.source || {};
    const task = item.task || {};
    const ingestTask = item.ingestTask || {};
    const error = item.error || {};
    const cursorDiff = item.cursorDiff || {};
    const semantic = item.semantic || {};
    const details = [
      source.id || source.sourceKey || 'unknown-source',
      item.scheduleReason ? 'reason=' + item.scheduleReason : undefined,
      task.id ? 'task=' + task.id : undefined,
      ingestTask.id ? 'ingestTask=' + ingestTask.id : undefined,
      cursorDiff.changed === undefined ? undefined : 'changed=' + cursorDiff.changed,
      cursorDiff.newPostCount === undefined ? undefined : 'newPosts=' + cursorDiff.newPostCount,
      semantic.status ? 'semantic=' + semantic.status + (semantic.reason ? '/' + semantic.reason : '') : undefined,
      error.message ? 'error=' + error.message : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml(source.displayName || source.id || 'Unknown source') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderSourceDrilldownButton(source) +
      renderSourceOperationTaskControls(item) +
      statusBadge(item.status || 'unknown', item.status === 'failed' ? 'fail' : 'ok') +
      '</span>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceOperationTaskControls(item) {
  const task = item && item.task || {};
  const ingestTask = item && item.ingestTask || {};
  return [
    renderTaskDetailButtonControl(task, 'Task'),
    renderTaskTraceButtonControl(task, 'Trace'),
    ingestTask.id && ingestTask.id !== task.id ? renderTaskDetailButtonControl(ingestTask, 'Ingest task') : '',
    ingestTask.id && ingestTask.id !== task.id ? renderTaskTraceButtonControl(ingestTask, 'Ingest trace') : ''
  ].join('');
}

function renderSourceOperationSkippedRows(skipped) {
  if (!skipped || skipped.length === 0) return '';
  return '<div class="source-operation-result-list skipped-source-list">' + skipped.slice(0, 12).map(function (item) {
    const source = item.source || {};
    const details = [
      source.id || source.sourceKey || 'unknown-source',
      'reason=' + (item.reason || 'unknown'),
      item.nextRunAt ? 'next=' + item.nextRunAt : undefined,
      item.retryAt ? 'retry=' + item.retryAt : undefined,
      item.backoffMs ? 'backoff=' + formatDurationMs(item.backoffMs) : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml(source.displayName || source.id || 'Skipped source') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderSourceDrilldownButton(source) +
      statusBadge('skipped', 'muted') +
      '</span>' +
      '</div>';
  }).join('') + '</div>';
}

function renderLegacyTaskList(result) {
  const tasks = result.tasks || [];
  const pipelineRuns = result.pipelineRuns || [];
  return [
    panel('最近洞察流水线', evidenceList(pipelineRuns.map(renderPipelineRunSummary)), 'wide'),
    panel('最近任务', evidenceList(tasks.map(function (task) {
      const output = task.output || {};
      return task.status + ' · ' + task.type + ' · ' + (output.title || task.id);
    })), 'wide')
  ].join('');
}

function renderTaskList(result) {
  const tasks = result.tasks || [];
  const pipelineRuns = result.pipelineRuns || [];
  return [
    panel('鏈€杩戞礊瀵熸祦姘寸嚎', evidenceList(pipelineRuns.map(renderPipelineRunSummary)), 'wide'),
    panel('Recent tasks', renderTaskRows(tasks), 'wide')
  ].join('');
}

function renderTaskRows(tasks) {
  if (!tasks || tasks.length === 0) return '<div class="muted">No tasks.</div>';
  return '<div class="source-operation-result-list">' + tasks.map(function (task) {
    const output = task.output || {};
    const trace = taskTraceMetadata(task);
    const details = [
      task.id,
      output.title,
      task.updatedAt || task.createdAt,
      trace.requestId ? 'request=' + trace.requestId : undefined,
      trace.traceId ? 'trace=' + trace.traceId : undefined,
      trace.idempotencyKey ? 'idempotency=' + trace.idempotencyKey : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml((task.status || 'unknown') + ' | ' + (task.type || 'task')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderTaskDetailButtonControl(task) +
      renderTaskTraceButtonControl(task) +
      '</span></div>';
  }).join('') + '</div>';
}

function renderTaskDetail(result) {
  const task = result.task || {};
  const sourceScope = result.sourceScope || {};
  const traceContext = result.traceContext || {};
  return [
    panel('Task detail', [
      '<div class="summary-strip">' + [
        summaryTile('Status', task.status || 'unknown', statusVariant(task.status)),
        summaryTile('Type', task.type || 'unknown'),
        summaryTile('Trace tasks', String(traceContext.taskCount || 0)),
        summaryTile('Source', sourceScope.sourceId || sourceScope.sourceKey || 'none', sourceScope.sourceId || sourceScope.sourceKey ? 'ok' : 'muted')
      ].join('') + '</div>',
      metric('Task ID', task.id || 'none'),
      metric('Created', task.createdAt || 'unknown'),
      metric('Updated', task.updatedAt || 'unknown'),
      metric('Finished', task.finishedAt || 'not finished'),
      metric('Source scope', formatTaskSourceScope(sourceScope)),
      metric('Trace request', traceContext.query && traceContext.query.requestId || 'none'),
      metric('Trace id', traceContext.query && traceContext.query.traceId || 'none'),
      metric('Idempotency', traceContext.query && traceContext.query.idempotencyKey || 'none'),
      renderTaskDetailButtons(result)
    ].join(''), 'wide'),
    panel('Task actions', renderTaskDetailActions(result.nextActions || []), 'wide'),
    panel('Task payload', '<pre>' + escapeHtml(JSON.stringify({
      input: task.input,
      output: task.output,
      error: task.error
    }, null, 2)) + '</pre>', 'wide'),
    panel('Correlated tasks', renderTraceContextTaskRows(traceContext.tasks || []), 'wide')
  ].join('');
}

function renderTaskDetailButtons(result) {
  const task = result.task || {};
  const sourceScope = result.sourceScope || {};
  return '<div class="button-group source-op-buttons">' +
    renderTaskTraceButtonControl(task) +
    renderSourceDrilldownButtonForScope(sourceScope) +
    '</div>';
}

function renderTaskDetailActions(actions) {
  if (!actions.length) return '<div class="muted">No recommended task actions.</div>';
  return actions.map(function (action) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml((action.severity || 'info') + ' | ' + (action.key || 'task.action')) + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      (action.command ? '<small>' + escapeHtml(action.command) + '</small>' : '') +
      '</span>' +
      statusBadge(action.severity || 'info', action.severity === 'warning' ? 'warn' : statusVariant(action.severity)) +
      '</div>';
  }).join('');
}

function formatTaskSourceScope(sourceScope) {
  const scope = sourceScope || {};
  return [
    scope.sourceKey ? 'source=' + scope.sourceKey : undefined,
    scope.sourceId ? 'sourceId=' + scope.sourceId : undefined,
    scope.sourceType ? 'type=' + scope.sourceType : undefined,
    scope.sourceThreadId ? 'thread=' + scope.sourceThreadId : undefined
  ].filter(Boolean).join(' | ') || 'none';
}

function renderTaskTraceContext(result) {
  const summary = result.summary || {};
  const latest = summary.latestTask || {};
  const idempotency = summary.idempotency || {};
  const panels = [
    panel('Task trace context', [
      '<div class="summary-strip">' + [
        summaryTile('Tasks', String(result.taskCount || 0)),
        summaryTile('Latest', latest.status || 'none', statusVariant(latest.status)),
        summaryTile('Duplicate risk', idempotency.duplicateExecutionRisk ? 'yes' : 'no', idempotency.duplicateExecutionRisk ? 'fail' : 'ok'),
        summaryTile('Reusable', idempotency.reusableTaskId || 'none', idempotency.reusableTaskId ? 'ok' : 'muted')
      ].join('') + '</div>',
      metric('Request', result.query && result.query.requestId || 'none'),
      metric('Task', result.query && result.query.taskId || 'none'),
      metric('Trace', result.query && result.query.traceId || 'none'),
      metric('Idempotency', result.query && result.query.idempotencyKey || 'none'),
      metric('By status', compactCountMap(summary.byStatus || {})),
      metric('By type', compactCountMap(summary.byType || {}))
    ].join(''), 'wide'),
    panel('Correlated tasks', renderTraceContextTaskRows(result.tasks || []), 'wide')
  ];
  if (idempotency.idempotencyKey) {
    panels.push(panel('Idempotency', [
      metric('Key', idempotency.idempotencyKey),
      metric('Task count', idempotency.taskCount || 0),
      metric('Completed', idempotency.completedCount || 0),
      metric('Reusable task', idempotency.reusableTaskId || 'none'),
      evidenceList(idempotency.taskIds || [])
    ].join(''), 'wide'));
  }
  return panels.join('');
}

function renderTraceContextTaskRows(tasks) {
  if (!tasks || tasks.length === 0) return '<div class="muted">No correlated tasks.</div>';
  return '<div class="source-operation-result-list">' + tasks.map(function (task) {
    const trace = task.trace || taskTraceMetadata(task);
    const details = [
      task.id,
      task.createdAt ? 'created=' + task.createdAt : undefined,
      task.updatedAt ? 'updated=' + task.updatedAt : undefined,
      trace.requestId ? 'request=' + trace.requestId : undefined,
      trace.traceId ? 'trace=' + trace.traceId : undefined,
      trace.idempotencyKey ? 'idempotency=' + trace.idempotencyKey : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml((task.status || 'unknown') + ' | ' + (task.type || 'task')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' + statusBadge(task.status || 'unknown', statusVariant(task.status)) + '</div>';
  }).join('') + '</div>';
}

function renderOperationsReadiness(readiness) {
  const checks = readiness && readiness.checks || [];
  const failing = checks.filter(function (check) {
    return check.status === 'fail';
  });
  const warning = checks.filter(function (check) {
    return check.status === 'warn';
  });
  const okCount = checks.filter(function (check) {
    return check.status === 'ok';
  }).length;
  const attention = failing.concat(warning).slice(0, 8);
  return panel('Operations readiness', [
    '<div class="summary-strip">',
    summaryTile('Status', readiness && readiness.status || 'unknown', statusVariant(readiness && readiness.status)),
    summaryTile('Fail', String(failing.length), failing.length > 0 ? 'fail' : 'ok'),
    summaryTile('Warn', String(warning.length), warning.length > 0 ? 'warn' : 'ok'),
    summaryTile('OK', String(okCount), 'ok'),
    '</div>',
    attention.length === 0
      ? '<div class="muted">No readiness checks need attention.</div>'
      : attention.map(renderReadinessCheckRow).join('')
  ].join(''), 'wide');
}

function renderReadinessCheckRow(check) {
  const value = check.value || {};
  const details = [
    check.summary,
    value.sourceKey ? 'source=' + value.sourceKey : undefined,
    value.sourceId ? 'sourceId=' + value.sourceId : undefined,
    value.count === undefined ? undefined : 'count=' + value.count,
    value.failed === undefined ? undefined : 'failed=' + value.failed,
    value.staleRunning === undefined ? undefined : 'stale=' + value.staleRunning,
    value.bySourceKey ? 'bySource=' + formatStanceSummary(value.bySourceKey) : undefined
  ].filter(Boolean).join(' | ');
  return '<div class="action-row ops-row"><span>' +
    '<strong>' + escapeHtml(check.key || 'unknown-check') + '</strong>' +
    '<small>' + escapeHtml(details) + '</small>' +
    '</span>' +
    statusBadge(check.status || 'warn', statusVariant(check.status)) +
    '</div>';
}

function renderWorkerLeaseOverview(leases) {
  const safeLeases = leases || {};
  const sampleLeases = uniqueLeases((safeLeases.sourceScopedLeases || []).concat(safeLeases.expiredLeases || []));
  return panel('Worker lease shards', [
    '<div class="summary-strip">',
    summaryTile('Active', String(safeLeases.active || 0), (safeLeases.active || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Expired', String(safeLeases.expired || 0), (safeLeases.expired || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Scoped', String(safeLeases.sourceScoped || 0), (safeLeases.sourceScoped || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Global', String(safeLeases.unscoped || 0), (safeLeases.unscoped || 0) > 0 ? 'muted' : 'ok'),
    '</div>',
    metric('Worker types', compactCountMap(safeLeases.byWorkerType)),
    metric('Active source ids', compactCountMap(safeLeases.activeBySourceId)),
    metric('Expired source ids', compactCountMap(safeLeases.expiredBySourceId)),
    metric('Active source keys', compactCountMap(safeLeases.activeBySourceKey)),
    metric('Expired source keys', compactCountMap(safeLeases.expiredBySourceKey)),
    evidenceList(sampleLeases.slice(0, 8).map(formatWorkerLeaseRow))
  ].join(''), 'wide');
}

function renderWorkerRunOverview(workers) {
  const safeWorkers = workers || {};
  const sampleRuns = uniqueWorkerRuns((safeWorkers.staleRuns || []).concat(safeWorkers.latestRun ? [safeWorkers.latestRun] : []));
  return panel('Worker run sources', [
    '<div class="summary-strip">',
    summaryTile('Running', String(safeWorkers.running || 0), (safeWorkers.running || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Stale', String(safeWorkers.stale || 0), (safeWorkers.stale || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Scoped', String(safeWorkers.sourceScoped || 0), (safeWorkers.sourceScoped || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Global', String(safeWorkers.unscoped || 0), (safeWorkers.unscoped || 0) > 0 ? 'muted' : 'ok'),
    '</div>',
    metric('Worker types', compactCountMap(safeWorkers.byWorkerType)),
    metric('Runs by source ids', compactCountMap(safeWorkers.bySourceId)),
    metric('Runs by source keys', compactCountMap(safeWorkers.bySourceKey)),
    metric('Running source ids', compactCountMap(safeWorkers.runningBySourceId)),
    metric('Stale source ids', compactCountMap(safeWorkers.staleBySourceId)),
    metric('Stale source keys', compactCountMap(safeWorkers.staleBySourceKey)),
    evidenceList(sampleRuns.slice(0, 8).map(formatWorkerRunRow))
  ].join(''), 'wide');
}

function workerLeaseStatusSummary(leases) {
  const safeLeases = leases || {};
  return [
    'active ' + (safeLeases.active || 0),
    'expired ' + (safeLeases.expired || 0),
    'scoped ' + (safeLeases.sourceScoped || 0),
    'global ' + (safeLeases.unscoped || 0)
  ].join(' 路 ');
}

function workerRunStatusSummary(workers) {
  const safeWorkers = workers || {};
  return [
    'running ' + (safeWorkers.running || 0),
    'stale ' + (safeWorkers.stale || 0),
    'scoped ' + (safeWorkers.sourceScoped || 0),
    'failed ' + (safeWorkers.failed || 0)
  ].join(' | ');
}

function uniqueLeases(leases) {
  const seen = new Set();
  return (leases || []).filter(function (lease) {
    const key = lease && lease.leaseKey || '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueWorkerRuns(runs) {
  const seen = new Set();
  return (runs || []).filter(function (run) {
    const key = run && run.id || '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatWorkerRunRow(run) {
  const scope = run.scope || {};
  const scopeLabel = scope.sourceId
    ? 'sourceId=' + scope.sourceId
    : (scope.sourceKey ? 'sourceKey=' + scope.sourceKey : 'global');
  return [
    run.status || 'unknown-status',
    run.workerType || 'unknown-worker',
    scopeLabel,
    run.workerId || 'unknown-owner',
    run.heartbeatAt || run.updatedAt || 'no-heartbeat',
    run.id || 'unknown-run'
  ].join(' | ');
}

function formatWorkerLeaseRow(lease) {
  const scope = lease.scope || {};
  const scopeLabel = scope.sourceId
    ? 'sourceId=' + scope.sourceId
    : (scope.sourceKey ? 'sourceKey=' + scope.sourceKey : 'global');
  return [
    lease.expired ? 'expired' : 'active',
    lease.workerType || 'unknown-worker',
    scopeLabel,
    lease.ownerId || 'unknown-owner',
    lease.leaseKey || 'unknown-lease',
    lease.expiresAt || 'no-expiry'
  ].join(' | ');
}

function renderOperationsRunbook(runbook) {
  const actions = runbook.actions || [];
  if (actions.length === 0) {
    return panel('运维 Runbook', '<div class="muted">暂无动作</div>', 'wide');
  }
  return panel('运维 Runbook', actions.slice(0, 10).map(function (action) {
    let command = action.recommendedCommand ? '<small>' + escapeHtml(action.recommendedCommand) + '</small>' : '';
    command += (action.relatedCommands || []).map(function (item) {
      return '<small>' + escapeHtml(item) + '</small>';
    }).join('');
    return '<div class="action-row"><span>' + escapeHtml(action.severity + ' · ' + action.area + ' · ' + action.title) + '<small>' + escapeHtml(action.summary) + '</small>' + command + '</span></div>';
  }).join(''), 'wide');
}

function renderAutomationReadinessPlan(input) {
  const cockpit = normalizeAutomationCockpitInput(input);
  const plan = cockpit.plan;
  return [
    renderAutomationCockpitHero(plan, cockpit),
    panel('Attention queue', renderAutomationAttentionQueue(cockpit.attentionQueue), 'wide automation-attention-panel'),
    panel('Snapshot freshness', renderAutomationFreshness(cockpit.freshness), 'wide automation-freshness-panel'),
    panel('Notification and audit pressure', renderAutomationOperatingPressure(cockpit), 'wide automation-pressure-panel'),
    panel('Automation gates', renderAutomationReadinessChecks(plan.checks || []), 'wide automation-gates-panel'),
    panel('Operator runbook', renderAutomationOperatorRunbook(cockpit.operatorRunbook), 'wide automation-runbook-panel'),
    panel('Automation remediation', renderAutomationRemediation(plan.remediation), 'wide automation-remediation-panel'),
    panel('Worker commands', renderAutomationWorkerCommands(plan.automation && plan.automation.workerCommands || []), 'wide automation-worker-panel'),
    panel('Next actions', renderAutomationNextActions(plan.nextActions || []), 'wide automation-next-panel')
  ].join('');
}

function normalizeAutomationCockpitInput(input) {
  const safeInput = input || {};
  if (safeInput.plan) {
    return {
      plan: safeInput.plan || {},
      notificationOverview: safeInput.notificationOverview || {},
      reviewActionAuditOverview: safeInput.reviewActionAuditOverview || {},
      reviewActionExecutions: safeInput.reviewActionExecutions || {},
      notificationDiagnostics: safeInput.notificationDiagnostics || {},
      attentionQueue: safeInput.attentionQueue || {},
      freshness: safeInput.freshness || {},
      operatorRunbook: safeInput.operatorRunbook || {}
    };
  }
  return {
    plan: safeInput,
    notificationOverview: {},
    reviewActionAuditOverview: {},
    reviewActionExecutions: {},
    notificationDiagnostics: {},
    attentionQueue: {},
    freshness: {},
    operatorRunbook: {}
  };
}

function renderAutomationCockpitHero(plan, cockpit) {
  const summary = plan.summary || {};
  const sources = summary.sources || {};
  const operations = summary.operations || {};
  const workers = summary.workers || {};
  const llm = summary.llm || {};
  const demo = summary.demo || {};
  const pressure = automationOperatingPressureSummary(cockpit || {});
  const freshness = cockpit && cockpit.freshness || {};
  const freshnessSpan = freshness.spanMs === undefined ? 'unknown' : formatDurationMs(freshness.spanMs);
  const representative = summary.representativeSource || {};
  const generatedAt = cockpit && cockpit.generatedAt || plan.generatedAt || 'unknown';
  const sourceTaskMode = workers.sourceTaskMode || plan.automation && plan.automation.sourceTaskMode || 'unknown';
  const representativeSource = representative.source && (representative.source.displayName || representative.source.id || representative.source.sourceKey) || 'none';
  const replayStatus = representative.replay && representative.replay.available ? 'available' : 'missing';
  const readyVariant = plan.readyForUnattendedRun ? 'ok' : statusVariant(plan.status);
  return [
    '<article class="automation-cockpit-hero ' + statusClassName(readyVariant) + '">',
    '<section class="automation-cockpit-main">',
    '<div class="automation-cockpit-header">',
    '<span class="automation-cockpit-label">Automation cockpit</span>',
    statusBadge(plan.status || 'unknown', readyVariant),
    statusBadge(plan.readyForUnattendedRun ? 'unattended ready' : 'operator review', plan.readyForUnattendedRun ? 'ok' : 'warn'),
    '</div>',
    '<h3>' + escapeHtml(automationReadinessHeadlineReadable(plan, sources, operations, workers, llm, demo)) + '</h3>',
    '<p>' + escapeHtml([
      'snapshot=' + generatedAt,
      'sourceTaskMode=' + sourceTaskMode,
      'topology=' + (workers.topology || 'unknown'),
      'llm=' + (llm.provider || 'unknown') + (llm.mockMode ? '/mock' : '')
    ].join(' | ')) + '</p>',
    '<div class="automation-cockpit-actions button-group">' +
      automationCockpitButton('refresh-automation-readiness', 'Refresh', 'secondary-inline-button') +
      automationCockpitButton('run-llm-readiness', 'LLM readiness', 'secondary-inline-button') +
      automationCockpitButton('run-llm-preflight', 'LLM preflight', 'secondary-inline-button') +
      automationCockpitButton('run-llm-evaluation', 'LLM evaluate', 'secondary-inline-button') +
      automationCockpitButton('run-demo-cycle', 'Demo cycle', '') +
    '</div>',
    '</section>',
    '<aside class="automation-cockpit-signals">',
    automationCockpitSignal('Ready', plan.readyForUnattendedRun ? 'yes' : 'no', plan.readyForUnattendedRun ? 'ok' : 'warn'),
    automationCockpitSignal('Sources', sources.total || 0, (sources.total || 0) > 0 ? 'ok' : 'fail'),
    automationCockpitSignal('Due now', sources.due || 0, (sources.due || 0) > 0 ? 'warn' : 'ok'),
    automationCockpitSignal('Queue', operations.queueTotal || 0, statusVariant(operations.cockpitStatus)),
    automationCockpitSignal('Runnable', operations.runnable || 0, (operations.runnable || 0) > 0 ? 'ok' : 'muted'),
    automationCockpitSignal('LLM', llm.provider || 'unknown', statusVariant(llm.status)),
    automationCockpitSignal('Freshness', (freshness.presentSourceCount || 0) + '/' + (freshness.sourceCount || 0), statusVariant(freshness.status)),
    automationCockpitSignal('Span', freshnessSpan, freshness.spanMs > 60000 ? 'warn' : statusVariant(freshness.status || 'ok')),
    '</aside>',
    '<section class="automation-cockpit-runpath">',
    '<span>Run path</span>',
    renderAutomationRunPath(summary, plan, cockpit || {}),
    '</section>',
    '<section class="automation-cockpit-foot">',
    '<span>Evidence loop</span>',
    '<strong>' + escapeHtml([
      'representative=' + representativeSource,
      'health=' + (representative.status || 'not-evaluated'),
      'replay=' + replayStatus,
      'outbox=' + pressure.outboxStatus
    ].join(' | ')) + '</strong>',
    '<small>' + escapeHtml([
      'skipped=' + (sources.skipped || 0),
      'priority=' + (operations.highestPriorityScore || 0),
      'demo=' + (demo.closureStatus || demo.status || 'not-run'),
      'audits=' + pressure.auditCount,
      'executions=' + pressure.executionCount
    ].join(' | ')) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function automationReadinessHeadlineReadable(plan, sources, operations, workers, llm, demo) {
  if (plan.readyForUnattendedRun) return 'Unattended operation is ready for a daily run.';
  if ((sources.total || 0) === 0) return 'Connect a trusted source before automation has something to run.';
  if ((operations.queueTotal || 0) > 0 && (operations.runnable || 0) > 0) return 'Runnable work is queued; run one controlled cycle next.';
  if (llm.mockMode || llm.provider === 'mock') return 'Semantic analysis is still on the mock/provider readiness path.';
  if (!workers.topology || workers.status !== 'ok') return 'Confirm worker topology before relying on long-running automation.';
  if (!demo.readyForDailyUse) return 'Complete the demo closure before treating the loop as daily-use ready.';
  return 'The automation base is in place; close the remaining operating gaps.';
}

function automationCockpitButton(action, label, className) {
  return '<button class="inline-button ' + escapeHtml(className || '') + '" type="button" data-action="' + escapeHtml(action) + '">' + escapeHtml(label) + '</button>';
}

function automationCockpitSignal(label, value, variant) {
  return '<div class="automation-cockpit-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function renderAutomationRunPath(summary, plan, cockpit) {
  const sources = summary.sources || {};
  const operations = summary.operations || {};
  const workers = summary.workers || {};
  const llm = summary.llm || {};
  const demo = summary.demo || {};
  const automation = plan.automation || {};
  const workerCommands = automation.workerCommands || [];
  const pressure = automationOperatingPressureSummary(cockpit || {});
  const rows = [
    {
      title: 'Source schedule',
      detail: 'registered=' + (sources.total || 0) + ' | due=' + (sources.due || 0) + ' | skipped=' + (sources.skipped || 0),
      status: (sources.total || 0) > 0 ? ((sources.due || 0) > 0 ? 'warn' : 'ok') : 'fail'
    },
    {
      title: 'Worker topology',
      detail: (workers.topology || 'unknown') + ' | mode=' + (workers.sourceTaskMode || automation.sourceTaskMode || 'unknown') + ' | workers=' + (workers.workerCount || workerCommands.length || 0),
      status: statusVariant(workers.status)
    },
    {
      title: 'LLM provider',
      detail: (llm.provider || 'unknown') + ' | mode=' + (llm.mode || 'unknown') + ' | mock=' + String(Boolean(llm.mockMode)),
      status: llm.mockMode ? 'warn' : statusVariant(llm.status)
    },
    {
      title: 'Demo closure',
      detail: 'status=' + (demo.closureStatus || demo.status || 'not-run') + ' | daily=' + String(Boolean(demo.readyForDailyUse)),
      status: demo.readyForDailyUse ? 'ok' : 'warn'
    },
    {
      title: 'Operator pressure',
      detail: 'queue=' + (operations.queueTotal || 0) + ' | runnable=' + (operations.runnable || 0) + ' | priority=' + (operations.highestPriorityScore || 0),
      status: statusVariant(operations.cockpitStatus)
    },
    {
      title: 'Notification outbox',
      detail: 'open=' + pressure.openEvents + ' | due=' + pressure.dueEvents + ' | failed=' + pressure.failedEvents,
      status: pressure.outboxVariant
    },
    {
      title: 'Review audit ledger',
      detail: 'audits=' + pressure.auditCount + ' | executions=' + pressure.executionCount + ' | stale=' + pressure.staleExecutions,
      status: pressure.auditVariant
    }
  ];
  return rows.map(function (row) {
    return '<div class="automation-cockpit-runrow ' + statusClassName(row.status) + '">' +
      '<strong>' + escapeHtml(row.title) + '</strong>' +
      '<small>' + escapeHtml(row.detail) + '</small>' +
      '</div>';
  }).join('');
}

function renderAutomationAttentionQueue(queue) {
  const safeQueue = queue || {};
  const items = safeQueue.items || [];
  const rows = [
    '<div class="summary-strip">',
    summaryTile('Status', safeQueue.status || 'unknown', statusVariant(safeQueue.status)),
    summaryTile('Items', String(safeQueue.itemCount || items.length || 0), (safeQueue.itemCount || items.length || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Critical', String(safeQueue.criticalCount || 0), (safeQueue.criticalCount || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('Warning', String(safeQueue.warningCount || 0), (safeQueue.warningCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Top', safeQueue.highestSeverity || 'ok', safeQueue.highestSeverity === 'critical' ? 'fail' : safeQueue.highestSeverity === 'warning' ? 'warn' : 'ok'),
    '</div>'
  ];
  if (items.length === 0) {
    rows.push(emptySignal('No cockpit attention items right now.', 'Clear'));
    return rows.join('');
  }
  rows.push('<div class="automation-attention-list">' + items.slice(0, 8).map(function (item) {
    const variant = item.severity === 'critical' ? 'fail' : item.severity === 'warning' ? 'warn' : statusVariant(item.status);
    return '<div class="action-row ops-row automation-attention-row ' + statusClassName(variant) + '">' +
      '<span>' +
      '<strong>' + escapeHtml('#' + (item.rank || '?') + ' ' + (item.title || item.id || 'Attention item')) + '</strong>' +
      '<small>' + escapeHtml((item.area || 'cockpit') + ' | ' + (item.summary || 'Review this cockpit signal.')) + '</small>' +
      '<small>' + escapeHtml(item.nextAction || 'Review the related cockpit panel.') + '</small>' +
      '</span>' +
      renderAutomationAttentionControl(item) +
      statusBadge(item.severity || item.status || 'info', variant) +
      '</div>';
  }).join('') + '</div>');
  return rows.join('');
}

function renderAutomationAttentionControl(item) {
  if (!item || (!item.targetPanel && !item.nextActionKey)) return '';
  const buttons = [];
  if (item.targetPanel) {
    buttons.push('<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="focus-automation-panel" data-target-panel="' + escapeHtml(item.targetPanel) + '">' + escapeHtml(item.actionLabel || 'Open panel') + '</button>');
  }
  if (item.nextActionKey) {
    buttons.push('<button class="inline-button compact-inline-button" type="button" data-action="run-automation-attention-action" data-attention-action="' + escapeHtml(item.nextActionKey) + '" data-target-panel="' + escapeHtml(item.targetPanel || '') + '">' + escapeHtml(item.nextActionLabel || 'Run check') + '</button>');
  }
  return '<span class="button-group automation-attention-actions">' + buttons.join('') + '</span>';
}

async function runAutomationAttentionAction(button) {
  const action = button.dataset.attentionAction;
  const targetPanel = button.dataset.targetPanel;
  if (action === 'refresh-automation-readiness') {
    await loadAutomationReadiness();
    focusAutomationPanel(targetPanel);
    return;
  }
  if (action === 'run-llm-readiness') {
    await runLlmReadiness(resolveAutomationActionTarget());
    focusAutomationPanel(targetPanel || 'automation-gates');
    return;
  }
  if (action === 'run-llm-preflight') {
    await runLlmPreflight(resolveAutomationActionTarget());
    focusAutomationPanel(targetPanel || 'automation-gates');
    return;
  }
  if (action === 'preview-runbook-command') {
    focusAutomationPanel(targetPanel || 'automation-runbook');
    const previewButton = document.querySelector('.automation-runbook-panel button[data-action="set-source-schedule"][data-execute="false"]');
    if (previewButton) {
      await setSourceScheduleFromButton(previewButton, false, resolveAutomationActionTarget());
      return;
    }
    const target = document.getElementById(resolveAutomationActionTarget());
    if (target) target.innerHTML = renderFeedbackState('empty', 'No safe runbook preview is available right now.');
  }
}

function focusAutomationPanel(targetPanel) {
  const panelClass = {
    'automation-gates': '.automation-gates-panel',
    'automation-freshness': '.automation-freshness-panel',
    'automation-pressure': '.automation-pressure-panel',
    'automation-runbook': '.automation-runbook-panel'
  }[targetPanel];
  if (!panelClass) return;
  const panel = document.querySelector(panelClass);
  if (!panel) return;
  panel.classList.remove('result-focus-pulse');
  const motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  panel.scrollIntoView({
    block: 'start',
    behavior: motion
  });
  window.setTimeout(function () {
    panel.classList.add('result-focus-pulse');
  }, 0);
}

function renderAutomationOperatingPressure(cockpit) {
  const pressure = automationOperatingPressureSummary(cockpit || {});
  const notificationOverview = cockpit.notificationOverview || {};
  const auditOverview = cockpit.reviewActionAuditOverview || {};
  const actionExecutions = cockpit.reviewActionExecutions || {};
  const notificationDiagnostics = cockpit.notificationDiagnostics || {};
  const checks = notificationDiagnostics.checks || [];
  return [
    '<div class="summary-strip">',
    summaryTile('Outbox', pressure.outboxStatus, pressure.outboxVariant),
    summaryTile('Open', String(pressure.openEvents), pressure.openEvents > 0 ? 'warn' : 'ok'),
    summaryTile('Due', String(pressure.dueEvents), pressure.dueEvents > 0 ? 'warn' : 'ok'),
    summaryTile('Failed', String(pressure.failedEvents), pressure.failedEvents > 0 ? 'fail' : 'ok'),
    summaryTile('Audits', String(pressure.auditCount), pressure.auditCount > 0 ? 'ok' : 'warn'),
    summaryTile('Executions', String(pressure.executionCount), pressure.staleExecutions > 0 ? 'fail' : pressure.executionCount > 0 ? 'ok' : 'muted'),
    summaryTile('Channel', pressure.channel, statusVariant(pressure.channelStatus)),
    '</div>',
    '<div class="action-row ops-row"><span>' +
      '<strong>Notification outbox</strong>' +
      '<small>' + escapeHtml(notificationOverview.recommendedNextAction || 'No notification overview action returned.') + '</small>' +
      '<small>' + escapeHtml('retryExhausted=' + pressure.retryExhaustedEvents + ' | events=' + pressure.eventCount) + '</small>' +
      '</span>' + statusBadge(pressure.outboxStatus, pressure.outboxVariant) + '</div>',
    '<div class="action-row ops-row"><span>' +
      '<strong>Review audit ledger</strong>' +
      '<small>' + escapeHtml(auditOverview.recommendedNextAction || 'No review audit recommendation returned.') + '</small>' +
      '<small>' + escapeHtml('tasks=' + (auditOverview.taskCount || 0) + ' | plannedClosure=' + (auditOverview.plannedClosureCount || 0) + ' | plannedMerge=' + (auditOverview.plannedMergeCandidateCount || 0)) + '</small>' +
      '</span>' + statusBadge(auditOverview.status || 'unknown', pressure.auditVariant) + '</div>',
    '<div class="action-row ops-row"><span>' +
      '<strong>Action executions</strong>' +
      '<small>' + escapeHtml('status=' + (actionExecutions.status || 'unknown') + ' | count=' + pressure.executionCount + ' | stale=' + pressure.staleExecutions + ' | failed=' + pressure.failedExecutions) + '</small>' +
      '<small>' + escapeHtml('Notification delivery and review actions stay observable before real executors are enabled.') + '</small>' +
      '</span>' + statusBadge(actionExecutions.status || 'unknown', pressure.executionVariant) + '</div>',
    checks.length > 0
      ? '<div class="action-row ops-row"><span>' +
        '<strong>Notification channel</strong>' +
        '<small>' + escapeHtml(checks.map(function (check) { return check.key + '=' + check.status; }).join(' | ')) + '</small>' +
        '</span>' + statusBadge(pressure.channelStatus, statusVariant(pressure.channelStatus)) + '</div>'
      : ''
  ].join('');
}

function renderAutomationFreshness(freshness) {
  const safeFreshness = freshness || {};
  const sources = safeFreshness.sources || [];
  const missingSources = safeFreshness.missingSources || [];
  const visibleSources = sources.slice(0, 12);
  const spanLabel = safeFreshness.spanMs === undefined ? 'unknown' : formatDurationMs(safeFreshness.spanMs);
  const rows = [
    '<div class="summary-strip">',
    summaryTile('Status', safeFreshness.status || 'unknown', statusVariant(safeFreshness.status)),
    summaryTile('Inputs', String(safeFreshness.presentSourceCount || 0) + '/' + String(safeFreshness.sourceCount || 0), (safeFreshness.missingSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Missing', String(safeFreshness.missingSourceCount || 0), (safeFreshness.missingSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Span', spanLabel, safeFreshness.spanMs > 60000 ? 'warn' : 'ok'),
    '</div>',
    '<div class="action-row ops-row automation-freshness-row"><span>' +
      '<strong>Snapshot window</strong>' +
      '<small>' + escapeHtml('oldest=' + (safeFreshness.oldestGeneratedAt || 'unknown') + ' | newest=' + (safeFreshness.newestGeneratedAt || 'unknown')) + '</small>' +
      '<small>' + escapeHtml(missingSources.length > 0 ? 'missing=' + missingSources.join(', ') : 'all expected inputs reported generatedAt') + '</small>' +
      '</span>' + statusBadge(safeFreshness.status || 'unknown', statusVariant(safeFreshness.status)) + '</div>'
  ];
  if (visibleSources.length > 0) {
    rows.push('<div class="automation-freshness-source-list">' + visibleSources.map(function (source) {
      return '<div class="automation-freshness-source ' + (source.present ? 'status-ok' : 'status-warn') + '">' +
        '<strong>' + escapeHtml(source.key || 'input') + '</strong>' +
        '<small>' + escapeHtml(source.generatedAt || 'missing') + '</small>' +
        '</div>';
    }).join('') + '</div>');
  }
  return rows.join('');
}

function formatDurationMs(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return 'unknown';
  if (ms < 1000) return String(ms) + 'ms';
  if (ms < 60000) return String(Math.round(ms / 1000)) + 's';
  if (ms < 3600000) return String(Math.round(ms / 60000)) + 'm';
  return String(Math.round(ms / 3600000)) + 'h';
}

function automationOperatingPressureSummary(cockpit) {
  if (cockpit && cockpit.operatingPressure) {
    return normalizeAutomationOperatingPressure(cockpit.operatingPressure);
  }
  const notificationOverview = cockpit.notificationOverview || {};
  const auditOverview = cockpit.reviewActionAuditOverview || {};
  const actionExecutions = cockpit.reviewActionExecutions || {};
  const notificationDiagnostics = cockpit.notificationDiagnostics || {};
  const checks = notificationDiagnostics.checks || [];
  const failedEvents = notificationOverview.failedCount || 0;
  const retryExhaustedEvents = notificationOverview.retryExhaustedCount || 0;
  const dueEvents = notificationOverview.dueForDeliveryCount || 0;
  const openEvents = notificationOverview.unacknowledgedCount || 0;
  const outboxVariant = failedEvents > 0 || retryExhaustedEvents > 0
    ? 'fail'
    : dueEvents > 0 || openEvents > 0
      ? 'warn'
      : statusVariant(notificationOverview.status || 'ok');
  const staleExecutions = actionExecutions.summary && actionExecutions.summary.staleRunning || actionExecutions.staleRunning || 0;
  const failedExecutions = actionExecutions.summary && actionExecutions.summary.failed || actionExecutions.failed || 0;
  const executionCount = actionExecutions.count || (actionExecutions.executions || []).length || 0;
  const auditCount = auditOverview.count || 0;
  const auditVariant = staleExecutions > 0 || failedExecutions > 0
    ? 'fail'
    : auditOverview.status === 'warn' || auditCount === 0
      ? 'warn'
      : statusVariant(auditOverview.status || 'ok');
  const channelFailed = checks.some(function (check) {
    return check.status === 'fail';
  });
  const channelWarn = checks.some(function (check) {
    return check.status === 'warn';
  });
  const channelStatus = channelFailed ? 'fail' : channelWarn ? 'warn' : checks.length > 0 ? 'ok' : 'unknown';
  return {
    eventCount: notificationOverview.eventCount || 0,
    openEvents,
    dueEvents,
    failedEvents,
    retryExhaustedEvents,
    outboxStatus: notificationOverview.status || 'ok',
    outboxVariant,
    auditCount,
    executionCount,
    staleExecutions,
    failedExecutions,
    auditVariant,
    executionVariant: staleExecutions > 0 || failedExecutions > 0 ? 'fail' : statusVariant(actionExecutions.status || 'ok'),
    channel: notificationDiagnostics.channel || 'unknown',
    channelStatus
  };
}

function normalizeAutomationOperatingPressure(pressure) {
  const safePressure = pressure || {};
  const outbox = safePressure.outbox || {};
  const audit = safePressure.audit || {};
  const executions = safePressure.executions || {};
  const channel = safePressure.channel || {};
  return {
    eventCount: outbox.eventCount || 0,
    openEvents: outbox.openCount || 0,
    dueEvents: outbox.dueCount || 0,
    failedEvents: outbox.failedCount || 0,
    retryExhaustedEvents: outbox.retryExhaustedCount || 0,
    outboxStatus: outbox.status || 'unknown',
    outboxVariant: statusVariant(outbox.status || safePressure.status || 'ok'),
    auditCount: audit.auditCount || 0,
    executionCount: executions.count || 0,
    staleExecutions: executions.staleRunningCount || 0,
    failedExecutions: executions.failedCount || 0,
    auditVariant: statusVariant(audit.status || safePressure.status || 'ok'),
    executionVariant: statusVariant(executions.status || safePressure.status || 'ok'),
    channel: channel.channel || 'unknown',
    channelStatus: channel.status || 'unknown'
  };
}

function renderAutomationReadinessChecks(checks) {
  if (!checks.length) return '<div class="muted">No automation gates returned.</div>';
  return checks.map(function (check) {
    return '<div class="action-row"><span>' +
      '<strong>' + escapeHtml(check.key || 'check') + '</strong>' +
      '<small>' + escapeHtml([check.area, check.value].filter(Boolean).join(' | ')) + '</small>' +
      '<small>' + escapeHtml(check.summary || '') + '</small>' +
      '</span>' + statusBadge(check.status || 'unknown', statusVariant(check.status)) + '</div>';
  }).join('');
}

function renderAutomationWorkerCommands(commands) {
  if (!commands.length) return '<div class="muted">No worker commands available.</div>';
  return commands.map(function (worker) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(worker.workerType || worker.key || 'worker') + '</strong>' +
      '<small>' + escapeHtml([worker.leaseKey, worker.intervalMs ? 'interval=' + worker.intervalMs + 'ms' : undefined].filter(Boolean).join(' | ')) + '</small>' +
      '<small>' + escapeHtml(worker.command || '') + '</small>' +
      '</span></div>';
  }).join('');
}

function renderAutomationOperatorRunbook(runbook) {
  const safeRunbook = runbook || {};
  const sections = safeRunbook.sections || [];
  const rows = [
    '<div class="summary-strip">',
    summaryTile('Status', safeRunbook.status || 'unknown', statusVariant(safeRunbook.status)),
    summaryTile('Commands', String(safeRunbook.commandCount || 0), (safeRunbook.commandCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Actionable', String(safeRunbook.actionableCommandCount || 0), (safeRunbook.actionableCommandCount || 0) > 0 ? 'warn' : 'muted'),
    summaryTile('Apply', String(safeRunbook.executeCommandCount || 0), (safeRunbook.executeCommandCount || 0) > 0 ? 'warn' : 'muted'),
    summaryTile('Sections', String(sections.length), sections.length > 0 ? 'ok' : 'muted'),
    summaryTile('Next', safeRunbook.nextCommand && safeRunbook.nextCommand.title || 'none', safeRunbook.nextCommand ? 'warn' : 'muted'),
    '</div>'
  ];
  if (sections.length === 0) {
    rows.push('<div class="muted">No operator runbook returned.</div>');
    return rows.join('');
  }
  sections.forEach(function (section) {
    const commands = (section.commands || []).filter(function (command) {
      return command && command.command;
    });
    rows.push('<div class="action-row ops-row automation-runbook-row">' +
      '<span>' +
      '<strong>' + escapeHtml(section.title || section.key || 'Runbook section') + '</strong>' +
      '<small>' + escapeHtml('commands=' + (section.commandCount || commands.length || 0)) + '</small>' +
      renderAutomationRunbookCommandRows(commands) +
      '</span>' +
      statusBadge(section.status || 'unknown', statusVariant(section.status)) +
      '</div>');
  });
  return rows.join('');
}

function renderAutomationRunbookCommandRows(commands) {
  if (!commands || commands.length === 0) return '';
  return '<div class="lifecycle-command-list automation-runbook-command-list">' + commands.map(function (command) {
    return '<div class="lifecycle-command-row automation-runbook-command-row">' +
      '<code>' + escapeHtml(command.command || '') + '</code>' +
      '<span class="button-group">' +
      '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="copy-lifecycle-command">Copy</button>' +
      renderAutomationRunbookIntentButton(command.intent) +
      '</span>' +
      '</div>';
  }).join('') + '</div>';
}

function renderAutomationRunbookIntentButton(intent) {
  const safeIntent = intent || {};
  if (safeIntent.type !== 'set-source-schedule' || !safeIntent.sourceId) return '';
  const label = safeIntent.execute ? 'Apply' : 'Preview';
  const className = safeIntent.execute ? 'inline-button compact-inline-button' : 'inline-button secondary-inline-button compact-inline-button';
  return '<button class="' + className + '" type="button" data-action="set-source-schedule"' +
    ' data-source-id="' + escapeHtml(safeIntent.sourceId) + '"' +
    ' data-interval-minutes="' + escapeHtml(String(safeIntent.intervalMinutes || 60)) + '"' +
    ' data-run-now="' + escapeHtml(String(safeIntent.runNow !== false)) + '"' +
    ' data-schedule-enabled="' + escapeHtml(String(safeIntent.scheduleEnabled !== false)) + '"' +
    ' data-execute="' + escapeHtml(String(safeIntent.execute === true)) + '">' + label + '</button>';
}

function renderAutomationRemediation(remediation) {
  if (!remediation) return '<div class="muted">No remediation plan returned.</div>';
  const actions = remediation.actions || [];
  const manualActions = remediation.manualActions || [];
  const rows = [
    '<div class="summary-strip">',
    summaryTile('Status', remediation.status || 'unknown', statusVariant(remediation.status === 'actionable' ? 'warn' : remediation.status === 'none' ? 'ok' : 'warn')),
    summaryTile('Actions', String(remediation.actionCount || 0), (remediation.actionCount || 0) > 0 ? 'warn' : 'muted'),
    summaryTile('Manual', String(remediation.manualActionCount || 0), (remediation.manualActionCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Safe', remediation.safeToAutoApply ? 'yes' : 'no', remediation.safeToAutoApply ? 'ok' : 'muted'),
    '</div>'
  ];
  if (!actions.length && !manualActions.length) {
    rows.push('<div class="muted">No remediation actions are needed.</div>');
    return rows.join('');
  }
  actions.slice(0, 8).forEach(function (action) {
    const sourceId = action.scope && action.scope.sourceId;
    const dryRunButton = sourceId
      ? '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-schedule" data-source-id="' + escapeHtml(sourceId) + '" data-interval-minutes="60" data-run-now="true" data-execute="false">Schedule check</button>'
      : '';
    const executeButton = sourceId
      ? '<button class="inline-button" type="button" data-action="set-source-schedule" data-source-id="' + escapeHtml(sourceId) + '" data-interval-minutes="60" data-run-now="true" data-execute="true">Schedule now</button>'
      : '';
    rows.push('<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.type || action.key || 'remediation') + '</strong>' +
      '<small>' + escapeHtml([action.severity, action.reason, sourceId].filter(Boolean).join(' | ')) + '</small>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      '<small>' + escapeHtml(action.executeCommand || action.command || '') + '</small>' +
      '</span><span class="button-group">' + dryRunButton + executeButton + '</span></div>');
  });
  manualActions.slice(0, 8).forEach(function (action) {
    rows.push('<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.checkKey || action.key || 'manual') + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      '<small>' + escapeHtml(action.command || '') + '</small>' +
      '</span></div>');
  });
  return rows.join('');
}

function renderAutomationNextActions(actions) {
  if (!actions.length) return '<div class="muted">No next actions.</div>';
  return actions.map(function (action) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.key || 'action') + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      (action.recommendedCommand ? '<small>' + escapeHtml(action.recommendedCommand) + '</small>' : '') +
      '</span>' + statusBadge(action.severity || 'info', attentionStatusVariant(action.severity)) + '</div>';
  }).join('');
}

function renderSourceOperations(result) {
  const cockpit = result.cockpit || {};
  const lifecycle = result.lifecycle || {};
  const schedule = result.schedule || {};
  const runbook = result.runbook || {};
  const attention = result.attention || {};
  const sourceTypeOperations = result.sourceTypeOperations || {};
  const sourceTypeReadiness = result.sourceTypeReadiness || {};
  const lifecycleSummary = lifecycle.summary || {};
  const scheduleSummary = schedule.summary || {};
  const actions = runbook.actions || [];
  const sourceActions = actions.filter(function (action) {
    return action.area === 'sources';
  });
  const alertableCount = countAlertableRunbookActions(actions);
  const attentionItems = attention.sources || buildSourceAttention(result);
  const sourceAttentionAlertableCount = countAlertableSourceAttention(attentionItems);
  const sourceTypeOperationsAlertableCount = countAlertableSourceTypeOperations(sourceTypeOperations.sourceTypes || []);
  const collectionSummary = schedule.summary && schedule.summary.byCollectionStatus || {};
  const panels = [
    renderSourceOperationsHero({
      cockpit,
      lifecycle,
      schedule,
      runbook,
      attentionItems,
      sourceTypeOperations,
      lifecycleSummary,
      scheduleSummary,
      collectionSummary,
      alertableCount,
      sourceAttentionAlertableCount,
      sourceTypeOperationsAlertableCount
    }),
    panel('Operator queue detail', [
      renderSourceOperationsCockpitRows(cockpit.queue || []),
      renderSourceOperationsCockpitNextActions(cockpit.nextActions || [])
    ].join(''), 'wide'),
    panel('Collection status', renderCollectionStatusOverview(schedule), 'wide'),
    panel('Collection actions', renderCollectionActionControls(schedule), 'wide'),
    panel('Source attention', renderSourceAttentionRows(attentionItems), 'wide'),
    panel('Source type operations', renderSourceTypeOperations(sourceTypeOperations), 'wide'),
    panel('Source type readiness', renderSourceTypeReadiness(sourceTypeReadiness), 'wide'),
    panel('Due sources', renderScheduleDecisionRows(schedule.dueSources || [], 'No due sources.', true), 'wide'),
    panel('Retry waiting sources', renderScheduleDecisionRows(filterScheduleSourcesByCollectionStatus(schedule.sources || [], 'retry-waiting'), 'No retry-waiting sources.', false), 'wide'),
    panel('Unscheduled or disabled sources', renderScheduleDecisionRows(filterScheduleSourcesByCollectionStatus(schedule.sources || [], ['unscheduled', 'disabled']), 'No unscheduled or disabled sources.', false), 'wide'),
    panel('Skipped sources', renderScheduleDecisionRows((schedule.skippedSources || []).slice(0, 10), 'No skipped sources.', false), 'wide'),
    panel('Lifecycle attention', renderLifecycleAttentionRows(lifecycle.sources || []), 'wide')
  ];
  if (sourceActions.length > 0) {
    panels.push(panel('Source runbook actions', renderRunbookActionRows(sourceActions), 'wide'));
  }
  return panels.join('');
}

function renderSourceOperationsHero(view) {
  const cockpit = view.cockpit || {};
  const lifecycle = view.lifecycle || {};
  const schedule = view.schedule || {};
  const runbook = view.runbook || {};
  const summary = cockpit.summary || {};
  const lifecycleSummary = view.lifecycleSummary || {};
  const scheduleSummary = view.scheduleSummary || {};
  const collectionSummary = view.collectionSummary || {};
  const queue = cockpit.queue || [];
  const alertableCount = view.alertableCount || 0;
  const sourceAttentionAlertableCount = view.sourceAttentionAlertableCount || 0;
  const sourceTypeOperationsAlertableCount = view.sourceTypeOperationsAlertableCount || 0;
  const headline = sourceOperationsHeadline(cockpit, schedule, lifecycle);
  return [
    '<article class="source-ops-hero">',
    '<section class="source-ops-main">',
    '<div class="source-ops-header">',
    '<span class="source-ops-label">Source runtime</span>',
    statusBadge(cockpit.status || lifecycle.status || schedule.status || 'unknown', statusVariant(cockpit.status || lifecycle.status || schedule.status)),
    '</div>',
    '<h3>' + escapeHtml(headline) + '</h3>',
    '<p>' + escapeHtml([
      'lifecycle=' + (lifecycle.status || 'unknown'),
      'schedule=' + (schedule.status || 'unknown'),
      'runbook=' + (runbook.status || 'unknown'),
      'enabled=' + String(lifecycleSummary.enabled || 0) + '/' + String(lifecycleSummary.total || 0)
    ].join(' | ')) + '</p>',
    '<div class="source-ops-actions button-group">' +
      sourceOpsAlertControl('Runbook check', 'Create runbook alerts', 'synthesize-runbook-events', alertableCount, 'data-limit="100"') +
      sourceOpsAlertControl('Attention check', 'Create attention alerts', 'synthesize-source-attention-events', sourceAttentionAlertableCount, 'data-limit="100" data-attention-limit="100" data-priority-score-threshold="70"') +
      sourceOpsAlertControl('Type check', 'Create type alerts', 'synthesize-source-type-operations-events', sourceTypeOperationsAlertableCount, 'data-limit="100" data-source-type-limit="100" data-attention-limit="100" data-priority-score-threshold="70"') +
    '</div>',
    '</section>',
    '<aside class="source-ops-signals">',
    sourceOpsSignal('Queue', summary.total || 0, statusVariant(cockpit.status)),
    sourceOpsSignal('Critical', summary.fail || 0, (summary.fail || 0) > 0 ? 'fail' : 'ok'),
    sourceOpsSignal('Due now', scheduleSummary.due || 0, (scheduleSummary.due || 0) > 0 ? 'warn' : 'ok'),
    sourceOpsSignal('Runnable', summary.runnable || 0, (summary.runnable || 0) > 0 ? 'ok' : 'muted'),
    sourceOpsSignal('Retry wait', lifecycleSummary.failureRetryWaiting || 0, (lifecycleSummary.failureRetryWaiting || 0) > 0 ? 'warn' : 'ok'),
    sourceOpsSignal('Unscheduled', collectionSummary.unscheduled || 0, (collectionSummary.unscheduled || 0) > 0 ? 'warn' : 'ok'),
    '</aside>',
    '<section class="source-ops-queue">',
    '<span>Hot queue</span>',
    renderSourceOperationsHeroQueue(queue),
    '</section>',
    '<section class="source-ops-foot">',
    '<span>Automation pressure</span>',
    '<strong>' + escapeHtml([
      'runbook=' + alertableCount,
      'sources=' + sourceAttentionAlertableCount,
      'types=' + sourceTypeOperationsAlertableCount
    ].join(' | ')) + '</strong>',
    '<small>' + escapeHtml([
      'warnings=' + (summary.warning || 0),
      'skipped=' + (scheduleSummary.skipped || 0),
      'planRetry=' + (collectionSummary['retry-waiting'] || 0),
      'disableBlocked=' + (lifecycleSummary.disableBlocked || 0)
    ].join(' | ')) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function sourceOperationsHeadline(cockpit, schedule, lifecycle) {
  const summary = cockpit.summary || {};
  const scheduleSummary = schedule.summary || {};
  const lifecycleSummary = lifecycle.summary || {};
  if ((summary.fail || 0) > 0) return 'Critical source work is waiting for a plan.';
  if ((scheduleSummary.due || 0) > 0) return 'Sources are due now; choose the next run deliberately.';
  if ((lifecycleSummary.failureRetryWaiting || 0) > 0) return 'Retry windows are open, with recovery work queued.';
  if ((summary.warning || 0) > 0) return 'Source runtime is stable, but needs attention.';
  return 'Source runtime is quiet and ready for the next signal.';
}

function sourceOpsSignal(label, value, variant) {
  return '<div class="source-ops-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function renderSourceOperationsHeroQueue(queue) {
  if (!queue || queue.length === 0) {
    return '<div class="source-ops-empty">No operator queue items.</div>';
  }
  return queue.slice(0, 3).map(function (item) {
    const source = item.source || {};
    const details = [
      item.kind,
      item.scope,
      'priority=' + (item.priorityScore || 0),
      item.signalCount !== undefined ? 'signals=' + item.signalCount : undefined,
      item.recommendedNextAction
    ].filter(Boolean).join(' | ');
    return '<div class="source-ops-queue-row">' +
      '<div>' +
      '<strong>' + escapeHtml('#' + (item.rank || '?') + ' ' + (item.title || item.id || 'Queue item')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</div>' +
      '<span class="button-group source-op-buttons">' +
      renderSourceOperationsCockpitControls(item, source) +
      statusBadge(item.severity || 'info', attentionStatusVariant(item.severity)) +
      '</span>' +
      '</div>';
  }).join('');
}

function sourceOpsAlertControl(previewLabel, executeLabel, action, alertableCount, attrs) {
  const disabled = alertableCount > 0 ? '' : ' disabled';
  const safeAttrs = attrs || '';
  return '<span class="source-ops-alert-control">' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="' + escapeHtml(action) + '" data-execute="false" ' + safeAttrs + '>' + escapeHtml(previewLabel) + '</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="' + escapeHtml(action) + '" data-execute="true" ' + safeAttrs + disabled + '>' + escapeHtml(executeLabel) + '</button>' +
    '</span>';
}

function renderSourceOperationsCockpit(cockpit) {
  const summary = cockpit.summary || {};
  const queue = cockpit.queue || [];
  return [
    '<div class="summary-strip">',
    summaryTile('Queue', String(summary.total || 0), statusVariant(cockpit.status)),
    summaryTile('Critical', String(summary.fail || 0), (summary.fail || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('Warning', String(summary.warning || 0), (summary.warning || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Runnable', String(summary.runnable || 0), (summary.runnable || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Sources', String(summary.sourceScoped || 0), (summary.sourceScoped || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Types', String(summary.sourceTypeScoped || 0), (summary.sourceTypeScoped || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Top priority', String(summary.highestPriorityScore || 0), (summary.highestPriorityScore || 0) >= 100 ? 'warn' : 'ok'),
    '</div>',
    renderSourceOperationsCockpitRows(queue),
    renderSourceOperationsCockpitNextActions(cockpit.nextActions || [])
  ].join('');
}

function renderSourceOperationsCockpitRows(queue) {
  if (!queue.length) return '<div class="muted">No operator queue items.</div>';
  return '<div class="source-work-list">' + queue.map(function (item) {
    const source = item.source || {};
    const sourceLabel = item.sourceType || source.sourceType || source.sourceKey || item.scope || 'source';
    const commands = [item.recommendedCommand].concat(item.relatedCommands || []).filter(Boolean).slice(0, 3);
    return '<div class="source-work-row ' + statusClassName(attentionStatusVariant(item.severity)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(sourceLabel) + '</span>' +
        '<strong>' + escapeHtml('#' + (item.rank || '?') + ' ' + (item.title || item.id || 'Queue item')) + '</strong>' +
        '<small>' + escapeHtml([item.kind, item.scope].filter(Boolean).join(' / ') || 'operator queue') + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(item.summary || item.recommendedNextAction || 'Review source operations before automation.') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('priority', item.priorityScore || 0, (item.priorityScore || 0) >= 100 ? 'warn' : 'info') +
          authorMetaChip('signals', item.signalCount === undefined ? 0 : item.signalCount, item.signalCount > 0 ? 'warn' : 'muted') +
          authorMetaChip('runnable', item.runnable ? 'yes' : 'no', item.runnable ? 'ok' : 'muted') +
          authorMetaChip('scope', item.scope, item.scope === 'source-type' ? 'info' : 'muted') +
        '</div>' +
        renderSourceCommandChips(commands) +
      '</section>' +
      '<section class="source-work-actions button-group source-op-buttons">' +
        renderSourceOperationsCockpitControls(item, source) +
        statusBadge(item.severity || 'info', attentionStatusVariant(item.severity)) +
      '</section>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceOperationsCockpitControls(item, source) {
  const planButton = '<button class="inline-button" type="button" data-action="load-source-cockpit-action-plan" data-rank="' + escapeHtml(item.rank || '') + '" data-item-id="' + escapeHtml(item.id || '') + '" data-source-id="' + escapeHtml(source && source.id || '') + '" data-source-key="' + escapeHtml(source && source.sourceKey || '') + '" data-source-type="' + escapeHtml(item.sourceType || source && source.sourceType || '') + '" data-limit="100" data-cockpit-limit="12">Plan</button>';
  if (item.scope === 'source-type' || item.sourceType) {
    return planButton + '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-type-drilldown" data-source-type="' + escapeHtml(item.sourceType || '') + '" data-limit="50" data-scan-limit="250">Ops</button>';
  }
  const hasSourceId = Boolean(source && source.id);
  const hasSourceScope = Boolean(source && (source.id || source.sourceKey));
  return [
    planButton,
    hasSourceScope ? renderSourceDrilldownButton(source || {}) : '',
    item.runnable && hasSourceId ? renderSourceRunButtons(source) : '',
    hasSourceId ? renderSourceFailureResetButtons(source) : ''
  ].join('');
}

function renderSourceOperationsCockpitNextActions(actions) {
  if (!actions.length) return '';
  return '<div class="tag-list reason-tags">' + evidenceList(actions.slice(0, 5).map(function (action) {
    return [action.severity || 'info', action.summary || action.key, action.recommendedCommand].filter(Boolean).join(' | ');
  })) + '</div>';
}

function renderSourceCockpitActionPlan(plan) {
  const summary = plan.summary || {};
  const item = plan.selectedItem || {};
  return [
    panel('Cockpit action plan', [
      '<div class="summary-strip">',
      summaryTile('Status', plan.status || 'unknown', statusVariant(plan.status === 'actionable' ? 'warn' : 'ok')),
      summaryTile('Actions', String(summary.actionCount || 0), (summary.actionCount || 0) > 0 ? 'ok' : 'muted'),
      summaryTile('Dry-run', String(summary.dryRunCount || 0), (summary.dryRunCount || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Execute', String(summary.executeCount || 0), (summary.executeCount || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Destructive', String(summary.destructiveCount || 0), (summary.destructiveCount || 0) > 0 ? 'fail' : 'ok'),
      '</div>',
      metric('Queue item', '#' + (item.rank || '?') + ' ' + (item.title || item.id || 'unknown')),
      metric('Kind', item.kind || 'unknown'),
      metric('Priority', item.priorityScore || 0),
      metric('Next', plan.recommendedNextAction || 'none')
    ].join(''), 'wide'),
    panel('Plan actions', renderSourceCockpitActionRows(plan.actions || [], item), 'wide')
  ].join('');
}

function renderSourceCockpitActionRows(actions, item) {
  if (!actions.length) return '<div class="muted">No cockpit actions are available.</div>';
  return actions.map(function (action) {
    const api = action.api || {};
    const details = [
      action.mode || 'manual',
      action.key || 'unknown',
      api.method && api.path ? api.method + ' ' + api.path : undefined,
      action.destructive ? 'destructive' : undefined,
      action.confirmationRequired ? 'confirmation' : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.label || action.key || 'Action') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      (action.command ? '<small>' + escapeHtml(action.command) + '</small>' : '') +
      '</span><span class="button-group source-op-buttons">' +
      renderSourceCockpitActionButton(action, item) +
      statusBadge(action.mode || 'manual', action.destructive ? 'fail' : (action.mode === 'execute' ? 'warn' : 'ok')) +
      '</span></div>';
  }).join('');
}

function renderSourceCockpitActionButton(action, item) {
  const source = item.source || {};
  const sourceId = escapeHtml(source.id || '');
  const sourceKey = escapeHtml(source.sourceKey || '');
  const sourceType = escapeHtml(item.sourceType || source.sourceType || '');
  if (action.key === 'source.drilldown') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-drilldown" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">Open</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-collection-health" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">Health</button>';
  }
  if (action.key === 'source.run-ingest') {
    return '<button class="inline-button" type="button" data-action="run-source" data-source-id="' + sourceId + '">Run</button>';
  }
  if (action.key === 'source.run-insight') {
    return '<button class="inline-button" type="button" data-action="run-source-pipeline" data-source-id="' + sourceId + '">Insight</button>';
  }
  if (action.key === 'source.failure-reset.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="reset-source-failure" data-source-id="' + sourceId + '" data-execute="false" data-retry-now="true">Preview</button>';
  }
  if (action.key === 'source.failure-reset.execute') {
    return '<button class="inline-button warning-inline-button" type="button" data-action="reset-source-failure" data-source-id="' + sourceId + '" data-execute="true" data-retry-now="true">Retry now</button>';
  }
  if (action.key === 'source.enable.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="true" data-execute="false">Preview</button>';
  }
  if (action.key === 'source.enable.execute') {
    return '<button class="inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="true" data-execute="true">Enable</button>';
  }
  if (action.key === 'source-attention.events.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-source-attention-events" data-execute="false" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="100" data-attention-limit="100" data-priority-score-threshold="70">Preview</button>';
  }
  if (action.key === 'runbook.events.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-runbook-events" data-execute="false" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="100">Preview</button>';
  }
  if (action.key === 'source-type.drilldown') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-type-drilldown" data-source-type="' + sourceType + '" data-limit="50" data-scan-limit="250">Open</button>';
  }
  if (action.key === 'source-type-operations.events.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-source-type-operations-events" data-execute="false" data-source-type="' + sourceType + '" data-limit="100" data-source-type-limit="100" data-attention-limit="100" data-priority-score-threshold="70">Preview</button>';
  }
  if (action.key === 'source-type.run-due-insight') {
    return '<button class="inline-button" type="button" data-action="run-due-pipelines" data-source-type="' + sourceType + '" data-limit="50" data-provider="mock">Run due</button>';
  }
  return '';
}

function renderSourceTypeOperations(report) {
  const summary = report.summary || {};
  return [
    '<div class="summary-strip">',
    summaryTile('Types', String(summary.sourceTypeCount || 0), (summary.failSourceTypeCount || 0) > 0 ? 'fail' : ((summary.warnSourceTypeCount || 0) > 0 ? 'warn' : 'ok')),
    summaryTile('Sources', String(summary.sourceCount || 0), (summary.sourceCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Due', String(summary.dueSourceCount || 0), (summary.dueSourceCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Running', String(summary.runningSourceCount || 0), (summary.runningSourceCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Retry wait', String(summary.failureRetryWaitingSourceCount || 0), (summary.failureRetryWaitingSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Attention', String(summary.attentionSourceCount || 0), (summary.warningAttentionSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Actionable', String(summary.actionableSourceCount || 0), (summary.actionableSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Top priority', String(summary.highestPriorityScore || 0), (summary.highestPriorityScore || 0) >= 100 ? 'warn' : 'ok'),
    '</div>',
    renderSourceTypeOperationsRows(report.sourceTypes || [])
  ].join('');
}

function renderSourceTypeOperationsRows(sourceTypes) {
  if (!sourceTypes.length) return '<div class="muted">No source type operations yet.</div>';
  return '<div class="source-work-list">' + sourceTypes.map(function (sourceType) {
    const readiness = sourceType.readiness || {};
    const schedule = sourceType.schedule || {};
    const lifecycle = sourceType.lifecycle || {};
    const attention = sourceType.attention || {};
    const commands = sourceType.recommendedCommands || [];
    const actions = '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-type-drilldown" data-source-type="' + escapeHtml(sourceType.sourceType || '') + '" data-limit="50" data-scan-limit="250">Ops</button>';
    return '<div class="source-work-row source-type-work-row ' + statusClassName(statusVariant(sourceType.status)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">source-type</span>' +
        '<strong>' + escapeHtml(sourceType.sourceType || 'unknown') + '</strong>' +
        '<small>' + escapeHtml('readiness=' + (readiness.status || 'unknown')) + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(sourceType.recommendedNextAction || 'Review this source type family and keep connector readiness clear.') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('sources', readiness.sourceCount || lifecycle.total || schedule.total || 0, 'info') +
          authorMetaChip('enabled', readiness.enabledSourceCount || lifecycle.enabled || 0, 'ok') +
          authorMetaChip('due', schedule.due || 0, (schedule.due || 0) > 0 ? 'warn' : 'muted') +
          authorMetaChip('running', lifecycle.running || 0, (lifecycle.running || 0) > 0 ? 'ok' : 'muted') +
          authorMetaChip('retry', lifecycle.failureRetryWaiting || 0, (lifecycle.failureRetryWaiting || 0) > 0 ? 'warn' : 'muted') +
          authorMetaChip('attention', attention.total || 0, (attention.total || 0) > 0 ? 'warn' : 'muted') +
          authorMetaChip('priority', attention.highestPriorityScore || 0, (attention.highestPriorityScore || 0) >= 100 ? 'warn' : 'info') +
        '</div>' +
        renderSourceCommandChips(commands.slice(0, 3)) +
      '</section>' +
      '<section class="source-work-actions button-group source-op-buttons">' +
        actions +
        statusBadge(sourceType.status || 'unknown', statusVariant(sourceType.status)) +
      '</section>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceTypeReadiness(report) {
  const summary = report.summary || {};
  const panels = [
    '<div class="summary-strip">',
    summaryTile('Types', String(summary.sourceTypeCount || 0), (summary.failSourceTypeCount || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('Ready', String(summary.readySourceTypeCount || 0), (summary.readySourceTypeCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Warn', String(summary.warnSourceTypeCount || 0), (summary.warnSourceTypeCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Fail', String(summary.failSourceTypeCount || 0), (summary.failSourceTypeCount || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('Unknown', String(summary.unknownSourceTypeCount || 0), (summary.unknownSourceTypeCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Sources', String(summary.sourceCount || 0), (summary.sourceCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Enabled', String(summary.enabledSourceCount || 0), (summary.enabledSourceCount || 0) > 0 ? 'ok' : 'muted'),
    '</div>',
    renderSourceTypeReadinessRows(report.sourceTypes || []),
    renderSourceTypeReadinessUnknownRows(report.unknownSourceTypes || [])
  ];
  if ((report.nextActions || []).length > 0) {
    panels.push('<div class="tag-list reason-tags">' + evidenceList(report.nextActions.slice(0, 10).map(function (action) {
      return action.severity + ' | ' + action.summary;
    })) + '</div>');
  }
  return panels.join('');
}

function renderSourceTypeReadinessRows(sourceTypes) {
  if (!sourceTypes.length) return '<div class="muted">No registered source types.</div>';
  return '<div class="source-work-list">' + sourceTypes.map(function (sourceType) {
    const compatible = sourceType.compatibleSourceKeys && sourceType.compatibleSourceKeys.length ? sourceType.compatibleSourceKeys.join(', ') : 'none';
    const checks = (sourceType.checks || []).slice(0, 4);
    return '<div class="source-work-row source-readiness-row ' + statusClassName(statusVariant(sourceType.status)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">connector</span>' +
        '<strong>' + escapeHtml(sourceType.sourceType || 'unknown') + '</strong>' +
        '<small>' + escapeHtml(compatible === 'none' ? 'no compatible sources' : 'compatible=' + compatible) + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(sourceType.description || 'Connector readiness profile.') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('sources', sourceType.sourceCount || 0, (sourceType.sourceCount || 0) > 0 ? 'info' : 'muted') +
          authorMetaChip('enabled', sourceType.enabledSourceCount || 0, (sourceType.enabledSourceCount || 0) > 0 ? 'ok' : 'muted') +
          authorMetaChip('checks', (sourceType.checks || []).length, 'info') +
        '</div>' +
        '<div class="source-work-checks">' + checks.map(function (check) {
          return '<span class="' + statusClassName(statusVariant(check.status)) + '">' + escapeHtml((check.status || 'unknown') + ' | ' + (check.key || 'check') + ' | ' + (check.summary || '')) + '</span>';
        }).join('') + '</div>' +
      '</section>' +
      '<section class="source-work-actions button-group source-op-buttons">' +
        statusBadge(sourceType.status || 'unknown', statusVariant(sourceType.status)) +
      '</section>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceTypeReadinessUnknownRows(sourceTypes) {
  if (!sourceTypes.length) return '';
  return '<div class="tag-list reason-tags">' + evidenceList(sourceTypes.map(function (sourceType) {
    return 'unknown | ' + sourceType.sourceType + ' | sources=' + sourceType.sourceCount + ' | enabled=' + sourceType.enabledSourceCount;
  })) + '</div>';
}

function buildSourceAttention(result) {
  const safeResult = result || {};
  const schedule = safeResult.schedule || {};
  const lifecycle = safeResult.lifecycle || {};
  const runbook = safeResult.runbook || {};
  const attentionBySource = new Map();

  (schedule.dueSources || []).forEach(function (source) {
    addSourceAttention(attentionBySource, source, {
      severity: 'info',
      label: 'due',
      summary: 'Scheduled source work is due now.',
      reason: source.decision && source.decision.reason,
      runnable: true
    });
  });

  (schedule.skippedSources || []).forEach(function (source) {
    const decision = source.decision || {};
    if (decision.reason !== 'waiting-failure-backoff') return;
    addSourceAttention(attentionBySource, source, {
      severity: 'warning',
      label: 'retry wait',
      summary: 'Failed source is waiting for retry backoff.',
      reason: decision.reason,
      retryAt: decision.retryAt,
      backoffMs: decision.backoffMs
    });
  });

  (lifecycle.sources || []).forEach(function (source) {
    const guard = source.disableGuard || {};
    const retry = source.failureRetry || {};
    if (guard.blocked) {
      addSourceAttention(attentionBySource, source, {
        severity: 'warning',
        label: 'disable blocked',
        summary: 'Disable is blocked by an active source run.',
        action: source.nextAction
      });
    }
    if (guard.stale) {
      addSourceAttention(attentionBySource, source, {
        severity: 'warning',
        label: 'stale run',
        summary: 'Source run looks stale and needs operator review.',
        action: source.nextAction
      });
    }
    if (retry.active && !retry.elapsed) {
      addSourceAttention(attentionBySource, source, {
        severity: 'warning',
        label: 'retry wait',
        summary: 'Failure retry window has not elapsed.',
        action: source.nextAction,
        retryAt: retry.retryAt,
        backoffMs: retry.backoffMs
      });
    }
    if (source.enabled === false) {
      addSourceAttention(attentionBySource, source, {
        severity: 'muted',
        label: 'disabled',
        summary: 'Source is disabled.',
        action: source.nextAction
      });
    }
  });

  (runbook.actions || []).filter(function (action) {
    return action.area === 'sources';
  }).forEach(function (action) {
    const evidence = action.evidence || {};
    addSourceAttention(attentionBySource, {
      id: evidence.sourceId,
      sourceKey: evidence.sourceKey,
      displayName: evidence.sourceName || evidence.displayName || evidence.sourceId || evidence.sourceKey
    }, {
      severity: action.severity || 'warning',
      label: 'runbook',
      summary: action.title || action.summary || 'Source runbook action requires attention.',
      command: action.recommendedCommand
    });
  });

  return Array.from(attentionBySource.values())
    .map(finalizeWebSourceAttention)
    .sort(compareSourceAttention)
    .slice(0, 12)
    .map(function (item, index) {
      return Object.assign({}, item, {
        attentionRank: item.attentionRank || index + 1
      });
    });
}

function addSourceAttention(map, source, signal) {
  const key = sourceAttentionKey(source, signal);
  if (!key) return;
  let item = map.get(key);
  if (!item) {
    item = {
      key,
      source: normalizeAttentionSource(source),
      severity: 'muted',
      signals: [],
      runnable: false,
      commands: []
    };
    map.set(key, item);
  } else {
    item.source = mergeAttentionSource(item.source, source);
  }
  item.severity = higherAttentionSeverity(item.severity, signal.severity);
  item.runnable = item.runnable || signal.runnable === true;
  if (signal.command) item.commands.push(signal.command);
  item.signals.push({
    severity: signal.severity || 'info',
    label: signal.label || 'attention',
    summary: signal.summary,
    reason: signal.reason,
    action: signal.action,
    retryAt: signal.retryAt,
    backoffMs: signal.backoffMs
  });
}

function sourceAttentionKey(source, signal) {
  const safeSource = source || {};
  return safeSource.id || safeSource.sourceId || safeSource.sourceKey || signal && signal.label;
}

function normalizeAttentionSource(source) {
  const safeSource = source || {};
  return {
    id: safeSource.id || safeSource.sourceId,
    sourceKey: safeSource.sourceKey,
    sourceType: safeSource.sourceType,
    displayName: safeSource.displayName,
    enabled: safeSource.enabled,
    runState: safeSource.runState,
    disableGuard: safeSource.disableGuard,
    failureRetry: safeSource.failureRetry,
    nextAction: safeSource.nextAction,
    recommendedCommands: safeSource.recommendedCommands
  };
}

function mergeAttentionSource(current, next) {
  const normalized = normalizeAttentionSource(next);
  return Object.assign({}, current, Object.keys(normalized).reduce(function (result, key) {
    if (normalized[key] !== undefined) result[key] = normalized[key];
    return result;
  }, {}));
}

function higherAttentionSeverity(left, right) {
  return attentionSeverityRank(right) > attentionSeverityRank(left) ? right : left;
}

function attentionSeverityRank(severity) {
  const ranks = {
    critical: 4,
    warning: 3,
    warn: 3,
    info: 2,
    ok: 1,
    muted: 0
  };
  return ranks[severity] === undefined ? 2 : ranks[severity];
}

function compareSourceAttention(left, right) {
  const scoreDiff = (right.priorityScore || 0) - (left.priorityScore || 0);
  if (scoreDiff !== 0) return scoreDiff;
  const signalDiff = (right.signals || []).length - (left.signals || []).length;
  if (signalDiff !== 0) return signalDiff;
  const severityDiff = attentionSeverityRank(right.severity) - attentionSeverityRank(left.severity);
  if (severityDiff !== 0) return severityDiff;
  return String(left.source.displayName || left.source.id || left.source.sourceKey || '').localeCompare(String(right.source.displayName || right.source.id || right.source.sourceKey || ''));
}

function renderSourceAttentionRows(items) {
  if (!items || items.length === 0) return '<div class="muted">No source attention needed.</div>';
  return '<div class="source-work-list">' + items.map(function (item) {
    const source = item.source || {};
    const runState = source.runState || {};
    const priorityScore = item.priorityScore === undefined ? scoreWebSourceAttention(item) : item.priorityScore;
    const signalLabels = uniqueText((item.signals || []).map(function (signal) {
      return signal.label;
    })).join(' + ');
    const canRunSourceActions = Boolean(source.id);
    const controls = '<section class="source-work-actions button-group source-op-buttons source-attention-controls">' +
      (item.attentionRank ? statusBadge('#' + item.attentionRank, attentionStatusVariant(item.severity)) : '') +
      statusBadge(signalLabels || item.severity || 'attention', attentionStatusVariant(item.severity)) +
      renderSourceDrilldownButton(source) +
      (item.runnable && canRunSourceActions ? renderSourceRunButtons(source) : '') +
      (canRunSourceActions ? renderSourceEnablementButtons(source) : '') +
      (canRunSourceActions ? renderSourceFailureResetButtons(source) : '') +
      '</section>';
    return '<div class="source-work-row source-attention-work-row ' + statusClassName(attentionStatusVariant(item.severity)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(source.sourceType || source.sourceKey || 'source') + '</span>' +
        '<strong>' + escapeHtml(source.displayName || source.id || source.sourceKey || 'Unknown source') + '</strong>' +
        '<small>' + escapeHtml(source.id || source.sourceKey || item.key || 'unknown scope') + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(item.recommendedNextAction || item.nextAction || 'Review source attention before automation.') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('priority', priorityScore, priorityScore >= 100 ? 'warn' : 'info') +
          authorMetaChip('run', runState.status || 'unknown', statusVariant(runState.status)) +
          authorMetaChip('signals', (item.signals || []).length, (item.signals || []).length > 0 ? 'warn' : 'muted') +
          authorMetaChip('commands', item.commands && item.commands.length || 0, item.commands && item.commands.length ? 'info' : 'muted') +
        '</div>' +
        renderSourceAttentionSignalRows(item.signals || []) +
        renderSourceCommandChips(item.commands || []) +
      '</section>' +
      controls +
      '</div>';
  }).join('') + '</div>';
}

function finalizeWebSourceAttention(item) {
  const commands = uniqueText(item.commands || []);
  const recommendedCommand = commands[0] || firstText(item.source && item.source.recommendedCommands);
  const recommendedNextAction = item.source && item.source.nextAction || firstText((item.signals || []).map(function (signal) {
    return signal.action;
  }));
  return Object.assign({}, item, {
    signalCount: (item.signals || []).length,
    priorityScore: scoreWebSourceAttention(item, commands, recommendedCommand, recommendedNextAction),
    commands,
    recommendedCommand,
    recommendedNextAction
  });
}

function scoreWebSourceAttention(item, commands, recommendedCommand, recommendedNextAction) {
  const safeCommands = commands || item.commands || [];
  const signalCount = (item.signals || []).length;
  const severityBase = {
    critical: 120,
    warning: 70,
    warn: 70,
    info: 30,
    ok: 5,
    muted: 0
  }[item.severity] || 30;
  return severityBase +
    Math.min(signalCount * 8, 32) +
    (item.runnable ? 10 : 0) +
    Math.min(safeCommands.length * 4, 12) +
    (recommendedCommand || item.recommendedCommand ? 6 : 0) +
    (recommendedNextAction || item.recommendedNextAction || item.nextAction ? 6 : 0);
}

function attentionSignalDetail(signals) {
  const details = [];
  (signals || []).forEach(function (signal) {
    if (signal.reason) details.push('reason=' + signal.reason);
    if (signal.action) details.push('action=' + signal.action);
    if (signal.retryAt) details.push('retry=' + signal.retryAt);
    if (signal.backoffMs) details.push('backoff=' + formatDurationMs(signal.backoffMs));
  });
  return uniqueText(details).slice(0, 4).join(' | ');
}

function renderSourceAttentionSignalRows(signals) {
  return (signals || []).slice(0, 4).map(function (signal) {
    return '<small class="source-attention-signal">' +
      escapeHtml((signal.label || 'attention') + ': ' + (signal.summary || 'Review this source.')) +
      '</small>';
  }).join('');
}

function attentionStatusVariant(severity) {
  if (severity === 'critical') return 'fail';
  if (severity === 'warning' || severity === 'warn') return 'warn';
  if (severity === 'muted') return 'muted';
  return 'ok';
}

function uniqueText(items) {
  const seen = new Set();
  return (items || []).filter(function (item) {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function firstText(items) {
  return (items || []).find(function (item) {
    return typeof item === 'string' && item.length > 0;
  });
}

function renderSourceCollectionHealthProfile(profile) {
  const automation = profile.automation || {};
  const schedule = automation.schedule || {};
  const incremental = profile.incremental || {};
  const cursor = incremental.cursor || {};
  const diff = incremental.incremental || {};
  const replay = profile.replay || {};
  const operations = profile.operations || {};
  const workers = operations.workers || { runs: {}, leases: {} };
  return [
    panel('Source collection health', [
      '<div class="summary-strip">',
      summaryTile('Status', profile.status || 'unknown', statusVariant(profile.status)),
      summaryTile('Automation', automation.status || 'unknown', collectionStatusVariant(automation.status)),
      summaryTile('Due', schedule.due ? 'yes' : 'no', schedule.due ? 'warn' : 'ok'),
      summaryTile('Cursor', cursor.present ? 'yes' : 'no', cursor.present ? 'ok' : 'warn'),
      summaryTile('Replay', replay.available ? 'yes' : 'no', replay.available ? 'ok' : 'warn'),
      summaryTile('Stale runs', String(workers.runs && workers.runs.stale || 0), workers.runs && workers.runs.stale > 0 ? 'fail' : 'ok'),
      '</div>',
      metric('Source', [profile.source && profile.source.displayName, profile.source && profile.source.id, profile.source && profile.source.sourceKey, profile.source && profile.source.sourceType].filter(Boolean).join(' | ') || 'unknown'),
      metric('Schedule', ['reason=' + (schedule.reason || 'unknown'), schedule.nextRunAt ? 'next=' + schedule.nextRunAt : undefined, schedule.retryAt ? 'retry=' + schedule.retryAt : undefined].filter(Boolean).join(' | ')),
      metric('Incremental', ['changed=' + String(diff.lastChanged), 'newPosts=' + (diff.newPostCount || 0), 'nextPosts=' + (diff.nextPostCount || 0)].join(' | ')),
      metric('Replay evidence', [(replay.evidenceKinds || []).join(',') || 'none', 'rawPages=' + (replay.rawPageHashCount || 0), replay.taskId ? 'task=' + replay.taskId : undefined].filter(Boolean).join(' | ')),
      metric('Operations', ['tasksFailed=' + (operations.tasks && operations.tasks.failed || 0), 'eventsOpen=' + (operations.events && operations.events.unacknowledged || 0), 'eventsFailed=' + (operations.events && operations.events.failed || 0), 'timeline=' + (operations.timelineCount || 0)].join(' | '))
    ].join(''), 'wide'),
    panel('Collection health checks', evidenceList((profile.checks || []).map(function (check) {
      return check.status + ' | ' + check.area + ' | ' + check.key + ' | ' + check.summary + ' | ' + check.value;
    })), 'wide'),
    panel('Collection health actions', evidenceList((profile.nextActions || []).map(function (action) {
      return (action.severity || 'info') + ' | ' + (action.key || 'action') + ' | ' + (action.summary || '') + ' | ' + (action.recommendedCommand || (action.commands || []).join(' | '));
    })), 'wide')
  ].join('');
}

function renderSourceOperationsDrilldown(report) {
  const health = report.health || {};
  const source = report.source || {};
  const sourceHealth = health.source || {};
  const tasks = health.tasks || {};
  const events = health.events || {};
  const workers = health.workers || {};
  const workerRuns = workers.runs || {};
  const workerLeases = workers.leases || {};
  const authorQueue = health.authorReviewQueue || {};
  const reviewActions = health.reviewActions || {};
  const reviewExecutions = reviewActions.executions || {};
  const eventActions = health.notificationEventActions || {};
  const collectionPlan = report.collectionPlan || {};
  const attention = report.attention || {};
  const recent = report.recent || {};
  const scope = report.scope || {};
  return [
    panel('Source ops drill-down', [
      '<div class="summary-strip">',
      summaryTile('Status', report.status || 'unknown', statusVariant(report.status)),
      summaryTile('Source', sourceHealth.status || (report.sourceFound ? 'found' : 'missing'), statusVariant(report.sourceFound ? report.status : 'warn')),
      summaryTile('Collection', collectionPlan.status || 'unknown', collectionStatusVariant(collectionPlan.status)),
      summaryTile('Tasks failed', String(tasks.failed || 0), (tasks.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Events failed', String(events.failed || 0), (events.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Stale runs', String(workerRuns.stale || 0), (workerRuns.stale || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Expired leases', String(workerLeases.expired || 0), (workerLeases.expired || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Review stale', String(reviewExecutions.staleRunning || 0), (reviewExecutions.staleRunning || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Event action stale', String(eventActions.staleRunning || 0), (eventActions.staleRunning || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Queue high', String(authorQueue.highPriorityOpenCount || 0), (authorQueue.highPriorityOpenCount || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Attention', attention.found ? ('#' + (attention.attentionRank || '?') + ' · ' + (attention.priorityScore || 0)) : 'none', attentionStatusVariant(attention.severity)),
      '</div>',
      metric('Scope', formatEventSourceScope(scope)),
      metric('Source', [source.displayName, source.id, source.sourceKey, source.sourceType].filter(Boolean).join(' | ') || 'not found'),
      metric('Collection plan', formatCollectionPlanSummary(collectionPlan)),
      metric('Cursor', formatCollectionCursorSummary(collectionPlan.cursor)),
      metric('Replay evidence', formatCollectionReplaySummary(collectionPlan.replay)),
      metric('Attention', attention.found ? [(attention.severity || 'info'), 'score ' + (attention.priorityScore || 0), 'signals ' + (attention.signalCount || 0), attention.recommendedNextAction || attention.recommendedCommand].filter(Boolean).join(' | ') : 'none'),
      attention.recommendedCommand ? metric('Attention command', attention.recommendedCommand) : '',
      metric('Schedule', sourceHealth.schedule ? ((sourceHealth.schedule.due ? 'due' : 'skip') + ' | ' + (sourceHealth.schedule.reason || 'unknown')) : 'unknown'),
      metric('Worker types', compactCountMap(workerRuns.byWorkerType)),
      metric('Lease types', compactCountMap(workerLeases.byWorkerType)),
      metric('Tasks', 'total ' + (tasks.total || 0) + ' | running ' + (tasks.running || 0) + ' | failed ' + (tasks.failed || 0)),
      metric('Events', 'open ' + (events.unacknowledged || 0) + ' | pending ' + (events.pending || 0) + ' | due ' + (events.dueForDelivery || 0)),
      metric('Review actions', 'audits ' + (reviewActions.auditCount || 0) + ' | executions ' + (reviewExecutions.count || 0) + ' | failed ' + (reviewExecutions.failed || 0)),
      metric('Event actions', 'executions ' + (eventActions.count || 0) + ' | running ' + (eventActions.running || 0) + ' | failed ' + (eventActions.failed || 0)),
      metric('Author queue', 'open ' + (authorQueue.openCount || 0) + ' | high ' + (authorQueue.highPriorityOpenCount || 0))
    ].join(''), 'wide'),
    panel('Source health brief', renderSourceHealthBrief(report), 'wide'),
    panel('Source collection plan', renderCollectionPlanDetails(collectionPlan), 'wide'),
    panel('Source attention details', renderSourceDrilldownAttention(attention), 'wide'),
    panel('Source next actions', renderSourceDrilldownActions(report.nextActions || []), 'wide'),
    panel('Source operations timeline', evidenceList((report.timeline || []).map(formatSourceTimelineRow)), 'wide'),
    panel('Recent source tasks', evidenceList((recent.tasks || []).map(formatSourceDrilldownTaskRow)), 'wide'),
    panel('Recent source events', evidenceList((recent.events || []).map(formatSourceDrilldownEventRow)), 'wide'),
    panel('Recent source workers', evidenceList((recent.workerRuns || []).map(formatWorkerRunRow).concat((recent.workerLeases || []).map(formatWorkerLeaseRow))), 'wide')
  ].join('');
}

function renderSourceTypeOperationsDrilldown(report) {
  const health = report.health || {};
  const sources = health.sources || {};
  const tasks = health.tasks || {};
  const events = health.events || {};
  const workers = health.workers || {};
  const workerRuns = workers.runs || {};
  const workerLeases = workers.leases || {};
  const operations = health.operations || {};
  const recent = report.recent || {};
  const scope = report.scope || {};
  return [
    panel('Source type ops drill-down', [
      '<div class="summary-strip">',
      summaryTile('Status', report.status || 'unknown', statusVariant(report.status)),
      summaryTile('Type', report.sourceType || 'unknown', statusVariant(report.status)),
      summaryTile('Sources', String(sources.total || 0), (sources.total || 0) > 0 ? 'ok' : 'muted'),
      summaryTile('Due', String(sources.due || 0), (sources.due || 0) > 0 ? 'ok' : 'muted'),
      summaryTile('Failed', String(sources.failed || 0), (sources.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Tasks failed', String(tasks.failed || 0), (tasks.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Events failed', String(events.failed || 0), (events.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Stale runs', String(workerRuns.stale || 0), (workerRuns.stale || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Expired leases', String(workerLeases.expired || 0), (workerLeases.expired || 0) > 0 ? 'warn' : 'ok'),
      '</div>',
      metric('Scope', [
        'type=' + (scope.sourceType || report.sourceType || 'unknown'),
        'sources=' + ((scope.sourceIds || []).length),
        'sourceKeys=' + (scope.sourceKeys || []).join(',')
      ].join(' | ')),
      metric('Operations', [
        'found=' + Boolean(operations.found),
        'status=' + (operations.status || 'unknown'),
        'attention=' + (operations.attention && operations.attention.total || 0),
        'priority=' + (operations.attention && operations.attention.highestPriorityScore || 0)
      ].join(' | ')),
      metric('Run statuses', compactCountMap(sources.byRunStatus)),
      metric('Schedule reasons', compactCountMap(sources.byScheduleReason)),
      metric('Event types', compactCountMap(events.byType)),
      metric('Worker types', compactCountMap(workerRuns.byWorkerType))
    ].join(''), 'wide'),
    panel('Source type next actions', renderSourceDrilldownActions(report.nextActions || []), 'wide'),
    panel('Recent source type sources', evidenceList((recent.sources || []).map(formatSourceTypeDrilldownSourceRow)), 'wide'),
    panel('Recent source type tasks', evidenceList((recent.tasks || []).map(formatSourceDrilldownTaskRow)), 'wide'),
    panel('Recent source type events', evidenceList((recent.events || []).map(formatSourceDrilldownEventRow)), 'wide'),
    panel('Recent source type workers', evidenceList((recent.workerRuns || []).map(formatWorkerRunRow).concat((recent.workerLeases || []).map(formatWorkerLeaseRow))), 'wide')
  ].join('');
}

function renderSourceHealthBrief(report) {
  const health = report.health || {};
  const sourceHealth = health.source || {};
  const workers = health.workers || {};
  const workerRuns = workers.runs || {};
  const workerLeases = workers.leases || {};
  const collectionPlan = report.collectionPlan || {};
  const recent = report.recent || {};
  const topAction = (report.nextActions || [])[0];
  const latestTask = firstValue(health.tasks && health.tasks.latest, (recent.tasks || [])[0]);
  const latestEvent = firstValue(health.events && health.events.latest, (recent.events || [])[0]);
  const latestWorkerRun = firstValue(workerRuns.latest, (recent.workerRuns || [])[0]);
  const latestLease = firstValue(workerLeases.latest, (recent.workerLeases || [])[0]);
  const schedule = sourceHealth.schedule || collectionPlan.schedule && collectionPlan.schedule.decision || {};
  const briefRows = [
    renderSourceBriefRow('Why', sourceProblemSummary(report), report.status),
    renderSourceBriefRow('Next action', topAction ? ((topAction.summary || topAction.key || 'Review source') + (topAction.recommendedCommand ? ' | ' + topAction.recommendedCommand : '')) : 'No source-specific action.', topAction && topAction.severity || 'ok'),
    renderSourceBriefRow('Schedule', formatSourceScheduleBrief(schedule), schedule.due ? 'ok' : 'muted'),
    renderSourceBriefRow('Latest task', formatLatestTaskBrief(latestTask), latestTask && latestTask.status),
    renderSourceBriefRow('Latest event', formatLatestEventBrief(latestEvent), latestEvent && (latestEvent.deliveryStatus || latestEvent.severity)),
    renderSourceBriefRow('Latest worker', formatLatestWorkerBrief(latestWorkerRun, latestLease), latestWorkerRun && latestWorkerRun.status || latestLease && (latestLease.expired ? 'warning' : 'ok'))
  ];
  return briefRows.join('');
}

function renderSourceBriefRow(label, value, status) {
  return '<div class="source-brief-row ' + statusClassName(sourceBriefStatusVariant(status)) + '">' +
    '<section>' +
      '<span>' + escapeHtml(label) + '</span>' +
      '<strong>' + escapeHtml(value || 'none') + '</strong>' +
    '</section>' +
    statusBadge(status || 'info', sourceBriefStatusVariant(status)) +
    '</div>';
}

function sourceProblemSummary(report) {
  const health = report.health || {};
  const tasks = health.tasks || {};
  const events = health.events || {};
  const workers = health.workers || {};
  const workerRuns = workers.runs || {};
  const workerLeases = workers.leases || {};
  const authorQueue = health.authorReviewQueue || {};
  const eventActions = health.notificationEventActions || {};
  const action = (report.nextActions || [])[0];
  if (!report.sourceFound) return 'Source registration is missing or ambiguous.';
  if (action && action.summary) return action.summary;
  if ((workerRuns.stale || 0) > 0) return 'Source-scoped worker runs are stale.';
  if ((workerLeases.expired || 0) > 0) return 'Source-scoped worker leases are expired.';
  if ((tasks.failed || 0) > 0) return 'Recent source tasks failed.';
  if ((events.failed || 0) > 0) return 'Recent notification events failed.';
  if ((eventActions.failed || 0) > 0 || (eventActions.staleRunning || 0) > 0) return 'Notification event actions need attention.';
  if ((authorQueue.highPriorityOpenCount || 0) > 0) return 'High-priority author review items are open.';
  if (report.status === 'ok') return 'Source is healthy in the current window.';
  return 'Review source health details.';
}

function formatSourceScheduleBrief(schedule) {
  const safeSchedule = schedule || {};
  const parts = [
    safeSchedule.due ? 'due now' : 'not due',
    safeSchedule.reason || safeSchedule.baseReason,
    safeSchedule.nextRunAt ? 'next=' + safeSchedule.nextRunAt : undefined,
    safeSchedule.retryAt ? 'retry=' + safeSchedule.retryAt : undefined,
    safeSchedule.failureCount ? 'failures=' + safeSchedule.failureCount : undefined,
    safeSchedule.backoffMs ? 'backoff=' + formatDurationMs(safeSchedule.backoffMs) : undefined
  ];
  return parts.filter(Boolean).join(' | ') || 'unknown schedule';
}

function formatLatestTaskBrief(task) {
  if (!task) return 'No recent source task.';
  return [
    task.status || 'unknown',
    task.type || 'task',
    task.finishedAt || task.updatedAt || task.createdAt || 'unknown-time',
    task.error && task.error.message || task.id
  ].filter(Boolean).join(' | ');
}

function formatLatestEventBrief(event) {
  if (!event) return 'No recent source event.';
  return [
    event.deliveryStatus || event.severity || 'unknown',
    event.type || 'event',
    event.nextDeliveryAt || event.createdAt || 'unknown-time',
    event.title || event.summary || event.id
  ].filter(Boolean).join(' | ');
}

function formatLatestWorkerBrief(run, lease) {
  const runPart = run ? [
    'run=' + (run.status || 'unknown'),
    run.workerType || 'worker',
    run.heartbeatAt || run.finishedAt || run.updatedAt || run.startedAt
  ].filter(Boolean).join('/') : 'run=none';
  const leasePart = lease ? [
    'lease=' + (lease.expired ? 'expired' : 'active'),
    lease.workerType || 'worker',
    lease.expiresAt || lease.updatedAt || lease.acquiredAt
  ].filter(Boolean).join('/') : 'lease=none';
  return runPart + ' | ' + leasePart;
}

function sourceBriefStatusVariant(status) {
  if (status === 'critical' || status === 'failed' || status === 'fail') return 'fail';
  if (status === 'warning' || status === 'warn' || status === 'stale' || status === 'expired') return 'warn';
  if (status === 'ok' || status === 'completed' || status === 'delivered' || status === true) return 'ok';
  if (status === 'running' || status === 'pending' || status === 'due') return 'warn';
  return statusVariant(status);
}

function firstValue() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (arguments[index]) return arguments[index];
  }
  return undefined;
}

function formatSourceTypeDrilldownSourceRow(source) {
  const schedule = source.schedule || {};
  const runState = source.runState || {};
  return [
    source.id || 'unknown-source',
    source.sourceKey || 'unknown-key',
    source.enabled === false ? 'disabled' : 'enabled',
    'run=' + (runState.status || 'unknown'),
    'due=' + Boolean(schedule.due),
    'reason=' + (schedule.reason || 'unknown')
  ].join(' | ');
}

function renderSourceDrilldownAttention(attention) {
  if (!attention || !attention.found) return '<div class="muted">No source attention item for this scope.</div>';
  const lines = [
    'rank #' + (attention.attentionRank || '?') + ' | priority=' + (attention.priorityScore || 0) + ' | severity=' + (attention.severity || 'info'),
    attention.recommendedNextAction ? 'next=' + attention.recommendedNextAction : undefined,
    attention.recommendedCommand ? 'command=' + attention.recommendedCommand : undefined
  ].filter(Boolean);
  return '<div class="source-work-row source-attention-work-row ' + statusClassName(attentionStatusVariant(attention.severity)) + '">' +
    '<section class="source-work-anchor">' +
      '<span class="source-work-scope">attention</span>' +
      '<strong>' + escapeHtml((attention.severity || 'info') + ' | source attention') + '</strong>' +
      '<small>' + escapeHtml('rank #' + (attention.attentionRank || '?')) + '</small>' +
    '</section>' +
    '<section class="source-work-brief">' +
      '<p>' + escapeHtml(attention.recommendedNextAction || 'Review this source attention item.') + '</p>' +
      '<div class="source-work-chips">' +
        authorMetaChip('priority', attention.priorityScore || 0, (attention.priorityScore || 0) >= 100 ? 'warn' : 'info') +
        authorMetaChip('signals', attention.signalCount || (attention.signals || []).length || 0, 'warn') +
      '</div>' +
      lines.map(function (line) { return '<small class="source-attention-signal">' + escapeHtml(line) + '</small>'; }).join('') +
      renderSourceAttentionSignalRows(attention.signals || []) +
    '</section>' +
    '<section class="source-work-actions button-group source-op-buttons">' +
      statusBadge('#' + (attention.attentionRank || '?'), attentionStatusVariant(attention.severity)) +
    '</section>' +
    '</div>';
}

function renderSourceDrilldownActions(actions) {
  if (!actions.length) return '<div class="muted">No source-specific actions.</div>';
  return '<div class="source-work-list">' + actions.map(function (action) {
    return '<div class="source-work-row source-action-row ' + statusClassName(action.severity === 'critical' ? 'warn' : statusVariant(action.severity)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(action.severity || 'info') + '</span>' +
        '<strong>' + escapeHtml(action.key || 'action') + '</strong>' +
        '<small>' + escapeHtml(action.mode || 'recommended') + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(action.summary || 'Review source action.') + '</p>' +
        renderSourceCommandChips([action.recommendedCommand].filter(Boolean).concat(action.commands || [])) +
      '</section>' +
      '<section class="source-work-actions button-group source-op-buttons">' +
        statusBadge(action.severity || 'info', action.severity === 'critical' ? 'warn' : statusVariant(action.severity)) +
      '</section>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceCommandChips(commands) {
  const safeCommands = uniqueText(commands || []).slice(0, 3);
  if (!safeCommands.length) return '';
  return '<div class="source-command-chips">' + safeCommands.map(function (command) {
    return '<span>' + escapeHtml(command) + '</span>';
  }).join('') + '</div>';
}

function formatSourceDrilldownTaskRow(task) {
  return [
    task.status || 'unknown-status',
    task.type || 'unknown-task',
    task.sourceId || task.sourceKey || 'unknown-source',
    task.updatedAt || task.createdAt || 'unknown-time',
    task.error && task.error.message ? task.error.message : task.id || 'unknown-task-id'
  ].join(' | ');
}

function formatSourceDrilldownEventRow(event) {
  return [
    event.deliveryStatus || 'unknown-delivery',
    event.type || 'event',
    event.sourceId || event.sourceKey || 'unknown-source',
    event.nextDeliveryAt || event.createdAt || 'unknown-time',
    event.title || event.summary || event.id || 'unknown-event'
  ].join(' | ');
}

function formatSourceTimelineRow(item) {
  return [
    item.timestamp || 'unknown-time',
    item.severity || 'info',
    item.kind || 'item',
    item.status || 'unknown-status',
    item.title || item.reference || item.id || 'unknown',
    item.sourceId || item.sourceKey || 'unknown-source',
    item.summary || item.reference || item.id || ''
  ].filter(Boolean).join(' | ');
}

function renderRunbookEventControls(alertableCount) {
  const disabled = alertableCount > 0 ? '' : ' disabled';
  return '<div class="action-row ops-row"><span>' +
    '<strong>Runbook alerts</strong>' +
    '<small>' + escapeHtml('alertable=' + alertableCount) + '</small>' +
    '</span>' +
    '<span class="button-group source-op-buttons">' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-runbook-events" data-execute="false" data-limit="100">Runbook check</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-runbook-events" data-execute="true" data-limit="100"' + disabled + '>Create alerts</button>' +
    '</span></div>';
}

function renderSourceAttentionEventControls(alertableCount) {
  const disabled = alertableCount > 0 ? '' : ' disabled';
  return '<div class="action-row ops-row"><span>' +
    '<strong>Source attention alerts</strong>' +
    '<small>' + escapeHtml('alertable=' + alertableCount + ' | threshold=70') + '</small>' +
    '</span>' +
    '<span class="button-group source-op-buttons">' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-source-attention-events" data-execute="false" data-limit="100" data-attention-limit="100" data-priority-score-threshold="70">Attention check</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-source-attention-events" data-execute="true" data-limit="100" data-attention-limit="100" data-priority-score-threshold="70"' + disabled + '>Create alerts</button>' +
    '</span></div>';
}

function renderSourceTypeOperationsEventControls(alertableCount) {
  const disabled = alertableCount > 0 ? '' : ' disabled';
  return '<div class="action-row ops-row"><span>' +
    '<strong>Source type operations alerts</strong>' +
    '<small>' + escapeHtml('alertable=' + alertableCount + ' | threshold=70') + '</small>' +
    '</span>' +
    '<span class="button-group source-op-buttons">' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-source-type-operations-events" data-execute="false" data-limit="100" data-source-type-limit="100" data-attention-limit="100" data-priority-score-threshold="70">Type check</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-source-type-operations-events" data-execute="true" data-limit="100" data-source-type-limit="100" data-attention-limit="100" data-priority-score-threshold="70"' + disabled + '>Create alerts</button>' +
    '</span></div>';
}

function countAlertableRunbookActions(actions) {
  return (actions || []).filter(function (action) {
    return action.severity === 'critical' || action.severity === 'warning';
  }).length;
}

function countAlertableSourceAttention(items) {
  return (items || []).filter(function (item) {
    return item.severity === 'critical' || item.severity === 'warning' || item.severity === 'warn' || (item.priorityScore || 0) >= 70;
  }).length;
}

function countAlertableSourceTypeOperations(sourceTypes) {
  return (sourceTypes || []).filter(function (sourceType) {
    const lifecycle = sourceType.lifecycle || {};
    const attention = sourceType.attention || {};
    return sourceType.status === 'fail' ||
      (attention.critical || 0) > 0 ||
      (attention.warning || 0) > 0 ||
      (attention.highestPriorityScore || 0) >= 70 ||
      (lifecycle.disableBlocked || 0) > 0 ||
      (lifecycle.staleRunning || 0) > 0 ||
      (lifecycle.failureRetryWaiting || 0) > 0;
  }).length;
}

function renderReasonTags(byReason) {
  const reasons = Object.keys(byReason || {}).sort();
  if (reasons.length === 0) return '<span class="muted">No schedule reasons yet.</span>';
  return reasons.map(function (reason) {
    return '<span class="tag">' + escapeHtml(reason + ': ' + byReason[reason]) + '</span>';
  }).join('');
}

function renderCollectionStatusOverview(schedule) {
  const summary = schedule && schedule.summary || {};
  const byStatus = summary.byCollectionStatus || {};
  const statuses = ['due', 'retry-waiting', 'scheduled', 'running', 'unscheduled', 'disabled', 'failed-waiting'];
  const statusTags = statuses.filter(function (status) {
    return (byStatus[status] || 0) > 0;
  }).map(function (status) {
    return '<span class="tag">' + escapeHtml(status + ': ' + byStatus[status]) + '</span>';
  }).join('');
  const filtered = schedule && schedule.collectionStatus && schedule.collectionStatus.length
    ? '<small>' + escapeHtml('filter=' + schedule.collectionStatus.join(',')) + '</small>'
    : '';
  return '<div class="tag-list reason-tags">' + (statusTags || '<span class="tag">no collection statuses</span>') + '</div>' + filtered;
}

function renderCollectionActionControls(schedule) {
  const summary = schedule && schedule.summary || {};
  const byStatus = summary.byCollectionStatus || {};
  const dueCount = summary.due || byStatus.due || (schedule && schedule.dueSources && schedule.dueSources.length) || 0;
  const retryWaiting = byStatus['retry-waiting'] || 0;
  const scheduled = byStatus.scheduled || 0;
  const blocked = (byStatus.running || 0) + (byStatus.disabled || 0) + (byStatus.unscheduled || 0);
  const disabled = dueCount > 0 ? '' : ' disabled';
  return '<div class="source-work-row source-action-row collection-action-row ' + statusClassName(dueCount > 0 ? 'warn' : 'ok') + '">' +
    '<section class="source-work-anchor">' +
      '<span class="source-work-scope">collection</span>' +
      '<strong>Due collection</strong>' +
      '<small>' + escapeHtml(dueCount > 0 ? 'ready to run' : 'queue clear') + '</small>' +
    '</section>' +
    '<section class="source-work-brief">' +
      '<p>Run due collectors first, then trigger insight pipelines for fresh source evidence.</p>' +
      '<div class="source-work-chips">' +
        authorMetaChip('due', dueCount, dueCount > 0 ? 'warn' : 'muted') +
        authorMetaChip('scheduled', scheduled, scheduled > 0 ? 'info' : 'muted') +
        authorMetaChip('retry', retryWaiting, retryWaiting > 0 ? 'warn' : 'muted') +
        authorMetaChip('blocked', blocked, blocked > 0 ? 'warn' : 'muted') +
        authorMetaChip('skipped', summary.skipped || 0, (summary.skipped || 0) > 0 ? 'muted' : 'ok') +
      '</div>' +
    '</section>' +
    '<section class="source-work-actions button-group source-op-buttons">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-due-sources" data-limit="25"' + disabled + '>Run due</button>' +
      '<button class="inline-button" type="button" data-action="run-due-pipelines" data-provider="mock" data-limit="25"' + disabled + '>Run insights</button>' +
    '</section>' +
    '</div>';
}

function filterScheduleSourcesByCollectionStatus(sources, statuses) {
  const wanted = new Set(Array.isArray(statuses) ? statuses : [statuses]);
  return (sources || []).filter(function (source) {
    const plan = source.collectionPlan || {};
    return wanted.has(plan.status);
  }).slice(0, 10);
}

function renderScheduleDecisionRows(sources, emptyText, runnable) {
  if (!sources || sources.length === 0) return '<div class="muted">' + escapeHtml(emptyText) + '</div>';
  return '<div class="source-work-list">' + sources.map(function (source) {
    const decision = source.decision || {};
    const runState = source.runState || {};
    const schedule = source.schedule || {};
    const collectionPlan = source.collectionPlan || {};
    return '<div class="source-work-row source-schedule-row ' + statusClassName(runnable ? 'ok' : 'muted') + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(source.sourceType || source.sourceKey || 'source') + '</span>' +
        '<strong>' + escapeHtml(source.displayName || source.id) + '</strong>' +
        '<small>' + escapeHtml(source.id || source.sourceKey || 'unknown source') + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml('reason=' + (decision.reason || 'unknown')) + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('plan', collectionPlan.status || 'unknown', collectionStatusVariant(collectionPlan.status)) +
          authorMetaChip('run', runState.status || 'unknown', statusVariant(runState.status)) +
          authorMetaChip('every', schedule.intervalMinutes ? schedule.intervalMinutes + 'm' : 'none', schedule.intervalMinutes ? 'info' : 'muted') +
          authorMetaChip('next', decision.nextRunAt || 'none', decision.nextRunAt ? 'info' : 'muted') +
          authorMetaChip('retry', decision.retryAt || 'none', decision.retryAt ? 'warn' : 'muted') +
        '</div>' +
        renderSourceCommandChips(source.recommendedCommands || collectionPlan.recommendedCommands || []) +
      '</section>' +
      renderScheduleSourceControls(source, runnable) +
      '</div>';
  }).join('') + '</div>';
}

function renderScheduleSourceControls(source, runnable) {
  return '<section class="source-work-actions button-group source-op-buttons schedule-op-buttons">' +
    statusBadge(runnable ? 'due' : 'skip', runnable ? 'ok' : 'muted') +
    renderSourceDrilldownButton(source) +
    renderSourceScheduleButtons(source) +
    (runnable ? renderSourceRunButtons(source) : '') +
    '</section>';
}

function renderCollectionPlanDetails(plan) {
  if (!plan || !plan.status) return '<div class="muted">No collection plan for this source.</div>';
  const schedule = plan.schedule || {};
  const decision = schedule.decision || {};
  const incremental = plan.incremental || {};
  return '<div class="source-work-row source-action-row ' + statusClassName(collectionStatusVariant(plan.status)) + '">' +
    '<section class="source-work-anchor">' +
      '<span class="source-work-scope">plan</span>' +
      '<strong>' + escapeHtml(plan.status || 'unknown') + '</strong>' +
      '<small>' + escapeHtml(plan.strategy && plan.strategy.mode || 'collection') + '</small>' +
    '</section>' +
    '<section class="source-work-brief">' +
      '<p>' + escapeHtml('reason=' + (decision.reason || 'unknown')) + '</p>' +
      '<div class="source-work-chips">' +
        authorMetaChip('next', decision.nextRunAt || 'none', decision.nextRunAt ? 'info' : 'muted') +
        authorMetaChip('retry', decision.retryAt || 'none', decision.retryAt ? 'warn' : 'muted') +
        authorMetaChip('cursor', formatCollectionCursorSummary(plan.cursor), plan.cursor && plan.cursor.present ? 'ok' : 'warn') +
        authorMetaChip('changed', String(incremental.lastChanged), incremental.lastChanged ? 'ok' : 'muted') +
        authorMetaChip('new', incremental.newPostCount || 0, (incremental.newPostCount || 0) > 0 ? 'ok' : 'muted') +
        authorMetaChip('replay', formatCollectionReplaySummary(plan.replay), plan.replay && plan.replay.available ? 'ok' : 'muted') +
      '</div>' +
      renderSourceCommandChips(plan.recommendedCommands || []) +
    '</section>' +
    '<section class="source-work-actions button-group source-op-buttons">' +
      statusBadge(plan.status || 'unknown', collectionStatusVariant(plan.status)) +
    '</section>' +
    '</div>';
}

function formatCollectionPlanSummary(plan) {
  if (!plan || !plan.status) return 'unknown';
  const schedule = plan.schedule || {};
  const decision = schedule.decision || {};
  return [
    plan.status,
    plan.strategy && plan.strategy.mode,
    'reason=' + (decision.reason || 'unknown'),
    decision.nextRunAt ? 'next=' + decision.nextRunAt : undefined,
    decision.retryAt ? 'retry=' + decision.retryAt : undefined
  ].filter(Boolean).join(' | ');
}

function formatCollectionCursorSummary(cursor) {
  const safeCursor = cursor || {};
  if (!safeCursor.present) return 'none';
  return [
    'posts=' + (safeCursor.postCount || 0),
    safeCursor.lastFloor !== undefined ? 'floor=' + safeCursor.lastFloor : undefined,
    safeCursor.lastPostId ? 'post=' + safeCursor.lastPostId : undefined,
    safeCursor.capturedAt ? 'captured=' + safeCursor.capturedAt : undefined
  ].filter(Boolean).join(' | ');
}

function formatCollectionReplaySummary(replay) {
  const safeReplay = replay || {};
  if (!safeReplay.available) return 'none';
  return [
    safeReplay.taskId ? 'task=' + safeReplay.taskId : undefined,
    (safeReplay.rawPageHashes || []).length ? 'rawPages=' + safeReplay.rawPageHashes.length : undefined,
    (safeReplay.pageNumbers || []).length ? 'pages=' + safeReplay.pageNumbers.join(',') : undefined,
    (safeReplay.evidenceKinds || []).length ? 'evidence=' + safeReplay.evidenceKinds.join(',') : undefined
  ].filter(Boolean).join(' | ') || 'available';
}

function collectionStatusVariant(status) {
  if (status === 'due') return 'ok';
  if (status === 'retry-waiting' || status === 'failed-waiting') return 'warn';
  if (status === 'running' || status === 'scheduled') return 'ok';
  if (status === 'disabled' || status === 'unscheduled') return 'muted';
  return 'muted';
}

function renderLifecycleAttentionRows(sources) {
  const attentionSources = (sources || []).filter(function (source) {
    const guard = source.disableGuard || {};
    const retry = source.failureRetry || {};
    return guard.blocked || guard.stale || (retry.active && !retry.elapsed) || source.enabled === false;
  });
  const rows = attentionSources.length > 0 ? attentionSources : (sources || []).slice(0, 5);
  if (rows.length === 0) return '<div class="muted">No tracked sources.</div>';
  if (attentionSources.length === 0) {
    return '<div class="muted">No lifecycle attention needed.</div>' + rows.map(renderLifecycleSourceRow).join('');
  }
  return rows.map(renderLifecycleSourceRow).join('');
}

function renderLifecycleSourceRow(source) {
  const guard = source.disableGuard || {};
  const retry = source.failureRetry || {};
  const runState = source.runState || {};
  const variant = guard.blocked || (retry.active && !retry.elapsed) ? 'warn' : (source.enabled === false ? 'muted' : 'ok');
  const label = guard.blocked ? 'blocked' : (retry.active && !retry.elapsed ? 'retry wait' : (source.enabled === false ? 'disabled' : 'ready'));
  const controls = '<section class="source-work-actions button-group source-op-buttons">' +
    statusBadge(label, variant) +
    renderSourceDrilldownButton(source) +
    renderSourceRunButtons(source) +
    renderSourceScheduleButtons(source) +
    renderSourceEnablementButtons(source) +
    renderSourceFailureResetButtons(source) +
    '</section>';
  return '<div class="source-work-row lifecycle-source-row ' + statusClassName(variant) + '">' +
    '<section class="source-work-anchor">' +
      '<span class="source-work-scope">' + escapeHtml(source.sourceType || source.sourceKey || 'source') + '</span>' +
      '<strong>' + escapeHtml(source.displayName || source.id) + '</strong>' +
      '<small>' + escapeHtml(source.id || source.sourceKey || 'unknown source') + '</small>' +
    '</section>' +
    '<section class="source-work-brief">' +
      '<p>' + escapeHtml(source.nextAction || 'Source is ready for the next operational step.') + '</p>' +
      '<div class="source-work-chips">' +
        authorMetaChip('run', runState.status || 'unknown', statusVariant(runState.status)) +
        authorMetaChip('state', label, variant) +
        authorMetaChip('started', guard.lastStartedAt || 'none', guard.lastStartedAt ? 'info' : 'muted') +
        authorMetaChip('retry', retry.retryAt || 'none', retry.retryAt ? 'warn' : 'muted') +
        authorMetaChip('task', source.latestLifecycleTask ? source.latestLifecycleTask.status || 'task' : 'none', source.latestLifecycleTask ? statusVariant(source.latestLifecycleTask.status) : 'muted') +
      '</div>' +
      renderSourceCommandChips(source.recommendedCommands || []) +
    '</section>' +
    controls +
    '</div>';
}

function renderLifecycleCommandRows(commands) {
  const filteredCommands = (commands || []).filter(Boolean).slice(0, 3);
  if (filteredCommands.length === 0) return '';
  return '<div class="lifecycle-command-list">' + filteredCommands.map(function (command) {
    return '<div class="lifecycle-command-row">' +
      '<code>' + escapeHtml(command) + '</code>' +
      '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="copy-lifecycle-command">Copy</button>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceDrilldownButton(source) {
  const sourceId = escapeHtml(source.id || '');
  const sourceKey = escapeHtml(source.sourceKey || '');
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-drilldown" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">Ops</button>' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-collection-health" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">Health</button>';
}

function renderSourceDrilldownButtonForScope(scope) {
  const safeScope = scope || {};
  if (!safeScope.sourceId && !safeScope.sourceKey) return '';
  return renderSourceDrilldownButton({
    id: safeScope.sourceId,
    sourceKey: safeScope.sourceKey
  });
}

function renderSourceRunButtons(source) {
  if (source.enabled === false) return '';
  const runState = source.runState || {};
  if (runState.status === 'running') return '';
  const sourceId = escapeHtml(source.id);
  return [
    '<button class="inline-button secondary-inline-button" type="button" data-action="run-source" data-source-id="' + sourceId + '">Run</button>',
    '<button class="inline-button secondary-inline-button" type="button" data-action="run-source-pipeline" data-source-id="' + sourceId + '">Insight</button>'
  ].join('');
}

function renderSourceScheduleButtons(source) {
  const sourceId = escapeHtml(source.id);
  if (!sourceId) return '';
  return [
    '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-schedule" data-source-id="' + sourceId + '" data-interval-minutes="60" data-run-now="true" data-execute="false">Schedule check</button>',
    '<button class="inline-button" type="button" data-action="set-source-schedule" data-source-id="' + sourceId + '" data-interval-minutes="60" data-run-now="true" data-execute="true">Schedule now</button>'
  ].join('');
}

function renderSourceEnablementButtons(source) {
  const sourceId = escapeHtml(source.id);
  if (source.enabled === false) {
    return [
      '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="true" data-execute="false">Enable check</button>',
      '<button class="inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="true" data-execute="true">Enable</button>'
    ].join('');
  }
  return [
    '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="false" data-execute="false">Disable check</button>',
    '<button class="inline-button warning-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="false" data-execute="true">Disable</button>'
  ].join('');
}

function renderSourceFailureResetButtons(source) {
  const runState = source.runState || {};
  const retry = source.failureRetry || {};
  if (runState.status !== 'failed' && !retry.active) return '';
  const sourceId = escapeHtml(source.id);
  return [
    '<button class="inline-button secondary-inline-button" type="button" data-action="reset-source-failure" data-source-id="' + sourceId + '" data-execute="false" data-retry-now="true">Reset check</button>',
    '<button class="inline-button warning-inline-button" type="button" data-action="reset-source-failure" data-source-id="' + sourceId + '" data-execute="true" data-retry-now="true">Retry now</button>'
  ].join('');
}

function renderSourceLifecycleUpdateResult(result) {
  const update = result.result || result;
  const task = result.task || {};
  const before = update.sourceBefore || {};
  const after = update.sourceAfter || {};
  const guard = update.guard || {};
  return panel(after.enabled ? 'Source enable' : 'Source disable', [
    metric('Status', update.status || 'unknown'),
    metric('Task', task.id || 'none'),
    metric('Mode', update.dryRun ? 'dry-run' : 'execute'),
    metric('Changed', update.changed ? 'yes' : 'no'),
    metric('Source', (before.id || after.id || 'unknown') + ' / ' + (after.displayName || before.displayName || 'unknown')),
    metric('Enabled before', before.enabled === undefined ? 'unknown' : before.enabled),
    metric('Enabled after', after.enabled === undefined ? 'unknown' : after.enabled),
    metric('Guard', guard.running ? 'running=' + guard.running + ' blocked=' + guard.blocked + ' stale=' + guard.stale : 'not-running'),
    renderTaskTraceButton(task)
  ].join(''), 'wide');
}

function renderSourceScheduleUpdateResult(result) {
  const update = result.result || result;
  const task = result.task || {};
  const before = update.sourceBefore || {};
  const after = update.sourceAfter || {};
  return panel('Source schedule', [
    metric('Status', update.status || 'unknown'),
    metric('Task', task.id || 'none'),
    metric('Mode', update.dryRun ? 'dry-run' : 'execute'),
    metric('Changed', update.changed ? 'yes' : 'no'),
    metric('Source', (before.id || after.id || 'unknown') + ' / ' + (after.displayName || before.displayName || 'unknown')),
    metric('Before', formatScheduleBrief(before.schedule)),
    metric('After', formatScheduleBrief(after.schedule)),
    renderTaskTraceButton(task)
  ].join(''), 'wide');
}

function formatScheduleBrief(schedule) {
  const safeSchedule = schedule || {};
  return [
    'enabled=' + (safeSchedule.enabled === undefined ? 'default' : safeSchedule.enabled),
    'interval=' + (safeSchedule.intervalMinutes || 'none'),
    'next=' + (safeSchedule.nextRunAt || 'none')
  ].join(' | ');
}

function renderSourceFailureResetResult(result) {
  const reset = result.result || result;
  const task = result.task || {};
  const sourceAfter = reset.sourceAfter || {};
  const runState = sourceAfter.runState || {};
  const schedule = sourceAfter.schedule || {};
  return panel('Source failure reset', [
    metric('Status', reset.status || 'unknown'),
    metric('Task', task.id || 'none'),
    metric('Mode', reset.dryRun ? 'dry-run' : 'execute'),
    metric('Changed', reset.changed ? 'yes' : 'no'),
    metric('Reason', reset.reason || 'unknown'),
    metric('Run state', runState.status || 'unknown'),
    metric('Failure count', runState.failureCount === undefined ? 'unknown' : runState.failureCount),
    metric('Next run', schedule.nextRunAt || reset.nextRunAt || 'unchanged'),
    renderTaskTraceButton(task)
  ].join(''), 'wide');
}

function renderRunbookNotificationEventResult(result) {
  const items = result.results || [];
  return panel('Runbook notification events', [
    metric('Status', result.status || 'unknown'),
    metric('Mode', result.dryRun ? 'dry-run' : 'execute'),
    metric('Actions', result.actionCount || 0),
    metric('Events', result.eventCount || 0),
    metric('Created', result.createdCount || 0),
    metric('Updated', result.updatedCount || 0),
    metric('Resolved', result.resolvedCount || 0),
    metric('Reopened', result.reopenedCount || 0),
    metric('Skipped', result.skippedCount || 0),
    evidenceList(items.map(function (item) {
      const event = item.event || {};
      const reason = item.reason ? ' / ' + item.reason : '';
      return item.status + ' | ' + (item.actionKey || 'unknown') + ' | ' + (event.id || 'no-event') + ' | ' + (event.severity || 'unknown') + reason;
    }))
  ].join(''), 'wide');
}

function renderSourceAttentionNotificationEventResult(result) {
  const items = result.results || [];
  return panel('Source attention notification events', [
    metric('Status', result.status || 'unknown'),
    metric('Mode', result.dryRun ? 'dry-run' : 'execute'),
    metric('Sources', result.sourceCount || 0),
    metric('Threshold', result.priorityScoreThreshold || 0),
    metric('Events', result.eventCount || 0),
    metric('Created', result.createdCount || 0),
    metric('Updated', result.updatedCount || 0),
    metric('Resolved', result.resolvedCount || 0),
    metric('Reopened', result.reopenedCount || 0),
    metric('Skipped', result.skippedCount || 0),
    evidenceList(items.map(function (item) {
      const event = item.event || {};
      const source = event.payload && event.payload.source || {};
      const reason = item.reason ? ' / ' + item.reason : '';
      return item.status + ' | ' + (item.attentionKey || source.id || source.sourceKey || 'unknown-source') + ' | ' + (event.id || 'no-event') + ' | ' + (event.severity || 'unknown') + reason;
    }))
  ].join(''), 'wide');
}

function renderSourceTypeOperationsNotificationEventResult(result) {
  const items = result.results || [];
  return panel('Source type operations notification events', [
    metric('Status', result.status || 'unknown'),
    metric('Mode', result.dryRun ? 'dry-run' : 'execute'),
    metric('Source types', result.sourceTypeCount || 0),
    metric('Threshold', result.priorityScoreThreshold || 0),
    metric('Readiness warnings', result.includeReadinessWarnings ? 'included' : 'ignored'),
    metric('Events', result.eventCount || 0),
    metric('Created', result.createdCount || 0),
    metric('Updated', result.updatedCount || 0),
    metric('Resolved', result.resolvedCount || 0),
    metric('Reopened', result.reopenedCount || 0),
    metric('Skipped', result.skippedCount || 0),
    evidenceList(items.map(function (item) {
      const event = item.event || {};
      const sourceType = item.sourceType || event.payload && event.payload.sourceType || 'unknown-source-type';
      const reason = item.reason ? ' / ' + item.reason : '';
      return item.status + ' | ' + sourceType + ' | ' + (event.id || 'no-event') + ' | ' + (event.severity || 'unknown') + reason;
    }))
  ].join(''), 'wide');
}

function renderRunbookActionRows(actions) {
  return actions.slice(0, 10).map(function (action) {
    const command = action.recommendedCommand ? '<small>' + escapeHtml(action.recommendedCommand) + '</small>' : '';
    const evidence = action.evidenceSummary || action.evidence && action.evidence.evidenceSummary;
    const evidenceRow = evidence ? '<small>' + escapeHtml('evidence=' + evidence) + '</small>' : '';
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.title || action.key) + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      evidenceRow +
      command +
      '</span>' +
      statusBadge(action.severity || 'info', action.severity === 'critical' ? 'fail' : 'warn') +
      '</div>';
  }).join('');
}

function summaryTile(label, value, variant) {
  const className = variant ? 'summary-tile ' + statusClassName(variant) : 'summary-tile';
  return '<div class="' + className + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function statusBadge(label, variant) {
  return '<span class="status-badge ' + statusClassName(variant) + '">' + escapeHtml(label) + '</span>';
}

function statusVariant(status) {
  if (status === 'ok' || status === 'noop') return 'ok';
  if (status === 'fail' || status === 'critical') return 'fail';
  if (status === 'warn' || status === 'warning' || status === 'review' || status === 'actionable' || status === 'preview') return 'warn';
  return 'muted';
}

function statusClassName(variant) {
  if (variant === 'ok') return 'status-ok';
  if (variant === 'info') return 'status-info';
  if (variant === 'warn') return 'status-warn';
  if (variant === 'fail') return 'status-fail';
  return 'status-muted';
}

function formatDurationMs(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return String(value || 0) + 'ms';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return seconds + 's';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + 'm';
  return Math.round(minutes / 60) + 'h';
}

function renderPipelineRunSummary(run) {
  const sourceName = run.source && run.source.displayName ? run.source.displayName : run.sourceId || 'unknown-source';
  const cursorDiff = run.cursorDiff || {};
  const semantic = run.semantic || {};
  const changed = cursorDiff.changed === undefined ? 'unknown' : (cursorDiff.changed ? 'changed' : 'unchanged');
  const newPosts = cursorDiff.newPostCount === undefined ? '' : ' · +' + cursorDiff.newPostCount;
  const semanticLabel = semantic.status ? ' · semantic ' + semantic.status + (semantic.reason ? '/' + semantic.reason : '') : '';
  const timestamp = run.finishedAt || run.updatedAt || run.createdAt || '';
  return run.status + ' · ' + sourceName + ' · ' + changed + newPosts + semanticLabel + ' · ' + timestamp;
}

function renderContextReviewResultSubmission(result) {
  if (result.valid === false) {
    const checks = result.validation && result.validation.checks ? result.validation.checks : [];
    return panel('Review result rejected', [
      metric('Status', result.status || 'invalid'),
      metric('Validation', result.validation ? result.validation.status : 'fail'),
      evidenceList(checks.filter(function (check) {
        return check.status === 'fail';
      }).slice(0, 8).map(function (check) {
        return check.key + ' | ' + check.summary;
      }))
    ].join(''), 'wide');
  }
  const record = result.record || {};
  const summary = record.summary || {};
  return panel('Review result stored', [
    metric('Record', record.id || 'unknown'),
    metric('Status', record.status || 'unknown'),
    metric('Handoff', record.handoffId || 'none'),
    metric('Severity', summary.notification ? summary.notification.severity : 'unknown'),
    metric('Remaining tasks', summary.remainingCount || 0),
    metric('Next action', summary.recommendedNextAction || 'none')
  ].join(''), 'wide');
}

function renderContextReviewResultOverview(result) {
  const overview = result.overview || {};
  const records = result.reviewResults || [];
  const attention = overview.attention || {};
  const actionPlan = result.actionPlan || {};
  const actionGate = result.actionGate || {};
  const actionAuditOverview = result.actionAuditOverview || {};
  const actionAudits = result.actionAudits || {};
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Reviews', String(overview.count || 0)),
    summaryTile('Warnings', String(attention.warningCount || 0), (attention.warningCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Critical', String(attention.criticalCount || 0), (attention.criticalCount || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('Remaining tasks', String(overview.remainingTaskCount || 0), (overview.remainingTaskCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('Merge candidates', String(overview.mergeCandidateCount || 0), (overview.mergeCandidateCount || 0) > 0 ? 'ok' : 'muted')
  ].join('') + '</div>';
  return [
    panel('Review result overview', [
      tiles,
      metric('Generated', overview.generatedAt || 'unknown'),
      metric('Next action', overview.recommendedNextAction || 'none')
    ].join(''), 'wide'),
    renderContextReviewResultActionPlan(actionPlan),
    renderContextReviewResultActionGate(actionGate),
    renderContextReviewActionAuditPanel({
      overview: actionAuditOverview,
      audits: actionAudits.audits || []
    }),
    panel('Review attention', renderContextReviewAttentionRows(attention.topRecords || []), 'wide'),
    panel('Recent review results', renderContextReviewResultRows(records), 'wide')
  ].join('');
}

function renderContextReviewResultActionPlan(plan) {
  const risk = plan.risk || {};
  const attention = plan.attention || {};
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Close tasks', String((plan.closeTaskIds || []).length), (plan.closeTaskIds || []).length > 0 ? 'ok' : 'muted'),
    summaryTile('Keep open', String((plan.keepOpenTaskIds || []).length), (plan.keepOpenTaskIds || []).length > 0 ? 'warn' : 'ok'),
    summaryTile('Merge candidates', String((plan.mergeCandidates || []).length), (plan.mergeCandidates || []).length > 0 ? 'ok' : 'muted'),
    summaryTile('Blocked', String((plan.blockedTasks || []).length), (plan.blockedTasks || []).length > 0 ? 'warn' : 'ok'),
    summaryTile('Conflicts', String((attention.conflictTaskIds || []).length), (attention.conflictTaskIds || []).length > 0 ? 'fail' : 'ok')
  ].join('') + '</div>';
  return panel('Review action plan', [
    tiles,
    metric('Generated', plan.generatedAt || 'unknown'),
    metric('Risk', risk.level || 'unknown'),
    metric('Next action', plan.recommendedNextAction || 'none'),
    '<h4>Merge candidates</h4>',
    renderReviewMergeCandidateRows(plan.mergeCandidates || []),
    '<h4>Blocked tasks</h4>',
    renderReviewBlockedTaskRows(plan.blockedTasks || [])
  ].join(''), 'wide');
}

function renderContextReviewResultActionGate(gateReport) {
  const executable = gateReport.executable || {};
  const gates = gateReport.gates || [];
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Gate status', gateReport.status || 'unknown', statusVariant(gateReport.status)),
    summaryTile('Can close', executable.canCloseTasks ? 'yes' : 'no', executable.canCloseTasks ? 'ok' : 'muted'),
    summaryTile('Can merge', executable.canMergeContext ? 'yes' : 'no', executable.canMergeContext ? 'ok' : 'muted'),
    summaryTile('Human review', executable.requiresHumanReview ? 'yes' : 'no', executable.requiresHumanReview ? 'warn' : 'ok'),
    summaryTile('Next actions', String((gateReport.nextActions || []).length), (gateReport.nextActions || []).length > 0 ? 'warn' : 'ok')
  ].join('') + '</div>';
  return panel('Review action gate', [
    tiles,
    metric('Generated', gateReport.generatedAt || 'unknown'),
    metric('Next action', gateReport.recommendedNextAction || 'none'),
    renderReviewActionGateRows(gates)
  ].join(''), 'wide');
}

function renderContextReviewActionApplyResult(result) {
  const task = result.task || {};
  const report = result.report || {};
  return panel('Review action apply task', [
    metric('Task', task.id || 'none'),
    metric('Task status', task.status || 'unknown'),
    metric('Report', report.status || 'unknown'),
    metric('Mode', report.dryRun ? 'dry-run' : 'execute'),
    metric('Executed', report.executed ? 'yes' : 'no'),
    metric('Applied', report.applied ? 'yes' : 'no'),
    metric('Close tasks', report.closeTaskCount || 0),
    metric('Merge candidates', report.mergeCandidateCount || 0),
    renderReviewActionApplyStepRows(report.steps || [])
  ].join(''), 'wide');
}

function renderContextReviewActionAuditPanel(result) {
  const overview = result.overview || {};
  const audits = result.audits || overview.recentAudits || [];
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Audits', String(overview.count || audits.length || 0), (overview.count || audits.length || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Tasks', String(overview.taskCount || 0), (overview.taskCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Close planned', String(overview.plannedClosureCount || 0), (overview.plannedClosureCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('Merge planned', String(overview.plannedMergeCandidateCount || 0), (overview.plannedMergeCandidateCount || 0) > 0 ? 'ok' : 'muted')
  ].join('') + '</div>';
  return panel('Review action audits', [
    tiles,
    metric('Generated', overview.generatedAt || 'unknown'),
    metric('Latest audit', overview.latestGeneratedAt || 'none'),
    metric('Sources', compactCountMap(overview.bySourceKey)),
    metric('Next action', overview.recommendedNextAction || 'none'),
    renderContextReviewActionAuditRows(audits)
  ].join(''), 'wide');
}

function renderContextReviewActionExecutionPanel(result) {
  const executions = result.executions || [];
  const completed = executions.filter(function (execution) { return execution.status === 'completed'; }).length;
  const running = executions.filter(function (execution) { return execution.status === 'running'; }).length;
  const staleRunning = result.staleRunningCount === undefined
    ? executions.filter(function (execution) { return execution.staleRunning; }).length
    : result.staleRunningCount;
  const failed = executions.filter(function (execution) { return execution.status === 'failed'; }).length;
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Status', result.status || 'ok', statusVariant(result.status || 'ok')),
    summaryTile('Executions', String(result.count || executions.length || 0), executions.length > 0 ? 'ok' : 'muted'),
    summaryTile('Completed', String(completed), completed > 0 ? 'ok' : 'muted'),
    summaryTile('Running', String(running), running > 0 ? 'warn' : 'muted'),
    summaryTile('Stale running', String(staleRunning), staleRunning > 0 ? 'fail' : 'muted'),
    summaryTile('Failed', String(failed), failed > 0 ? 'fail' : 'muted')
  ].join('') + '</div>';
  return panel('Review action executions', [
    tiles,
    metric('Generated', result.generatedAt || 'unknown'),
    metric('Stale window', result.runningStaleAfterMs === undefined ? 'unknown' : result.runningStaleAfterMs + ' ms'),
    metric('Sources', compactCountMap(result.bySourceKey)),
    metric('Stale sources', compactCountMap(result.staleRunningBySourceKey)),
    result.message ? '<div class="muted">' + escapeHtml(result.message) + '</div>' : '',
    renderContextReviewActionExecutionRows(executions)
  ].join(''), 'wide');
}

function renderContextReviewActionExecutorDiagnostics(result) {
  const methods = result.methods || {};
  const audit = result.audit || {};
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Status', result.status || 'unknown', statusVariant(result.status)),
    summaryTile('Mode', result.mode || 'none', result.ready ? 'ok' : 'warn'),
    summaryTile('Ready', result.ready ? 'yes' : 'no', result.ready ? 'ok' : 'warn'),
    summaryTile('Dry-run only', result.dryRunOnly ? 'yes' : 'no', result.dryRunOnly ? 'warn' : 'ok'),
    summaryTile('Audits', String(audit.count || 0), (audit.count || 0) > 0 ? 'ok' : 'muted')
  ].join('') + '</div>';
  return panel('Review executor diagnostics', [
    tiles,
    metric('Source', result.source || 'unknown'),
    metric('Mutates source truth', result.mutatesSourceTruth ? 'yes' : 'no'),
    metric('closeTasks', methods.closeTasks ? 'available' : 'missing'),
    metric('mergeContext', methods.mergeContext ? 'available' : 'missing'),
    metric('Latest audit', audit.latestGeneratedAt || 'none'),
    '<h4>Checks</h4>',
    renderDiagnosticCheckRows(result.checks || []),
    '<h4>Next actions</h4>',
    evidenceList((result.nextActions || []).map(function (action) {
      return action.severity + ' | ' + action.key + ' | ' + action.summary;
    }))
  ].join(''), 'wide');
}

function renderContextReviewResultEventSynthesis(result) {
  const rows = result.results || [];
  return panel('Review alert synthesis', [
    metric('Mode', result.dryRun ? 'dry-run' : 'execute'),
    metric('Review results', result.reviewResultCount || 0),
    metric('Actions', result.actionCount || 0),
    metric('Created', result.createdCount || 0),
    metric('Updated', result.updatedCount || 0),
    metric('Skipped', result.skippedCount || 0),
    evidenceList(rows.map(function (item) {
      const event = item.event || {};
      const reason = item.reason ? ' | ' + item.reason : '';
      return item.status + ' | ' + (item.recordId || 'unknown-record') + ' | ' + (event.id || 'no-event') + ' | ' + (event.severity || 'unknown') + reason;
    }))
  ].join(''), 'wide');
}

function renderContextReviewAttentionRows(records) {
  if (records.length === 0) return '<div class="muted">No review attention needed.</div>';
  return records.map(function (record) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(record.status || 'unknown') + ' | ' + escapeHtml(record.handoffId || record.id || 'unknown') + '</strong>' +
      '<small>' + escapeHtml(record.reason || 'attention') + '</small>' +
      '<small>' + escapeHtml(record.recommendedNextAction || '') + '</small>' +
      '</span>' +
      statusBadge(record.severity || 'info', statusVariant(record.severity)) +
      '</div>';
  }).join('');
}

function renderContextReviewResultRows(records) {
  if (records.length === 0) return '<div class="muted">No submitted review results.</div>';
  return records.map(function (record) {
    const summary = record.summary || {};
    const notification = summary.notification || {};
    const reviewer = record.reviewer || {};
    const details = [
      record.id,
      record.submittedAt,
      reviewer.id ? 'reviewer=' + reviewer.id : undefined,
      'remaining=' + (summary.remainingCount || 0),
      'merge=' + (Array.isArray(summary.mergeCandidates) ? summary.mergeCandidates.length : 0)
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml((record.status || 'unknown') + ' | ' + (record.handoffId || 'no-handoff')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(summary.recommendedNextAction || '') + '</small>' +
      '</span>' +
      statusBadge(notification.severity || 'info', statusVariant(notification.severity)) +
      '</div>';
  }).join('');
}

function renderReviewMergeCandidateRows(candidates) {
  if (candidates.length === 0) return '<div class="muted">No merge candidates.</div>';
  return candidates.slice(0, 10).map(function (candidate) {
    const details = [
      candidate.recordId,
      candidate.taskType,
      candidate.decision,
      candidate.confidence === undefined ? undefined : 'confidence=' + candidate.confidence
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(candidate.taskId || 'unknown-task') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(candidate.rationale || '') + '</small>' +
      '</span>' +
      statusBadge(candidate.severity || 'info', statusVariant(candidate.severity)) +
      '</div>';
  }).join('');
}

function renderReviewBlockedTaskRows(tasks) {
  if (tasks.length === 0) return '<div class="muted">No blocked tasks.</div>';
  return tasks.slice(0, 10).map(function (task) {
    const details = [
      task.recordId,
      task.taskType,
      task.decision,
      task.confidence === undefined ? undefined : 'confidence=' + task.confidence
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(task.taskId || 'unknown-task') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(task.reason || '') + '</small>' +
      '</span>' +
      statusBadge(task.severity || 'warning', statusVariant(task.severity || 'warning')) +
      '</div>';
  }).join('');
}

function renderReviewActionGateRows(gates) {
  if (gates.length === 0) return '<div class="muted">No review gates.</div>';
  return gates.map(function (gate) {
    const evidence = gate.evidence || {};
    const details = Object.keys(evidence).slice(0, 4).map(function (key) {
      const value = Array.isArray(evidence[key]) ? evidence[key].length : evidence[key];
      return key + '=' + value;
    }).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(gate.key || 'unknown-gate') + '</strong>' +
      '<small>' + escapeHtml(gate.summary || '') + '</small>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' +
      statusBadge(gate.status || 'warn', statusVariant(gate.status)) +
      '</div>';
  }).join('');
}

function renderReviewActionApplyStepRows(steps) {
  if (steps.length === 0) return '<div class="muted">No apply steps.</div>';
  return steps.map(function (step) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(step.key || 'unknown-step') + '</strong>' +
      '<small>' + escapeHtml(step.summary || '') + '</small>' +
      '</span>' +
      statusBadge(step.status || 'warn', statusVariant(step.status)) +
      '</div>';
  }).join('');
}

function renderDiagnosticCheckRows(checks) {
  if (checks.length === 0) return '<div class="muted">No diagnostic checks.</div>';
  return checks.map(function (check) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(check.key || 'unknown-check') + '</strong>' +
      '<small>' + escapeHtml(check.summary || '') + '</small>' +
      '<small>' + escapeHtml(check.value === undefined ? '' : String(check.value)) + '</small>' +
      '</span>' +
      statusBadge(check.status || 'warn', statusVariant(check.status)) +
      '</div>';
  }).join('');
}

function renderContextReviewActionAuditRows(audits) {
  if (audits.length === 0) return '<div class="muted">No review action audits.</div>';
  return audits.map(function (audit) {
    const request = audit.request || {};
    const details = [
      audit.generatedAt,
      audit.sourceKey ? 'source=' + audit.sourceKey : undefined,
      audit.sourceId ? 'sourceId=' + audit.sourceId : undefined,
      request.taskId ? 'task=' + request.taskId : undefined,
      request.closeTaskIds ? 'close=' + request.closeTaskIds.length : undefined,
      request.mergeCandidates ? 'merge=' + request.mergeCandidates.length : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(audit.action || 'unknown-action') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(audit.filePath || '') + '</small>' +
      '</span>' +
      statusBadge(audit.adapter || 'file-audit', 'ok') +
      '</div>';
  }).join('');
}

function renderContextReviewActionExecutionRows(executions) {
  if (executions.length === 0) return '<div class="muted">No review action executions.</div>';
  return executions.map(function (execution) {
    const details = [
      execution.updatedAt || execution.createdAt,
      execution.sourceKey ? 'source=' + execution.sourceKey : undefined,
      execution.sourceId ? 'sourceId=' + execution.sourceId : undefined,
      execution.taskId ? 'task=' + execution.taskId : undefined,
      execution.requestHash ? 'hash=' + String(execution.requestHash).slice(0, 12) : undefined,
      execution.attemptCount ? 'attempts=' + execution.attemptCount : undefined,
      execution.runningAgeMs === undefined ? undefined : 'ageMs=' + execution.runningAgeMs
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(execution.action || 'unknown-action') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(execution.key || '') + '</small>' +
      '<small>' + escapeHtml(execution.filePath || '') + '</small>' +
      '</span>' +
      statusBadge(execution.staleRunning ? 'stale running' : execution.status || 'unknown', execution.staleRunning ? 'fail' : statusVariant(execution.status)) +
      '</div>';
  }).join('');
}

function renderEventListLegacy(result) {
  const events = result.events || [];
  const overview = result.overview;
  const policy = result.policy;
  const summary = renderEventListSummary(events);
  const title = '通知事件 · ' + currentEventFilterSummary();
  const listPanel = events.length === 0
    ? panel(title, summary + '<div class="muted">暂无</div>', 'wide')
    : panel(title, summary + events.map(renderNotificationEventRow).join(''), 'wide');
  return (overview ? renderNotificationEventOverview(overview) : '') +
    (policy ? renderNotificationSynthesisPolicy(policy) : '') +
    listPanel;
}

function renderNotificationEventDetail(result) {
  const event = result.event || {};
  const sourceScope = result.sourceScope || {};
  const relatedTask = result.relatedTask || {};
  return [
    panel('Event detail', [
      '<div class="summary-strip event-summary-strip">' + [
        summaryTile('Status', event.deliveryStatus || 'pending', statusVariant(event.deliveryStatus || 'pending')),
        summaryTile('Severity', event.severity || 'unknown', statusVariant(event.severity)),
        summaryTile('Type', event.type || 'unknown'),
        summaryTile('Source', sourceScope.sourceId || sourceScope.sourceKey || 'none', sourceScope.sourceId || sourceScope.sourceKey ? 'ok' : 'muted')
      ].join('') + '</div>',
      metric('Event ID', event.id || 'none'),
      metric('Created', event.createdAt || 'unknown'),
      metric('Next delivery', event.nextDeliveryAt || 'none'),
      metric('Attempts', event.deliveryAttempts || 0),
      metric('Acknowledged', event.acknowledgedAt || 'not acknowledged'),
      metric('Source scope', formatTaskSourceScope(sourceScope)),
      metric('Related task', relatedTask.id ? relatedTask.id + (relatedTask.missing ? ' (missing)' : ' | ' + [relatedTask.status, relatedTask.type].filter(Boolean).join('/')) : 'none'),
      renderNotificationEventDetailButtons(result)
    ].join(''), 'wide'),
    panel('Action readiness', renderNotificationEventActionReadiness(result.actionReadiness), 'wide'),
    panel('Event actions', renderNotificationEventDetailActions(result.nextActions || [], event.id), 'wide'),
    panel('Event payload', '<pre>' + escapeHtml(JSON.stringify({
      title: event.title,
      summary: event.summary,
      payload: event.payload,
      deliveryResult: event.deliveryResult,
      lastDeliveryError: event.lastDeliveryError
    }, null, 2)) + '</pre>', 'wide')
  ].join('');
}

function renderNotificationEventActionReadiness(readiness) {
  if (!readiness) return '<div class="muted">No action readiness report.</div>';
  const gates = readiness.gates || [];
  return [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('Status', readiness.status || 'unknown', statusVariant(readiness.status)),
      summaryTile('Gates', readiness.gateCount || gates.length),
      summaryTile('Warnings', readiness.warningCount || 0, readiness.warningCount ? 'warn' : 'ok'),
      summaryTile('Executable', (readiness.executableActionKeys || []).length)
    ].join('') + '</div>',
    gates.map(function (gate) {
      return '<div class="action-row ops-row"><span>' +
        '<strong>' + escapeHtml((gate.status || 'unknown') + ' | ' + (gate.key || 'gate')) + '</strong>' +
        '<small>' + escapeHtml(gate.summary || '') + '</small>' +
        '</span>' +
        statusBadge(gate.status || 'unknown', gate.status === 'warn' ? 'warn' : statusVariant(gate.status)) +
        '</div>';
    }).join('')
  ].join('');
}

function renderNotificationEventDetailButtons(result) {
  const event = result.event || {};
  const sourceScope = result.sourceScope || {};
  const relatedTask = result.relatedTask || {};
  return '<div class="button-group source-op-buttons">' +
    renderEventSourceDrilldownButton({
      sourceId: sourceScope.sourceId,
      sourceKey: sourceScope.sourceKey
    }) +
    (relatedTask.id ? '<button class="inline-button secondary-inline-button" type="button" data-action="load-task-detail" data-task-id="' + escapeHtml(relatedTask.id) + '" data-trace-limit="20">Task</button>' : '') +
    (event.acknowledgedAt ? '' : '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id || '') + '">Acknowledge</button>') +
    '</div>';
}

function renderNotificationEventDetailActions(actions, eventId) {
  if (!actions.length) return '<div class="muted">No recommended event actions.</div>';
  return actions.map(function (action) {
    const intentButton = eventId && action.key
      ? '<button class="inline-button secondary-inline-button" type="button" data-action="prepare-event-action-intent" data-event-id="' + escapeHtml(eventId) + '" data-action-key="' + escapeHtml(action.key) + '">Dry-run</button>'
      : '';
    const executeButton = eventId && action.key === 'event.acknowledge'
      ? '<button class="inline-button" type="button" data-action="execute-event-action" data-event-id="' + escapeHtml(eventId) + '" data-action-key="' + escapeHtml(action.key) + '">Execute</button>'
      : '';
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml((action.severity || 'info') + ' | ' + (action.key || 'event.action')) + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      (action.command ? '<small>' + escapeHtml(action.command) + '</small>' : '') +
      '</span>' +
      '<span class="button-group source-op-buttons">' +
      intentButton +
      executeButton +
      statusBadge(action.severity || 'info', action.severity === 'warning' ? 'warn' : statusVariant(action.severity)) +
      '</span>' +
      '</div>';
  }).join('');
}

function renderNotificationEventActionIntent(result) {
  if (result && result.error) {
    return panel('Event action dry-run error', [
      metric('Code', result.error.code || 'error'),
      metric('Message', result.error.message || 'Action intent could not be prepared.')
    ].join(''), 'wide');
  }
  const intent = result.intent || {};
  const api = intent.api || {};
  const gate = result.readinessGate || {};
  const ledger = result.ledger || {};
  const executionLedger = result.executionLedger || {};
  const executed = result.executed === true;
  return [
    panel(executed ? 'Event action execution' : 'Event action dry-run', [
      '<div class="summary-strip event-summary-strip">' + [
        summaryTile('Status', result.status || 'unknown', statusVariant(result.status)),
        summaryTile('Mode', result.mode || 'dry-run', 'ok'),
        summaryTile('Executed', executed ? 'yes' : 'no', executed ? 'warn' : 'ok'),
        summaryTile('Action', result.action && result.action.key || 'unknown')
      ].join('') + '</div>',
      metric('Intent ID', intent.id || 'none'),
      metric('Event ID', result.event && result.event.id || intent.eventId || 'none'),
      metric('Actor', intent.actor || 'operator'),
      metric('Reason', intent.reason || 'none'),
      metric('Ledger', ledger.recorded ? ledger.recordId || 'recorded' : ledger.reason || 'not recorded'),
      metric('Execution ledger', executionLedger.recorded ? [executionLedger.status, executionLedger.key, executionLedger.replayed ? 'replayed' : 'new'].filter(Boolean).join(' | ') : executionLedger.reason || 'not recorded'),
      metric('API plan', [api.method, api.path].filter(Boolean).join(' ') || 'manual'),
      metric('Command', intent.command || 'none'),
      metric('Acknowledged at', result.event && result.event.acknowledgedAt || 'none'),
      metric('Gate', gate.key ? gate.status + ' | ' + gate.key + ' | ' + gate.summary : 'none')
    ].join(''), 'wide'),
    panel('Intent evidence', '<pre>' + escapeHtml(JSON.stringify({
      api: intent.api,
      ledger: result.ledger,
      executionLedger: result.executionLedger,
      audit: intent.audit,
      evidence: intent.evidence,
      actionReadiness: result.actionReadiness
    }, null, 2)) + '</pre>', 'wide')
  ].join('');
}

function renderNotificationEventOverviewLegacy(overview) {
  const attention = overview.attention || {};
  return panel('Notification outbox overview', [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('Status', overview.status || 'unknown', statusVariant(overview.status)),
      summaryTile('Window', String(overview.eventCount || 0)),
      summaryTile('Open', String(overview.unacknowledgedCount || 0), overview.unacknowledgedCount > 0 ? 'warn' : 'ok'),
      summaryTile('Due', String(overview.dueForDeliveryCount || 0), overview.dueForDeliveryCount > 0 ? 'warn' : 'ok'),
      summaryTile('Failed', String(overview.failedCount || 0), overview.failedCount > 0 ? 'fail' : 'ok')
    ].join('') + '</div>',
    metric('Delivery status', formatStanceSummary(overview.byDeliveryStatus)),
    metric('Open delivery status', formatStanceSummary(overview.byOpenDeliveryStatus)),
    metric('Event types', formatStanceSummary(overview.byType)),
    metric('Severity', formatStanceSummary(overview.bySeverity)),
    metric('Sources', compactCountMap(overview.bySourceKey)),
    metric('Open sources', compactCountMap(overview.byOpenSourceKey)),
    metric('Next delivery', overview.nextDeliveryAt || 'none'),
    metric('Oldest open', overview.oldestUnacknowledgedAt || 'none'),
    metric('Next', overview.recommendedNextAction || 'none'),
    renderNotificationSourceHotspots(overview.sourceHotspots || []),
    evidenceList((attention.failedEvents || []).slice(0, 5).map(function (event) {
      return (event.deliveryStatus || 'failed') + ' | ' + event.type + ' | ' + event.id + ' | attempts=' + (event.deliveryAttempts || 0);
    }).concat((attention.reviewableEvents || []).slice(0, 5).map(function (event) {
      return (event.deliveryStatus || 'delivered') + ' | ' + event.type + ' | ' + event.id + ' | reviewable';
    })))
  ].join(''), 'wide');
}

function renderNotificationSynthesisPolicyLegacy(policy) {
  const defaults = policy.defaults || {};
  return panel('Notification synthesis policy', [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('Dry-run', defaults.dryRun ? 'yes' : 'no', defaults.dryRun ? 'ok' : 'warn'),
      summaryTile('Alert severities', String((defaults.alertSeverities || []).length), 'warn'),
      summaryTile('Source threshold', String(defaults.sourceAttentionPriorityScoreThreshold || 0), 'warn'),
      summaryTile('Event types', String((policy.eventTypes || []).length), 'ok')
    ].join('') + '</div>',
    metric('Immutable', (defaults.immutableExistingStates || []).join(',') || 'none'),
    metric('Mutation statuses', (defaults.mutationStatuses || []).join(',') || 'none'),
    metric('Next', policy.recommendedNextAction || 'none'),
    renderNotificationSynthesisPolicyRows(policy.eventTypes || []),
    evidenceList((policy.sharedRules || []).map(function (rule) {
      return rule.key + ' | ' + rule.summary;
    }))
  ].join(''), 'wide');
}

function renderNotificationSynthesisPolicyRowsLegacy(eventTypes) {
  if (!eventTypes.length) return '<div class="muted">No synthesis policy event types.</div>';
  return '<div class="source-hotspot-list">' + eventTypes.map(function (item) {
    const rules = (item.alertRules || []).map(function (rule) {
      return rule.threshold === undefined ? rule.key : rule.key + '=' + rule.threshold;
    }).join(', ');
    const details = [
      item.sourceScoped ? 'source-scoped' : 'global',
      item.staleResolution ? 'stale-resolution' : 'no-stale-resolution',
      item.reopensAutoResolved ? 'reopen-auto-resolved' : 'no-reopen',
      item.preservesDeliveryState ? 'preserve-delivery-state' : undefined,
      rules ? 'rules=' + rules : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.type || 'unknown-type') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' +
      statusBadge(item.staleResolution ? 'managed' : 'direct', item.staleResolution ? 'ok' : 'muted') +
      '</div>';
  }).join('') + '</div>';
}

function renderEventListSummaryLegacy(events) {
  const pending = events.filter(function (event) { return (event.deliveryStatus || 'pending') === 'pending'; }).length;
  const failed = events.filter(function (event) { return event.deliveryStatus === 'failed'; }).length;
  const resolved = events.filter(function (event) { return event.deliveryStatus === 'resolved'; }).length;
  const open = events.filter(function (event) { return !event.acknowledgedAt; }).length;
  return '<div class="summary-strip event-summary-strip">' + [
    summaryTile('显示', String(events.length)),
    summaryTile('未确认', String(open), open > 0 ? 'warn' : 'ok'),
    summaryTile('待投递', String(pending), pending > 0 ? 'warn' : 'ok'),
    summaryTile('失败', String(failed), failed > 0 ? 'fail' : 'ok'),
    summaryTile('已解决', String(resolved), 'ok')
  ].join('') + '</div>';
}

function renderNotificationEventRowLegacy(event) {
  const ackLabel = event.acknowledgedAt ? '已确认' : '确认';
  const disabled = event.acknowledgedAt ? ' disabled' : '';
  const title = event.title || event.summary || event.id || 'untitled-event';
  const summary = event.summary && event.summary !== title ? '<small>' + escapeHtml(event.summary) + '</small>' : '';
  const meta = eventMetadata(event).join(' · ');
  const controls = '<span class="button-group source-op-buttons">' +
    renderEventSourceDrilldownButton(event) +
    '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id) + '"' + disabled + '>' + ackLabel + '</button>' +
    '</span>';
  return '<div class="action-row event-row"><span><strong>' + escapeHtml(title) + '</strong>' + summary + '<small>' + escapeHtml(meta) + '</small></span>' + controls + '</div>';
}

function renderNotificationEventRowLegacy2(event) {
  const ackLabel = event.acknowledgedAt ? 'Acknowledged' : 'Acknowledge';
  const disabled = event.acknowledgedAt ? ' disabled' : '';
  const title = event.title || event.summary || event.id || 'untitled-event';
  const summary = event.summary && event.summary !== title ? '<small>' + escapeHtml(event.summary) + '</small>' : '';
  const meta = eventMetadata(event).join(' | ');
  const controls = '<span class="button-group source-op-buttons">' +
    renderEventDetailButtonControl(event) +
    renderEventSourceDrilldownButton(event) +
    renderEventTaskDetailButton(event) +
    '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id) + '"' + disabled + '>' + ackLabel + '</button>' +
    '</span>';
  return '<div class="action-row event-row"><span><strong>' + escapeHtml(title) + '</strong>' + summary + '<small>' + escapeHtml(meta) + '</small></span>' + controls + '</div>';
}

function renderEventDetailButtonControl(event) {
  if (!event || !event.id) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-event-detail" data-event-id="' + escapeHtml(event.id) + '">Detail</button>';
}

function renderEventTaskDetailButton(event) {
  if (!event || !event.taskId) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-task-detail" data-task-id="' + escapeHtml(event.taskId) + '" data-trace-limit="20">Task</button>';
}

function renderNotificationSourceHotspotsLegacy(hotspots) {
  if (!hotspots.length) return '';
  return '<div class="source-hotspot-list">' + hotspots.slice(0, 5).map(function (hotspot) {
    const details = [
      'open=' + (hotspot.openCount || 0),
      'failed=' + (hotspot.failedCount || 0),
      'due=' + (hotspot.dueForDeliveryCount || 0),
      'exhausted=' + (hotspot.retryExhaustedCount || 0),
      hotspot.oldestUnacknowledgedAt ? 'oldest=' + hotspot.oldestUnacknowledgedAt : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(hotspot.sourceKey || hotspot.sourceId || 'unknown-source') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderEventSourceDrilldownButton(hotspot) +
      '</span></div>';
  }).join('') + '</div>';
}

function renderEventList(result) {
  const events = result.events || [];
  const overview = result.overview;
  const policy = result.policy;
  const summary = renderEventListSummary(events);
  const title = 'Notification stream | ' + currentEventFilterSummary();
  const listPanel = events.length === 0
    ? panel(title, summary + renderNotificationEventEmptyState(overview), 'wide')
    : panel(title, summary + events.map(renderNotificationEventRow).join(''), 'wide');
  return (overview ? renderNotificationEventOverview(overview) : '') +
    (policy ? renderNotificationSynthesisPolicy(policy) : '') +
    listPanel;
}

function renderNotificationEventOverview(overview) {
  const attention = overview.attention || {};
  const attentionRows = (attention.failedEvents || []).slice(0, 3).map(function (event) {
    return notificationOutboxAttentionRow(event, 'failed');
  }).concat((attention.reviewableEvents || []).slice(0, 3).map(function (event) {
    return notificationOutboxAttentionRow(event, 'reviewable');
  }));
  return [
    '<article class="notification-outbox-hero">',
      '<section class="notification-outbox-main">',
        '<div class="notification-outbox-header">',
          '<span class="notification-outbox-label">Notification outbox</span>',
          statusBadge(overview.status || 'unknown', statusVariant(overview.status)),
        '</div>',
        '<h3>' + escapeHtml(overview.recommendedNextAction || 'Notification outbox is clear in the current window.') + '</h3>',
        '<p>' + escapeHtml([
          'delivery=' + formatStanceSummary(overview.byDeliveryStatus),
          'severity=' + formatStanceSummary(overview.bySeverity),
          'sources=' + compactCountMap(overview.bySourceKey)
        ].filter(Boolean).join(' | ')) + '</p>',
      '</section>',
      '<aside class="notification-outbox-signals">',
        notificationOutboxSignal('Window', overview.eventCount || 0, (overview.eventCount || 0) > 0 ? 'info' : 'muted'),
        notificationOutboxSignal('Open', overview.unacknowledgedCount || 0, (overview.unacknowledgedCount || 0) > 0 ? 'warn' : 'ok'),
        notificationOutboxSignal('Due', overview.dueForDeliveryCount || 0, (overview.dueForDeliveryCount || 0) > 0 ? 'warn' : 'ok'),
        notificationOutboxSignal('Failed', overview.failedCount || 0, (overview.failedCount || 0) > 0 ? 'fail' : 'ok'),
      '</aside>',
      '<section class="notification-outbox-next">',
        '<span>Timing</span>',
        '<strong>' + escapeHtml(overview.nextDeliveryAt || 'no scheduled delivery') + '</strong>',
        '<small>' + escapeHtml('oldest open=' + (overview.oldestUnacknowledgedAt || 'none') + ' | open sources=' + compactCountMap(overview.byOpenSourceKey)) + '</small>',
      '</section>',
      '<section class="notification-outbox-attention">',
        '<span>Attention queue</span>',
        (attentionRows.length ? attentionRows.join('') : '<div class="notification-outbox-empty">No failed or reviewable notification signals.</div>'),
      '</section>',
      renderNotificationSourceHotspots(overview.sourceHotspots || []),
    '</article>'
  ].join('');
}

function notificationOutboxSignal(label, value, variant) {
  return '<div class="notification-outbox-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function notificationOutboxAttentionRow(event, label) {
  return '<div class="notification-outbox-attention-row">' +
    '<strong>' + escapeHtml(event.type || 'notification') + '</strong>' +
    '<small>' + escapeHtml([label, event.deliveryStatus || 'unknown', event.id, event.deliveryAttempts === undefined ? undefined : 'attempts=' + event.deliveryAttempts].filter(Boolean).join(' | ')) + '</small>' +
    '</div>';
}

function renderNotificationSynthesisPolicy(policy) {
  const defaults = policy.defaults || {};
  return panel('Notification synthesis policy', [
    '<div class="notification-policy-shell">',
      '<section class="notification-policy-head">',
        '<span>Policy guard</span>',
        '<strong>' + escapeHtml(policy.recommendedNextAction || 'Use dry-run synthesis before executing notification alerts.') + '</strong>',
        '<small>' + escapeHtml('immutable=' + ((defaults.immutableExistingStates || []).join(',') || 'none') + ' | mutation=' + ((defaults.mutationStatuses || []).join(',') || 'none')) + '</small>',
      '</section>',
      '<div class="summary-strip event-summary-strip notification-policy-summary">' + [
        summaryTile('Dry-run', defaults.dryRun ? 'yes' : 'no', defaults.dryRun ? 'ok' : 'warn'),
        summaryTile('Alert severities', String((defaults.alertSeverities || []).length), 'warn'),
        summaryTile('Source threshold', String(defaults.sourceAttentionPriorityScoreThreshold || 0), 'warn'),
        summaryTile('Event types', String((policy.eventTypes || []).length), 'ok')
      ].join('') + '</div>',
      renderNotificationSynthesisPolicyRows(policy.eventTypes || []),
      '<div class="notification-policy-rules">' + (policy.sharedRules || []).map(function (rule) {
        return '<span>' + escapeHtml(rule.key + ' | ' + rule.summary) + '</span>';
      }).join('') + '</div>',
    '</div>'
  ].join(''), 'wide');
}

function renderNotificationSynthesisPolicyRows(eventTypes) {
  if (!eventTypes.length) return '<div class="muted">No synthesis policy event types.</div>';
  return '<div class="notification-policy-list">' + eventTypes.map(function (item) {
    const rules = (item.alertRules || []).map(function (rule) {
      return rule.threshold === undefined ? rule.key : rule.key + '=' + rule.threshold;
    }).join(', ');
    const details = [
      item.staleResolution ? 'stale-resolution' : 'no-stale-resolution',
      item.reopensAutoResolved ? 'reopen-auto-resolved' : 'no-reopen',
      item.preservesDeliveryState ? 'preserve-delivery-state' : undefined,
      rules ? 'rules=' + rules : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="notification-policy-row">' +
      '<section>' +
        '<span class="notification-policy-type">' + escapeHtml(item.sourceScoped ? 'source-scoped' : 'global') + '</span>' +
        '<strong>' + escapeHtml(item.type || 'unknown-type') + '</strong>' +
        '<small>' + escapeHtml(details) + '</small>' +
      '</section>' +
      '<div class="notification-policy-state">' +
        statusBadge(item.staleResolution ? 'managed' : 'direct', item.staleResolution ? 'ok' : 'muted') +
      '</div>' +
      '</div>';
  }).join('') + '</div>';
}

function renderEventListSummary(events) {
  const pending = events.filter(function (event) { return (event.deliveryStatus || 'pending') === 'pending'; }).length;
  const failed = events.filter(function (event) { return event.deliveryStatus === 'failed'; }).length;
  const resolved = events.filter(function (event) { return event.deliveryStatus === 'resolved'; }).length;
  const open = events.filter(function (event) { return !event.acknowledgedAt; }).length;
  return '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Shown', String(events.length)),
    summaryTile('Open', String(open), open > 0 ? 'warn' : 'ok'),
    summaryTile('Pending', String(pending), pending > 0 ? 'warn' : 'ok'),
    summaryTile('Failed', String(failed), failed > 0 ? 'fail' : 'ok'),
    summaryTile('Resolved', String(resolved), 'ok')
  ].join('') + '</div>';
}

function renderNotificationEventRow(event) {
  const ackLabel = event.acknowledgedAt ? 'Acknowledged' : 'Acknowledge';
  const disabled = event.acknowledgedAt ? ' disabled' : '';
  const title = event.title || event.summary || event.id || 'untitled-event';
  const summary = event.summary && event.summary !== title ? event.summary : 'Notification event is waiting in the current outbox window.';
  const source = [event.sourceKey, event.sourceId].filter(Boolean).join(' / ') || 'global';
  const controls = '<section class="notification-event-actions button-group source-op-buttons">' +
    renderEventDetailButtonControl(event) +
    renderEventSourceDrilldownButton(event) +
    renderEventTaskDetailButton(event) +
    '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id) + '"' + disabled + '>' + ackLabel + '</button>' +
    '</section>';
  return '<div class="notification-event-row ' + statusClassName(statusVariant(event.severity || event.deliveryStatus)) + '">' +
    '<section class="notification-event-anchor">' +
      '<span class="notification-event-source">' + escapeHtml(source) + '</span>' +
      '<strong>' + escapeHtml(event.type || 'notification') + '</strong>' +
      '<small>' + escapeHtml(event.createdAt || 'time unknown') + '</small>' +
    '</section>' +
    '<section class="notification-event-brief">' +
      '<p>' + escapeHtml(title) + '</p>' +
      '<small>' + escapeHtml(summary) + '</small>' +
      '<div class="notification-event-chips">' +
        authorMetaChip('severity', event.severity || 'unknown', statusVariant(event.severity)) +
        authorMetaChip('delivery', event.deliveryStatus || 'pending', statusVariant(event.deliveryStatus || 'pending')) +
        authorMetaChip('attempts', event.deliveryAttempts || 0, (event.deliveryAttempts || 0) > 0 ? 'warn' : 'muted') +
        authorMetaChip('ack', event.acknowledgedAt ? 'yes' : 'no', event.acknowledgedAt ? 'ok' : 'warn') +
      '</div>' +
    '</section>' +
    controls +
    '</div>';
}

function renderNotificationEventEmptyState(overview) {
  return '<div class="notification-empty-state">' +
    '<span>Standby</span>' +
    '<strong>No notification events match this filter.</strong>' +
    '<small>' + escapeHtml(overview && overview.recommendedNextAction || 'Generate alerts from source attention, author review, or runbook checks when something needs operator action.') + '</small>' +
    '</div>';
}

function renderNotificationSourceHotspots(hotspots) {
  if (!hotspots.length) return '';
  return '<section class="notification-hotspots"><span>Source hotspots</span>' + hotspots.slice(0, 5).map(function (hotspot) {
    const details = [
      'open=' + (hotspot.openCount || 0),
      'failed=' + (hotspot.failedCount || 0),
      'due=' + (hotspot.dueForDeliveryCount || 0),
      'exhausted=' + (hotspot.retryExhaustedCount || 0),
      hotspot.oldestUnacknowledgedAt ? 'oldest=' + hotspot.oldestUnacknowledgedAt : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="notification-hotspot-row"><section>' +
      '<strong>' + escapeHtml(hotspot.sourceKey || hotspot.sourceId || 'unknown-source') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</section><span class="button-group source-op-buttons">' +
      renderEventSourceDrilldownButton(hotspot) +
      '</span></div>';
  }).join('') + '</section>';
}

function renderEventSourceDrilldownButton(source) {
  if (!source || (!source.sourceId && !source.sourceKey)) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-drilldown" data-source-id="' + escapeHtml(source.sourceId || '') + '" data-source-key="' + escapeHtml(source.sourceKey || '') + '" data-limit="50">Ops</button>' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-collection-health" data-source-id="' + escapeHtml(source.sourceId || '') + '" data-source-key="' + escapeHtml(source.sourceKey || '') + '" data-limit="50">Health</button>';
}

function eventMetadata(event) {
  const source = event.sourceKey || event.sourceId ? '来源 ' + [event.sourceKey, event.sourceId].filter(Boolean).join('/') : '';
  const ack = event.acknowledgedAt ? '确认 ' + [event.acknowledgedBy, event.acknowledgedAt].filter(Boolean).join(' ') : '未确认';
  return [
    event.createdAt,
    event.type,
    event.severity,
    event.deliveryStatus || 'pending',
    source,
    ack
  ].filter(Boolean);
}

function currentEventFilterSummary() {
  const formElement = document.getElementById('eventFilterForm');
  if (!formElement) return '未确认 · 全部状态 · 全部类型';
  const form = new FormData(formElement);
  const acknowledged = String(form.get('acknowledged') || '');
  const deliveryStatus = String(form.get('deliveryStatus') || '');
  const type = String(form.get('type') || '');
  const sourceKey = String(form.get('sourceKey') || '').trim();
  const sourceId = String(form.get('sourceId') || '').trim();
  const scope = acknowledged === 'true' ? '已确认' : (acknowledged === 'false' ? '未确认' : '全部');
  return [
    scope,
    deliveryStatus || '全部状态',
    type || '全部类型',
    sourceKey || '全部来源',
    sourceId || 'all source ids'
  ].join(' · ');
}

function renderEventDispatchResult(result) {
  const filters = result.filters || {};
  return panel('事件投递完成', [
    metric('通道', result.channelKey),
    metric('Scope', formatEventSourceScope(filters)),
    metric('Limit', filters.limit || 'default'),
    metric('已投递', result.dispatchedCount),
    metric('失败', result.failedCount),
    metric('跳过', result.skippedCount)
  ].join(''), 'wide');
}

function formatEventSourceScope(filters) {
  const parts = [
    filters.sourceKey ? 'sourceKey=' + filters.sourceKey : undefined,
    filters.sourceId ? 'sourceId=' + filters.sourceId : undefined
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'all sources';
}

function renderEventAckResult(result) {
  return panel('事件已确认', [
    metric('事件 ID', result.event.id),
    metric('确认时间', result.event.acknowledgedAt),
    metric('确认人', result.event.acknowledgedBy)
  ].join(''), 'wide');
}

function renderEventBatchAckResult(result) {
  const title = result.dryRun ? 'Notification acknowledgement preview' : 'Notification events acknowledged';
  return panel(title, [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('Status', result.status || 'unknown', statusVariant(result.status)),
      summaryTile('Dry-run', result.dryRun ? 'yes' : 'no', result.dryRun ? 'warn' : 'ok'),
      summaryTile('Candidates', String(result.candidateCount || 0), result.candidateCount > 0 ? 'warn' : 'muted'),
      summaryTile('Acked', String(result.acknowledgedCount || 0), result.acknowledgedCount > 0 ? 'ok' : 'muted'),
      summaryTile('Skipped', String(result.skippedCount || 0), result.skippedCount > 0 ? 'warn' : 'ok'),
      summaryTile('Window', String(result.eventCount || 0))
    ].join('') + '</div>',
    metric('Acknowledged by', result.acknowledgedBy || 'system'),
    evidenceList((result.results || []).slice(0, 8).map(function (item) {
      return item.status + ' | ' + item.eventId + (item.reason ? ' | ' + item.reason : '');
    }))
  ].join(''), 'wide');
}

function renderEventArchiveResult(result) {
  const rows = result.results && result.results.length ? result.results : result.candidates || [];
  return panel('Notification event archive', [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('Status', result.status || 'unknown', statusVariant(result.status)),
      summaryTile('Dry-run', result.dryRun ? 'yes' : 'no', result.dryRun ? 'warn' : 'ok'),
      summaryTile('Candidates', String(result.candidateCount || 0), result.candidateCount > 0 ? 'warn' : 'ok'),
      summaryTile('Archived', String(result.archivedCount || 0), result.archivedCount > 0 ? 'ok' : 'muted')
    ].join('') + '</div>',
    metric('Cutoff', result.cutoffAt || 'none'),
    metric('Batch', result.batchId || 'none'),
    evidenceList(rows.slice(0, 8).map(function (item) {
      return (item.status || 'candidate') + ' | ' + (item.eventId || item.id) + ' | ' + (item.sourceKey || (item.event && item.event.sourceKey) || 'unknown');
    })),
    metric('Next', result.recommendedNextAction || 'none')
  ].join(''), 'wide');
}

function renderSemanticInsights(insights) {
  return panel('语义增强', [
    metric('Provider', insights.provider),
    metric('摘要', insights.summary),
    evidenceList((insights.entityInsights || []).slice(0, 5).map(function (item) {
      const refs = (item.evidenceRefs || []).map(function (ref) { return '#' + ref.floor; }).join(', ');
      return '实体 ' + item.name + ' · ' + item.confidence + ' · ' + refs;
    })),
    evidenceList((insights.opinionInsights || []).slice(0, 5).map(function (item) {
      return '观点 #' + item.floor + ' · ' + item.attitude + ' · ' + item.confidence;
    })),
    evidenceList((insights.limitations || []).map(function (item) {
      return '限制：' + item;
    }))
  ].join(''), 'wide');
}

function renderRawPageFetchResult(result) {
  return panel('原始页已抓取', [
    metric('SHA1', result.rawPage.contentSha1),
    metric('论坛', result.rawPage.sourceKey),
    metric('URL', result.rawPage.sourceUrl),
    metric('重复', result.duplicate ? '是' : '否')
  ].join(''), 'wide');
}

function renderRawPageFetchWindowResult(windowResult) {
  if (!windowResult || !Array.isArray(windowResult.results) || windowResult.results.length === 0) {
    return '<div class="muted">No raw pages were fetched.</div>';
  }
  if (windowResult.results.length === 1) return renderRawPageFetchResult(windowResult.results[0].result);
  const rows = windowResult.results.map(function (item) {
    const rawPage = item.result && item.result.rawPage || {};
    const details = [
      'page=' + item.page,
      rawPage.contentSha1 ? 'sha1=' + rawPage.contentSha1 : undefined,
      rawPage.sourceUrl || undefined,
      item.result && item.result.duplicate ? 'duplicate' : 'new'
    ].filter(Boolean).join(' | ');
    return '<div class="action-row"><span>' +
      escapeHtml(rawPage.sourceUrl || ('page ' + item.page)) +
      '<small>' + escapeHtml(details) + '</small></span></div>';
  }).join('');
  return panel('Raw pages fetched', [
    metric('Start page', windowResult.startPage),
    metric('Pages', windowResult.pageCount),
    rows
  ].join(''), 'wide');
}

function renderRawPageReplayResult(result) {
  return panel('原始页回放完成', [
    metric('任务 ID', result.task.id),
    metric('状态', result.task.status),
    metric('主题', result.report.thread.title),
    metric('楼层', result.report.thread.parsedPostCount)
  ].join(''), 'wide');
}

function renderRawPageList(result) {
  const pages = result.pages || [];
  if (pages.length === 0) return panel('原始页证据', '<div class="muted">暂无</div>', 'wide');
  return panel('原始页证据', pages.map(function (page) {
    const meta = page.metadata || {};
    const details = [
      page.sourceKey,
      page.sourceThreadId || 'unknown-thread',
      page.contentSha1,
      meta.status ? 'HTTP ' + meta.status : '',
      page.fetchedAt
    ].filter(Boolean).join(' · ');
    return '<div class="action-row"><span>' + escapeHtml(page.sourceUrl || page.contentSha1) + '<small>' + escapeHtml(details) + '</small></span><button class="inline-button" type="button" data-action="replay-raw-page" data-source-key="' + escapeHtml(page.sourceKey) + '" data-content-sha1="' + escapeHtml(page.contentSha1) + '">回放</button></div>';
  }).join(''), 'wide');
}

function renderSourceList(result) {
  const sources = result.sources || [];
  const sourceDiagnostics = result.diagnostics || {};
  const diagnosticsBySourceId = sourceDiagnosticMap(sourceDiagnostics);
  const diagnosticsPanel = renderSourceDiagnostics(sourceDiagnostics);
  if (sources.length === 0) return diagnosticsPanel + panel('跟踪来源', '<div class="muted">暂无</div>', 'wide');
  return diagnosticsPanel + panel('跟踪来源', sources.map(function (source) {
    const runState = source.runState || {};
    const schedule = source.schedule || {};
    const cursor = source.cursor || {};
    const cursorDiff = runState.lastCursorDiff || {};
    const diagnostics = diagnosticsBySourceId[source.id];
    const runLabel = runState.status || 'never-run';
    const scheduleLabel = schedule.intervalMinutes ? ' · every ' + schedule.intervalMinutes + 'm' : '';
    const cursorLabel = cursor.postCount !== undefined ? ' · posts ' + cursor.postCount + ' / #' + cursor.lastFloor : '';
    const diffLabel = cursorDiff.newPostCount !== undefined ? ' · +' + cursorDiff.newPostCount : '';
    const lastTask = runState.lastTaskId ? ' · ' + runState.lastTaskId : '';
    const diagnosticLabel = diagnostics ? ' · config ' + diagnostics.status : '';
    return '<div class="action-row"><span>' + escapeHtml(source.displayName) + '<small>' + escapeHtml(source.id + ' · ' + source.sourceType + ' · ' + runLabel + diagnosticLabel + scheduleLabel + cursorLabel + diffLabel + lastTask) + '</small></span><span class="button-group"><button class="inline-button" type="button" data-action="run-source" data-source-id="' + escapeHtml(source.id) + '">运行</button><button class="inline-button secondary-inline-button" type="button" data-action="run-source-pipeline" data-source-id="' + escapeHtml(source.id) + '">洞察</button></span></div>';
  }).join(''), 'wide');
}

function renderSourceOpsList(result) {
  const sources = result.sources || [];
  const sourceDiagnostics = result.diagnostics || {};
  const diagnosticsBySourceId = sourceDiagnosticMap(sourceDiagnostics);
  const diagnosticsPanel = renderSourceDiagnostics(sourceDiagnostics);
  if (sources.length === 0) return diagnosticsPanel + panel('Tracked sources', '<div class="muted">No tracked sources yet.</div>', 'wide');
  return diagnosticsPanel + panel('Tracked sources', sources.map(function (source) {
    const runState = source.runState || {};
    const schedule = source.schedule || {};
    const cursor = source.cursor || {};
    const cursorDiff = runState.lastCursorDiff || {};
    const diagnostics = diagnosticsBySourceId[source.id];
    const runLabel = runState.status || 'never-run';
    const controls = '<section class="source-work-actions button-group source-op-buttons">' +
      renderSourceDrilldownButton(source) +
      '<button class="inline-button" type="button" data-action="run-source" data-source-id="' + escapeHtml(source.id) + '">Run</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-source-pipeline" data-source-id="' + escapeHtml(source.id) + '">Insight</button>' +
      '</section>';
    return '<div class="source-work-row tracked-source-row ' + statusClassName(statusVariant(runState.status || diagnostics && diagnostics.status || 'ok')) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(source.sourceType || source.sourceKey || 'source') + '</span>' +
        '<strong>' + escapeHtml(source.displayName || source.id) + '</strong>' +
        '<small>' + escapeHtml(source.id || 'unknown source') + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml([formatSourceLocationSummary(source.location || {}), runState.lastTaskId].filter(Boolean).join(' | ') || 'Tracked source is ready for operation.') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('key', source.sourceKey || 'none', source.sourceKey ? 'info' : 'muted') +
          authorMetaChip('run', runLabel, statusVariant(runLabel)) +
          authorMetaChip('config', diagnostics ? diagnostics.status : 'unknown', diagnostics ? statusVariant(diagnostics.status) : 'muted') +
          authorMetaChip('every', schedule.intervalMinutes ? schedule.intervalMinutes + 'm' : 'none', schedule.intervalMinutes ? 'info' : 'muted') +
          authorMetaChip('posts', cursor.postCount !== undefined ? cursor.postCount + ' / #' + cursor.lastFloor : 'none', cursor.postCount !== undefined ? 'ok' : 'muted') +
          authorMetaChip('new', cursorDiff.newPostCount !== undefined ? '+' + cursorDiff.newPostCount : 'none', cursorDiff.newPostCount > 0 ? 'ok' : 'muted') +
        '</div>' +
      '</section>' +
      controls +
      '</div>';
  }).join(''), 'wide');
}

function formatSourceLocationSummary(location) {
  if (!location || typeof location !== 'object') return undefined;
  const parts = [];
  if (location.startPage || location.pageCount) {
    const startPage = location.startPage || 1;
    const pageCount = location.pageCount || 1;
    parts.push('pages ' + startPage + '-' + (startPage + pageCount - 1));
  }
  if (location.url) parts.push('url');
  if (location.inputDir) parts.push('dir');
  if (location.inputFile) parts.push('file');
  return parts.length ? parts.join(' / ') : undefined;
}

function renderSourceDiagnostics(diagnostics) {
  const sources = diagnostics.sources || [];
  if (sources.length === 0) return panel('来源接入诊断', '<div class="muted">No source diagnostics.</div>', 'wide');
  const rows = sources.slice(0, 10).map(function (source) {
    const failed = (source.checks || []).filter(function (check) {
      return check.status !== 'ok';
    }).map(function (check) {
      return check.key + '=' + check.status;
    }).join(', ');
    return source.status + ' | ' + source.displayName + (failed ? ' | ' + failed : '');
  });
  const actions = (diagnostics.nextActions || []).slice(0, 8).map(function (action) {
    const commands = action.commands || (action.command ? [action.command] : []);
    return action.severity + ' | ' + action.sourceId + ' | ' + action.key + ' | ' + commands.join(' | ') + (action.evidenceSummary ? ' evidence=' + action.evidenceSummary : '');
  });
  return panel('来源接入诊断', evidenceList(rows.concat(actions)), 'wide');
}

function sourceDiagnosticMap(diagnostics) {
  return (diagnostics.sources || []).reduce(function (map, source) {
    map[source.sourceId] = source;
    return map;
  }, {});
}

function panel(title, content, className) {
  return '<article class="panel ' + (className || '') + '">' +
    '<div class="panel-head"><h3>' + escapeHtml(title) + '</h3><span class="panel-mark" aria-hidden="true"></span></div>' +
    '<div class="panel-body">' + content + '</div>' +
    '</article>';
}

function metric(label, value) {
  return '<div class="metric-row"><span class="muted">' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function evidenceList(items) {
  if (!items || items.length === 0) return emptySignal('No evidence signals yet.', 'Standby');
  return items.map(function (item) {
    return '<div class="evidence-row"><span>' + escapeHtml(item) + '</span></div>';
  }).join('');
}

function emptySignal(message, label) {
  return '<div class="empty-signal" role="status">' +
    '<span>' + escapeHtml(label || 'Standby') + '</span>' +
    '<strong>' + escapeHtml(message || 'No signal yet.') + '</strong>' +
    '<i aria-hidden="true"></i>' +
    '</div>';
}

function formatCheckValue(value) {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatCapabilities(capabilities) {
  if (!capabilities || typeof capabilities !== 'object') return '';
  return Object.keys(capabilities).sort().map(function (key) {
    return key + '=' + capabilities[key];
  }).join(',');
}

function schemaDriftSummary(schemaDrift) {
  const parts = [];
  if ((schemaDrift.missingExtensions || []).length > 0) {
    parts.push('extensions:' + schemaDrift.missingExtensions.join(','));
  }
  if ((schemaDrift.missingTables || []).length > 0) {
    parts.push('tables:' + schemaDrift.missingTables.join(','));
  }
  if ((schemaDrift.missingColumns || []).length > 0) {
    parts.push('columns:' + schemaDrift.missingColumns.join(','));
  }
  if ((schemaDrift.missingIndexes || []).length > 0) {
    parts.push('indexes:' + schemaDrift.missingIndexes.join(','));
  }
  if ((schemaDrift.inspectionErrors || []).length > 0) {
    parts.push('errors:' + schemaDrift.inspectionErrors.map(function (item) {
      return item.key;
    }).join(','));
  }
  return parts.join(' ');
}

function tagList(items) {
  if (!items || items.length === 0) return emptySignal('No tags yet.', 'Quiet');
  return '<div class="tag-list">' + items.map(function (item) {
    return '<span class="tag">' + escapeHtml(item) + '</span>';
  }).join('') + '</div>';
}

function reviewActionStatusSummary(reviewActions) {
  const summary = reviewActions || {};
  const executions = summary.executions || {};
  return [
    'audits ' + (summary.auditCount || 0),
    'executions ' + (executions.count || 0),
    'running ' + (executions.running || 0),
    'failed ' + (executions.failed || 0),
    'sources ' + compactCountMap(summary.bySourceKey || executions.bySourceKey),
    'latest ' + (summary.latestGeneratedAt || executions.latestUpdatedAt || 'none')
  ].join(' · ');
}

function eventActionStatusSummary(eventActions) {
  const summary = eventActions || {};
  const executions = summary.executions || summary;
  return [
    'executions ' + (executions.count || 0),
    'running ' + (executions.running || 0),
    'stale ' + (executions.staleRunning || 0),
    'failed ' + (executions.failed || 0),
    'sources ' + compactCountMap(executions.bySourceKey),
    'latest ' + (executions.latestUpdatedAt || 'none')
  ].join(' | ');
}

function authorReviewQueueStatusSummary(queue) {
  const summary = queue || {};
  return [
    'open ' + (summary.openCount || 0),
    'high ' + (summary.highPriorityOpenCount || 0),
    'sources ' + compactCountMap(summary.openBySourceKey || summary.bySourceKey),
    'latest ' + (summary.latestUpdatedAt || 'none')
  ].join(' · ');
}

function compactCountMap(counts) {
  const entries = Object.entries(counts || {}).filter(function (entry) {
    return entry[1] > 0;
  });
  if (entries.length === 0) return 'none';
  return entries.slice(0, 4).map(function (entry) {
    return entry[0] + ':' + entry[1];
  }).join(', ') + (entries.length > 4 ? ', +' + String(entries.length - 4) : '');
}

async function requestJson(url, body, options) {
  const safeOptions = options || {};
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok && !safeOptions.acceptErrorStatus) {
    const errorBody = await response.json().catch(function () { return {}; });
    throw new Error(errorBody.error && errorBody.error.message ? errorBody.error.message : response.statusText);
  }
  return response.json();
}

function isCopyCommandAction(button) {
  return button && (button.dataset.action === 'copy-command' || button.dataset.action === 'copy-lifecycle-command');
}

async function copyCommandFromButton(button) {
  const row = button.closest('.lifecycle-command-row');
  const commandElement = row ? row.querySelector('code') : undefined;
  const command = commandElement ? commandElement.textContent : '';
  if (!command) return;
  const originalText = button.textContent;
  try {
    await copyTextToClipboard(command);
    button.textContent = 'Copied';
  } catch (error) {
    button.textContent = 'Copy failed';
  }
  window.setTimeout(function () {
    button.textContent = originalText;
  }, 1500);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Fall through to the textarea copy path for restrictive browser policies.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    if (!document.execCommand || !document.execCommand('copy')) {
      throw new Error('copy command was not accepted');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

async function fetchJson(url, options) {
  const safeOptions = options || {};
  const controller = safeOptions.timeoutMs && typeof AbortController !== 'undefined'
    ? new AbortController()
    : undefined;
  const timeoutId = controller
    ? window.setTimeout(function () {
      controller.abort();
    }, safeOptions.timeoutMs)
    : undefined;
  let response;
  try {
    response = await fetch(url, controller ? { signal: controller.signal } : undefined);
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('Request timed out: ' + url);
    throw error;
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
  if (!response.ok && !safeOptions.acceptErrorStatus) throw new Error(response.statusText);
  return response.json();
}

function createOperationalOverviewFallback(error) {
  return {
    status: 'warn',
    storageMode: 'deferred',
    generatedAt: new Date().toISOString(),
    sources: {},
    tasks: {},
    events: {},
    workers: {
      leases: {}
    },
    rawPages: {},
    authorReviewQueue: {},
    reviewActions: {
      executions: {}
    },
    notificationEventActions: {},
    warning: error && error.message ? error.message : 'Operational overview unavailable.'
  };
}

function renderError(targetId, error) {
  document.getElementById(targetId).innerHTML = renderFeedbackState('error', error && error.message ? error.message : error);
}

function renderFeedbackState(type, message) {
  const isError = type === 'error';
  const safeMessage = escapeHtml(message || (isError ? 'Request failed.' : 'Loading...'));
  const role = isError ? 'alert' : 'status';
  const label = isError ? 'Blocked' : 'Working';
  const detail = isError ? '请求未完成。' : '结果准备中。';
  const skeleton = isError ? '' : '<div class="feedback-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>';
  return '<div class="' + (isError ? 'error ' : 'empty ') + 'feedback-state feedback-state-' + (isError ? 'error' : 'loading') + '" role="' + role + '" aria-live="polite">' +
    '<div class="feedback-head"><span>' + label + '</span><strong>' + safeMessage + '</strong><small>' + escapeHtml(detail) + '</small></div>' +
    skeleton +
    '</div>';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
