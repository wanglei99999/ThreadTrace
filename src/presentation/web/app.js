'use strict';

const state = {
  adapters: [],
  currentView: 'history'
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
  document.getElementById('ackVisibleEventsButton').addEventListener('click', acknowledgeVisibleEvents);
  document.getElementById('runSourcesButton').addEventListener('click', runAllSources);
  document.getElementById('runDueSourcesButton').addEventListener('click', runDueSources);
  document.getElementById('runDuePipelinesButton').addEventListener('click', runDuePipelines);
  document.getElementById('crawlUrlButton').addEventListener('click', crawlThreadUrl);
  loadAdapters();
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
    const button = event.target.closest('button[data-action="ack-event"]');
    if (!button) return;
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
  const request = {
    forum: form.get('forum'),
    sourceType,
    displayName: form.get('displayName'),
    modulePath: String(form.get('modulePath') || '').trim() || undefined
  };
  if (location) {
    request.location = location;
  } else if (sourceType === 'thread-url') {
    request.url = locationValue;
  } else if (sourceType === 'normalized-thread-json') {
    request.inputFile = locationValue;
  } else {
    request.inputDir = form.get('inputDir');
  }
  return request;
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

function fillAdapterSelect(id) {
  const select = document.getElementById(id);
  select.innerHTML = '';
  state.adapters.forEach(function (adapter) {
    const option = document.createElement('option');
    option.value = adapter.sourceKey;
    option.textContent = adapter.displayName + ' (' + adapter.sourceKey + ')';
    select.appendChild(option);
  });
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
      statusRow('Runbook', operationsRunbook.status + ' · ' + operationsRunbook.actionCount),
      statusRow('存储', overview.storageMode),
      statusRow('Adapters', adapterDiagnostics.status + ' · ' + adapterDiagnostics.adapterCount),
      statusRow('Source config', sourceDiagnostics.status + ' · ' + sourceDiagnostics.sourceCount),
      statusRow('Notify', diagnosticStatus(notificationDiagnostics, 'notifications.channel') + ' · ' + notificationDiagnostics.channel),
      statusRow('Source mode', diagnostics.configuration.workers.sourceTaskMode),
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
    document.getElementById('runbookResult').innerHTML = renderOperationsRunbook(operationsRunbook);
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
      })
    ]).then(function (results) {
      return {
        lifecycle: results[0],
        schedule: results[1],
        runbook: results[2]
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
  const formElement = document.getElementById('eventFilterForm');
  const form = formElement ? new FormData(formElement) : undefined;
  const acknowledged = form ? String(form.get('acknowledged') || '') : 'false';
  const deliveryStatus = form ? String(form.get('deliveryStatus') || '').trim() : '';
  const type = form ? String(form.get('type') || '').trim() : '';
  query.set('limit', String(normalizeEventLimit(form ? form.get('limit') : 10)));
  if (acknowledged === 'true' || acknowledged === 'false') query.set('acknowledged', acknowledged);
  if (deliveryStatus) query.set('deliveryStatus', deliveryStatus);
  if (type) query.set('type', type);
  return query;
}

function normalizeEventLimit(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1) return 10;
  return Math.min(Math.floor(limit), 100);
}

function buildVisibleEventAckRequest() {
  const formElement = document.getElementById('eventFilterForm');
  const form = formElement ? new FormData(formElement) : undefined;
  const deliveryStatus = form ? String(form.get('deliveryStatus') || '').trim() : '';
  const type = form ? String(form.get('type') || '').trim() : '';
  const request = {
    acknowledged: false,
    acknowledgedBy: 'web',
    note: 'Acknowledged from the web event filter.',
    limit: normalizeEventLimit(form ? form.get('limit') : 10)
  };
  if (deliveryStatus) request.deliveryStatus = deliveryStatus;
  if (type) request.type = type;
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
  await renderAsync('eventResult', function () {
    return requestJson('/api/events/dispatch', {});
  }, renderEventDispatchResult);
  await loadSystemStatus();
  await loadEvents();
}

async function acknowledgeVisibleEvents() {
  const request = buildVisibleEventAckRequest();
  if (!window.confirm('Acknowledge up to ' + request.limit + ' open notification events in the current filter?')) return;
  const target = document.getElementById('eventResult');
  target.innerHTML = '<div class="empty">Acknowledging events...</div>';
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

function renderAuthorReviewQueueRows(items) {
  if (items.length === 0) return '<div class="muted">暂无审核队列</div>';
  return items.slice(0, 12).map(function (item) {
    const ref = (item.refs || [])[0] || {};
    const details = [
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
      '</span>' +
      statusBadge(item.priority || 'unknown', item.priority === 'high' ? 'warn' : 'muted') +
      '</div>';
  }).join('');
}

function renderAuthorReviewQueueResult(result) {
  const summary = result.summary || {};
  const openCount = summary.openCount || 0;
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
      result.createdCount === undefined ? '' : metric('Sync', 'created=' + (result.createdCount || 0) + ' / updated=' + (result.updatedCount || 0)),
      metric('Next', result.recommendedNextAction || 'none'),
      '<span class="button-group">' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">Refresh open queue</button>' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="false" data-limit="50">Alert check</button>' +
        '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="true" data-limit="50"' + alertDisabled + '>Create alerts</button>' +
      '</span>'
    ].join(''), 'wide'),
    panel('Open items', renderDurableAuthorReviewQueueRows(result.items || []), 'wide')
  ].join('');
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
    const details = [
      item.id,
      item.type,
      item.reason,
      item.sourceThreadId || ref.sourceThreadId ? 'thread=' + (item.sourceThreadId || ref.sourceThreadId) : undefined,
      item.floor === undefined && ref.floor === undefined ? undefined : '#' + (item.floor === undefined ? ref.floor : item.floor),
      'seen=' + (item.seenCount || 0)
    ].filter(Boolean).join(' · ');
    const controls = item.status === 'open'
      ? '<span class="button-group"><button class="inline-button secondary-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="confirmed">Confirm</button><button class="inline-button warning-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="ignored">Ignore</button></span>'
      : statusBadge(item.status || 'unknown', item.status === 'confirmed' ? 'ok' : 'muted');
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
    const focus = (item.topFocusEntities || []).slice(0, 4).map(function (entity) {
      return entity.entity && entity.entity.displayName ? entity.entity.displayName + '/' + entity.latestAttitude : entity.key;
    }).join(' · ');
    const details = [
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
      '</span>' +
      statusBadge(intelligence.evidenceStatus || (item.evidenceGapCount > 0 ? 'needs-review' : 'ready'), intelligence.evidenceStatus === 'needs-review' ? 'warn' : 'ok') +
      '</div>';
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
  if (result.sourceValidation && result.sourceValidation.source) {
    panels.push(panel('来源草稿', [
      metric('来源 ID', result.sourceValidation.source.id),
      metric('可保存', result.sourceValidation.valid ? 'yes' : 'no'),
      metric('诊断', result.sourceValidation.status)
    ].join('')));
  }
  if (result.connectorModuleValidation) {
    panels.push(panel('Connector 模块', [
      metric('可加载', result.connectorModuleValidation.valid ? 'yes' : 'no'),
      metric('状态', result.connectorModuleValidation.status),
      metric('模块', result.connectorModuleValidation.modulePath || 'missing'),
      metric('错误', (result.connectorModuleValidation.errors || []).length)
    ].join('')));
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
  const modules = result.modules || [];
  const errors = result.errors || [];
  const registrationCount = modules.reduce(function (total, item) {
    return total + (item.forumAdapters || []).length + (item.sourceIngestHandlers || []).length;
  }, 0);
  const panels = [
    panel('Connector 模块验证', [
      metric('状态', result.status),
      metric('可加载', result.valid ? 'yes' : 'no'),
      metric('模块', result.modulePath || 'missing'),
      metric('注册项', registrationCount),
      metric('错误', errors.length)
    ].join('')),
    panel('验证检查', evidenceList((result.checks || []).map(function (check) {
      return check.status + ' · ' + check.key + ' · ' + check.summary + ' · ' + check.value;
    })), 'wide')
  ];
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
  const panels = [
    panel('Connector rollout plan', [
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
      metric('Source mode', result.sourceTaskMode)
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
      return item.status + ' 路 ' + item.area + ' 路 ' + item.key + ' 路 ' + (item.required ? 'required' : 'optional') + ' 路 ' + item.summary + env;
    })), 'wide')
  ];
  if (actions.length > 0) {
    panels.push(panel('Resource actions', evidenceList(actions.map(function (action) {
      return action.severity + ' 路 ' + action.key + ' 路 ' + action.summary + ' 路 ' + (action.commands || []).join(' | ');
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
      return action.severity + ' 路 ' + action.key + ' 路 ' + action.summary + ' 路 ' + (action.commands || []).join(' | ');
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
  if (actions.length > 0) {
    panels.push(panel('Apply actions', evidenceList(actions.map(function (action) {
      return action.severity + ' 路 ' + action.key + ' 路 ' + action.summary + ' 路 ' + (action.commands || []).join(' | ');
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
  return panel('来源批量任务完成', [
    metric('来源数', result.sourceCount),
    metric('完成', result.completedCount),
    metric('失败', result.failedCount),
    evidenceList((result.results || []).map(function (item) {
      return item.status + ' · ' + item.source.displayName + ' · ' + (item.task ? item.task.id : item.error.message);
    }))
  ].join(''), 'wide');
}

function renderDueSourceBatchRunResult(result) {
  return panel('到期来源任务完成', [
    metric('来源数', result.sourceCount),
    metric('到期', result.dueCount),
    metric('跳过', result.skippedCount),
    metric('完成', result.completedCount),
    metric('失败', result.failedCount),
    evidenceList((result.results || []).map(function (item) {
      return item.status + ' · ' + item.scheduleReason + ' · ' + item.source.displayName + ' · ' + (item.task ? item.task.id : item.error.message);
    }))
  ].join(''), 'wide');
}

function renderDueSourcePipelineBatchRunResult(result) {
  return panel('到期来源洞察流水线完成', [
    metric('来源数', result.sourceCount),
    metric('到期', result.dueCount),
    metric('跳过', result.skippedCount),
    metric('完成', result.completedCount),
    metric('失败', result.failedCount),
    evidenceList((result.results || []).map(function (item) {
      const semantic = item.semantic ? ' / semantic ' + item.semantic.status : '';
      return item.status + ' 路 ' + item.scheduleReason + ' 路 ' + item.source.displayName + ' 路 ' + (item.task ? item.task.id : item.error.message) + semantic;
    }))
  ].join(''), 'wide');
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
    panel('Due sources', renderScheduleDecisionRows(schedule.dueSources || [], 'No due sources.'), 'wide'),
    panel('Skipped sources', renderScheduleDecisionRows((schedule.skippedSources || []).slice(0, 10), 'No skipped sources.'), 'wide'),
    panel('Lifecycle attention', renderLifecycleAttentionRows(lifecycle.sources || []), 'wide')
  ];
  if (sourceActions.length > 0) {
    panels.push(panel('Source runbook actions', renderRunbookActionRows(sourceActions), 'wide'));
  }
  return panels.join('');
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

function renderScheduleDecisionRows(sources, emptyText) {
  if (!sources || sources.length === 0) return '<div class="muted">' + escapeHtml(emptyText) + '</div>';
  return sources.map(function (source) {
    const decision = source.decision || {};
    const runState = source.runState || {};
    const details = [
      source.id,
      source.sourceKey + '/' + source.sourceType,
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
      statusBadge(decision.due ? 'due' : 'skip', decision.due ? 'ok' : 'muted') +
      '</div>';
  }).join('');
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
    renderSourceRunButtons(source) +
    renderSourceEnablementButtons(source) +
    renderSourceFailureResetButtons(source) +
    '</span>';
  return '<div class="action-row ops-row"><span>' +
    '<strong>' + escapeHtml(source.displayName || source.id) + '</strong>' +
    '<small>' + escapeHtml(details) + '</small>' +
    '</span>' +
    controls +
    '</div>';
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
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.title || action.key) + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
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
  if (status === 'ok') return 'ok';
  if (status === 'fail' || status === 'critical') return 'fail';
  if (status === 'warn' || status === 'warning') return 'warn';
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
    metric('Event types', formatStanceSummary(overview.byType)),
    metric('Severity', formatStanceSummary(overview.bySeverity)),
    metric('Next delivery', overview.nextDeliveryAt || 'none'),
    metric('Oldest open', overview.oldestUnacknowledgedAt || 'none'),
    metric('Next', overview.recommendedNextAction || 'none'),
    evidenceList((attention.failedEvents || []).slice(0, 5).map(function (event) {
      return (event.deliveryStatus || 'failed') + ' | ' + event.type + ' | ' + event.id + ' | attempts=' + (event.deliveryAttempts || 0);
    }))
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
  return '<div class="action-row event-row"><span><strong>' + escapeHtml(title) + '</strong>' + summary + '<small>' + escapeHtml(meta) + '</small></span><button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id) + '"' + disabled + '>' + ackLabel + '</button></div>';
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
  const scope = acknowledged === 'true' ? '已确认' : (acknowledged === 'false' ? '未确认' : '全部');
  return [
    scope,
    deliveryStatus || '全部状态',
    type || '全部类型'
  ].join(' · ');
}

function renderEventDispatchResult(result) {
  return panel('事件投递完成', [
    metric('通道', result.channelKey),
    metric('已投递', result.dispatchedCount),
    metric('失败', result.failedCount),
    metric('跳过', result.skippedCount)
  ].join(''), 'wide');
}

function renderEventAckResult(result) {
  return panel('事件已确认', [
    metric('事件 ID', result.event.id),
    metric('确认时间', result.event.acknowledgedAt),
    metric('确认人', result.event.acknowledgedBy)
  ].join(''), 'wide');
}

function renderEventBatchAckResult(result) {
  return panel('Notification events acknowledged', [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('Status', result.status || 'unknown', statusVariant(result.status)),
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
  if (sources.length === 0) return panel('来源接入诊断', '<div class="muted">暂无</div>', 'wide');
  return panel('来源接入诊断', evidenceList(sources.slice(0, 10).map(function (source) {
    const failed = (source.checks || []).filter(function (check) {
      return check.status !== 'ok';
    }).map(function (check) {
      return check.key + '=' + check.status;
    }).join(', ');
    return source.status + ' · ' + source.displayName + (failed ? ' · ' + failed : '');
  })), 'wide');
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
    'latest ' + (summary.latestGeneratedAt || executions.latestUpdatedAt || 'none')
  ].join(' · ');
}

function authorReviewQueueStatusSummary(queue) {
  const summary = queue || {};
  return [
    'open ' + (summary.openCount || 0),
    'high ' + (summary.highPriorityOpenCount || 0),
    'latest ' + (summary.latestUpdatedAt || 'none')
  ].join(' · ');
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
