'use strict';

const state = {
  adapters: [],
  sourceTypes: [],
  currentView: 'history',
  rolloutManifestDraft: undefined
};

const views = {
  history: {
    title: '历史分析',
    subtitle: '解析保存页目录，生成作者、实体、观点和证据概览。'
  },
  context: {
    title: '新发言解读',
    subtitle: '输入一条新发言，召回相关历史楼层和匹配理由。'
  },
  search: {
    title: '历史检索',
    subtitle: '先把保存页写入本地证据索引，再按关键词检索可引用的历史发言。'
  },
  system: {
    title: '系统状态',
    subtitle: '查看 API、适配器和本地服务状态。'
  }
};

document.addEventListener('DOMContentLoaded', function () {
  bindNavigation();
  bindForms();
  document.getElementById('refreshAdaptersButton').addEventListener('click', loadAdapters);
  document.getElementById('enrichHistoryButton').addEventListener('click', enrichHistoryDirectory);
  document.getElementById('refreshAuthorIntelligenceButton').addEventListener('click', loadAuthorIntelligence);
  document.getElementById('authorIntelligenceResult').addEventListener('click', handleAuthorIntelligenceAction);
  document.getElementById('refreshTasksButton').addEventListener('click', loadTasks);
  document.getElementById('refreshSourcesButton').addEventListener('click', loadSources);
  document.getElementById('refreshSourceOperationsButton').addEventListener('click', loadSourceOperations);
  document.getElementById('onboardingResult').addEventListener('click', handleOnboardingAction);
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
  document.getElementById('crawlUrlButton').addEventListener('click', crawlThreadUrl);
  loadAdapters();
  loadConnectorCatalog();
  loadSystemStatus();
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
        intervalMinutes: Number(form.get('intervalMinutes')) || undefined
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
    const form = new FormData(event.currentTarget);
    await renderAsync('deploymentGateResult', function () {
      return requestJson('/api/deployment/gate', parseManifestJson(form.get('manifestJson')), {
        acceptErrorStatus: true
      });
    }, renderDeploymentGateReport);
  });

  document.getElementById('rolloutApplyForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request = parseManifestJson(form.get('manifestJson'));
    request.execute = form.get('execute') === 'true';
    await renderAsync('rolloutApplyResult', function () {
      return requestJson('/api/operations/rollout-manifest/apply', request, {
        acceptErrorStatus: true
      });
    }, renderRolloutManifestApply);
    await loadSources();
    await loadSourceOperations();
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

  document.getElementById('sourceOperationsResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'copy-lifecycle-command') {
      await copyLifecycleCommandFromButton(button);
      return;
    }
    if (button.dataset.action === 'synthesize-runbook-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('Create notification events from current runbook actions?')) return;
      await synthesizeRunbookEventsFromButton(button, execute);
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
    if (button.dataset.action === 'load-source-drilldown') {
      await loadSourceOperationsDrilldownFromButton(button);
      return;
    }
    if (button.dataset.action === 'run-source' || button.dataset.action === 'run-source-pipeline') {
      await runSourceTaskFromButton(button, 'sourceOperationActionResult');
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
    if (button.dataset.action === 'load-source-drilldown') {
      await loadSourceOperationsDrilldownFromButton(button);
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

function handleOnboardingAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'load-rollout-manifest-draft') {
    fillRolloutManifestForms(state.rolloutManifestDraft);
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

function parseOptionalLocationJson(value) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Location JSON must be an object.');
  }
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

function setView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.nav-item').forEach(function (button) {
    button.classList.toggle('active', button.dataset.view === viewName);
  });
  document.querySelectorAll('.view-panel').forEach(function (panel) {
    panel.classList.add('hidden');
  });
  document.getElementById(viewName + 'View').classList.remove('hidden');
  document.getElementById('viewTitle').textContent = views[viewName].title;
  document.getElementById('viewSubtitle').textContent = views[viewName].subtitle;
  if (viewName === 'system') loadSystemStatus();
  if (viewName === 'system') loadSources();
  if (viewName === 'system') loadSourceOperations();
  if (viewName === 'system') loadEvents();
  if (viewName === 'system') loadContextReviewResults();
  if (viewName === 'system') loadRawPages();
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
  } catch (error) {
    renderError('historyResult', error);
  }
}

async function loadConnectorCatalog() {
  try {
    const result = await fetchJson('/api/connectors/catalog', {
      acceptErrorStatus: true
    });
    state.sourceTypes = mergeSourceTypeLists(state.sourceTypes, result.sourceTypes || []);
    fillSuggestionLists();
  } catch (error) {
    state.sourceTypes = state.sourceTypes || [];
  }
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
  const known = new Set();
  (current || []).concat(incoming || []).forEach(function (item) {
    if (!item || !item.sourceType || known.has(item.sourceType)) return;
    known.add(item.sourceType);
    result.push(item);
  });
  return result;
}

async function loadSystemStatus() {
  const target = document.getElementById('systemStatus');
  try {
    const health = await fetchJson('/health');
    const adapters = await fetchJson('/adapters');
    const openApi = await fetchJson('/openapi.json');
    const overview = await fetchJson('/api/operations/overview?limit=100');
    const adapterDiagnostics = await fetchJson('/api/adapters/diagnostics', {
      acceptErrorStatus: true
    });
    const diagnostics = await fetchJson('/api/runtime/diagnostics', {
      acceptErrorStatus: true
    });
    const sourceDiagnostics = await fetchJson('/api/sources/diagnostics?limit=100', {
      acceptErrorStatus: true
    });
    const deploymentChecklist = await fetchJson('/api/deployment/checklist?limit=100', {
      acceptErrorStatus: true
    });
    const operationsReadiness = await fetchJson('/api/operations/readiness?limit=100', {
      acceptErrorStatus: true
    });
    const operationsRunbook = await fetchJson('/api/operations/runbook?limit=100', {
      acceptErrorStatus: true
    });
    const notificationDiagnostics = await fetchJson('/api/notifications/diagnostics', {
      acceptErrorStatus: true
    });
    const resourceStatusRows = diagnostics.configuration.storageMode === 'postgres'
      ? [statusRow('Postgres', diagnosticStatus(diagnostics, 'resources.postgres'))]
      : [
        statusRow('Input dir', diagnosticStatus(diagnostics, 'resources.inputDir')),
        statusRow('Store dir', diagnosticStatus(diagnostics, 'resources.storeDir'))
      ];
    const rows = [
      statusRow('服务', health.ok ? '运行中' : '异常'),
      statusRow('诊断', diagnostics.status),
      statusRow('Deploy', deploymentChecklist.status),
      statusRow('Readiness', readinessStatusSummary(operationsReadiness)),
      statusRow('Runbook', operationsRunbook.status + ' · ' + operationsRunbook.actionCount),
      statusRow('存储', overview.storageMode),
      statusRow('Adapters', adapterDiagnostics.status + ' · ' + adapterDiagnostics.adapterCount),
      statusRow('Source config', sourceDiagnostics.status + ' · ' + sourceDiagnostics.sourceCount),
      statusRow('Notify', diagnosticStatus(notificationDiagnostics, 'notifications.channel') + ' · ' + notificationDiagnostics.channel),
      statusRow('Source mode', diagnostics.configuration.workers.sourceTaskMode),
      statusRow('Worker runs', workerRunStatusSummary(overview.workers)),
      statusRow('Worker leases', workerLeaseStatusSummary(overview.workers && overview.workers.leases)),
      statusRow('LLM', diagnostics.configuration.llm.provider),
    ].concat(resourceStatusRows, [
      statusRow('适配器', String((adapters.adapters || []).length)),
      statusRow('API 契约', openApi.openapi),
      statusRow('端点', String(Object.keys(openApi.paths || {}).length)),
      statusRow('来源', overview.sources.enabled + '/' + overview.sources.total + ' · due ' + overview.sources.due),
      statusRow('任务', 'running ' + overview.tasks.running + ' · failed ' + overview.tasks.failed),
      statusRow('事件', 'pending ' + overview.events.pending + ' · failed ' + overview.events.failed + ' · open ' + overview.events.unacknowledged),
      statusRow('Author queue', authorReviewQueueStatusSummary(overview.authorReviewQueue)),
      statusRow('Review actions', reviewActionStatusSummary(overview.reviewActions)),
      statusRow('原始页', String(overview.rawPages.total)),
      statusRow('生成时间', overview.generatedAt)
    ]);
    target.innerHTML = rows.join('');
    document.getElementById('runbookResult').innerHTML = renderOperationsReadiness(operationsReadiness) + renderWorkerRunOverview(overview.workers) + renderWorkerLeaseOverview(overview.workers && overview.workers.leases) + renderOperationsRunbook(operationsRunbook);
  } catch (error) {
    target.innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
  }
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
  }, renderSourceList);
}

async function loadSourceOperations() {
  await renderAsync('sourceOperationsResult', function () {
    return Promise.all([
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
      })
    ]).then(function (results) {
      return {
        lifecycle: results[0],
        schedule: results[1],
        runbook: results[2],
        attention: results[3]
      };
    });
  }, renderSourceOperations);
}

async function loadEvents() {
  await renderAsync('eventResult', function () {
    const query = buildEventQuery();
    return Promise.all([
      fetchJson('/api/events?' + query.toString()),
      fetchJson('/api/events/overview?' + query.toString())
    ]).then(function (results) {
      return {
        events: results[0].events || [],
        overview: results[1]
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
    return requestJson('/api/crawl-page', {
      forum: form.get('forum'),
      url: form.get('url')
    });
  }, renderRawPageFetchResult);
  await loadSystemStatus();
  await loadRawPages();
}

async function runAllSources() {
  await renderAsync('taskResult', function () {
    return requestJson('/api/sources/tasks/ingest', {});
  }, renderSourceBatchRunResult);
  await loadSystemStatus();
  await loadTasks();
  await loadSources();
  await loadSourceOperations();
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

async function synthesizeRunbookEventsFromButton(button, execute) {
  await renderAsync('sourceOperationActionResult', function () {
    return requestJson('/api/operations/runbook/events', {
      execute,
      limit: Number(button.dataset.limit) || 100
    });
  }, renderRunbookNotificationEventResult);
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
  target.innerHTML = '<div class="empty">Dispatching notification events...</div>';
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
  target.innerHTML = '<div class="empty">' + (execute ? 'Acknowledging events...' : 'Previewing acknowledgement candidates...') + '</div>';
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
  target.innerHTML = '<div class="empty">Checking event archive policy...</div>';
  try {
    const result = await requestJson('/api/events/archive', request);
    await loadEvents();
    const refreshedTarget = document.getElementById('eventResult');
    refreshedTarget.innerHTML = renderEventArchiveResult(result) + refreshedTarget.innerHTML;
  } catch (error) {
    renderError('eventResult', error);
  }
}

async function renderAsync(targetId, task, renderer) {
  const target = document.getElementById(targetId);
  target.innerHTML = '<div class="empty">分析中...</div>';
  try {
    const result = await task();
    target.innerHTML = renderer(result);
  } catch (error) {
    renderError(targetId, error);
  }
}

function renderHistoryReport(report) {
  const panels = [
    panel('主题概览', [
      metric('标题', report.thread.title),
      metric('楼层', report.thread.parsedPostCount),
      metric('作者数', report.authorStats.length),
      metric('页数', report.thread.totalPages || '未知')
    ].join('')),
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
  const summary = dashboard.summary || {};
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('报告', dashboard.reportCount || 0, dashboard.status === 'warn' ? 'warn' : 'ok'),
    summaryTile('修订', dashboard.reportRevisionCount || 0),
    summaryTile('线程', summary.threadCount || 0),
    summaryTile('作者', summary.authorCount || 0),
    summaryTile('观点', summary.opinionCount || 0),
    summaryTile('实体', summary.focusEntityCount || 0),
    summaryTile('缺口', summary.evidenceGapCount || 0, summary.evidenceGapCount > 0 ? 'warn' : 'ok'),
    summaryTile('Queue', summary.reviewQueueCount || 0, (summary.reviewQueueCount || 0) > 0 ? 'warn' : 'ok')
  ].join('') + '</div>';
  return [
    panel('作者情报概览', [
      tiles,
      metric('状态', dashboard.status || 'unknown'),
      metric('范围', authorIntelligenceScope(dashboard)),
      metric('报告模式', dashboard.revisionMode || 'latest-per-thread'),
      metric('建议', dashboard.recommendedNextAction || dashboard.message || ''),
      metric('Queue priority', formatStanceSummary(summary.reviewQueuePriorityCounts)),
      metric('Queue type', formatStanceSummary(summary.reviewQueueTypeCounts)),
      '<span class="button-group">' +
        '<button class="inline-button" type="button" data-action="sync-author-review-queue">Sync queue</button>' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">Open queue</button>' +
        '<a class="inline-button secondary-inline-button" href="' + escapeHtml(authorIntelligenceMarkdownHref(dashboard)) + '" target="_blank" rel="noreferrer">Markdown</a>' +
      '</span>'
    ].join(''), 'wide'),
    panel('Source review pressure', renderAuthorSourceReviewPressureRows(dashboard.sourceReviewPressure || []), 'wide'),
    panel('Review queue', renderAuthorReviewQueueRows(dashboard.reviewQueue || []), 'wide'),
    panel('重点作者', renderAuthorIntelligenceRows(dashboard.authors || []), 'wide'),
    panel('聚焦实体', renderAuthorEntityRows(dashboard.focusEntities || []), 'wide'),
    panel('观点时间线', renderOpinionTimelineRows(dashboard.opinionTimeline || []), 'wide'),
    panel('证据缺口', renderAuthorEvidenceGapRows(dashboard.evidenceGaps || []), 'wide'),
    panel('高信号证据', renderAuthorEvidenceRows(dashboard.evidence || []), 'wide')
  ].join('');
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

function renderAuthorReviewQueueRows(items) {
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
  const sourceCounts = Object.keys(summary.openBySourceKey || {}).length > 0 ? summary.openBySourceKey : summary.bySourceKey;
  const alertDisabled = openCount > 0 ? '' : ' disabled';
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('Items', result.itemCount || 0),
    summaryTile('Open', openCount, openCount > 0 ? 'warn' : 'ok'),
    summaryTile('High', summary.byPriority && summary.byPriority.high || 0, summary.byPriority && summary.byPriority.high ? 'warn' : 'ok')
  ].join('') + '</div>';
  return [
    panel('Author review queue', [
      tiles,
      metric('Status', result.status || 'ok'),
      metric('By status', formatStanceSummary(summary.byStatus)),
      metric('By priority', formatStanceSummary(summary.byPriority)),
      metric('By type', formatStanceSummary(summary.byType)),
      metric('By source', formatStanceSummary(sourceCounts)),
      result.createdCount === undefined ? '' : metric('Sync', 'created=' + (result.createdCount || 0) + ' / updated=' + (result.updatedCount || 0)),
      metric('Next', result.recommendedNextAction || 'none'),
      '<span class="button-group">' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">Refresh open queue</button>' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="false" data-limit="50">Alert check</button>' +
        '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="true" data-limit="50"' + alertDisabled + '>Create alerts</button>' +
      '</span>'
    ].join(''), 'wide'),
    panel('Source hotspots', renderAuthorReviewQueueSourceHotspots(summary.sourceHotspots || []), 'wide'),
    panel('Open items', renderDurableAuthorReviewQueueRows(result.items || []), 'wide')
  ].join('');
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

function renderDurableAuthorReviewQueueRows(items) {
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

function renderAuthorIntelligenceRows(authors) {
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

function renderAuthorEntityRows(entities) {
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

function renderOpinionTimelineRows(items) {
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

function renderAuthorEvidenceGapRows(gaps) {
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

function renderAuthorEvidenceRows(items) {
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
    panel('证据命中', evidenceList(results.map(function (item) {
      return '#' + item.metadata.floor + ' ' + item.metadata.author + ' · ' + item.score + '｜' + item.text;
    })), 'wide')
  ].join('');
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
      '</span></div>',
      '<pre>' + escapeHtml(JSON.stringify(result.rolloutManifestDraft, null, 2)) + '</pre>'
    ].join(''), 'wide'));
  }
  if (result.connectorModuleValidation) {
    rememberConnectorContractSourceTypes(result.connectorModuleValidation.contractSummary);
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
  if (moduleValidation) rememberConnectorContractSourceTypes(moduleValidation.contractSummary);
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
      metric('Source', report.sourceDraft ? (report.sourceDraft.sourceKey || 'unknown') + ' / ' + (report.sourceDraft.sourceType || 'unknown') : 'missing')
    ].join('')),
    panel('Apply steps', evidenceList(steps.map(function (step) {
      return step.status + ' 路 ' + step.key + ' 路 ' + step.summary;
    })), 'wide')
  ];
  if (report.registration && report.registration.source) {
    panels.push(panel('Registered source', [
      metric('Source ID', report.registration.source.id),
      metric('Created', report.registration.created ? 'yes' : 'no'),
      metric('Name', report.registration.source.displayName)
    ].join('')));
  }
  if (report.rollbackPlan) {
    panels.push(panel('Rollback plan', [
      metric('Available', report.rollbackPlan.available ? 'yes' : 'no'),
      metric('Mode', report.rollbackPlan.mode || 'unknown'),
      metric('Source ID', report.rollbackPlan.sourceId || 'after execute'),
      metric('Summary', report.rollbackPlan.summary || ''),
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
    renderSourceOperationResultRows(result.results || [])
  ].join(''), 'wide');
}

function renderDueSourceBatchRunResult(result) {
  return panel('Due source batch run', [
    metric('Sources', result.sourceCount),
    metric('Due', result.dueCount),
    metric('Skipped', result.skippedCount),
    metric('Completed', result.completedCount),
    metric('Failed', result.failedCount),
    renderSourceOperationResultRows(result.results || []),
    renderSourceOperationSkippedRows(result.skipped || [])
  ].join(''), 'wide');
}

function renderDueSourcePipelineBatchRunResult(result) {
  return panel('Due source insight batch run', [
    metric('Sources', result.sourceCount),
    metric('Due', result.dueCount),
    metric('Skipped', result.skippedCount),
    metric('Completed', result.completedCount),
    metric('Failed', result.failedCount),
    renderSourceOperationResultRows(result.results || []),
    renderSourceOperationSkippedRows(result.skipped || [])
  ].join(''), 'wide');
}

function renderSourceOperationResultRows(results) {
  if (!results || results.length === 0) return '<div class="muted">No source operation results.</div>';
  return '<div class="source-operation-result-list">' + results.map(function (item) {
    const source = item.source || {};
    const task = item.task || item.ingestTask || {};
    const error = item.error || {};
    const cursorDiff = item.cursorDiff || {};
    const semantic = item.semantic || {};
    const details = [
      source.id || source.sourceKey || 'unknown-source',
      item.scheduleReason ? 'reason=' + item.scheduleReason : undefined,
      task.id ? 'task=' + task.id : undefined,
      cursorDiff.changed === undefined ? undefined : 'changed=' + cursorDiff.changed,
      cursorDiff.newPostCount === undefined ? undefined : 'newPosts=' + cursorDiff.newPostCount,
      semantic.status ? 'semantic=' + semantic.status + (semantic.reason ? '/' + semantic.reason : '') : undefined,
      error.message ? 'error=' + error.message : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml(source.displayName || source.id || 'Unknown source') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' +
      statusBadge(item.status || 'unknown', item.status === 'failed' ? 'fail' : 'ok') +
      '</div>';
  }).join('') + '</div>';
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
      '</span>' +
      statusBadge('skipped', 'muted') +
      '</div>';
  }).join('') + '</div>';
}

function renderTaskList(result) {
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

function renderSourceOperations(result) {
  const lifecycle = result.lifecycle || {};
  const schedule = result.schedule || {};
  const runbook = result.runbook || {};
  const attention = result.attention || {};
  const lifecycleSummary = lifecycle.summary || {};
  const scheduleSummary = schedule.summary || {};
  const actions = runbook.actions || [];
  const sourceActions = actions.filter(function (action) {
    return action.area === 'sources';
  });
  const alertableCount = countAlertableRunbookActions(actions);
  const panels = [
    panel('Source operations', [
      '<div class="summary-strip">',
      summaryTile('Lifecycle', lifecycle.status || 'unknown', statusVariant(lifecycle.status)),
      summaryTile('Schedule', schedule.status || 'unknown', statusVariant(schedule.status)),
      summaryTile('Enabled', String(lifecycleSummary.enabled || 0) + '/' + String(lifecycleSummary.total || 0)),
      summaryTile('Due now', String(scheduleSummary.due || 0)),
      summaryTile('Skipped', String(scheduleSummary.skipped || 0)),
      summaryTile('Retry wait', String(lifecycleSummary.failureRetryWaiting || 0), lifecycleSummary.failureRetryWaiting > 0 ? 'warn' : 'ok'),
      summaryTile('Disable blocked', String(lifecycleSummary.disableBlocked || 0), lifecycleSummary.disableBlocked > 0 ? 'warn' : 'ok'),
      summaryTile('Alertable', String(alertableCount), alertableCount > 0 ? 'warn' : 'ok'),
      summaryTile('Runbook', String(runbook.actionCount || actions.length || 0), statusVariant(runbook.status)),
      '</div>',
      '<div class="tag-list reason-tags">',
      renderReasonTags(scheduleSummary.byReason),
      '</div>',
      renderRunbookEventControls(alertableCount)
    ].join(''), 'wide'),
    panel('Source attention', renderSourceAttentionRows(attention.sources || buildSourceAttention(result)), 'wide'),
    panel('Due sources', renderScheduleDecisionRows(schedule.dueSources || [], 'No due sources.', true), 'wide'),
    panel('Skipped sources', renderScheduleDecisionRows((schedule.skippedSources || []).slice(0, 10), 'No skipped sources.', false), 'wide'),
    panel('Lifecycle attention', renderLifecycleAttentionRows(lifecycle.sources || []), 'wide')
  ];
  if (sourceActions.length > 0) {
    panels.push(panel('Source runbook actions', renderRunbookActionRows(sourceActions), 'wide'));
  }
  return panels.join('');
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
  return '<div class="source-attention-list">' + items.map(function (item) {
    const source = item.source || {};
    const runState = source.runState || {};
    const priorityScore = item.priorityScore === undefined ? scoreWebSourceAttention(item) : item.priorityScore;
    const signalLabels = uniqueText((item.signals || []).map(function (signal) {
      return signal.label;
    })).join(' + ');
    const details = [
      source.id || source.sourceKey || item.key,
      source.sourceKey && source.sourceType ? source.sourceKey + '/' + source.sourceType : source.sourceKey || source.sourceType,
      'priority=' + priorityScore,
      runState.status ? 'run=' + runState.status : undefined,
      attentionSignalDetail(item.signals || []),
      item.commands && item.commands.length > 0 ? 'commands=' + item.commands.length : undefined
    ].filter(Boolean).join(' | ');
    const canRunSourceActions = Boolean(source.id);
    const controls = '<span class="button-group source-op-buttons source-attention-controls">' +
      (item.attentionRank ? statusBadge('#' + item.attentionRank, attentionStatusVariant(item.severity)) : '') +
      statusBadge(signalLabels || item.severity || 'attention', attentionStatusVariant(item.severity)) +
      renderSourceDrilldownButton(source) +
      (item.runnable && canRunSourceActions ? renderSourceRunButtons(source) : '') +
      (canRunSourceActions ? renderSourceEnablementButtons(source) : '') +
      (canRunSourceActions ? renderSourceFailureResetButtons(source) : '') +
      '</span>';
    return '<div class="action-row ops-row source-attention-row"><span>' +
      '<strong>' + escapeHtml(source.displayName || source.id || source.sourceKey || 'Unknown source') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      renderSourceAttentionSignalRows(item.signals || []) +
      '</span>' +
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
  const recent = report.recent || {};
  const scope = report.scope || {};
  return [
    panel('Source ops drill-down', [
      '<div class="summary-strip">',
      summaryTile('Status', report.status || 'unknown', statusVariant(report.status)),
      summaryTile('Source', sourceHealth.status || (report.sourceFound ? 'found' : 'missing'), statusVariant(report.sourceFound ? report.status : 'warn')),
      summaryTile('Tasks failed', String(tasks.failed || 0), (tasks.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Events failed', String(events.failed || 0), (events.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Stale runs', String(workerRuns.stale || 0), (workerRuns.stale || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Expired leases', String(workerLeases.expired || 0), (workerLeases.expired || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Review stale', String(reviewExecutions.staleRunning || 0), (reviewExecutions.staleRunning || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('Queue high', String(authorQueue.highPriorityOpenCount || 0), (authorQueue.highPriorityOpenCount || 0) > 0 ? 'warn' : 'ok'),
      '</div>',
      metric('Scope', formatEventSourceScope(scope)),
      metric('Source', [source.displayName, source.id, source.sourceKey, source.sourceType].filter(Boolean).join(' | ') || 'not found'),
      metric('Schedule', sourceHealth.schedule ? ((sourceHealth.schedule.due ? 'due' : 'skip') + ' | ' + (sourceHealth.schedule.reason || 'unknown')) : 'unknown'),
      metric('Worker types', compactCountMap(workerRuns.byWorkerType)),
      metric('Lease types', compactCountMap(workerLeases.byWorkerType)),
      metric('Tasks', 'total ' + (tasks.total || 0) + ' | running ' + (tasks.running || 0) + ' | failed ' + (tasks.failed || 0)),
      metric('Events', 'open ' + (events.unacknowledged || 0) + ' | pending ' + (events.pending || 0) + ' | due ' + (events.dueForDelivery || 0)),
      metric('Review actions', 'audits ' + (reviewActions.auditCount || 0) + ' | executions ' + (reviewExecutions.count || 0) + ' | failed ' + (reviewExecutions.failed || 0)),
      metric('Author queue', 'open ' + (authorQueue.openCount || 0) + ' | high ' + (authorQueue.highPriorityOpenCount || 0))
    ].join(''), 'wide'),
    panel('Source next actions', renderSourceDrilldownActions(report.nextActions || []), 'wide'),
    panel('Recent source tasks', evidenceList((recent.tasks || []).map(formatSourceDrilldownTaskRow)), 'wide'),
    panel('Recent source events', evidenceList((recent.events || []).map(formatSourceDrilldownEventRow)), 'wide'),
    panel('Recent source workers', evidenceList((recent.workerRuns || []).map(formatWorkerRunRow).concat((recent.workerLeases || []).map(formatWorkerLeaseRow))), 'wide')
  ].join('');
}

function renderSourceDrilldownActions(actions) {
  if (!actions.length) return '<div class="muted">No source-specific actions.</div>';
  return actions.map(function (action) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml((action.severity || 'info') + ' | ' + (action.key || 'action')) + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      (action.recommendedCommand ? '<small>' + escapeHtml(action.recommendedCommand) + '</small>' : '') +
      '</span>' +
      statusBadge(action.severity || 'info', action.severity === 'critical' ? 'warn' : statusVariant(action.severity)) +
      '</div>';
  }).join('');
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

function countAlertableRunbookActions(actions) {
  return (actions || []).filter(function (action) {
    return action.severity === 'critical' || action.severity === 'warning';
  }).length;
}

function renderReasonTags(byReason) {
  const reasons = Object.keys(byReason || {}).sort();
  if (reasons.length === 0) return '<span class="muted">No schedule reasons yet.</span>';
  return reasons.map(function (reason) {
    return '<span class="tag">' + escapeHtml(reason + ': ' + byReason[reason]) + '</span>';
  }).join('');
}

function renderScheduleDecisionRows(sources, emptyText, runnable) {
  if (!sources || sources.length === 0) return '<div class="muted">' + escapeHtml(emptyText) + '</div>';
  return sources.map(function (source) {
    const decision = source.decision || {};
    const runState = source.runState || {};
    const schedule = source.schedule || {};
    const details = [
      source.id,
      source.sourceKey + '/' + source.sourceType,
      schedule.intervalMinutes ? 'every=' + schedule.intervalMinutes + 'm' : undefined,
      'run=' + (runState.status || 'unknown'),
      'reason=' + (decision.reason || 'unknown'),
      decision.nextRunAt ? 'next=' + decision.nextRunAt : undefined,
      decision.retryAt ? 'retry=' + decision.retryAt : undefined,
      decision.backoffMs ? 'backoff=' + formatDurationMs(decision.backoffMs) : undefined
    ].filter(Boolean).join(' | ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(source.displayName || source.id) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' +
      renderScheduleSourceControls(source, runnable) +
      '</div>';
  }).join('');
}

function renderScheduleSourceControls(source, runnable) {
  return '<span class="button-group source-op-buttons schedule-op-buttons">' +
    statusBadge(runnable ? 'due' : 'skip', runnable ? 'ok' : 'muted') +
    renderSourceDrilldownButton(source) +
    (runnable ? renderSourceRunButtons(source) : '') +
    '</span>';
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
  const details = [
    source.id,
    'run=' + (runState.status || 'unknown'),
    'action=' + (source.nextAction || 'unknown'),
    guard.lastStartedAt ? 'started=' + guard.lastStartedAt : undefined,
    retry.retryAt ? 'retry=' + retry.retryAt : undefined,
    retry.backoffMs ? 'backoff=' + formatDurationMs(retry.backoffMs) : undefined,
    source.latestLifecycleTask ? 'task=' + source.latestLifecycleTask.id + '/' + source.latestLifecycleTask.status : undefined
  ].filter(Boolean).join(' | ');
  const controls = '<span class="button-group source-op-buttons">' +
    statusBadge(label, variant) +
    renderSourceDrilldownButton(source) +
    renderSourceRunButtons(source) +
    renderSourceEnablementButtons(source) +
    renderSourceFailureResetButtons(source) +
    '</span>';
  return '<div class="action-row ops-row"><span>' +
    '<strong>' + escapeHtml(source.displayName || source.id) + '</strong>' +
    '<small>' + escapeHtml(details) + '</small>' +
    renderLifecycleCommandRows(source.recommendedCommands || []) +
    '</span>' +
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
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-drilldown" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">Ops</button>';
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
    metric('Guard', guard.running ? 'running=' + guard.running + ' blocked=' + guard.blocked + ' stale=' + guard.stale : 'not-running')
  ].join(''), 'wide');
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
    metric('Next run', schedule.nextRunAt || reset.nextRunAt || 'unchanged')
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
  if (status === 'warn' || status === 'warning' || status === 'actionable' || status === 'preview') return 'warn';
  return 'muted';
}

function statusClassName(variant) {
  if (variant === 'ok') return 'status-ok';
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

function renderEventList(result) {
  const events = result.events || [];
  const overview = result.overview;
  const summary = renderEventListSummary(events);
  const title = '通知事件 · ' + currentEventFilterSummary();
  const listPanel = events.length === 0
    ? panel(title, summary + '<div class="muted">暂无</div>', 'wide')
    : panel(title, summary + events.map(renderNotificationEventRow).join(''), 'wide');
  return (overview ? renderNotificationEventOverview(overview) : '') + listPanel;
}

function renderNotificationEventOverview(overview) {
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

function renderEventListSummary(events) {
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

function renderNotificationEventRow(event) {
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

function renderNotificationSourceHotspots(hotspots) {
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

function renderEventSourceDrilldownButton(source) {
  if (!source || (!source.sourceId && !source.sourceKey)) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-drilldown" data-source-id="' + escapeHtml(source.sourceId || '') + '" data-source-key="' + escapeHtml(source.sourceKey || '') + '" data-limit="50">Ops</button>';
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
  return '<article class="panel ' + (className || '') + '"><h3>' + escapeHtml(title) + '</h3>' + content + '</article>';
}

function metric(label, value) {
  return '<div class="metric-row"><span class="muted">' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function evidenceList(items) {
  if (!items || items.length === 0) return '<div class="muted">暂无</div>';
  return items.map(function (item) {
    return '<div class="evidence-row"><span>' + escapeHtml(item) + '</span></div>';
  }).join('');
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
  if (!items || items.length === 0) return '<div class="muted">暂无</div>';
  return '<div class="tag-list">' + items.map(function (item) {
    return '<span class="tag">' + escapeHtml(item) + '</span>';
  }).join('') + '</div>';
}

function statusRow(label, value) {
  return '<div class="status-row"><span class="muted">' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
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

async function copyLifecycleCommandFromButton(button) {
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
  const response = await fetch(url);
  if (!response.ok && !safeOptions.acceptErrorStatus) throw new Error(response.statusText);
  return response.json();
}

function renderError(targetId, error) {
  document.getElementById(targetId).innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
