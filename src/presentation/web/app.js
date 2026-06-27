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
  sourceTypeReadiness: undefined,
  automationAutoRefresh: false,
  automationAutoRefreshTimer: undefined,
  automationReadinessInFlight: false,
  automationLastRefreshAt: undefined,
  automationNextRefreshAt: undefined,
  automationActionHistory: []
};

const AUTOMATION_AUTO_REFRESH_STORAGE_KEY = 'threadtrace.automationCockpit.autoRefresh';
const AUTOMATION_ACTION_HISTORY_STORAGE_KEY = 'threadtrace.automationCockpit.actionHistory';
const AUTOMATION_AUTO_REFRESH_INTERVAL_MS = 60000;
const AUTOMATION_ACTION_HISTORY_LIMIT = 8;

const views = {
  history: {
    title: '历史分析',
    subtitle: '解析保存页目录，生成作者、实体、观点和证据概览。',
    mode: '资料入口',
    focus: '本地资料'
  },
  context: {
    title: '新发言解读',
    subtitle: '输入一条新发言，召回相关历史楼层和匹配理由。',
    mode: '语境还原',
    focus: '作者线索'
  },
  search: {
    title: '历史检索',
    subtitle: '先把保存页写入本地证据索引，再按关键词检索可引用的历史发言。',
    mode: '证据检索',
    focus: '历史楼层'
  },
  system: {
    title: '工作台状态',
    subtitle: '查看来源、任务、提醒和本地服务的当前状态。',
    mode: '运行概览',
    focus: '来源与提醒'
  }
};

document.addEventListener('DOMContentLoaded', function () {
  state.automationAutoRefresh = readAutomationAutoRefreshPreference();
  state.automationActionHistory = readAutomationActionHistory();
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
    if (!window.confirm('要为需要关注的复核结果创建提醒吗？')) return;
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
  syncAutomationAutoRefresh();
  window.addEventListener('hashchange', initializeCurrentViewFromLocation);
  window.addEventListener('beforeunload', stopAutomationAutoRefresh);
});

function readAutomationAutoRefreshPreference() {
  try {
    return window.localStorage && window.localStorage.getItem(AUTOMATION_AUTO_REFRESH_STORAGE_KEY) === 'true';
  } catch (error) {
    return false;
  }
}

function writeAutomationAutoRefreshPreference(enabled) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(AUTOMATION_AUTO_REFRESH_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch (error) {}
}

function readAutomationActionHistory() {
  try {
    if (!window.localStorage) return [];
    const parsed = JSON.parse(window.localStorage.getItem(AUTOMATION_ACTION_HISTORY_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeAutomationActionHistoryItem).filter(Boolean).slice(0, AUTOMATION_ACTION_HISTORY_LIMIT);
  } catch (error) {
    return [];
  }
}

function writeAutomationActionHistory(history) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(AUTOMATION_ACTION_HISTORY_STORAGE_KEY, JSON.stringify((history || []).slice(0, AUTOMATION_ACTION_HISTORY_LIMIT)));
    }
  } catch (error) {}
}

function normalizeAutomationActionHistoryItem(item) {
  if (!item || typeof item !== 'object') return undefined;
  const action = String(item.action || '').trim();
  if (!action) return undefined;
  return {
    action,
    status: String(item.status || 'unknown'),
    mode: String(item.mode || 'check'),
    changed: String(item.changed || 'n/a'),
    subject: String(item.subject || 'ThreadTrace 工作区'),
    next: String(item.next || '查看下方的详细结果。'),
    recordedAt: String(item.recordedAt || new Date().toISOString())
  };
}

function rememberAutomationAction(action, meta) {
  const safeMeta = meta || {};
  const item = normalizeAutomationActionHistoryItem({
    action: action || 'Automation',
    status: safeMeta.status || 'unknown',
    mode: safeMeta.mode || 'check',
    changed: safeMeta.changed || 'n/a',
    subject: safeMeta.subject || 'ThreadTrace 工作区',
    next: safeMeta.next || '查看下方的详细结果。',
    recordedAt: new Date().toISOString()
  });
  if (!item) return state.automationActionHistory || [];
  state.automationActionHistory = [item].concat(state.automationActionHistory || []).slice(0, AUTOMATION_ACTION_HISTORY_LIMIT);
  writeAutomationActionHistory(state.automationActionHistory);
  return state.automationActionHistory;
}

function clearAutomationActionHistory() {
  state.automationActionHistory = [];
  writeAutomationActionHistory(state.automationActionHistory);
}

function setAutomationAutoRefresh(enabled) {
  state.automationAutoRefresh = Boolean(enabled);
  writeAutomationAutoRefreshPreference(state.automationAutoRefresh);
  syncAutomationAutoRefresh();
  updateAutomationAutoRefreshControl();
}

function syncAutomationAutoRefresh() {
  if (state.automationAutoRefresh && !state.automationAutoRefreshTimer) {
    scheduleAutomationAutoRefresh(AUTOMATION_AUTO_REFRESH_INTERVAL_MS);
  } else if (!state.automationAutoRefresh) {
    stopAutomationAutoRefresh();
  }
}

function scheduleAutomationAutoRefresh(delayMs) {
  stopAutomationAutoRefresh();
  const safeDelayMs = Math.max(1000, Number(delayMs) || AUTOMATION_AUTO_REFRESH_INTERVAL_MS);
  state.automationNextRefreshAt = new Date(Date.now() + safeDelayMs).toISOString();
  state.automationAutoRefreshTimer = window.setTimeout(async function () {
    state.automationAutoRefreshTimer = undefined;
    state.automationNextRefreshAt = undefined;
    updateAutomationAutoRefreshControl();
    if (!state.automationAutoRefresh) return;
    if (state.currentView === 'system') {
      await loadAutomationReadiness({ source: 'auto' });
    }
    if (state.automationAutoRefresh) scheduleAutomationAutoRefresh(AUTOMATION_AUTO_REFRESH_INTERVAL_MS);
  }, safeDelayMs);
  updateAutomationAutoRefreshControl();
}

function stopAutomationAutoRefresh() {
  if (!state.automationAutoRefreshTimer) return;
  window.clearTimeout(state.automationAutoRefreshTimer);
  state.automationAutoRefreshTimer = undefined;
  state.automationNextRefreshAt = undefined;
}

function updateAutomationAutoRefreshControl() {
  const button = document.querySelector('button[data-action="toggle-automation-auto-refresh"]');
  if (!button) return;
  const enabled = state.automationAutoRefresh;
  const stateLabel = enabled ? '开' : '关';
  const statusLabel = automationAutoRefreshStatusLabel();
  button.dataset.enabled = enabled ? 'true' : 'false';
  button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  button.setAttribute('aria-label', '自动刷新' + stateLabel + '，每 60 秒更新。' + statusLabel);
  button.setAttribute('title', '自动刷新' + stateLabel + '，每 60 秒更新。' + statusLabel);
  button.classList.toggle('is-active', enabled);
  button.classList.toggle('is-refreshing', state.automationReadinessInFlight);
  const value = button.querySelector('strong');
  if (value) value.textContent = stateLabel;
  const status = button.querySelector('small');
  if (status) status.textContent = statusLabel;
}

function automationAutoRefreshStatusLabel() {
  if (state.automationReadinessInFlight) return '刷新中';
  if (state.automationAutoRefresh && state.automationNextRefreshAt) {
    return '下次 ' + formatTimeOfDay(state.automationNextRefreshAt);
  }
  if (state.automationLastRefreshAt) return '上次 ' + formatTimeOfDay(state.automationLastRefreshAt);
  return '60s';
}

function formatTimeOfDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return hours + ':' + minutes + ':' + seconds;
}

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
      if (execute && !window.confirm('要为当前操作清单创建提醒吗？')) return;
      await synthesizeRunbookEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-source-attention-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('要为当前来源关注创建提醒吗？')) return;
      await synthesizeSourceAttentionEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-source-type-operations-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('要为当前来源类型运行创建提醒吗？')) return;
      await synthesizeSourceTypeOperationsEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'reset-source-failure') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('要清除这个来源的失败状态并立即重试吗？')) return;
      await resetSourceFailureFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'set-source-enabled') {
      await setSourceEnabledFromButton(button);
      return;
    }
    if (button.dataset.action === 'set-source-schedule') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('要更新这个来源的运行计划吗？')) return;
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
      if (execute && !window.confirm('要清除这个来源的失败状态并立即重试吗？')) return;
      await resetSourceFailureFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'set-source-enabled') {
      await setSourceEnabledFromButton(button);
      return;
    }
    if (button.dataset.action === 'set-source-schedule') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('要更新这个来源的运行计划吗？')) return;
      await setSourceScheduleFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-source-attention-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('要为这个来源关注创建提醒吗？')) return;
      await synthesizeSourceAttentionEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-source-type-operations-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('要为这个来源类型运行创建提醒吗？')) return;
      await synthesizeSourceTypeOperationsEventsFromButton(button, execute);
      return;
    }
    if (button.dataset.action === 'synthesize-runbook-events') {
      const execute = button.dataset.execute === 'true';
      if (execute && !window.confirm('要为这些操作清单创建提醒吗？')) return;
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
    if (execute && !window.confirm('要为当前待复核事项创建提醒吗？')) return;
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
  if (button.dataset.action === 'toggle-automation-auto-refresh') {
    setAutomationAutoRefresh(button.dataset.enabled !== 'true');
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
    if (execute && !window.confirm('要更新这个来源的运行计划吗？')) return;
    await setSourceScheduleFromButton(button, execute, resolveAutomationActionTarget());
    return;
  }
  if (button.dataset.action === 'focus-automation-panel') {
    focusAutomationPanel(button.dataset.targetPanel);
    return;
  }
  if (button.dataset.action === 'run-automation-attention-action') {
    await runAutomationAttentionAction(button);
    return;
  }
  if (button.dataset.action === 'run-automation-pressure-action') {
    await runAutomationPressureAction(button);
  }
}

async function handleAutomationActionResult(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (isCopyCommandAction(button)) {
    await copyCommandFromButton(button);
    return;
  }
  if (button.dataset.action === 'clear-automation-action-history') {
    clearAutomationActionHistory();
    const panel = button.closest('.automation-action-history-panel');
    if (panel) panel.remove();
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
    renderError('rolloutReadinessResult', new Error('请先提供发布清单 JSON。'));
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
      title: '应用门禁',
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
    renderError('rolloutApplyResult', new Error('请先提供发布清单 JSON，再做应用预演。'));
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
  setLoading('rolloutApplyResult', '正在检查应用门禁...');
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
  const confirmed = window.confirm('应用门禁有提醒。仍要继续真实应用，并记录这次应用任务吗？');
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
  if (result.error) throw new Error(result.error.message || '无法载入推荐清单。');
  fillSourceOnboardingFromManifest(result.manifest, modulePath);
  renderSourceOnboardingRecipeFromForm();
  state.onboardingRecipeManifestDraft = result.manifest;
  state.loadedConnectorPackageManifestDraft = result.manifest;
  fillRolloutManifestForms(result.manifest);
  const target = document.getElementById('onboardingResult');
  target.innerHTML = panel('推荐清单已载入', [
    metric('来源包', result.packageName || 'unknown'),
    metric('来源类型', result.sourceType || 'unknown'),
    metric('清单路径', result.manifestPath || result.recommendedManifest || 'unknown'),
    '<div class="button-group source-op-buttons">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="preflight-loaded-connector-package-manifest">检查清单</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-rollout-readiness-checks">检查发布</button>' +
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
    target.innerHTML = panel('来源接入方案', '<div class="muted">先选择一个已登记的来源类型。</div>', 'wide');
    return;
  }
  target.innerHTML = renderSourceOnboardingRecipe(sourceTypeSpec, sourceKey);
}

function parseManifestJson(value) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error('请先提供发布清单 JSON。');
  }
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('发布清单 JSON 需要是一个对象。');
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
    throw new Error('复核结果 JSON 不能为空。');
  }
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('复核结果 JSON 必须是一个对象。');
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
    renderAutomationActionHistoryStandby();
    loadSystemStatus();
    loadAutomationReadiness();
  }
  syncAutomationAutoRefresh();
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
    '<span class="system-runtime-label">运行概览</span>',
    statusBadge(systemStatusLabel(variant), variant),
    '</div>',
    '<h3>' + escapeHtml(systemStatusHeadline(variant, operationsRunbook, deploymentChecklist, operationsReadiness)) + '</h3>',
    '<p>' + escapeHtml([
      '服务 ' + (health.ok ? '运行中' : '需关注'),
      '存储 ' + workspaceValue(overview.storageMode || config.storageMode, '未知'),
      '来源模式 ' + workspaceValue(workersConfig.sourceTaskMode, '未知'),
      '更新 ' + workspaceValue(overview.generatedAt || diagnostics.generatedAt || deploymentChecklist.generatedAt, '等待更新')
    ].join(' · ')) + '</p>',
    '</section>',
    '<aside class="system-runtime-pressure">',
    systemRuntimeSignal('来源', String(sources.enabled || 0) + '/' + String(sources.total || 0), '到期 ' + String(sources.due || 0) + ' · 失败 ' + String(sources.failed || 0), sourcePressureVariant(sources)),
    systemRuntimeSignal('任务', '运行中 ' + String(tasks.running || 0), '失败 ' + String(tasks.failed || 0) + ' · 总数 ' + String(tasks.total || 0), taskPressureVariant(tasks)),
    systemRuntimeSignal('提醒', '待处理 ' + String(events.pending || 0), '失败 ' + String(events.failed || 0) + ' · 未读 ' + String(events.unacknowledged || 0), eventPressureVariant(events, {})),
    systemRuntimeSignal('执行', '运行中 ' + String(workers.running || 0), '停滞 ' + String(workers.stale || 0) + ' · 占用 ' + String(workers.leases && workers.leases.active || 0), workerPressureVariant(workers)),
    '</aside>',
    '<section class="system-runtime-stack">',
    systemRuntimeMini('准备', readinessStatusSummary(operationsReadiness), statusVariant(operationsReadiness.status)),
    systemRuntimeMini('操作', (operationsRunbook.status || 'unknown') + ' · 动作 ' + String(operationsRunbook.actionCount || 0), statusVariant(operationsRunbook.status)),
    systemRuntimeMini('概览', overview.warning ? '延迟' : '实时', overview.warning ? 'warn' : 'ok'),
    systemRuntimeMini('发布', deploymentChecklist.status || 'unknown', statusVariant(deploymentChecklist.status)),
    systemRuntimeMini('助手', llmConfig.provider || 'unknown', statusVariant(diagnostics.status)),
    systemRuntimeMini('适配器', (adapterDiagnostics.status || 'unknown') + ' · ' + String(adapterDiagnostics.adapterCount || (adapters.adapters || []).length || 0), statusVariant(adapterDiagnostics.status)),
    systemRuntimeMini('来源配置', (sourceDiagnostics.status || 'unknown') + ' · ' + String(sourceDiagnostics.sourceCount || 0), statusVariant(sourceDiagnostics.status)),
    systemRuntimeMini('提醒', diagnosticStatus(notificationDiagnostics, 'notifications.channel') + ' · ' + (notificationDiagnostics.channel || 'unknown'), statusVariant(diagnosticStatus(notificationDiagnostics, 'notifications.channel'))),
    resourceSignals.map(function (signal) {
      return systemRuntimeMini(signal.label, signal.value, statusVariant(signal.value));
    }).join(''),
    '</section>',
    '<section class="system-runtime-foot">',
    '<span>接口与资料</span>',
    '<strong>' + escapeHtml([
      'API ' + (openApi.openapi || 'unknown'),
      '路径 ' + String(Object.keys(openApi.paths || {}).length),
      '原始页 ' + String(rawPages.total || 0)
    ].join(' · ')) + '</strong>',
    '<small>' + escapeHtml([
      '作者复核 ' + authorReviewQueueStatusSummary(authorQueue),
      '复核动作 ' + reviewActionStatusSummary(overview.reviewActions),
      '提醒动作 ' + eventActionStatusSummary(overview.notificationEventActions)
    ].join(' · ')) + '</small>',
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
    '<span class="cockpit-kicker">今日工作区</span>',
    '<h3>今天该看什么</h3>',
    '<p>先看来源、提醒和任务是否需要注意；每一条异常都保留通向来源、上下文和证据卡片的路径。</p>',
    '</div>',
    '<div class="cockpit-hero-status">',
    '<span>今日状态</span>',
    '<strong>' + escapeHtml(historyCockpitLabel(variant)) + '</strong>',
    '<small>' + escapeHtml(nextAction) + '</small>',
    '</div>',
    '<div class="cockpit-command-row">',
    '<button class="inline-button" type="button" data-action="refresh-history-cockpit">刷新概览</button>',
    '<button class="inline-button secondary-inline-button" type="button" data-view="system">查看工作台</button>',
    '</div>',
    '<small class="cockpit-generated">更新于 ' + escapeHtml(generatedAt) + '</small>',
    '</section>',
    cockpitQueueCard(cockpit, deploymentChecklist, eventOverview),
    cockpitCard('来源', String(sources.enabled || 0) + '/' + String(sources.total || 0), '到期 ' + String(sources.due || 0) + ' · 失败 ' + String(sources.failed || 0), sourcePressureVariant(sources)),
    cockpitCard('任务', '运行中 ' + String(tasks.running || 0), '失败 ' + String(tasks.failed || 0) + ' · 总数 ' + String(tasks.total || 0), taskPressureVariant(tasks)),
    cockpitCard('提醒', '待处理 ' + String(events.pending || eventOverview.pendingCount || 0), '失败 ' + String(events.failed || eventOverview.failedCount || 0) + ' · 未读 ' + String(events.unacknowledged || eventOverview.unacknowledgedCount || 0), eventPressureVariant(events, eventOverview)),
    cockpitCard('执行', '运行中 ' + String(workers.running || 0), '停滞 ' + String(workers.stale || 0) + ' · 占用 ' + String(workers.leases && workers.leases.active || 0), workerPressureVariant(workers)),
    cockpitCard('证据', String(rawPages.total || 0), '原始页面 · 最近 ' + (rawPages.latestFetchedAt || '暂无'), (rawPages.total || 0) > 0 ? 'ok' : 'muted'),
    cockpitCard('助手', diagnostics.configuration && diagnostics.configuration.llm ? diagnostics.configuration.llm.provider : 'unknown', '存储 ' + (overview.storageMode || diagnostics.configuration && diagnostics.configuration.storageMode || 'unknown'), statusVariant(diagnostics.status)),
    cockpitCard('复核', '打开 ' + String(authorQueue.openCount || 0), '高优先级 ' + String(authorQueue.highPriorityOpenCount || 0) + ' · 来源 ' + compactCountMap(authorQueue.openBySourceKey), (authorQueue.highPriorityOpenCount || 0) > 0 ? 'warn' : 'muted')
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
      '#' + (item.rank || '?') + ' ' + (item.title || item.id || '待处理事项'),
      [item.kind, item.scope, item.recommendedNextAction].filter(Boolean).join(' · '),
      attentionStatusVariant(item.severity)
    );
  }).concat(checklistItems.slice(0, Math.max(0, 4 - queue.length)).map(function (item) {
    return cockpitQueueRow(item.key || '发布检查', item.summary || item.status || '需要关注', statusVariant(item.status));
  }));
  if (rows.length === 0 && eventOverview.recommendedNextAction) {
    rows.push(cockpitQueueRow('提醒建议', eventOverview.recommendedNextAction, statusVariant(eventOverview.status)));
  }
  return '<article class="cockpit-card cockpit-queue-card ' + cockpitClassName(statusVariant(cockpit.status || deploymentChecklist.status || eventOverview.status)) + '">' +
    '<div class="cockpit-card-head"><span>待处理路径</span>' + statusBadge(cockpit.status || deploymentChecklist.status || eventOverview.status || 'quiet', statusVariant(cockpit.status || deploymentChecklist.status || eventOverview.status)) + '</div>' +
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

async function loadAutomationReadiness(options) {
  const safeOptions = options || {};
  if (state.automationReadinessInFlight) {
    updateAutomationAutoRefreshControl();
    return {
      skipped: true,
      reason: 'automation-readiness-refresh-in-flight',
      source: safeOptions.source || 'manual'
    };
  }
  const targetId = document.getElementById('automationReadinessResult')
    ? 'automationReadinessResult'
    : 'sourceOperationsResult';
  state.automationReadinessInFlight = true;
  updateAutomationAutoRefreshControl();
  try {
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
      loadingMessage: '正在刷新自动运行概览...'
    });
    state.automationLastRefreshAt = new Date().toISOString();
    return {
      skipped: false,
      source: safeOptions.source || 'manual',
      refreshedAt: state.automationLastRefreshAt
    };
  } finally {
    state.automationReadinessInFlight = false;
    if (state.automationAutoRefresh && safeOptions.source !== 'auto') {
      scheduleAutomationAutoRefresh(AUTOMATION_AUTO_REFRESH_INTERVAL_MS);
    } else {
      updateAutomationAutoRefreshControl();
    }
  }
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
    renderError('eventResult', new Error('需要提醒 ID 和动作键，才能预演动作。'));
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
    renderError('eventResult', new Error('需要提醒 ID 和动作键，才能执行动作。'));
    return;
  }
  if (!window.confirm('要对这条提醒执行 ' + actionKey + ' 吗？')) return;
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
    note: '从页面筛选结果确认提醒。',
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
    return renderAutomationActionResult('助手预检', {
      status: result.status,
      mode: result.provider || 'provider',
      subject: result.task || result.traceId || 'schema check',
      changed: result.validation && result.validation.status,
      next: firstNextActionSummary(result.nextActions)
    }, renderLlmPreflightReport(result));
  }, automationActionRenderOptions(resolvedTargetId, '正在进行助手预检...'));
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
    return renderAutomationActionResult('助手状态', {
      status: result.status,
      mode: result.mode || 'configuration',
      subject: result.provider || 'provider',
      changed: readiness.realProviderCandidate ? 'real provider' : 'mock/default',
      next: firstNextActionSummary(result.nextActions)
    }, renderLlmReadinessProfile(result));
  }, automationActionRenderOptions(resolvedTargetId, '正在检查助手状态...'));
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
    return renderAutomationActionResult('质量评估', {
      status: result.status,
      mode: result.provider || 'provider',
      subject: String(result.sampleCount || 0) + ' samples',
      changed: 'warn=' + String(summary.warn || 0) + ' fail=' + String(summary.fail || 0),
      next: firstNextActionSummary(result.nextActions)
    }, renderLlmEvaluationReport(result));
  }, automationActionRenderOptions(resolvedTargetId, '正在评估助手质量门禁...'));
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
    return renderAutomationActionResult('试跑闭环', {
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
    return renderAutomationActionResult('来源排期', {
      status: update.status,
      mode: update.dryRun ? '预演' : '执行',
      subject: (after.displayName || before.displayName || after.id || before.id || sourceId),
      changed: update.changed ? '已变化' : '无变化',
      next: schedule.nextRunAt ? '下次 ' + schedule.nextRunAt : '下次运行未变化'
    }, rendered);
  }, automationActionRenderOptions(resolvedTargetId, execute ? '正在应用来源排期...' : '正在预览来源排期...'));
  if (execute) {
    await loadSystemStatus();
    await loadTasks();
    await loadSources();
    await loadSourceOperations();
    await loadAutomationReadiness();
  }
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
  if (execute && !window.confirm('要确认当前筛选下最多 ' + request.limit + ' 条未读提醒吗？')) return;
  const target = document.getElementById('eventResult');
  target.innerHTML = renderFeedbackState('loading', execute ? '正在确认提醒...' : '正在预览可确认提醒...');
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
  if (execute && !window.confirm('要归档当前筛选下 30 天前已处理的提醒吗？')) return;
  const target = document.getElementById('eventResult');
  target.innerHTML = renderFeedbackState('loading', '正在检查提醒归档规则...');
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
  target.innerHTML = renderFeedbackState('loading', safeOptions.loadingMessage || '正在处理...');
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
  const history = rememberAutomationAction(action, safeMeta);
  const summary = [
    '<div class="automation-action-summary">',
    '<div class="summary-strip">',
    summaryTile('动作', action || '自动运行', 'info'),
    summaryTile('状态', workspaceStatusLabel(safeMeta.status), statusVariant(safeMeta.status)),
    summaryTile('模式', safeMeta.mode || '检查'),
    summaryTile('变化', safeMeta.changed || '未记录', statusVariant(safeMeta.changed)),
    '</div>',
    '<div class="automation-action-summary-line">',
    '<span><strong>' + escapeHtml(safeMeta.subject || 'ThreadTrace 工作区') + '</strong>',
    '<small>' + escapeHtml(safeMeta.next || '查看下方详细报告。') + '</small></span>',
    statusBadge(workspaceStatusLabel(safeMeta.status), statusVariant(safeMeta.status)),
    '</div>',
    '</div>'
  ].join('');
  return panel('最近动作', summary, 'wide automation-action-summary-panel') + renderAutomationActionHistory(history) + content;
}

function renderAutomationActionHistory(history) {
  const items = (history || []).slice(0, AUTOMATION_ACTION_HISTORY_LIMIT);
  if (items.length === 0) return '';
  const rows = items.map(function (item, index) {
    const variant = statusVariant(item.status);
    return '<div class="automation-action-history-row ' + statusClassName(variant) + '">' +
      '<span class="automation-action-history-rank">' + escapeHtml('#' + (index + 1)) + '</span>' +
      '<span class="automation-action-history-body"><strong>' + escapeHtml(item.action) + '</strong>' +
      '<small>' + escapeHtml(formatTimeOfDay(item.recordedAt) + ' · ' + item.subject + ' · ' + item.next) + '</small></span>' +
      '<span class="automation-action-history-meta">' +
        statusBadge(item.status, variant) +
        '<small>' + escapeHtml(item.mode + ' · 变化=' + item.changed) + '</small>' +
      '</span>' +
    '</div>';
  }).join('');
  const content = '<div class="automation-action-history-head">' +
      '<span><strong>最近工作台动作</strong><small>' + escapeHtml('只保存在当前浏览器，方便快速回看。') + '</small></span>' +
      '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="clear-automation-action-history">清除</button>' +
    '</div>' +
    '<div class="automation-action-history-list">' + rows + '</div>';
  return panel('动作历史', content, 'wide automation-action-history-panel');
}

function renderAutomationActionHistoryStandby() {
  const target = document.getElementById('automationActionResult');
  if (!target || String(target.innerHTML || '').trim()) return;
  const history = state.automationActionHistory || [];
  if (history.length === 0) return;
  target.setAttribute('aria-busy', 'false');
  target.innerHTML = renderAutomationActionHistory(history);
}

function firstNextActionSummary(actions) {
  const first = (actions || []).find(Boolean);
  if (!first) return '暂无需要继续执行的命令。';
  return first.summary || first.command || first.key || '查看生成的后续命令。';
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
    report.entityCandidates ? '实体 ' + report.entityCandidates.length : undefined,
    report.opinionCandidates ? '观点 ' + report.opinionCandidates.length : undefined,
    report.opinionChains ? '观点链 ' + report.opinionChains.length : undefined,
    report.implicitReferenceCandidates ? '隐含指代 ' + report.implicitReferenceCandidates.length : undefined
  ].filter(Boolean);
  return [
    '<article class="history-report-hero">',
    '<div class="history-report-main">',
    '<span class="history-report-kicker">证据路径</span>',
    '<h3>' + escapeHtml(thread.title || '未命名主题') + '</h3>',
    '<p>' + escapeHtml(reliability.summary || '已完成保存页解析，下面可以继续查看作者、实体、观点链和原文证据。') + '</p>',
    '<div class="history-report-tags">' + tagList(signals) + '</div>',
    '</div>',
    '<div class="history-report-facts">',
    historyFact('发言', thread.parsedPostCount || 0),
    historyFact('作者', (report.authorStats || []).length),
    historyFact('页数', thread.totalPages || '未知'),
    historyFact('可信度', reliability.status || '未知'),
    '</div>',
    '<div class="history-report-author">',
    '<span>主要作者</span>',
    '<strong>' + escapeHtml(author.displayName || author.sourceAuthorId || '未知作者') + '</strong>',
    '<small>' + escapeHtml([primary.postCount ? '发言 ' + primary.postCount : undefined, primary.opinionCount ? '观点 ' + primary.opinionCount : undefined, formatStanceSummary(primary.stanceSummary)].filter(Boolean).join(' · ')) + '</small>',
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
    panel('来源复核压力', renderAuthorSourceReviewPressureRows(dashboard.sourceReviewPressure || []), 'wide'),
    panel('复核队列', renderAuthorReviewQueueRows(dashboard.reviewQueue || []), 'wide'),
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
  const nextAction = authorWorkspaceCopy(dashboard.recommendedNextAction || dashboard.message, '查看作者线索，并同步待复核队列。');
  return [
    '<article class="author-intel-hero">',
    '<section class="author-intel-main">',
    '<div class="author-intel-header">',
    '<span class="author-intel-label">作者雷达</span>',
    statusBadge(workspaceStatusLabel(status), statusVariant(status)),
    '</div>',
    '<h3>' + escapeHtml(nextAction) + '</h3>',
    '<p>' + escapeHtml([authorIntelligenceScope(dashboard), formatAuthorRevisionMode(dashboard.revisionMode), '报告 ' + (dashboard.reportCount || 0), '修订 ' + (dashboard.reportRevisionCount || 0)].filter(Boolean).join(' · ')) + '</p>',
    '<div class="author-intel-actions button-group">' +
      '<button class="inline-button" type="button" data-action="sync-author-review-queue">同步复核</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">打开队列</button>' +
      '<a class="inline-button secondary-inline-button" href="' + escapeHtml(authorIntelligenceMarkdownHref(dashboard)) + '" target="_blank" rel="noreferrer">打开报告</a>' +
    '</div>',
    '</section>',
    '<aside class="author-intel-signals">',
    authorIntelSignal('作者', summary.authorCount || 0, (summary.authorCount || 0) > 0 ? 'ok' : 'muted'),
    authorIntelSignal('观点', summary.opinionCount || 0, (summary.opinionCount || 0) > 0 ? 'ok' : 'muted'),
    authorIntelSignal('对象', summary.focusEntityCount || 0, (summary.focusEntityCount || 0) > 0 ? 'ok' : 'muted'),
    authorIntelSignal('缺口', gapCount, gapCount > 0 ? 'warn' : 'ok'),
    authorIntelSignal('复核', queueCount, queueCount > 0 ? 'warn' : 'ok'),
    authorIntelSignal('主题', summary.threadCount || 0, (summary.threadCount || 0) > 0 ? 'ok' : 'muted'),
    '</aside>',
    '<section class="author-intel-focus">',
    '<span>关注作者</span>',
    renderAuthorIntelFocusRows(authors),
    '</section>',
    '<section class="author-intel-review">',
    '<span>复核压力</span>',
    '<strong>' + escapeHtml('待复核 ' + queueCount + ' · 证据缺口 ' + gapCount) + '</strong>',
    '<small>' + escapeHtml([
      formatAuthorCountSummary(summary.reviewQueuePriorityCounts),
      formatAuthorCountSummary(summary.reviewQueueTypeCounts),
      topPressure.sourceKey ? '主要来源 ' + topPressure.sourceKey : undefined,
      authorWorkspaceCopy(topPressure.recommendedNextAction)
    ].filter(Boolean).join(' · ')) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function authorIntelSignal(label, value, variant) {
  return '<div class="author-intel-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function formatAuthorRevisionMode(mode) {
  return mode === 'all-revisions' ? '全部修订' : '每个主题取最新报告';
}

function authorWorkspaceCopy(value, fallback) {
  const text = value === undefined || value === null || value === '' ? (fallback || '') : String(value);
  const normalized = text.trim();
  if (normalized.indexOf('Validate high-confidence opinion from ') === 0) {
    return '核验高可信观点：' + normalized.slice('Validate high-confidence opinion from '.length);
  }
  const translated = {
    'Work the author intelligence review queue from highest priority to lowest.': '按优先级处理作者复核队列。',
    'Work the source-scoped author review queue before downstream automation.': '先处理这个来源的作者复核队列，再继续后续自动动作。',
    'Confirm, ignore, or drill into the source scope.': '确认、忽略，或打开来源查看证据。',
    'Confirm the cited floor, then allow it to seed author memory or downstream briefings.': '先确认引用楼层，再用于作者记忆或后续简报。',
    'Open source scope and validate the evidence chain.': '打开来源范围，核验证据路径。',
    'Needs operator review before downstream action.': '需要先复核证据，再继续后续动作。',
    'Continue working the remaining open author intelligence review queue items.': '继续处理剩余的作者复核事项。',
    'Use top authors, focus entities, and opinion timeline as the next review anchors.': '以重点作者、聚焦实体和观点时间线作为下一轮复核锚点。',
    'high-confidence-opinion': '高可信观点',
    high: '高优先',
    medium: '中优先',
    low: '低优先',
    open: '待处理',
    confirmed: '已确认',
    ignored: '已忽略',
    unknown: '未知'
  }[normalized];
  return translated || text;
}

function formatAuthorCountSummary(summary) {
  const keys = Object.keys(summary || {});
  if (keys.length === 0) return '暂无';
  return keys.sort().map(function (key) {
    return authorWorkspaceCopy(key) + ' ' + summary[key];
  }).join(' / ');
}

function renderAuthorIntelFocusRows(authors) {
  if (!authors || authors.length === 0) {
    return '<div class="author-intel-empty">暂无作者线索。</div>';
  }
  return authors.slice(0, 3).map(function (item) {
    const author = item.author || {};
    const focus = (item.topFocusEntities || []).slice(0, 3).map(function (entity) {
      return entity.entity && entity.entity.displayName ? entity.entity.displayName : entity.key;
    }).filter(Boolean).join(' / ');
    return '<div class="author-intel-focus-row">' +
      '<strong>' + escapeHtml(author.displayName || author.sourceAuthorId || item.key || '未知作者') + '</strong>' +
      '<small>' + escapeHtml(['发言 ' + (item.postCount || 0), '观点 ' + (item.opinionCount || 0), '缺口 ' + (item.evidenceGapCount || 0), focus].filter(Boolean).join(' · ')) + '</small>' +
      '</div>';
  }).join('');
}

function authorIntelligenceScope(dashboard) {
  const parts = [
    dashboard.sourceKey || '全部来源',
    dashboard.sourceThreadId ? '主题 ' + dashboard.sourceThreadId : undefined
  ];
  const filter = dashboard.authorFilter || {};
  if (filter.authorId || filter.displayName) {
    parts.push('作者 ' + (filter.displayName || filter.authorId));
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
  if (items.length === 0) return '<div class="muted">暂无来源复核压力。</div>';
  return items.slice(0, 12).map(function (item) {
    const details = [
      '主题 ' + (item.threadCount || 0),
      '作者 ' + (item.authorCount || 0),
      '观点 ' + (item.opinionCount || 0),
      '缺口 ' + (item.evidenceGapCount || 0),
      '待复核 ' + (item.reviewQueueCount || 0),
      '高优先 ' + (item.highPriorityReviewQueueCount || 0),
      item.latestGeneratedAt ? '最新 ' + item.latestGeneratedAt : undefined
    ].filter(Boolean).join(' · ');
    const typeSummary = formatAuthorCountSummary(item.reviewQueueTypeCounts);
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.sourceKey || '未知来源') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(typeSummary) + '</small>' +
      '<small>' + escapeHtml(authorWorkspaceCopy(item.recommendedNextAction)) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      statusBadge((item.highPriorityReviewQueueCount || 0) > 0 ? '待复核' : '稳定', (item.highPriorityReviewQueueCount || 0) > 0 ? 'warn' : 'ok') +
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
      sourceKey ? '来源 ' + sourceKey : undefined,
      item.type ? '类型 ' + item.type : undefined,
      item.reason ? '原因 ' + item.reason : undefined,
      item.score === undefined ? undefined : '评分 ' + item.score,
      ref.sourceThreadId ? '主题 ' + ref.sourceThreadId : undefined,
      ref.floor === undefined ? undefined : '#' + ref.floor
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.title || item.key || 'review item') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.summary || '') + '</small>' +
      '<small>' + escapeHtml(authorWorkspaceCopy(item.nextAction)) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      statusBadge(authorWorkspaceCopy(item.priority || 'unknown'), item.priority === 'high' ? 'warn' : 'muted') +
      renderSourceDrilldownButtonForScope({ sourceKey }) +
      '</span></div>';
  }).join('');
}

function renderAuthorReviewQueueResult(result) {
  const summary = result.summary || {};
  const openCount = summary.openCount || 0;
  return [
    renderAuthorReviewQueueHero(result),
    panel('来源关注', renderAuthorReviewQueueSourceHotspots(summary.sourceHotspots || []), 'wide'),
    panel('待复核事项', renderDurableAuthorReviewQueueRows(result.items || []), 'wide')
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
  const sync = result.createdCount === undefined ? undefined : '新建 ' + (result.createdCount || 0) + ' / 更新 ' + (result.updatedCount || 0);
  const status = result.status || (openCount > 0 ? 'review' : 'ok');
  return [
    '<article class="review-queue-hero">',
    '<section class="review-queue-main">',
    '<div class="review-queue-header">',
    '<span class="review-queue-label">复核队列</span>',
    statusBadge(workspaceStatusLabel(status), openCount > 0 ? 'warn' : statusVariant(status)),
    '</div>',
    '<h3>' + escapeHtml(authorWorkspaceCopy(result.recommendedNextAction, '当前没有待处理的作者复核。')) + '</h3>',
    '<p>' + escapeHtml([
      '状态 ' + workspaceStatusLabel(result.status || 'ok'),
      '优先级 ' + formatAuthorCountSummary(summary.byPriority),
      '类型 ' + formatAuthorCountSummary(summary.byType),
      sync
    ].filter(Boolean).join(' · ')) + '</p>',
    '<div class="review-queue-actions button-group">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">刷新队列</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="false" data-limit="50">提醒检查</button>' +
      '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="true" data-limit="50"' + alertDisabled + '>创建提醒</button>' +
    '</div>',
    '</section>',
    '<aside class="review-queue-signals">',
    reviewQueueSignal('事项', result.itemCount || 0, (result.itemCount || 0) > 0 ? 'ok' : 'muted'),
    reviewQueueSignal('待处理', openCount, openCount > 0 ? 'warn' : 'ok'),
    reviewQueueSignal('高优先', highCount, highCount > 0 ? 'warn' : 'ok'),
    reviewQueueSignal('来源', sourceCount, sourceCount > 0 ? 'warn' : 'muted'),
    '</aside>',
    '<section class="review-queue-hotspots">',
    '<span>来源关注</span>',
    renderReviewQueueHotspotRows(hotspots),
    '</section>',
    '<section class="review-queue-foot">',
    '<span>队列构成</span>',
    '<strong>' + escapeHtml(formatAuthorCountSummary(summary.byStatus)) + '</strong>',
    '<small>' + escapeHtml('来源 ' + formatAuthorCountSummary(sourceCounts)) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function reviewQueueSignal(label, value, variant) {
  return '<div class="review-queue-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function renderReviewQueueHotspotRows(items) {
  if (!items || items.length === 0) {
    return '<div class="review-queue-empty">暂无来源关注。</div>';
  }
  return items.slice(0, 3).map(function (item) {
    return '<div class="review-queue-hotspot-row">' +
      '<strong>' + escapeHtml(item.sourceKey || '未知来源') + '</strong>' +
      '<small>' + escapeHtml([
        '事项 ' + (item.itemCount || 0),
        '待处理 ' + (item.openCount || 0),
        '高优先 ' + (item.highPriorityOpenCount || 0),
        formatAuthorCountSummary(item.byType)
      ].filter(Boolean).join(' · ')) + '</small>' +
      '</div>';
  }).join('');
}

function renderAuthorReviewQueueSourceHotspots(items) {
  if (items.length === 0) return '<div class="muted">暂无来源关注。</div>';
  return items.slice(0, 12).map(function (item) {
    const details = [
      '事项 ' + (item.itemCount || 0),
      '待处理 ' + (item.openCount || 0),
      '高优先 ' + (item.highPriorityOpenCount || 0),
      item.latestUpdatedAt ? '最新 ' + item.latestUpdatedAt : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.sourceKey || '未知来源') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(formatAuthorCountSummary(item.byType)) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      statusBadge((item.highPriorityOpenCount || 0) > 0 ? '待复核' : '开放', (item.highPriorityOpenCount || 0) > 0 ? 'warn' : 'muted') +
      renderSourceDrilldownButtonForScope({ sourceKey: item.sourceKey }) +
      '</span></div>';
  }).join('');
}

function renderAuthorReviewQueueEventSynthesis(result) {
  const rows = result.results || [];
  return [
    panel('作者复核提醒', [
      metric('模式', result.dryRun ? '预演' : '执行'),
      metric('事项', result.itemCount || 0),
      metric('动作', result.actionCount || 0),
      metric('新增', result.createdCount || 0),
      metric('更新', result.updatedCount || 0),
      metric('已解决', result.resolvedCount || 0),
      metric('重新打开', result.reopenedCount || 0),
      metric('跳过', result.skippedCount || 0),
      metric('下一步', authorWorkspaceCopy(result.recommendedNextAction, '无')),
      '<span class="button-group">' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="load-author-review-queue">返回队列</button>' +
        '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-author-review-queue-events" data-execute="false" data-limit="50">再次检查</button>' +
      '</span>'
    ].join(''), 'wide'),
    panel('提醒预览', evidenceList(rows.map(function (item) {
      return authorReviewQueueEventSynthesisLine(item);
    })), 'wide')
  ].join('');
}

function authorReviewQueueEventSynthesisLine(item) {
  const safeItem = item || {};
  const event = safeItem.event || {};
  return [
    workspaceStatusLabel(safeItem.status || 'unknown'),
    safeItem.itemId ? '事项 ' + safeItem.itemId : '事项未记录',
    event.id ? '提醒 ' + event.id : '暂无提醒',
    '级别 ' + workspaceStatusLabel(event.severity || 'unknown'),
    safeItem.reason ? '原因 ' + safeItem.reason : undefined
  ].filter(Boolean).join(' · ');
}

function renderDurableAuthorReviewQueueRowsLegacy(items) {
  if (items.length === 0) return '<div class="muted">暂无持久复核事项。</div>';
  return items.slice(0, 30).map(function (item) {
    const ref = (item.refs || [])[0] || {};
    const sourceKey = item.sourceKey || ref.sourceKey;
    const details = [
      item.id,
      sourceKey ? '来源 ' + sourceKey : undefined,
      item.type ? '类型 ' + item.type : undefined,
      item.reason ? '原因 ' + item.reason : undefined,
      item.sourceThreadId || ref.sourceThreadId ? '主题 ' + (item.sourceThreadId || ref.sourceThreadId) : undefined,
      item.floor === undefined && ref.floor === undefined ? undefined : '#' + (item.floor === undefined ? ref.floor : item.floor),
      '出现 ' + (item.seenCount || 0)
    ].filter(Boolean).join(' · ');
    const controls = '<span class="button-group source-op-buttons">' +
      renderSourceDrilldownButtonForScope({ sourceKey }) +
      (item.status === 'open'
        ? '<button class="inline-button secondary-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="confirmed">确认</button><button class="inline-button warning-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="ignored">忽略</button>'
        : statusBadge(authorWorkspaceCopy(item.status || 'unknown'), item.status === 'confirmed' ? 'ok' : 'muted')) +
      '</span>';
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.title || item.id) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.summary || '') + '</small>' +
      '<small>' + escapeHtml(authorWorkspaceCopy(item.nextAction)) + '</small>' +
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
      sourceKey ? '来源 ' + sourceKey : undefined,
      '发言 ' + (item.postCount || 0),
      '观点 ' + (item.opinionCount || 0),
      '主题 ' + (item.threadCount || 0),
      item.dominantStance ? '立场 ' + item.dominantStance : undefined,
      item.averageOpinionConfidence === undefined ? undefined : '可信度 ' + item.averageOpinionConfidence,
      '主线 ' + (item.primaryThreadCount || 0),
      '缺口 ' + (item.evidenceGapCount || 0)
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(author.displayName || author.sourceAuthorId || item.key) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(intelligence.summary || focus || formatStanceSummary(item.stanceSummary)) + '</small>' +
      (focus ? '<small>' + escapeHtml(focus) + '</small>' : '') +
      '</span><span class="button-group source-op-buttons">' +
      statusBadge(workspaceStatusLabel(intelligence.evidenceStatus || (item.evidenceGapCount > 0 ? 'needs-review' : 'ready')), intelligence.evidenceStatus === 'needs-review' ? 'warn' : 'ok') +
      renderSourceDrilldownButtonForScope({ sourceKey }) +
      '</span></div>';
  }).join('');
}

function renderAuthorReviewQueueRows(items) {
  if (items.length === 0) return '<div class="muted">暂无作者复核事项。</div>';
  return items.slice(0, 12).map(function (item) {
    const ref = (item.refs || [])[0] || {};
    const sourceKey = item.sourceKey || ref.sourceKey || (item.thread && item.thread.sourceKey);
    const threadRef = ref.sourceThreadId ? '主题 ' + ref.sourceThreadId : undefined;
    const floorRef = ref.floor === undefined ? undefined : '#' + ref.floor;
    return '<div class="author-review-row ' + (item.priority === 'high' ? 'is-hot' : '') + '">' +
      '<section class="author-review-identity">' +
        '<span class="author-review-source">' + escapeHtml(sourceKey || '全部来源') + '</span>' +
        '<strong>' + escapeHtml(authorWorkspaceCopy(item.title, item.key || '复核事项')) + '</strong>' +
        '<small>' + escapeHtml([authorWorkspaceCopy(item.type), authorWorkspaceCopy(item.reason)].filter(Boolean).join(' / ') || '作者线索') + '</small>' +
      '</section>' +
      '<section class="author-review-brief">' +
        '<p>' + escapeHtml(item.summary || item.reason || '需要先复核证据，再继续后续动作。') + '</p>' +
        '<div class="author-review-chips">' +
          authorMetaChip('优先级', authorWorkspaceCopy(item.priority || 'unknown'), item.priority === 'high' ? 'warn' : 'muted') +
          authorMetaChip('评分', item.score === undefined ? undefined : item.score, item.score >= 0.8 ? 'warn' : 'info') +
          authorMetaChip('主题', threadRef, 'info') +
          authorMetaChip('楼层', floorRef, 'muted') +
        '</div>' +
        '<small>' + escapeHtml(authorWorkspaceCopy(item.nextAction, '打开来源范围，核验证据路径。')) + '</small>' +
      '</section>' +
      '<section class="author-review-actions button-group source-op-buttons">' +
        statusBadge(authorWorkspaceCopy(item.priority || 'unknown'), item.priority === 'high' ? 'warn' : 'muted') +
        renderSourceDrilldownButtonForScope({ sourceKey }) +
      '</section>' +
    '</div>';
  }).join('');
}

function renderDurableAuthorReviewQueueRows(items) {
  if (items.length === 0) return '<div class="muted">暂无持久复核事项。</div>';
  return items.slice(0, 30).map(function (item) {
    const ref = (item.refs || [])[0] || {};
    const sourceKey = item.sourceKey || ref.sourceKey;
    const threadRef = item.sourceThreadId || ref.sourceThreadId;
    const floorRef = item.floor === undefined && ref.floor === undefined ? undefined : '#' + (item.floor === undefined ? ref.floor : item.floor);
    const controls = '<section class="author-review-actions button-group source-op-buttons">' +
      renderSourceDrilldownButtonForScope({ sourceKey }) +
      (item.status === 'open'
        ? '<button class="inline-button secondary-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="confirmed">确认</button><button class="inline-button warning-inline-button" type="button" data-action="set-author-review-status" data-item-id="' + escapeHtml(item.id) + '" data-status="ignored">忽略</button>'
        : statusBadge(item.status || 'unknown', item.status === 'confirmed' ? 'ok' : 'muted')) +
      '</section>';
    return '<div class="author-review-row durable-review-row ' + (item.priority === 'high' ? 'is-hot' : '') + '">' +
      '<section class="author-review-identity">' +
        '<span class="author-review-source">' + escapeHtml(sourceKey || '未知来源') + '</span>' +
        '<strong>' + escapeHtml(authorWorkspaceCopy(item.title, item.id)) + '</strong>' +
        '<small>' + escapeHtml([authorWorkspaceCopy(item.type), authorWorkspaceCopy(item.reason)].filter(Boolean).join(' / ') || item.id) + '</small>' +
      '</section>' +
      '<section class="author-review-brief">' +
        '<p>' + escapeHtml(item.summary || '队列事项正在等待判断。') + '</p>' +
        '<div class="author-review-chips">' +
          authorMetaChip('状态', authorWorkspaceCopy(item.status || 'unknown'), item.status === 'open' ? 'warn' : 'muted') +
          authorMetaChip('出现', item.seenCount || 0, (item.seenCount || 0) > 1 ? 'info' : 'muted') +
          authorMetaChip('主题', threadRef ? '主题 ' + threadRef : undefined, 'info') +
          authorMetaChip('楼层', floorRef, 'muted') +
        '</div>' +
        '<small>' + escapeHtml(authorWorkspaceCopy(item.nextAction, '确认、忽略，或打开来源查看证据。')) + '</small>' +
      '</section>' +
      controls +
      '</div>';
  }).join('');
}

function renderAuthorIntelligenceRows(authors) {
  if (authors.length === 0) return '<div class="muted">暂无作者画像。</div>';
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
        '<span class="author-review-source">' + escapeHtml(sourceKey || '未知来源') + '</span>' +
        '<strong>' + escapeHtml(author.displayName || author.sourceAuthorId || item.key || '未知作者') + '</strong>' +
        '<small>' + escapeHtml([author.sourceAuthorId, item.dominantStance ? '态度=' + item.dominantStance : undefined].filter(Boolean).join(' / ') || '作者画像') + '</small>' +
      '</section>' +
      '<section class="author-signal-brief">' +
        '<p>' + escapeHtml(intelligence.summary || focus || formatStanceSummary(item.stanceSummary) || '暂无摘要。') + '</p>' +
        '<div class="author-signal-metrics">' +
          authorMetaChip('发言', item.postCount || 0, 'info') +
          authorMetaChip('观点', item.opinionCount || 0, 'ok') +
          authorMetaChip('主题', item.threadCount || 0, 'muted') +
          authorMetaChip('可信度', confidence, confidence >= 0.8 ? 'ok' : 'muted') +
          authorMetaChip('主线', item.primaryThreadCount || 0, 'info') +
          authorMetaChip('缺口', item.evidenceGapCount || 0, item.evidenceGapCount > 0 ? 'warn' : 'ok') +
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
      thread.sourceThreadId ? '主题 ' + thread.sourceThreadId : undefined,
      item.publishedAt,
      item.scope,
      item.horizon,
      item.confidence === undefined ? undefined : '可信度 ' + item.confidence
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml('#' + item.floor + ' · ' + (author.displayName || author.sourceAuthorId || '未知作者')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.evidenceText || '') + '</small>' +
      '</span>' +
      statusBadge(authorWorkspaceCopy(item.attitude || 'unknown'), statusVariant(item.attitude)) +
      '</div>';
  }).join('');
}

function renderAuthorEvidenceGapRowsLegacy(gaps) {
  if (gaps.length === 0) return '<div class="muted">暂无证据缺口</div>';
  return gaps.slice(0, 12).map(function (gap) {
    const entity = gap.entity || {};
    const thread = gap.thread || {};
    const details = [
      thread.sourceThreadId ? '主题 ' + thread.sourceThreadId : undefined,
      '#' + gap.firstFloor + '-#' + gap.lastFloor,
      gap.reason
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(entity.displayName || gap.key || '未知对象') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(gap.summary || '') + '</small>' +
      '</span>' +
      statusBadge('证据缺口', 'warn') +
      '</div>';
  }).join('');
}

function renderAuthorEvidenceRowsLegacy(items) {
  if (items.length === 0) return '<div class="muted">暂无高信号证据</div>';
  return items.slice(0, 12).map(function (item) {
    const thread = item.thread || {};
    const author = item.author || {};
    const details = [
      thread.sourceThreadId ? '主题 ' + thread.sourceThreadId : undefined,
      item.publishedAt,
      item.score === undefined ? undefined : '评分 ' + item.score
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml('#' + item.floor + ' · ' + (author.displayName || author.sourceAuthorId || '未知作者')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.excerpt || '') + '</small>' +
      '</span>' +
      statusBadge('证据', 'ok') +
      '</div>';
  }).join('');
}

function renderAuthorEntityRows(entities) {
  if (entities.length === 0) return '<div class="muted">暂无聚焦实体。</div>';
  return entities.slice(0, 12).map(function (item) {
    const entity = item.entity || {};
    const levels = item.evidenceLevels || {};
    return '<div class="author-evidence-row entity-signal-row">' +
      '<section class="author-evidence-anchor">' +
        '<span class="author-review-source">对象</span>' +
        '<strong>' + escapeHtml(entity.displayName || item.key || '未知对象') + '</strong>' +
        '<small>' + escapeHtml(item.latestAttitude || '未知态度') + '</small>' +
      '</section>' +
      '<section class="author-evidence-brief">' +
        '<p>' + escapeHtml(formatStanceSummary(item.attitudeCounts) || '这个对象出现在当前作者窗口中。') + '</p>' +
        '<div class="author-evidence-chips">' +
          authorMetaChip('提及', item.mentionCount || 0, 'info') +
          authorMetaChip('作者观点', item.primaryAuthorOpinionCount || 0, 'ok') +
          authorMetaChip('主题', item.threadCount || 0, 'muted') +
          authorMetaChip('明确', levels.explicit || 0, (levels.explicit || 0) > 0 ? 'ok' : 'muted') +
          authorMetaChip('推断', levels.inferred || 0, (levels.inferred || 0) > 0 ? 'warn' : 'muted') +
        '</div>' +
      '</section>' +
      '<section class="author-evidence-status">' +
        statusBadge(item.latestAttitude || 'unknown', statusVariant(item.latestAttitude)) +
      '</section>' +
      '</div>';
  }).join('');
}

function renderOpinionTimelineRows(items) {
  if (items.length === 0) return '<div class="muted">暂无观点时间线。</div>';
  return items.slice(0, 16).map(function (item) {
    const thread = item.thread || {};
    const author = item.author || {};
    return '<div class="author-evidence-row opinion-timeline-row">' +
      '<section class="author-evidence-anchor">' +
        '<span class="author-review-source">' + escapeHtml(thread.sourceKey || '时间线') + '</span>' +
        '<strong>' + escapeHtml('#' + item.floor + ' / ' + (author.displayName || author.sourceAuthorId || '未知作者')) + '</strong>' +
        '<small>' + escapeHtml(item.publishedAt || '时间未知') + '</small>' +
      '</section>' +
      '<section class="author-evidence-brief">' +
        '<p>' + escapeHtml(item.evidenceText || '暂无观点证据文本。') + '</p>' +
        '<div class="author-evidence-chips">' +
          authorMetaChip('主题', thread.sourceThreadId ? '主题 ' + thread.sourceThreadId : undefined, 'info') +
          authorMetaChip('范围', item.scope, 'muted') +
          authorMetaChip('周期', item.horizon, 'muted') +
          authorMetaChip('可信度', item.confidence, item.confidence >= 0.8 ? 'ok' : 'muted') +
        '</div>' +
      '</section>' +
      '<section class="author-evidence-status">' +
        statusBadge(item.attitude || 'unknown', statusVariant(item.attitude)) +
      '</section>' +
      '</div>';
  }).join('');
}

function renderAuthorEvidenceGapRows(gaps) {
  if (gaps.length === 0) return '<div class="muted">暂无证据缺口。</div>';
  return gaps.slice(0, 12).map(function (gap) {
    const entity = gap.entity || {};
    const thread = gap.thread || {};
    return '<div class="author-evidence-row evidence-gap-row">' +
      '<section class="author-evidence-anchor">' +
        '<span class="author-review-source">' + escapeHtml(thread.sourceKey || '缺口') + '</span>' +
        '<strong>' + escapeHtml(entity.displayName || gap.key || '未知对象') + '</strong>' +
        '<small>' + escapeHtml('#' + gap.firstFloor + '-#' + gap.lastFloor) + '</small>' +
      '</section>' +
      '<section class="author-evidence-brief">' +
        '<p>' + escapeHtml(gap.summary || gap.reason || '这个对象需要更强证据才能继续自动处理。') + '</p>' +
        '<div class="author-evidence-chips">' +
          authorMetaChip('主题', thread.sourceThreadId ? '主题 ' + thread.sourceThreadId : undefined, 'info') +
          authorMetaChip('原因', gap.reason, 'warn') +
          authorMetaChip('起点', gap.firstFloor === undefined ? undefined : '#' + gap.firstFloor, 'muted') +
          authorMetaChip('终点', gap.lastFloor === undefined ? undefined : '#' + gap.lastFloor, 'muted') +
        '</div>' +
      '</section>' +
      '<section class="author-evidence-status">' +
        statusBadge('gap', 'warn') +
      '</section>' +
      '</div>';
  }).join('');
}

function renderAuthorEvidenceRows(items) {
  if (items.length === 0) return '<div class="muted">暂无高信号证据。</div>';
  return items.slice(0, 12).map(function (item) {
    const thread = item.thread || {};
    const author = item.author || {};
    return '<div class="author-evidence-row high-signal-row">' +
      '<section class="author-evidence-anchor">' +
        '<span class="author-review-source">' + escapeHtml(thread.sourceKey || '证据') + '</span>' +
        '<strong>' + escapeHtml('#' + item.floor + ' / ' + (author.displayName || author.sourceAuthorId || '未知作者')) + '</strong>' +
        '<small>' + escapeHtml(item.publishedAt || '时间未知') + '</small>' +
      '</section>' +
      '<section class="author-evidence-brief">' +
        '<p>' + escapeHtml(item.excerpt || '暂无证据摘录。') + '</p>' +
        '<div class="author-evidence-chips">' +
          authorMetaChip('主题', thread.sourceThreadId ? '主题 ' + thread.sourceThreadId : undefined, 'info') +
          authorMetaChip('评分', item.score, item.score >= 0.8 ? 'ok' : 'muted') +
          authorMetaChip('楼层', item.floor === undefined ? undefined : '#' + item.floor, 'muted') +
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
  const floors = (evidencePackage.floors || []).length > 0 ? '#' + evidencePackage.floors.slice(0, 6).join(' / #') : '暂无';
  const reviewCount = match.reviewRequiredCount || 0;
  const taskCount = handoff.taskCount || (report.contextReviewTasks || []).length || 0;
  const highPriorityCount = handoff.highPriorityTaskCount || 0;
  const tags = [
    summary.evidenceLevel ? '证据 ' + summary.evidenceLevel : undefined,
    summary.confidence !== undefined ? '可信度 ' + summary.confidence : undefined,
    match.topEntity ? '对象 ' + match.topEntity : undefined,
    match.topRelationType ? '关系 ' + match.topRelationType : undefined
  ].filter(Boolean);
  const reviewTone = highPriorityCount > 0 || reviewCount > 0 ? 'warn' : statusVariant(summary.status || match.status || handoff.status);
  return [
    '<article class="context-verdict-hero">',
    '<section class="context-verdict-main">',
    '<div class="context-verdict-header">',
    '<span class="context-verdict-label">上下文判断</span>',
    statusBadge(summary.status || match.status || 'interpreted', reviewTone),
    '</div>',
    '<h3>' + escapeHtml(summary.summary || '已完成语境召回，等待进一步核验。') + '</h3>',
    '<p>' + escapeHtml(post.contentText || '暂无新发言内容。') + '</p>',
    '<div class="context-verdict-tags">' + tagList(tags) + '</div>',
    '</section>',
    '<aside class="context-verdict-rail">',
    contextVerdictSignal('匹配', match.total || (report.contextChainMatches || []).length || 0, statusVariant(match.status)),
    contextVerdictSignal('复核', reviewCount, reviewCount > 0 ? 'warn' : 'ok'),
    contextVerdictSignal('事项', taskCount, taskCount > 0 ? 'warn' : 'muted'),
    contextVerdictSignal('楼层', floors, floors === '暂无' ? 'muted' : 'ok'),
    '</aside>',
    '<section class="context-verdict-next">',
    '<span>下一步</span>',
    '<strong>' + escapeHtml(handoff.recommendedNextAction || '查看匹配证据，并决定是否需要创建复核事项。') + '</strong>',
    '<small>' + escapeHtml(highPriorityCount > 0 ? '高优先复核事项 ' + highPriorityCount : '暂无高优先复核事项') + '</small>',
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
  if (!results.length) return emptySignal('暂未找到匹配证据。', '检索');
  return results.map(function (item) {
    const metadata = item.metadata || {};
    const floor = metadata.floor !== undefined && metadata.floor !== null ? '#' + metadata.floor : '#?';
    const author = metadata.author || metadata.authorId || '未知作者';
    const score = item.score !== undefined && item.score !== null ? item.score : '暂无';
    return '<div class="search-hit-row">' +
      '<div class="search-hit-meta">' +
      '<span>' + escapeHtml(floor) + '</span>' +
      '<strong>' + escapeHtml(author) + '</strong>' +
      '<small>匹配度 ' + escapeHtml(score) + '</small>' +
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
  const adapterSummary = recipe.adapterGuidance && recipe.adapterGuidance.summary || (recipe.requiresAdapter ? '需要适配器。' : '不需要适配器。');
  const compatibleLabel = compatibleSourceKeys.length > 0 ? compatibleSourceKeys.join(', ') : 'none';
  return renderConnectorCatalogPanels(sourceTypeSpec).concat([
    panel('来源接入方案', [
      metric('来源类型', sourceTypeSpec.sourceType),
      metric('适配方式', recipe.requiresAdapter ? '需要适配器' : '直接接入'),
      metric('位置字段', requiredFields.length + ' 必填 / ' + optionalFields.length + ' 选填'),
      metric('兼容来源', compatibleLabel)
    ].join('')),
    panel('接入提示', [
      '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(recipe.requiresAdapter ? '论坛适配器' : '标准来源') + '</strong>' +
      '<small>' + escapeHtml(adapterSummary) + '</small>' +
      '</span>' + statusBadge(recipe.requiresAdapter ? 'adapter' : 'direct', recipe.requiresAdapter && compatibleSourceKeys.length === 0 ? 'warning' : 'ok') + '</div>'
    ].join('')),
    panel('位置字段', renderRecipeLocationRows(sourceTypeSpec, requiredFields, optionalFields), 'wide'),
    panel('建议流程', renderRecipeFlowRows(recipe.recommendedFlow || []), 'wide'),
    panel('发布清单模板', [
      '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(manifest.name || '发布清单') + '</strong>' +
      '<small>' + escapeHtml([
        '来源 ' + workspaceValue(manifest.source && manifest.source.sourceKey, '未命名'),
        '类型 ' + workspaceValue(manifest.source && manifest.source.sourceType, '未设置')
      ].join(' · ')) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-onboarding-recipe-manifest">使用模板</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="preflight-onboarding-recipe-manifest">检查模板</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-rollout-readiness-checks">检查发布</button>' +
      '</span></div>',
      '<pre>' + escapeHtml(JSON.stringify(manifest, null, 2)) + '</pre>'
    ].join(''), 'wide')
  ]).join('');
}

function renderConnectorCatalogPanels(sourceTypeSpec) {
  const panels = [];
  if (sourceTypeSpec.package) {
    panels.push(panel('来源包', [
      renderConnectorPackageSummary(sourceTypeSpec.package),
      renderConnectorPackageCategories(sourceTypeSpec.package.categories),
      metric('推荐清单', sourceTypeSpec.package.rollout && sourceTypeSpec.package.rollout.recommendedManifest || 'none'),
      renderConnectorPackageUseButtons(sourceTypeSpec.package, sourceTypeSpec.sourceType)
    ].join(''), 'wide'));
  } else if ((state.connectorPackages || []).length > 0) {
    panels.push(panel('来源包', renderConnectorPackageCatalogRows(state.connectorPackages), 'wide'));
  }
  if ((state.connectorModuleErrors || []).length > 0) {
    panels.push(panel('来源模块错误', evidenceList(state.connectorModuleErrors.map(function (error) {
      return [
        '模块 ' + workspaceValue(error.modulePath, '未识别模块'),
        '原因 ' + workspaceValue(error.message, '加载失败')
      ].join(' · ');
    })), 'wide'));
  }
  return panels;
}

function renderConnectorPackageSummary(connectorPackage) {
  const packageSourceType = connectorPackage.sourceType || {};
  return [
    '<div class="action-row ops-row"><span>',
    '<strong>' + escapeHtml(connectorPackage.displayName || connectorPackage.packageName || '来源包') + '</strong>',
    '<small>' + escapeHtml([
      connectorPackage.packageName ? '包 ' + connectorPackage.packageName : undefined,
      connectorPackage.packageVersion ? '版本 ' + connectorPackage.packageVersion : undefined,
      connectorPackage.packageType ? '类型 ' + connectorPackage.packageType : undefined,
      packageSourceType.kind ? '来源形态 ' + packageSourceType.kind : undefined
    ].filter(Boolean).join(' · ')) + '</small>',
    '<small>' + escapeHtml(packageSourceType.description || packageSourceType.displayName || '') + '</small>',
    '</span>' + statusBadge('来源包', 'ok') + '</div>'
  ].join('');
}

function renderConnectorPackageCategories(categories) {
  if (!categories || categories.length === 0) return tagList(['未分类']);
  return tagList(categories.map(function (category) {
    return '分类 ' + category;
  }));
}

function renderConnectorPackageCatalogRows(packages) {
  if (!packages.length) return '<div class="muted">暂无来源包信息。</div>';
  return packages.map(function (connectorPackage) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(connectorPackage.displayName || connectorPackage.packageName || '来源包') + '</strong>' +
      '<small>' + escapeHtml([
        connectorPackage.packageName ? '包 ' + connectorPackage.packageName : undefined,
        connectorPackage.packageType ? '类型 ' + connectorPackage.packageType : undefined,
        (connectorPackage.categories || []).length ? '分类 ' + (connectorPackage.categories || []).join('、') : undefined
      ].filter(Boolean).join(' · ')) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderConnectorPackageUseButtons(connectorPackage) +
      statusBadge('来源包', 'ok') +
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
      ' data-source-type="' + escapeHtml(item.sourceType || '') + '">使用来源包</button>' +
      renderConnectorPackageManifestButton(connectorPackage, item.sourceType);
  }).join('');
}

function renderConnectorPackageManifestButton(connectorPackage, sourceType) {
  if (!connectorPackage || !connectorPackage.rollout || !connectorPackage.rollout.recommendedManifest) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-connector-package-manifest"' +
    ' data-package-name="' + escapeHtml(connectorPackage.packageName || '') + '"' +
    ' data-module-path="' + escapeHtml(connectorPackage.modulePath || '') + '"' +
    ' data-source-type="' + escapeHtml(sourceType || '') + '">载入清单</button>';
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
  if (fields.length === 0) return '<div class="muted">暂无位置字段。</div>';
  return fields.map(function (field) {
    const property = properties[field] || {};
    const required = requiredFields.includes(field);
    const detail = [
      property.type,
      property.format,
      property.description
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(field) + '</strong>' +
      '<small>' + escapeHtml(detail || '位置值') + '</small>' +
      '</span>' + statusBadge(required ? '必填' : '选填', required ? 'warning' : 'muted') + '</div>';
  }).join('');
}

function renderRecipeFlowRows(flow) {
  if (!flow.length) return '<div class="muted">暂无建议流程。</div>';
  return flow.map(function (step) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml((step.phase || '步骤') + ' · ' + (step.key || '未知步骤')) + '</strong>' +
      '<small>' + escapeHtml(step.summary || '') + '</small>' +
      '<small>' + escapeHtml([step.cli, step.api].filter(Boolean).join(' · ')) + '</small>' +
      '</span>' + statusBadge(step.key || '步骤', 'muted') + '</div>';
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
      metric('状态', workspaceStatusLabel(result.status)),
      metric('论坛', result.sourceKey || '未知'),
      metric('来源类型', result.sourceType || '未知'),
      metric('步骤', steps.length),
      metric('失败', failedSteps.length)
    ].join('')),
    panel('预检步骤', evidenceList(steps.map(function (step) {
      return workspaceStatusLabel(step.status) + ' · ' + step.key + ' · ' + step.summary;
    })), 'wide')
  ];
  if ((result.nextActions || []).length > 0) {
    panels.push(panel('接入建议', evidenceList((result.nextActions || []).map(function (action) {
      const commands = action.commands || (action.command ? [action.command] : []);
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' 证据 ' + detail.evidenceSummary : '');
      }).join(' · ');
      return workspaceStatusLabel(action.severity) + ' · ' + action.key + ' · ' + action.summary + ' · ' + commands.join(' · ') + (action.evidenceSummary ? ' · 证据 ' + action.evidenceSummary : '') + (details ? ' · 明细 ' + details : '');
    })), 'wide'));
  }
  if (result.sourceValidation && result.sourceValidation.source) {
    panels.push(panel('来源草稿', [
      metric('来源 ID', result.sourceValidation.source.id),
      metric('可保存', result.sourceValidation.valid ? '是' : '否'),
      metric('诊断', workspaceStatusLabel(result.sourceValidation.status))
    ].join('')));
  }
  if (result.rolloutManifestDraft) {
    panels.push(panel('发布清单草稿', [
      '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(result.rolloutManifestDraft.name || '未命名清单') + '</strong>' +
      '<small>' + escapeHtml((result.rolloutManifestDraft.source && result.rolloutManifestDraft.source.sourceKey || '未知') + ' · ' + (result.rolloutManifestDraft.source && result.rolloutManifestDraft.source.sourceType || '未知')) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-rollout-manifest-draft">使用草稿</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="preflight-rollout-manifest-draft">检查草稿</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-rollout-readiness-checks">检查发布</button>' +
      '</span></div>',
      '<pre>' + escapeHtml(JSON.stringify(result.rolloutManifestDraft, null, 2)) + '</pre>'
    ].join(''), 'wide'));
  }
  if (result.connectorModuleValidation) {
    rememberConnectorContractSourceTypes(result.connectorModuleValidation.contractSummary);
    rememberConnectorPackageManifests(result.connectorModuleValidation.packageManifests);
    panels.push(panel('接入模块', [
      renderConnectorContractTiles(result.connectorModuleValidation.contractSummary),
      metric('可加载', result.connectorModuleValidation.valid ? '是' : '否'),
      metric('状态', workspaceStatusLabel(result.connectorModuleValidation.status)),
      metric('模块', result.connectorModuleValidation.modulePath || '未提供'),
      metric('错误', (result.connectorModuleValidation.errors || []).length)
    ].join('')));
    if (hasConnectorContractDetails(result.connectorModuleValidation.contractSummary)) {
      panels.push(panel('接入契约概览', renderConnectorContractSummary(result.connectorModuleValidation.contractSummary), 'wide'));
    }
    if ((result.connectorModuleValidation.packageManifests || []).length > 0) {
      panels.push(panel('来源包', renderConnectorPackageManifestRows(result.connectorModuleValidation.packageManifests), 'wide'));
    }
    const failureRows = connectorContractFailureRows(result.connectorModuleValidation.checks || []);
    if (failureRows.length > 0) {
      panels.push(panel('接入契约问题', evidenceList(failureRows), 'wide'));
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
    panels.push(panel('来源包', renderConnectorPackageManifestRows(result.packageManifests), 'wide'));
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
  if (!packageManifests || packageManifests.length === 0) return '<div class="muted">暂无来源包清单。</div>';
  return packageManifests.map(function (item) {
    const details = [
      item.packageName ? '包 ' + item.packageName : undefined,
      item.packageVersion ? '版本 ' + item.packageVersion : undefined,
      item.packageType ? '类型 ' + item.packageType : undefined,
      (item.categories || []).length ? '分类 ' + item.categories.join('、') : undefined,
      (item.declaredSourceTypes || []).length ? '来源类型 ' + item.declaredSourceTypes.join('、') : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(item.displayName || item.packageName || '来源包') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(item.rollout && item.rollout.recommendedManifest ? '推荐清单 ' + item.rollout.recommendedManifest : '暂无推荐清单') + '</small>' +
      '</span>' + statusBadge(workspaceStatusLabel(item.status || 'unknown'), statusVariant(item.status)) + '</div>';
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
      rows.push(check.key + ' · 重复适配器 ' + value.duplicateForumAdapters.join('、'));
    }
    if (Array.isArray(value.duplicateSourceIngestHandlers) && value.duplicateSourceIngestHandlers.length > 0) {
      rows.push(check.key + ' · 重复采集处理 ' + value.duplicateSourceIngestHandlers.join('、'));
    }
    (value.failures || []).forEach(function (failure) {
      rows.push(check.key + ' · ' + workspaceValue(failure.sourceKey || failure.sourceType, '未知来源') + ' · 缺少字段 ' + (failure.missing || []).join('、'));
    });
    return rows;
  }, []);
}

function renderSourceIngestDryRun(result) {
  const checks = result.checks || [];
  const panels = [
    panel('来源采集试跑', [
      metric('状态', workspaceStatusLabel(result.status)),
      metric('试跑', result.dryRun ? '是' : '否'),
      metric('来源', result.source ? result.source.sourceKey + ' / ' + result.source.sourceType : '未知'),
      metric('主题', result.thread ? result.thread.sourceThreadId : '暂无'),
      metric('发言', result.thread ? result.thread.postCount : 0)
    ].join('')),
    panel('隔离写入', [
      metric('快照', result.repositoryWrites ? result.repositoryWrites.threadSnapshots : 0),
      metric('报告', result.repositoryWrites ? result.repositoryWrites.reports : 0),
      metric('任务', result.repositoryWrites ? result.repositoryWrites.tasks : 0),
      metric('原始页', result.repositoryWrites ? result.repositoryWrites.rawThreadPages : 0)
    ].join('')),
    panel('预演检查', evidenceList(checks.map(function (check) {
      return workspaceStatusLabel(check.status) + ' · ' + check.key + ' · ' + check.summary;
    })), 'wide')
  ];
  if (result.error) {
    panels.push(panel('预演错误', [
      metric('代码', result.error.code || 'error'),
      metric('说明', result.error.message)
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
    panel('来源上线计划', [
      moduleValidation ? renderConnectorContractTiles(moduleValidation.contractSummary) : '',
      metric('状态', workspaceStatusLabel(result.status)),
      metric('来源', workspaceValue(result.sourceKey, '未知') + ' / ' + workspaceValue(result.sourceType, '未知')),
      metric('模块', result.modulePath || '未提供'),
      metric('步骤', steps.length)
    ].join('')),
    panel('上线步骤', evidenceList(steps.map(function (step) {
      return workspaceStatusLabel(step.status) + ' · ' + step.key + ' · ' + step.summary;
    })), 'wide')
  ];
  if (result.sourceIngestDryRun) {
    panels.push(panel('采集试跑', [
      metric('状态', workspaceStatusLabel(result.sourceIngestDryRun.status)),
      metric('主题', result.sourceIngestDryRun.thread ? result.sourceIngestDryRun.thread.sourceThreadId : '暂无'),
      metric('发言', result.sourceIngestDryRun.thread ? result.sourceIngestDryRun.thread.postCount : 0)
    ].join('')));
  }
  if (moduleValidation && hasConnectorContractDetails(moduleValidation.contractSummary)) {
    panels.push(panel('接入契约概览', renderConnectorContractSummary(moduleValidation.contractSummary), 'wide'));
  }
  if (moduleValidation && (moduleValidation.packageManifests || []).length > 0) {
    panels.push(panel('来源包', renderConnectorPackageManifestRows(moduleValidation.packageManifests), 'wide'));
  }
  if (moduleValidation) {
    const failureRows = connectorContractFailureRows(moduleValidation.checks || []);
    if (failureRows.length > 0) {
      panels.push(panel('接入契约问题', evidenceList(failureRows), 'wide'));
    }
  }
  if (actions.length > 0) {
    panels.push(panel('下一步', evidenceList(actions.map(function (action) {
      return workspaceStatusLabel(action.severity) + ' · ' + action.key + ' · ' + action.command;
    })), 'wide'));
  }
  return panels.join('');
}

function renderWorkerTopologyPlan(result) {
  const workers = result.workers || [];
  const checks = result.checks || [];
  return [
    panel('执行拓扑计划', [
      metric('状态', workspaceStatusLabel(result.status)),
      metric('拓扑', result.topology),
      metric('存储', result.storageMode),
      metric('来源模式', result.sourceTaskMode),
      metric('范围', formatEventSourceScope(result.scope || {
        sourceKey: result.sourceKey,
        sourceId: result.sourceId
      }))
    ].join('')),
    panel('执行器', evidenceList(workers.map(function (worker) {
      return worker.workerType + ' · 规模 ' + worker.scale + ' · 占用 ' + worker.leaseKey + ' · ' + worker.command;
    })), 'wide'),
    panel('拓扑检查', evidenceList(checks.map(function (check) {
      return workspaceStatusLabel(check.status) + ' · ' + check.key + ' · ' + check.summary;
    })), 'wide')
  ].join('');
}

function renderRolloutManifestPlan(result) {
  const steps = result.steps || [];
  const actions = result.nextActions || [];
  const panels = [
    panel('发布清单计划', [
      metric('状态', workspaceStatusLabel(result.status)),
      metric('清单', (result.name || '未命名') + ' / ' + (result.manifestVersion || '1.0')),
      metric('来源', workspaceValue(result.sourceKey, '未知') + ' / ' + workspaceValue(result.sourceType, '未知')),
      metric('模块', result.modulePath || '未提供')
    ].join('')),
    panel('清单步骤', evidenceList(steps.map(function (step) {
      return workspaceStatusLabel(step.status) + ' · ' + step.key + ' · ' + step.summary;
    })), 'wide')
  ];
  if (result.connectorRolloutPlan) {
    panels.push(panel('接入计划', [
      metric('状态', workspaceStatusLabel(result.connectorRolloutPlan.status)),
      metric('步骤', (result.connectorRolloutPlan.steps || []).length),
      metric('下一步', (result.connectorRolloutPlan.nextActions || []).length)
    ].join('')));
  }
  if (result.workerTopologyPlan) {
    panels.push(panel('执行拓扑', [
      metric('状态', workspaceStatusLabel(result.workerTopologyPlan.status)),
      metric('拓扑', result.workerTopologyPlan.topology),
      metric('执行器', (result.workerTopologyPlan.workers || []).length)
    ].join('')));
  }
  if (actions.length > 0) {
    panels.push(panel('清单建议', evidenceList(actions.map(function (action) {
      const related = (action.relatedCommands || []).length > 0 ? ' · 相关命令 ' + action.relatedCommands.join(' · ') : '';
      return workspaceStatusLabel(action.severity) + ' · ' + action.key + ' · ' + action.command + related;
    })), 'wide'));
  }
  return panels.join('');
}

function renderResourceProvisioningPlan(result) {
  const resources = result.resources || [];
  const actions = result.nextActions || [];
  const panels = [
    panel('资源准备计划', [
      metric('状态', workspaceStatusLabel(result.status)),
      metric('存储', result.environment ? result.environment.storageMode : '未知'),
      metric('来源', result.environment ? workspaceValue(result.environment.sourceKey, '未知') + ' / ' + workspaceValue(result.environment.sourceType, '未知') : '未知'),
      metric('助手', result.environment ? workspaceValue(result.environment.llmProvider, '未知') : '未知')
    ].join('')),
    panel('资源检查', evidenceList(resources.map(function (item) {
      const env = item.env && item.env.length > 0 ? ' · 环境 ' + item.env.join('、') : '';
      const evidence = item.evidenceSummary ? ' · 证据 ' + item.evidenceSummary : '';
      const drift = item.schemaDrift && item.schemaDrift.status !== 'ok' ? ' · 结构差异 ' + schemaDriftSummary(item.schemaDrift) : '';
      return workspaceStatusLabel(item.status) + ' · ' + item.area + ' · ' + item.key + ' · ' + (item.required ? '必需' : '可选') + ' · ' + item.summary + env + evidence + drift;
    })), 'wide')
  ];
  if (actions.length > 0) {
    panels.push(panel('资源建议', evidenceList(actions.map(function (action) {
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' 证据 ' + detail.evidenceSummary : '');
      }).join(' · ');
      return workspaceStatusLabel(action.severity) + ' · ' + action.key + ' · ' + action.summary + ' · ' + (action.commands || []).join(' · ') + (details ? ' · 明细 ' + details : '');
    })), 'wide'));
  }
  return panels.join('');
}

function renderDeploymentGateReport(result) {
  const gates = result.gates || [];
  const actions = result.nextActions || [];
  const panels = [
    panel('应用门禁', [
      metric('状态', workspaceStatusLabel(result.status)),
      metric('检查项', result.gateCount || gates.length),
      metric('下一步', actions.length)
    ].join('')),
    panel('门禁结果', evidenceList(gates.map(function (gate) {
      return workspaceStatusLabel(gate.status) + ' · ' + gate.area + ' · ' + gate.key + ' · ' + gate.summary;
    })), 'wide')
  ];
  const llmSummary = renderDeploymentGateLlmSummary(result);
  if (llmSummary) panels.push(llmSummary);
  if (actions.length > 0) {
    panels.push(panel('门禁建议', evidenceList(actions.map(function (action) {
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' 证据 ' + detail.evidenceSummary : '');
      }).join(' · ');
      return workspaceStatusLabel(action.severity) + ' · ' + action.key + ' · ' + action.summary + ' · ' + (action.commands || []).join(' · ') + (details ? ' · 明细 ' + details : '');
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
  return panel('助手状态', [
    '<div class="summary-strip">',
    summaryTile('配置', workspaceStatusLabel(configStatus), statusVariant(configStatus)),
    summaryTile('预检', workspaceStatusLabel(preflightStatus), statusVariant(preflight.status)),
    summaryTile('评估', workspaceStatusLabel(evaluationStatus), statusVariant(evaluation.status)),
    summaryTile('样本', String(evaluation.sampleCount || 0)),
    summaryTile('提醒', String(summary.warn || 0), (summary.warn || 0) > 0 ? 'warn' : 'ok'),
    '</div>',
    metric('提供方', evaluation.provider || preflight.provider || llmProviderFromItems(llmItems) || '未知'),
    metric('模式', evaluation.status ? '语义评估' : preflight.status ? '预检' : '配置检查'),
    evidenceList(llmItems.map(function (item) {
      const evidence = item.evidence || {};
      const sampleText = evidence.sampleCount ? ' · 样本 ' + evidence.sampleCount : '';
      const traceText = evidence.traceId ? ' 路径 ' + evidence.traceId : '';
      return workspaceStatusLabel(item.status) + ' · ' + item.key + ' · ' + item.summary + sampleText + traceText;
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
    panel('应用执行门禁', [
      metric('结论', workspaceStatusLabel(decision)),
      metric('门禁状态', workspaceStatusLabel(result && result.status)),
      metric('执行方式', '真实应用'),
      metric('检查项', result && (result.gateCount || gates.length) || 0),
      metric('下一步', actions.length),
      metric('记录', decision === 'cleared' || decision === 'awaiting-confirmation' ? '执行后会写入应用记录' : '尚未提交应用任务')
    ].join('')),
    panel('门禁结果', evidenceList(gates.map(function (gate) {
      return workspaceStatusLabel(gate.status) + ' · ' + gate.area + ' · ' + gate.key + ' · ' + gate.summary;
    })), 'wide')
  ];
  if (actions.length > 0) {
    panels.push(panel('执行前建议', evidenceList(actions.map(function (action) {
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' 证据 ' + detail.evidenceSummary : '');
      }).join(' · ');
      return workspaceStatusLabel(action.severity) + ' · ' + action.key + ' · ' + action.summary + ' · ' + (action.commands || []).join(' · ') + (details ? ' · 明细 ' + details : '');
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
    panel('发布准备', [
      '<div class="summary-strip event-summary-strip">' + [
        summaryTile('状态', status, statusVariant(status)),
        summaryTile('检查', String(checks.length)),
        summaryTile('动作', String(nextActionCount), nextActionCount > 0 ? 'warn' : 'ok'),
        summaryTile('来源', workspaceValue(source.sourceType, '未设置'), statusVariant(status))
      ].join('') + '</div>',
      metric('清单', workspaceValue(manifest.name, '未命名')),
      metric('来源', [
        '名称 ' + workspaceValue(source.sourceKey || source.forum, '未命名'),
        '类型 ' + workspaceValue(source.sourceType, '未设置')
      ].join(' · ')),
      metric('模块', workspaceValue(connector.modulePath || source.modulePath, '未提供')),
      renderRolloutReadinessOpsButtons(source)
    ].join(''), 'wide'),
    panel('准备检查', evidenceList(checks.map(function (check) {
      const actionCount = check.result && check.result.nextActions ? check.result.nextActions.length : 0;
      const detail = check.error ? '原因 ' + check.error.message : '建议动作 ' + actionCount;
      return [
        workspaceStatusLabel(check.status),
        check.key ? '检查 ' + check.key : undefined,
        check.title,
        detail
      ].filter(Boolean).join(' · ');
    })), 'wide')
  ];
  const actionRows = renderRolloutReadinessActionRows(checks);
  if (actionRows) {
    panels.push(panel('准备动作', actionRows, 'wide'));
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
    '<button class="inline-button secondary-inline-button" type="button" data-action="run-rollout-apply-dry-run">预演应用</button>' +
    '</div>';
}

function renderSourceTypeDrilldownButton(scope) {
  const safeScope = scope || {};
  if (!safeScope.sourceType) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-type-drilldown"' +
    ' data-source-type="' + escapeHtml(safeScope.sourceType || '') + '"' +
    ' data-source-key="' + escapeHtml(safeScope.sourceKey || '') + '"' +
    ' data-limit="50" data-scan-limit="250">来源类型</button>';
}

function renderRolloutReadinessActionRows(checks) {
  const rows = [];
  (checks || []).forEach(function (check) {
    (check.result && check.result.nextActions || []).forEach(function (action) {
      const commands = action.commands || (action.command ? [action.command] : []);
      const details = [
        check.key ? '检查 ' + check.key : undefined,
        '重要程度 ' + workspaceStatusLabel(action.severity || 'info'),
        action.key ? '动作 ' + action.key : undefined
      ].filter(Boolean).join(' · ');
      rows.push('<div class="action-row ops-row"><span>' +
        '<strong>' + escapeHtml(action.title || check.title || '准备建议') + '</strong>' +
        '<small>' + escapeHtml(details) + '</small>' +
        '<small>' + escapeHtml(action.summary || action.command || '') + '</small>' +
        renderReadinessCommandRows(commands) +
        '</span>' + statusBadge(workspaceStatusLabel(action.severity || 'info'), action.severity === 'critical' ? 'fail' : statusVariant(action.severity)) + '</div>');
    });
  });
  return rows.join('');
}

function renderReadinessCommandRows(commands) {
  if (!commands || commands.length === 0) return '';
  return '<div class="lifecycle-command-list">' + commands.map(function (command) {
    return '<div class="lifecycle-command-row">' +
      '<code>' + escapeHtml(command) + '</code>' +
      '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="copy-lifecycle-command">复制</button>' +
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
    panel('发布清单应用', [
      metric('状态', report.status),
      metric('任务', result.task ? result.task.id : 'none'),
      metric('模式', report.dryRun ? '预演' : '执行'),
      metric('已应用', report.applied ? '是' : '否'),
      metric('来源', report.sourceDraft ? (report.sourceDraft.sourceKey || 'unknown') + ' / ' + (report.sourceDraft.sourceType || 'unknown') : 'missing'),
      renderTaskTraceButton(result.task)
    ].join('')),
    panel('应用步骤', evidenceList(steps.map(function (step) {
      return step.status + ' 路 ' + step.key + ' 路 ' + step.summary;
    })), 'wide')
  ];
  if (report.registration && report.registration.source) {
    panels.push(panel('已登记来源', [
      metric('来源 ID', report.registration.source.id),
      metric('已创建', report.registration.created ? '是' : '否'),
      metric('名称', report.registration.source.displayName),
      renderRolloutApplyOperationButtons(report)
    ].join('')));
  }
  if (report.rollbackPlan) {
    panels.push(panel('回退方案', [
      metric('可用', report.rollbackPlan.available ? '是' : '否'),
      metric('模式', report.rollbackPlan.mode || 'unknown'),
      metric('来源 ID', report.rollbackPlan.sourceId || 'after execute'),
      metric('摘要', report.rollbackPlan.summary || ''),
      renderRolloutRollbackButtons(report),
      evidenceList(report.rollbackPlan.commands || [])
    ].join(''), 'wide'));
  }
  if (actions.length > 0) {
    panels.push(panel('应用动作', evidenceList(actions.map(function (action) {
      const details = (action.details || []).map(function (detail) {
        return detail.key + (detail.evidenceSummary ? ' 证据 ' + detail.evidenceSummary : '');
      }).join(' · ');
      return workspaceStatusLabel(action.severity) + ' · ' + action.key + ' · ' + action.summary + ' · ' + (action.commands || []).join(' · ') + (details ? ' · 明细 ' + details : '');
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
  return '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + safeSourceId + '" data-enabled="false" data-execute="false">回退检查</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + safeSourceId + '" data-enabled="false" data-execute="true">回退停用</button>';
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
    ' data-limit="20">' + escapeHtml(label || '路径') + '</button>';
}

function renderTaskDetailButton(task) {
  const button = renderTaskDetailButtonControl(task);
  return button ? '<div class="button-group source-op-buttons">' + button + '</div>' : '';
}

function renderTaskDetailButtonControl(task, label) {
  if (!task || !task.id) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-task-detail" data-task-id="' +
    escapeHtml(task.id) + '" data-trace-limit="20">' + escapeHtml(label || '详情') + '</button>';
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
  return panel('来源批量运行', [
    metric('来源', result.sourceCount),
    metric('完成', result.completedCount),
    metric('失败', result.failedCount),
    renderBatchTaskControls(result.task),
    renderSourceOperationResultRows(result.results || [])
  ].join(''), 'wide');
}

function renderDueSourceBatchRunResult(result) {
  return panel('到期来源运行', [
    metric('批量任务', result.task && result.task.id || '暂无'),
    metric('任务状态', result.task && result.task.status || '未知'),
    metric('来源', result.sourceCount),
    metric('到期', result.dueCount),
    metric('跳过', result.skippedCount),
    metric('完成', result.completedCount),
    metric('失败', result.failedCount),
    metric('检查时间', result.checkedAt || '未知'),
    metric('完成时间', result.finishedAt || '未知'),
    renderBatchTaskControls(result.task),
    renderDueBatchEvidence(result.evidence),
    renderSourceOperationResultRows(result.results || []),
    renderSourceOperationSkippedRows(result.skipped || [])
  ].join(''), 'wide');
}

function renderDueSourcePipelineBatchRunResult(result) {
  return panel('到期洞察运行', [
    metric('批量任务', result.task && result.task.id || '暂无'),
    metric('任务状态', result.task && result.task.status || '未知'),
    metric('来源', result.sourceCount),
    metric('到期', result.dueCount),
    metric('跳过', result.skippedCount),
    metric('完成', result.completedCount),
    metric('失败', result.failedCount),
    metric('检查时间', result.checkedAt || '未知'),
    metric('完成时间', result.finishedAt || '未知'),
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
    summaryTile('证据包', batch.taskId || '暂无', batch.taskId ? 'ok' : 'muted'),
    summaryTile('可回放', String(summary.replayableCount || 0), (summary.replayableCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('时间线', String(timeline.length), timeline.length > 0 ? 'ok' : 'muted'),
    summaryTile('等待重试', String(summary.backoffSkippedCount || 0), (summary.backoffSkippedCount || 0) > 0 ? 'warn' : 'ok'),
    '</div>',
    timeline.slice(0, 8).map(function (item) {
      const details = [
        item.scheduleReason ? '排期 ' + item.scheduleReason : undefined,
        item.taskId ? '任务 ' + item.taskId : undefined,
        item.changed === undefined ? undefined : '变化 ' + (item.changed ? '有' : '无'),
        item.newPostCount === undefined ? undefined : '新增 ' + item.newPostCount,
        item.semanticStatus ? '语义 ' + item.semanticStatus : undefined,
        item.retryAt ? '重试 ' + item.retryAt : undefined
      ].filter(Boolean).join(' · ');
      return '<div class="action-row"><span><strong>' + escapeHtml(item.kind || '证据') + '</strong><small>' + escapeHtml([item.sourceId, item.sourceKey].filter(Boolean).join(' · ') || '全部来源') + '</small><small>' + escapeHtml(details) + '</small></span>' + statusBadge(item.status || 'unknown', statusVariant(item.status)) + '</div>';
    }).join('')
  ].join('');
}

function renderLlmReadinessProfile(profile) {
  const readiness = profile.readiness || {};
  const configuration = profile.configuration || {};
  return [
    panel('助手状态概况', [
      '<div class="summary-strip">',
      summaryTile('状态', workspaceStatusLabel(workspaceValue(profile.status, 'unknown')), statusVariant(profile.status)),
      summaryTile('模式', llmModeLabel(profile.mode)),
      summaryTile('提供方', workspaceValue(profile.provider, '未配置'), readiness.mockMode ? 'warn' : 'ok'),
      summaryTile('真实服务', readiness.realProviderCandidate ? '已连接' : '使用模拟', readiness.realProviderCandidate ? 'ok' : 'warn'),
      summaryTile('预检', readiness.preflightPassed ? '通过' : '未运行', readiness.preflightPassed ? 'ok' : 'muted'),
      summaryTile('评估', readiness.evaluationPassed ? '通过' : '未运行', readiness.evaluationPassed ? 'ok' : 'muted'),
      '</div>',
      metric('密钥', configuration.apiKeyConfigured ? '已配置' : '未配置'),
      metric('模型', configuration.modelConfigured ? '已配置' : '未配置'),
      metric('服务地址', configuration.baseUrlConfigured ? '已配置' : '默认地址'),
      metric('超时', configuration.timeoutMs ? configuration.timeoutMs + ' ms' : '默认')
    ].join(''), 'wide'),
    panel('助手状态检查', evidenceList((profile.checks || []).map(function (check) {
      return llmCheckSummary(check);
    })), 'wide'),
    panel('助手状态建议', renderNextActionRows(profile.nextActions || []), 'wide automation-action-command-panel')
  ].join('');
}

function renderLlmPreflightReport(report) {
  const validation = report.validation || {};
  const usage = report.usage || {};
  const preview = report.outputPreview || {};
  return [
    panel('助手预检', [
      '<div class="summary-strip">',
      summaryTile('状态', workspaceStatusLabel(workspaceValue(report.status, 'unknown')), statusVariant(report.status)),
      summaryTile('提供方', workspaceValue(report.provider, '未配置'), report.provider === 'mock' ? 'muted' : 'ok'),
      summaryTile('验证', workspaceStatusLabel(workspaceValue(validation.status, 'not-run')), statusVariant(validation.status)),
      summaryTile('协议', workspaceValue(report.schemaVersion, '未注明'), validation.status === 'ok' ? 'ok' : 'muted'),
      '</div>',
      metric('路径编号', workspaceValue(report.traceId, '暂无')),
      metric('任务', workspaceValue(report.task, '未指定')),
      metric('用量', formatLlmUsage(usage)),
      metric('输出', workspaceValue(preview.summary, '暂无输出')),
      report.error ? metric('错误', workspaceValue(report.error.message, '未知错误')) : ''
    ].join(''), 'wide'),
    panel('助手预检检查', evidenceList((report.checks || []).map(function (check) {
      return llmCheckSummary(check);
    })), 'wide'),
    panel('助手预检建议', renderNextActionRows(report.nextActions || []), 'wide automation-action-command-panel')
  ].join('');
}

function renderLlmEvaluationReport(report) {
  const summary = report.summary || {};
  return [
    panel('助手质量评估', [
      '<div class="summary-strip">',
      summaryTile('状态', workspaceStatusLabel(workspaceValue(report.status, 'unknown')), statusVariant(report.status)),
      summaryTile('提供方', workspaceValue(report.provider, '未配置'), report.provider === 'mock' ? 'muted' : 'ok'),
      summaryTile('样本', String(report.sampleCount || 0)),
      summaryTile('提醒', String(summary.warn || 0), (summary.warn || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('失败', String(summary.fail || 0), (summary.fail || 0) > 0 ? 'fail' : 'ok'),
      '</div>',
      metric('路径编号', workspaceValue(report.traceId, '暂无')),
      metric('任务', workspaceValue(report.task, '未指定')),
      metric('协议', workspaceValue(report.schemaVersion, '未注明'))
    ].join(''), 'wide'),
    panel('助手评估样本', evidenceList((report.results || []).map(formatLlmEvaluationSampleRow)), 'wide'),
    panel('助手评估建议', renderNextActionRows(report.nextActions || []), 'wide automation-action-command-panel')
  ].join('');
}

function llmModeLabel(mode) {
  const labels = {
    configuration: '配置检查',
    preflight: '预检',
    evaluation: '质量评估',
    mock: '模拟服务'
  };
  return labels[mode] || workspaceValue(mode, '配置检查');
}

function llmCheckSummary(check) {
  const safeCheck = check || {};
  return [
    safeCheck.summary || safeCheck.title || safeCheck.key || '检查项',
    workspaceStatusLabel(safeCheck.status || 'unknown'),
    safeCheck.area ? '范围 ' + safeCheck.area : undefined,
    safeCheck.key ? '检查项 ' + safeCheck.key : undefined
  ].filter(Boolean).join(' · ');
}

function formatLlmEvaluationSampleRow(result) {
  const preview = result.outputPreview || {};
  const warnings = (result.qualityChecks || []).filter(function (check) {
    return check.status !== 'ok';
  }).map(function (check) {
    return sourceDiagnosticCheckSummary(check);
  }).join(', ');
  const validation = result.validation ? workspaceStatusLabel(result.validation.status || 'unknown') : workspaceStatusLabel('not-run');
  return [
    workspaceStatusLabel(workspaceValue(result.status, 'unknown')),
    workspaceValue(result.title || result.id, '评估样本'),
    '校验 ' + validation,
    '证据 ' + (preview.evidenceRefCount || 0),
    '实体 ' + (preview.entityInsightCount || 0),
    '观点 ' + (preview.opinionInsightCount || 0),
    formatLlmUsage(result.usage || {}),
    warnings ? '需要关注 ' + warnings : undefined,
    result.error && result.error.message ? '错误 ' + result.error.message : undefined
  ].filter(Boolean).join(' · ');
}

function renderSourceDemoCycleReport(report) {
  const summary = report.summary || {};
  const pipeline = report.pipeline || {};
  const acknowledgement = report.acknowledgement || {};
  return [
    panel('试跑闭环', [
      '<div class="summary-strip">',
      summaryTile('状态', workspaceStatusLabel(workspaceValue(report.status, 'unknown')), statusVariant(report.status)),
      summaryTile('到期', summary.dueCount || 0, summary.dueCount > 0 ? 'ok' : 'muted'),
      summaryTile('完成', summary.completedCount || 0, summary.failedCount > 0 ? 'warn' : 'ok'),
      summaryTile('提醒', summary.sourceChangedEventCount || 0, summary.sourceChangedEventCount > 0 ? 'ok' : 'muted'),
      '</div>',
      metric('任务', report.task && report.task.id || '暂无'),
      metric('路径编号', workspaceValue(report.traceId, '暂无')),
      metric('主要来源', formatSourceScope(report.primarySource)),
      metric('打开提醒', summary.openEventCount === undefined ? '未记录' : summary.openEventCount),
      metric('确认', workspaceStatusLabel(workspaceValue(acknowledgement.status, 'not-run'))),
      renderBatchTaskControls(pipeline.task)
    ].join(''), 'wide'),
    panel('试跑处理路径', [
      metric('批量任务', pipeline.task && pipeline.task.id || 'none'),
      metric('来源', pipeline.sourceCount || 0),
      metric('跳过', pipeline.skippedCount || 0),
      metric('失败', pipeline.failedCount || 0),
      renderSourceOperationResultRows(pipeline.results || []),
      renderSourceOperationSkippedRows(pipeline.skipped || [])
    ].join(''), 'wide'),
    panel('来源变化提醒', renderDemoCycleEvents(report.sourceChangedEvents || []), 'wide'),
    acknowledgement.status ? panel('确认结果', renderDemoCycleAcknowledgement(acknowledgement), 'wide') : '',
    report.closure ? panel('试跑闭环收口', renderDemoCycleClosure(report.closure), 'wide') : '',
    report.drilldown ? panel('试跑明细', [
      metric('状态', report.drilldown.status || 'unknown'),
      metric('最新提醒', report.drilldown.health && report.drilldown.health.events && report.drilldown.health.events.latest ? report.drilldown.health.events.latest.id : 'none'),
      metric('最新任务', report.drilldown.health && report.drilldown.health.tasks && report.drilldown.health.tasks.latest ? report.drilldown.health.tasks.latest.id : 'none'),
      renderSourceDrilldownButtonForScope(report.primarySource || {})
    ].join(''), 'wide') : '',
    panel('试跑建议', renderNextActionRows(report.nextActions || []), 'wide automation-action-command-panel')
  ].join('');
}

function renderNextActionRows(actions) {
  if (!actions || actions.length === 0) return '<div class="muted">暂无后续动作。</div>';
  return '<div class="automation-action-command-list">' + actions.map(function (action) {
    const commands = action.commands || (action.command ? [action.command] : []);
    const details = (action.details || []).map(function (detail) {
      return detail.key + (detail.evidenceSummary ? ' · 证据 ' + detail.evidenceSummary : '');
    }).join(' · ');
    const actionDetails = [
      '重要程度 ' + workspaceStatusLabel(action.severity || 'info'),
      action.key ? '动作 ' + action.key : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row automation-action-command-row">' +
      '<span>' +
      '<strong>' + escapeHtml(action.title || action.summary || '后续建议') + '</strong>' +
      '<small>' + escapeHtml(actionDetails) + '</small>' +
      '<small>' + escapeHtml(action.summary || action.command || '') + '</small>' +
      (action.evidenceSummary ? '<small>' + escapeHtml('证据 ' + action.evidenceSummary) + '</small>' : '') +
      (details ? '<small>' + escapeHtml('详情 ' + details) + '</small>' : '') +
      renderReadinessCommandRows(commands) +
      '</span>' +
      statusBadge(workspaceStatusLabel(action.severity || 'info'), action.severity === 'critical' ? 'fail' : statusVariant(action.severity)) +
      '</div>';
  }).join('') + '</div>';
}

function renderDemoCycleClosure(closure) {
  const summary = closure.summary || {};
  const steps = closure.steps || [];
  return [
    '<div class="summary-strip">',
    summaryTile('状态', closure.status || '未知', statusVariant(closure.status)),
    summaryTile('就绪', closure.readyForDailyUse ? '是' : '否', closure.readyForDailyUse ? 'ok' : 'warn'),
    summaryTile('评分', String(summary.readinessScore || 0)),
    summaryTile('完成', String(summary.completed || 0) + '/' + String(summary.total || 0), summary.completed === summary.total ? 'ok' : 'warn'),
    summaryTile('缺口', String((summary.missingStepKeys || []).length), (summary.missingStepKeys || []).length > 0 ? 'warn' : 'ok'),
    '</div>',
    metric('下一步', closure.recommendedNextAction || '暂无'),
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
    '<strong>' + escapeHtml(step.title || step.key || '收口步骤') + '</strong>' +
    '<small>' + escapeHtml(step.summary || '') + '</small>' +
    (evidenceText ? '<small>' + escapeHtml(evidenceText) + '</small>' : '') +
    (step.nextAction ? '<small>' + escapeHtml('下一步 ' + step.nextAction) + '</small>' : '') +
    '</span>' +
    statusBadge(workspaceStatusLabel(step.status || 'unknown'), statusVariant(step.status)) +
    '</div>';
}

function renderDemoCycleEvents(events) {
  if (!events.length) return '<div class="muted">这次试跑没有生成来源变化提醒。</div>';
  return '<div class="source-operation-result-list">' + events.map(function (event) {
    const details = [
      event.id ? '提醒 ' + event.id : undefined,
      '投递 ' + workspaceStatusLabel(event.deliveryStatus || 'pending'),
      event.acknowledgedAt ? '确认 ' + event.acknowledgedAt : '未确认'
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(event.title || event.id || '来源变化提醒') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(event.summary || '') + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderEventDetailButtonControl(event) +
      (event.acknowledgedAt ? '' : '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id || '') + '">确认提醒</button>') +
      renderEventTaskDetailButton(event) +
      '</span></div>';
  }).join('') + '</div>';
}

function renderDemoCycleAcknowledgement(result) {
  return [
    '<div class="summary-strip">',
    summaryTile('状态', workspaceStatusLabel(workspaceValue(result.status, 'unknown')), statusVariant(result.status)),
    summaryTile('候选', result.candidateCount || 0, result.candidateCount > 0 ? 'warn' : 'muted'),
    summaryTile('已确认', result.acknowledgedCount || 0, result.acknowledgedCount > 0 ? 'ok' : 'muted'),
    summaryTile('跳过', result.skippedCount || 0, result.skippedCount > 0 ? 'warn' : 'muted'),
    '</div>',
    evidenceList((result.results || []).map(function (item) {
      return workspaceStatusLabel(workspaceValue(item.status, 'unknown')) + ' · ' + (item.eventId || '') + (item.reason ? ' · 原因 ' + item.reason : '');
    }))
  ].join('');
}

function formatSourceScope(scope) {
  const safeScope = scope || {};
  return [safeScope.sourceId, safeScope.sourceKey].filter(Boolean).join(' · ') || '全部来源';
}

function formatLlmUsage(usage) {
  const parts = [];
  if (usage.inputTokens !== undefined) parts.push('输入 ' + usage.inputTokens);
  if (usage.outputTokens !== undefined) parts.push('输出 ' + usage.outputTokens);
  if (usage.prompt_tokens !== undefined) parts.push('提示词 ' + usage.prompt_tokens);
  if (usage.completion_tokens !== undefined) parts.push('生成 ' + usage.completion_tokens);
  if (usage.total_tokens !== undefined) parts.push('总量 ' + usage.total_tokens);
  return parts.length ? parts.join(' · ') : '暂无用量';
}

function renderBatchTaskControls(task) {
  if (!task) return '';
  return '<div class="button-group source-op-buttons batch-task-controls">' +
    renderTaskDetailButtonControl(task, '批量任务') +
    renderTaskTraceButtonControl(task, '批量路径') +
    '</div>';
}

function renderSourceOperationResultRows(results) {
  if (!results || results.length === 0) return '<div class="muted">暂无来源运行结果。</div>';
  return '<div class="source-operation-result-list">' + results.map(function (item) {
    const source = item.source || {};
    const task = item.task || {};
    const ingestTask = item.ingestTask || {};
    const error = item.error || {};
    const cursorDiff = item.cursorDiff || {};
    const semantic = item.semantic || {};
    const details = [
      source.id || source.sourceKey || '未知来源',
      item.scheduleReason ? '原因 ' + item.scheduleReason : undefined,
      task.id ? '任务 ' + task.id : undefined,
      ingestTask.id ? '导入任务 ' + ingestTask.id : undefined,
      cursorDiff.changed === undefined ? undefined : '变化 ' + (cursorDiff.changed ? '有' : '无'),
      cursorDiff.newPostCount === undefined ? undefined : '新增原始页 ' + cursorDiff.newPostCount,
      semantic.status ? '语义 ' + semantic.status + (semantic.reason ? ' · 原因 ' + semantic.reason : '') : undefined,
      error.message ? '错误 ' + error.message : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml(source.displayName || source.id || '未知来源') + '</strong>' +
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
    renderTaskDetailButtonControl(task, '任务详情'),
    renderTaskTraceButtonControl(task, '任务路径'),
    ingestTask.id && ingestTask.id !== task.id ? renderTaskDetailButtonControl(ingestTask, '导入任务') : '',
    ingestTask.id && ingestTask.id !== task.id ? renderTaskTraceButtonControl(ingestTask, '导入路径') : ''
  ].join('');
}

function renderSourceOperationSkippedRows(skipped) {
  if (!skipped || skipped.length === 0) return '';
  return '<div class="source-operation-result-list skipped-source-list">' + skipped.slice(0, 12).map(function (item) {
    const source = item.source || {};
    const details = [
      source.id || source.sourceKey || '未知来源',
      '原因 ' + (item.reason || '未知'),
      item.nextRunAt ? '下次 ' + item.nextRunAt : undefined,
      item.retryAt ? '重试 ' + item.retryAt : undefined,
      item.backoffMs ? '等待 ' + formatDurationMs(item.backoffMs) : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml(source.displayName || source.id || '已跳过来源') + '</strong>' +
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
      return [taskWorkspaceTitle(task), output.title || task.id].filter(Boolean).join(' · ');
    })), 'wide')
  ].join('');
}

function renderTaskList(result) {
  const tasks = result.tasks || [];
  const pipelineRuns = result.pipelineRuns || [];
  return [
    panel('最近洞察流水线', evidenceList(pipelineRuns.map(renderPipelineRunSummary)), 'wide'),
    panel('最近任务', renderTaskRows(tasks), 'wide')
  ].join('');
}

function renderTaskRows(tasks) {
  if (!tasks || tasks.length === 0) return '<div class="muted">暂无任务。</div>';
  return '<div class="source-operation-result-list">' + tasks.map(function (task) {
    const output = task.output || {};
    const trace = taskTraceMetadata(task);
    const details = [
      task.id,
      output.title,
      task.updatedAt || task.createdAt,
      trace.requestId ? '请求 ' + trace.requestId : undefined,
      trace.traceId ? '路径 ' + trace.traceId : undefined,
      trace.idempotencyKey ? '去重 ' + trace.idempotencyKey : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml(taskWorkspaceTitle(task)) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span><span class="button-group source-op-buttons">' +
      renderTaskDetailButtonControl(task) +
      renderTaskTraceButtonControl(task) +
      '</span></div>';
  }).join('') + '</div>';
}

function taskWorkspaceTitle(task) {
  const safeTask = task || {};
  return [
    workspaceStatusLabel(workspaceValue(safeTask.status, 'unknown')),
    '类型 ' + taskTypeLabel(safeTask.type)
  ].join(' · ');
}

function taskTypeLabel(type) {
  const labels = {
    task: '任务',
    ingest: '采集',
    analyze: '分析',
    semantic: '语义分析',
    notification: '提醒',
    review: '复核'
  };
  return labels[type] || workspaceValue(type, '任务');
}

function renderTaskDetail(result) {
  const task = result.task || {};
  const sourceScope = result.sourceScope || {};
  const traceContext = result.traceContext || {};
  return [
    panel('任务详情', [
      '<div class="summary-strip">' + [
        summaryTile('状态', workspaceStatusLabel(workspaceValue(task.status, 'unknown')), statusVariant(task.status)),
        summaryTile('类型', taskTypeLabel(task.type)),
        summaryTile('关联任务', String(traceContext.taskCount || 0)),
        summaryTile('来源', sourceScope.sourceId || sourceScope.sourceKey || '暂无', sourceScope.sourceId || sourceScope.sourceKey ? 'ok' : 'muted')
      ].join('') + '</div>',
      metric('任务 ID', task.id || '暂无'),
      metric('创建时间', task.createdAt || '未知'),
      metric('更新时间', task.updatedAt || '未知'),
      metric('完成时间', task.finishedAt || '未完成'),
      metric('来源范围', formatTaskSourceScope(sourceScope)),
      metric('请求', traceContext.query && traceContext.query.requestId || '暂无'),
      metric('路径 ID', traceContext.query && traceContext.query.traceId || '暂无'),
      metric('去重键', traceContext.query && traceContext.query.idempotencyKey || '暂无'),
      renderTaskDetailButtons(result)
    ].join(''), 'wide'),
    panel('建议动作', renderTaskDetailActions(result.nextActions || []), 'wide'),
    panel('任务证据包', '<pre>' + escapeHtml(JSON.stringify({
      input: task.input,
      output: task.output,
      error: task.error
    }, null, 2)) + '</pre>', 'wide'),
    panel('关联任务', renderTraceContextTaskRows(traceContext.tasks || []), 'wide')
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
  if (!actions.length) return '<div class="muted">暂无建议动作。</div>';
  return actions.map(function (action) {
    const details = [
      '重要程度 ' + workspaceStatusLabel(action.severity || 'info'),
      action.key ? '动作 ' + action.key : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.title || action.summary || '任务建议') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(action.summary || '查看任务建议，并保留命令作为证据。') + '</small>' +
      (action.command ? '<small>' + escapeHtml(action.command) + '</small>' : '') +
      '</span>' +
      statusBadge(workspaceStatusLabel(action.severity || 'info'), action.severity === 'warning' ? 'warn' : statusVariant(action.severity)) +
      '</div>';
  }).join('');
}

function formatTaskSourceScope(sourceScope) {
  const scope = sourceScope || {};
  return [
    scope.sourceKey ? '来源 ' + scope.sourceKey : undefined,
    scope.sourceId ? '来源 ID ' + scope.sourceId : undefined,
    scope.sourceType ? '类型 ' + scope.sourceType : undefined,
    scope.sourceThreadId ? '主题 ' + scope.sourceThreadId : undefined
  ].filter(Boolean).join(' · ') || '全部来源';
}

function renderTaskTraceContext(result) {
  const summary = result.summary || {};
  const latest = summary.latestTask || {};
  const idempotency = summary.idempotency || {};
  const panels = [
    panel('任务路径上下文', [
      '<div class="summary-strip">' + [
        summaryTile('任务', String(result.taskCount || 0)),
        summaryTile('最新', latest.status || '暂无', statusVariant(latest.status)),
        summaryTile('重复风险', idempotency.duplicateExecutionRisk ? '有' : '无', idempotency.duplicateExecutionRisk ? 'fail' : 'ok'),
        summaryTile('可复用', idempotency.reusableTaskId || '暂无', idempotency.reusableTaskId ? 'ok' : 'muted')
      ].join('') + '</div>',
      metric('请求', result.query && result.query.requestId || '暂无'),
      metric('任务', result.query && result.query.taskId || '暂无'),
      metric('路径', result.query && result.query.traceId || '暂无'),
      metric('去重键', result.query && result.query.idempotencyKey || '暂无'),
      metric('状态分布', compactCountMap(summary.byStatus || {})),
      metric('类型分布', compactCountMap(summary.byType || {}))
    ].join(''), 'wide'),
    panel('关联任务', renderTraceContextTaskRows(result.tasks || []), 'wide')
  ];
  if (idempotency.idempotencyKey) {
    panels.push(panel('去重线索', [
      metric('键', idempotency.idempotencyKey),
      metric('任务数', idempotency.taskCount || 0),
      metric('已完成', idempotency.completedCount || 0),
      metric('可复用任务', idempotency.reusableTaskId || '暂无'),
      evidenceList(idempotency.taskIds || [])
    ].join(''), 'wide'));
  }
  return panels.join('');
}

function renderTraceContextTaskRows(tasks) {
  if (!tasks || tasks.length === 0) return '<div class="muted">暂无关联任务。</div>';
  return '<div class="source-operation-result-list">' + tasks.map(function (task) {
    const trace = task.trace || taskTraceMetadata(task);
    const details = [
      task.id,
      task.createdAt ? '创建 ' + task.createdAt : undefined,
      task.updatedAt ? '更新 ' + task.updatedAt : undefined,
      trace.requestId ? '请求 ' + trace.requestId : undefined,
      trace.traceId ? '路径 ' + trace.traceId : undefined,
      trace.idempotencyKey ? '去重 ' + trace.idempotencyKey : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row source-operation-result-row"><span>' +
      '<strong>' + escapeHtml(taskWorkspaceTitle(task)) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' + statusBadge(workspaceStatusLabel(workspaceValue(task.status, 'unknown')), statusVariant(task.status)) + '</div>';
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
  return panel('自动运行准备度', [
    '<div class="summary-strip">',
    summaryTile('状态', workspaceStatusLabel(readiness && readiness.status), statusVariant(readiness && readiness.status)),
    summaryTile('失败', String(failing.length), failing.length > 0 ? 'fail' : 'ok'),
    summaryTile('提醒', String(warning.length), warning.length > 0 ? 'warn' : 'ok'),
    summaryTile('正常', String(okCount), 'ok'),
    '</div>',
    attention.length === 0
      ? '<div class="muted">当前没有需要关注的准备度检查。</div>'
      : attention.map(renderReadinessCheckRow).join('')
  ].join(''), 'wide');
}

function renderReadinessCheckRow(check) {
  const value = check.value || {};
  const details = [
    check.summary,
    value.sourceKey ? '来源代号 ' + value.sourceKey : undefined,
    value.sourceId ? '来源 ID ' + value.sourceId : undefined,
    value.count === undefined ? undefined : '数量 ' + value.count,
    value.failed === undefined ? undefined : '失败 ' + value.failed,
    value.staleRunning === undefined ? undefined : '停滞 ' + value.staleRunning,
    value.bySourceKey ? '来源分布 ' + formatStanceSummary(value.bySourceKey) : undefined
  ].filter(Boolean).join(' · ');
  return '<div class="action-row ops-row"><span>' +
    '<strong>' + escapeHtml(check.summary || check.key || '准备度检查') + '</strong>' +
    '<small>' + escapeHtml(details) + '</small>' +
    '</span>' +
    statusBadge(workspaceStatusLabel(check.status), statusVariant(check.status)) +
    '</div>';
}

function renderWorkerLeaseOverview(leases) {
  const safeLeases = leases || {};
  const sampleLeases = uniqueLeases((safeLeases.sourceScopedLeases || []).concat(safeLeases.expiredLeases || []));
  return panel('执行占用', [
    '<div class="summary-strip">',
    summaryTile('活跃', String(safeLeases.active || 0), (safeLeases.active || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('过期', String(safeLeases.expired || 0), (safeLeases.expired || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('按来源', String(safeLeases.sourceScoped || 0), (safeLeases.sourceScoped || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('全局', String(safeLeases.unscoped || 0), (safeLeases.unscoped || 0) > 0 ? 'muted' : 'ok'),
    '</div>',
    metric('执行类型', compactCountMap(safeLeases.byWorkerType)),
    metric('活跃来源 ID', compactCountMap(safeLeases.activeBySourceId)),
    metric('过期来源 ID', compactCountMap(safeLeases.expiredBySourceId)),
    metric('活跃来源代号', compactCountMap(safeLeases.activeBySourceKey)),
    metric('过期来源代号', compactCountMap(safeLeases.expiredBySourceKey)),
    evidenceList(sampleLeases.slice(0, 8).map(formatWorkerLeaseRow))
  ].join(''), 'wide');
}

function renderWorkerRunOverview(workers) {
  const safeWorkers = workers || {};
  const sampleRuns = uniqueWorkerRuns((safeWorkers.staleRuns || []).concat(safeWorkers.latestRun ? [safeWorkers.latestRun] : []));
  return panel('执行记录', [
    '<div class="summary-strip">',
    summaryTile('运行中', String(safeWorkers.running || 0), (safeWorkers.running || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('停滞', String(safeWorkers.stale || 0), (safeWorkers.stale || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('按来源', String(safeWorkers.sourceScoped || 0), (safeWorkers.sourceScoped || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('全局', String(safeWorkers.unscoped || 0), (safeWorkers.unscoped || 0) > 0 ? 'muted' : 'ok'),
    '</div>',
    metric('执行类型', compactCountMap(safeWorkers.byWorkerType)),
    metric('来源 ID', compactCountMap(safeWorkers.bySourceId)),
    metric('来源代号', compactCountMap(safeWorkers.bySourceKey)),
    metric('运行中来源 ID', compactCountMap(safeWorkers.runningBySourceId)),
    metric('停滞来源 ID', compactCountMap(safeWorkers.staleBySourceId)),
    metric('停滞来源代号', compactCountMap(safeWorkers.staleBySourceKey)),
    evidenceList(sampleRuns.slice(0, 8).map(formatWorkerRunRow))
  ].join(''), 'wide');
}

function workerLeaseStatusSummary(leases) {
  const safeLeases = leases || {};
  return [
    '活跃 ' + (safeLeases.active || 0),
    '过期 ' + (safeLeases.expired || 0),
    '按来源 ' + (safeLeases.sourceScoped || 0),
    '全局 ' + (safeLeases.unscoped || 0)
  ].join(' · ');
}

function workerRunStatusSummary(workers) {
  const safeWorkers = workers || {};
  return [
    '运行中 ' + (safeWorkers.running || 0),
    '停滞 ' + (safeWorkers.stale || 0),
    '按来源 ' + (safeWorkers.sourceScoped || 0),
    '失败 ' + (safeWorkers.failed || 0)
  ].join(' · ');
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
    ? '来源 ID ' + scope.sourceId
    : (scope.sourceKey ? '来源代号 ' + scope.sourceKey : '全局');
  return [
    workspaceStatusLabel(run.status),
    '执行器 ' + (run.workerType || '未知执行器'),
    scopeLabel,
    '持有者 ' + (run.workerId || '未知'),
    '心跳 ' + (run.heartbeatAt || run.updatedAt || '暂无'),
    '记录 ' + (run.id || '未知')
  ].join(' · ');
}

function formatWorkerLeaseRow(lease) {
  const scope = lease.scope || {};
  const scopeLabel = scope.sourceId
    ? '来源 ID ' + scope.sourceId
    : (scope.sourceKey ? '来源代号 ' + scope.sourceKey : '全局');
  return [
    lease.expired ? '已过期' : '活跃',
    '执行器 ' + (lease.workerType || '未知执行器'),
    scopeLabel,
    '持有者 ' + (lease.ownerId || '未知'),
    '占用 ' + (lease.leaseKey || '未知'),
    '到期 ' + (lease.expiresAt || '暂无')
  ].join(' · ');
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
    panel('待处理路径', renderAutomationAttentionQueue(cockpit.attentionQueue), 'wide automation-attention-panel'),
    panel('快照新鲜度', renderAutomationFreshness(cockpit.freshness), 'wide automation-freshness-panel'),
    panel('提醒与审计压力', renderAutomationOperatingPressure(cockpit), 'wide automation-pressure-panel'),
    panel('自动运行门禁', renderAutomationReadinessChecks(plan.checks || []), 'wide automation-gates-panel'),
    panel('操作清单', renderAutomationOperatorRunbook(cockpit.operatorRunbook), 'wide automation-runbook-panel'),
    panel('修复建议', renderAutomationRemediation(plan.remediation), 'wide automation-remediation-panel'),
    panel('执行命令', renderAutomationWorkerCommands(plan.automation && plan.automation.workerCommands || []), 'wide automation-worker-panel'),
    panel('下一步', renderAutomationNextActions(plan.nextActions || []), 'wide automation-next-panel')
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
  const freshnessSpan = freshness.spanMs === undefined ? '暂无' : formatDurationMs(freshness.spanMs);
  const representative = summary.representativeSource || {};
  const generatedAt = cockpit && cockpit.generatedAt || plan.generatedAt;
  const sourceTaskMode = workers.sourceTaskMode || plan.automation && plan.automation.sourceTaskMode;
  const representativeSource = representative.source && (representative.source.displayName || representative.source.id || representative.source.sourceKey) || '暂无';
  const replayStatus = representative.replay && representative.replay.available ? '可用' : '缺失';
  const readyVariant = plan.readyForUnattendedRun ? 'ok' : statusVariant(plan.status);
  return [
    '<article class="automation-cockpit-hero ' + statusClassName(readyVariant) + '">',
    '<section class="automation-cockpit-main">',
    '<div class="automation-cockpit-header">',
    '<span class="automation-cockpit-label">自动运行概览</span>',
    statusBadge(workspaceStatusLabel(plan.status), readyVariant),
    statusBadge(plan.readyForUnattendedRun ? '可自动运行' : '需要复核', plan.readyForUnattendedRun ? 'ok' : 'warn'),
    '</div>',
    '<h3>' + escapeHtml(automationReadinessHeadlineReadable(plan, sources, operations, workers, llm, demo)) + '</h3>',
    '<p>' + escapeHtml([
      '快照 ' + workspaceValue(generatedAt, '未知'),
      '来源模式 ' + workspaceValue(sourceTaskMode, '未知'),
      '拓扑 ' + workspaceValue(workers.topology, '未知'),
      '助手 ' + workspaceValue(llm.provider, '未知') + (llm.mockMode ? ' · 模拟' : '')
    ].join(' · ')) + '</p>',
    '<div class="automation-cockpit-actions button-group">' +
      automationCockpitButton('refresh-automation-readiness', '刷新', 'secondary-inline-button') +
      automationCockpitAutoRefreshToggle() +
      automationCockpitButton('run-llm-readiness', '助手状态', 'secondary-inline-button') +
      automationCockpitButton('run-llm-preflight', '助手预检', 'secondary-inline-button') +
      automationCockpitButton('run-llm-evaluation', '质量评估', 'secondary-inline-button') +
      automationCockpitButton('run-demo-cycle', '试跑闭环', '') +
    '</div>',
    '</section>',
    '<aside class="automation-cockpit-signals">',
    automationCockpitSignal('就绪', plan.readyForUnattendedRun ? '是' : '否', plan.readyForUnattendedRun ? 'ok' : 'warn'),
    automationCockpitSignal('来源', sources.total || 0, (sources.total || 0) > 0 ? 'ok' : 'fail'),
    automationCockpitSignal('今日到期', sources.due || 0, (sources.due || 0) > 0 ? 'warn' : 'ok'),
    automationCockpitSignal('队列', operations.queueTotal || 0, statusVariant(operations.cockpitStatus)),
    automationCockpitSignal('可运行', operations.runnable || 0, (operations.runnable || 0) > 0 ? 'ok' : 'muted'),
    automationCockpitSignal('助手', workspaceValue(llm.provider, '未知'), statusVariant(llm.status)),
    automationCockpitSignal('新鲜度', (freshness.presentSourceCount || 0) + '/' + (freshness.sourceCount || 0), statusVariant(freshness.status)),
    automationCockpitSignal('跨度', freshnessSpan, freshness.spanMs > 60000 ? 'warn' : statusVariant(freshness.status || 'ok')),
    '</aside>',
    '<section class="automation-cockpit-runpath">',
    '<span>运行路径</span>',
    renderAutomationRunPath(summary, plan, cockpit || {}),
    '</section>',
    '<section class="automation-cockpit-foot">',
    '<span>证据回路</span>',
    '<strong>' + escapeHtml([
      '代表来源 ' + representativeSource,
      '健康 ' + workspaceStatusLabel(representative.status || 'not-evaluated'),
      '回放 ' + replayStatus,
      '提醒箱 ' + workspaceStatusLabel(pressure.outboxStatus)
    ].join(' · ')) + '</strong>',
    '<small>' + escapeHtml([
      '跳过 ' + (sources.skipped || 0),
      '优先级 ' + (operations.highestPriorityScore || 0),
      '试跑 ' + workspaceStatusLabel(demo.closureStatus || demo.status || 'not-run'),
      '审计 ' + pressure.auditCount,
      '执行 ' + pressure.executionCount
    ].join(' · ')) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function automationReadinessHeadlineReadable(plan, sources, operations, workers, llm, demo) {
  if (plan.readyForUnattendedRun) return '每日自动运行已经准备好。';
  if ((sources.total || 0) === 0) return '先接入一个可信来源，自动运行才有内容可处理。';
  if ((operations.queueTotal || 0) > 0 && (operations.runnable || 0) > 0) return '已有可运行事项排队，下一步适合做一次受控试跑。';
  if (llm.mockMode || llm.provider === 'mock') return '语义分析仍在助手提供方的准备路径上。';
  if (!workers.topology || workers.status !== 'ok') return '先确认执行拓扑，再依赖长时间自动运行。';
  if (!demo.readyForDailyUse) return '完成一次试跑闭环后，再把它当成日常流程使用。';
  return '自动运行底座已经在位，继续收口剩余的运行缺口。';
}

function automationCockpitButton(action, label, className) {
  return '<button class="inline-button ' + escapeHtml(className || '') + '" type="button" data-action="' + escapeHtml(action) + '">' + escapeHtml(label) + '</button>';
}

function automationCockpitAutoRefreshToggle() {
  const enabled = Boolean(state.automationAutoRefresh);
  const stateLabel = enabled ? '开' : '关';
  const statusLabel = automationAutoRefreshStatusLabel();
  return [
    '<button class="automation-auto-refresh-toggle' + (enabled ? ' is-active' : '') + (state.automationReadinessInFlight ? ' is-refreshing' : '') + '" type="button" data-action="toggle-automation-auto-refresh" data-enabled="' + (enabled ? 'true' : 'false') + '" aria-pressed="' + (enabled ? 'true' : 'false') + '" aria-label="' + escapeHtml('自动刷新' + stateLabel + '，每 60 秒更新。' + statusLabel) + '" title="' + escapeHtml('自动刷新' + stateLabel + '，每 60 秒更新。' + statusLabel) + '">',
    '<span>自动刷新</span>',
    ' ',
    '<strong>' + stateLabel + '</strong>',
    ' ',
    '<small>' + escapeHtml(statusLabel) + '</small>',
    '</button>'
  ].join('');
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
      title: '来源排期',
      detail: '已登记 ' + (sources.total || 0) + ' · 到期 ' + (sources.due || 0) + ' · 暂缓 ' + (sources.skipped || 0),
      status: (sources.total || 0) > 0 ? ((sources.due || 0) > 0 ? 'warn' : 'ok') : 'fail'
    },
    {
      title: '执行拓扑',
      detail: workspaceValue(workers.topology, '未知拓扑') + ' · 来源模式 ' + workspaceValue(workers.sourceTaskMode || automation.sourceTaskMode, '未设置') + ' · 执行器 ' + (workers.workerCount || workerCommands.length || 0),
      status: statusVariant(workers.status)
    },
    {
      title: '助手提供方',
      detail: workspaceValue(llm.provider, '未知提供方') + ' · 运行模式 ' + workspaceValue(llm.mode, '未设置') + ' · 模拟 ' + (llm.mockMode ? '已开启' : '未开启'),
      status: llm.mockMode ? 'warn' : statusVariant(llm.status)
    },
    {
      title: '试跑收口',
      detail: '状态 ' + workspaceStatusLabel(demo.closureStatus || demo.status || 'not-run') + ' · 日常可用 ' + (demo.readyForDailyUse ? '是' : '否'),
      status: demo.readyForDailyUse ? 'ok' : 'warn'
    },
    {
      title: '操作压力',
      detail: '队列 ' + (operations.queueTotal || 0) + ' · 可运行 ' + (operations.runnable || 0) + ' · 优先级 ' + (operations.highestPriorityScore || 0),
      status: statusVariant(operations.cockpitStatus)
    },
    {
      title: '提醒箱',
      detail: '未读 ' + pressure.openEvents + ' · 到期 ' + pressure.dueEvents + ' · 失败 ' + pressure.failedEvents,
      status: pressure.outboxVariant
    },
    {
      title: '复核审计',
      detail: '审计 ' + pressure.auditCount + ' · 执行 ' + pressure.executionCount + ' · 停滞 ' + pressure.staleExecutions,
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
    summaryTile('状态', automationAttentionStatusLabel(safeQueue.status || 'unknown'), statusVariant(safeQueue.status)),
    summaryTile('事项', String(safeQueue.itemCount || items.length || 0), (safeQueue.itemCount || items.length || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('严重', String(safeQueue.criticalCount || 0), (safeQueue.criticalCount || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('提醒', String(safeQueue.warningCount || 0), (safeQueue.warningCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('最高', automationAttentionStatusLabel(safeQueue.highestSeverity || 'ok'), safeQueue.highestSeverity === 'critical' ? 'fail' : safeQueue.highestSeverity === 'warning' ? 'warn' : 'ok'),
    '</div>'
  ];
  if (items.length === 0) {
    rows.push(emptySignal('当前没有需要处理的路径。', '清爽'));
    return rows.join('');
  }
  rows.push('<div class="automation-attention-list">' + items.slice(0, 8).map(function (item) {
    const variant = item.severity === 'critical' ? 'fail' : item.severity === 'warning' ? 'warn' : statusVariant(item.status);
    return '<div class="action-row ops-row automation-attention-row ' + statusClassName(variant) + '">' +
      '<span>' +
      '<strong>' + escapeHtml('#' + (item.rank || '?') + ' ' + automationAttentionTitle(item)) + '</strong>' +
      '<small>' + escapeHtml(automationAttentionAreaLabel(item.area || 'cockpit') + ' · ' + automationAttentionSummary(item)) + '</small>' +
      '<small>' + escapeHtml(automationAttentionNextAction(item)) + '</small>' +
      '</span>' +
      renderAutomationAttentionControl(item) +
      statusBadge(automationAttentionStatusLabel(item.severity || item.status || 'info'), variant) +
      '</div>';
  }).join('') + '</div>');
  return rows.join('');
}

function automationAttentionTitle(item) {
  const safeItem = item || {};
  const id = safeItem.id || '';
  const title = safeItem.title || '';
  const byId = {
    readiness: '自动运行准备度',
    'pressure.outbox': '提醒箱',
    'pressure.audit': '复核审计',
    'pressure.executions': '动作执行记录',
    'pressure.channel': '提醒渠道',
    freshness: '快照新鲜度',
    'runbook.actionable': '操作清单'
  };
  return byId[id] || title || id || '待处理事项';
}

function automationAttentionAreaLabel(area) {
  return {
    readiness: '准备度',
    notifications: '提醒',
    'review-audit': '复核审计',
    executions: '执行记录',
    freshness: '快照',
    runbook: '操作清单',
    cockpit: '工作区'
  }[area] || area || '工作区';
}

function automationAttentionSummary(item) {
  const summary = item && item.summary ? String(item.summary) : '查看这个工作区信号。';
  return summary
    .replace(/\s+\|\s+/g, ' · ')
    .replace(/\bretryExhausted=/g, '重试耗尽 ')
    .replace(/\bfailedChecks=/g, '失败检查 ')
    .replace(/\bwarnChecks=/g, '提醒检查 ')
    .replace(/\bplannedClosure=/g, '计划关闭 ')
    .replace(/\bplannedMerge=/g, '计划合并 ')
    .replace(/\bactionable=/g, '可处理 ')
    .replace(/\bdryRun=/g, '预览 ')
    .replace(/\bexecute=/g, '执行 ')
    .replace(/\baudits=/g, '审计 ')
    .replace(/\btasks=/g, '任务 ')
    .replace(/\bpresent=/g, '已就绪 ')
    .replace(/\bmissing=/g, '缺失 ')
    .replace(/\bspanMs=/g, '跨度 ')
    .replace(/\bchannel=/g, '渠道 ')
    .replace(/\bcount=/g, '总数 ')
    .replace(/\bstale=/g, '停滞 ')
    .replace(/\bopen=/g, '未读 ')
    .replace(/\bdue=/g, '到期 ')
    .replace(/\bfailed=/g, '失败 ');
}

function automationAttentionNextAction(item) {
  const safeItem = item || {};
  const nextAction = safeItem.nextAction ? String(safeItem.nextAction) : '';
  if (safeItem.id === 'readiness') return '自动运行还不能无人值守。';
  if (safeItem.id === 'pressure.outbox') return '查看未读、到期和失败提醒。';
  if (safeItem.id === 'pressure.audit') return '执行动作前先查看复核审计压力。';
  if (safeItem.id === 'pressure.executions') return '检查停滞或失败的自动动作。';
  if (safeItem.id === 'pressure.channel') return '依赖投递前先检查提醒渠道。';
  if (safeItem.id === 'freshness') {
    const suffix = nextAction.indexOf(':') >= 0 ? nextAction.slice(nextAction.indexOf(':') + 1).trim() : '';
    return suffix ? '刷新缺失输入：' + suffix : '刷新过期的工作区输入。';
  }
  if (safeItem.id === 'runbook.actionable') {
    return nextAction.indexOf('node ') === 0 ? nextAction : '查看操作清单里的命令。';
  }
  return nextAction || '查看相关工作区面板。';
}

function automationAttentionStatusLabel(status) {
  return {
    ok: '正常',
    info: '提示',
    warn: '提醒',
    warning: '提醒',
    fail: '失败',
    critical: '严重',
    unknown: '未知'
  }[status] || status || '未知';
}

function automationAttentionPanelActionLabel(item) {
  if (!item || !item.targetPanel) return '打开面板';
  return {
    'automation-gates': '打开门禁',
    'automation-pressure': '打开概览',
    'automation-freshness': '打开新鲜度',
    'automation-runbook': '打开操作清单'
  }[item.targetPanel] || '打开面板';
}

function automationAttentionRunActionLabel(item) {
  if (!item || !item.nextActionKey) return '运行检查';
  return {
    'refresh-automation-readiness': '刷新快照',
    'preview-runbook-command': '预览下一步',
    'run-llm-readiness': '检查助手状态',
    'run-llm-preflight': '运行助手预检'
  }[item.nextActionKey] || '运行检查';
}

function renderAutomationAttentionControl(item) {
  if (!item || (!item.targetPanel && !item.nextActionKey)) return '';
  const buttons = [];
  if (item.targetPanel) {
    buttons.push('<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="focus-automation-panel" data-target-panel="' + escapeHtml(item.targetPanel) + '">' + escapeHtml(automationAttentionPanelActionLabel(item)) + '</button>');
  }
  if (item.nextActionKey) {
    buttons.push('<button class="inline-button compact-inline-button" type="button" data-action="run-automation-attention-action" data-attention-action="' + escapeHtml(item.nextActionKey) + '" data-target-panel="' + escapeHtml(item.targetPanel || '') + '">' + escapeHtml(automationAttentionRunActionLabel(item)) + '</button>');
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
    if (target) target.innerHTML = renderFeedbackState('empty', '当前没有可安全预览的操作清单命令。');
  }
}

async function runAutomationPressureAction(button) {
  const action = button.dataset.pressureAction;
  if (action === 'outbox-overview') {
    await renderAsync(resolveAutomationActionTarget(), function () {
      return fetchJson('/api/events/overview?limit=50', {
        acceptErrorStatus: true
      });
    }, function (overview) {
      return renderAutomationActionResult('提醒箱概览', {
        status: overview.status,
        mode: 'read-only',
        subject: '提醒箱',
        changed: '无变化',
        next: overview.recommendedNextAction || '查看提醒箱压力。'
      }, renderNotificationEventOverview(overview));
    }, automationActionRenderOptions(resolveAutomationActionTarget(), '正在读取提醒箱概览...'));
    return;
  }
  if (action === 'ack-preview') {
    await renderAsync(resolveAutomationActionTarget(), function () {
      return requestJson('/api/events/ack', {
        limit: 50,
        acknowledged: false,
        acknowledgedBy: 'automation-cockpit',
        note: 'Previewed from Automation Cockpit pressure panel.',
        dryRun: true,
        execute: false
      });
    }, function (result) {
      return renderAutomationActionResult('确认预览', {
        status: result.status,
        mode: 'dry-run',
        subject: '未读提醒',
        changed: '无变化',
        next: '已预览 ' + String(result.candidateCount || 0) + ' 条可确认提醒。'
      }, renderEventBatchAckResult(result));
    }, automationActionRenderOptions(resolveAutomationActionTarget(), '正在预览提醒确认...'));
    return;
  }
  if (action === 'dispatch-preview') {
    await renderAsync(resolveAutomationActionTarget(), function () {
      return fetchJson('/api/events/overview?limit=50', {
        acceptErrorStatus: true
      });
    }, function (overview) {
      return renderAutomationActionResult('投递预览', {
        status: overview.status,
        mode: 'read-only preview',
        subject: '提醒投递',
        changed: '无投递副作用',
        next: dispatchPreviewNextAction(overview)
      }, renderNotificationDispatchPreview(overview));
    }, automationActionRenderOptions(resolveAutomationActionTarget(), '正在预览提醒投递...'));
    return;
  }
  if (action === 'audit-overview') {
    await renderAsync(resolveAutomationActionTarget(), function () {
      return Promise.all([
        fetchJson('/api/context-review-results/action-audits/overview?limit=100', {
          acceptErrorStatus: true
        }),
        fetchJson('/api/context-review-results/action-audits?limit=20', {
          acceptErrorStatus: true
        })
      ]).then(function (results) {
        return {
          overview: results[0],
          audits: results[1].audits || []
        };
      });
    }, function (result) {
      const overview = result.overview || {};
      return renderAutomationActionResult('复核审计', {
        status: overview.status,
        mode: 'read-only',
        subject: '复核审计',
        changed: '无变化',
        next: overview.recommendedNextAction || '查看复核审计压力。'
      }, renderContextReviewActionAuditPanel(result));
    }, automationActionRenderOptions(resolveAutomationActionTarget(), '正在读取复核审计...'));
    return;
  }
  if (action === 'gate-preview') {
    await renderAsync(resolveAutomationActionTarget(), function () {
      return fetchJson('/api/context-review-results/action-gate?limit=50', {
        acceptErrorStatus: true
      });
    }, function (gateReport) {
      return renderAutomationActionResult('门禁预览', {
        status: gateReport.status,
        mode: 'read-only',
        subject: '复核动作门禁',
        changed: '无变化',
        next: gateReport.recommendedNextAction || '应用后续动作前，先检查复核动作门禁。'
      }, renderContextReviewResultActionGate(gateReport));
    }, automationActionRenderOptions(resolveAutomationActionTarget(), '正在读取复核动作门禁...'));
    return;
  }
  if (action === 'execution-overview') {
    await renderAsync(resolveAutomationActionTarget(), function () {
      return fetchJson('/api/context-review-results/action-executions?limit=20', {
        acceptErrorStatus: true
      });
    }, function (result) {
      return renderAutomationActionResult('复核执行', {
        status: result.status,
        mode: 'read-only',
        subject: '动作执行记录',
        changed: '无变化',
        next: result.message || '检查停滞或失败的自动运行执行记录。'
      }, renderContextReviewActionExecutionPanel(result));
    }, automationActionRenderOptions(resolveAutomationActionTarget(), '正在读取复核执行记录...'));
    return;
  }
  if (action === 'executor-diagnostics') {
    await renderAsync(resolveAutomationActionTarget(), function () {
      return fetchJson('/api/context-review-results/action-executor/diagnostics?limit=100', {
        acceptErrorStatus: true
      });
    }, function (result) {
      return renderAutomationActionResult('执行诊断', {
        status: result.status,
        mode: 'read-only',
        subject: '复核执行器',
        changed: '无变化',
        next: (result.nextActions || [])[0] && (result.nextActions || [])[0].summary || '检查复核执行器准备度。'
      }, renderContextReviewActionExecutorDiagnostics(result));
    }, automationActionRenderOptions(resolveAutomationActionTarget(), '正在读取复核执行诊断...'));
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
    summaryTile('提醒箱', pressure.outboxStatus, pressure.outboxVariant),
    summaryTile('未读', String(pressure.openEvents), pressure.openEvents > 0 ? 'warn' : 'ok'),
    summaryTile('到期', String(pressure.dueEvents), pressure.dueEvents > 0 ? 'warn' : 'ok'),
    summaryTile('失败', String(pressure.failedEvents), pressure.failedEvents > 0 ? 'fail' : 'ok'),
    summaryTile('审计', String(pressure.auditCount), pressure.auditCount > 0 ? 'ok' : 'warn'),
    summaryTile('执行', String(pressure.executionCount), pressure.staleExecutions > 0 ? 'fail' : pressure.executionCount > 0 ? 'ok' : 'muted'),
    summaryTile('渠道', pressure.channel, statusVariant(pressure.channelStatus)),
    '</div>',
    '<div class="action-row ops-row"><span>' +
      '<strong>提醒箱</strong>' +
      '<small>' + escapeHtml(notificationOverview.recommendedNextAction || '暂无提醒箱建议。') + '</small>' +
      '<small>' + escapeHtml('重试耗尽 ' + pressure.retryExhaustedEvents + ' · 提醒 ' + pressure.eventCount) + '</small>' +
      '</span><span class="button-group automation-pressure-actions">' +
        '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="run-automation-pressure-action" data-pressure-action="outbox-overview">打开提醒箱</button>' +
        '<button class="inline-button compact-inline-button" type="button" data-action="run-automation-pressure-action" data-pressure-action="ack-preview">确认预览</button>' +
        '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="run-automation-pressure-action" data-pressure-action="dispatch-preview">投递预览</button>' +
      '</span>' + statusBadge(pressure.outboxStatus, pressure.outboxVariant) + '</div>',
    '<div class="action-row ops-row"><span>' +
      '<strong>复核审计</strong>' +
      '<small>' + escapeHtml(auditOverview.recommendedNextAction || '暂无复核审计建议。') + '</small>' +
      '<small>' + escapeHtml('任务 ' + (auditOverview.taskCount || 0) + ' · 计划关闭 ' + (auditOverview.plannedClosureCount || 0) + ' · 计划合并 ' + (auditOverview.plannedMergeCandidateCount || 0)) + '</small>' +
      '</span><span class="button-group automation-pressure-actions">' +
        '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="run-automation-pressure-action" data-pressure-action="audit-overview">打开审计</button>' +
        '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="run-automation-pressure-action" data-pressure-action="gate-preview">门禁预览</button>' +
      '</span>' + statusBadge(workspaceStatusLabel(auditOverview.status || 'unknown'), pressure.auditVariant) + '</div>',
    '<div class="action-row ops-row"><span>' +
      '<strong>动作执行</strong>' +
      '<small>' + escapeHtml('状态 ' + workspaceStatusLabel(actionExecutions.status || 'unknown') + ' · 数量 ' + pressure.executionCount + ' · 停滞 ' + pressure.staleExecutions + ' · 失败 ' + pressure.failedExecutions) + '</small>' +
      '<small>' + escapeHtml('真实执行器启用前，提醒投递和复核动作仍保持可观察。') + '</small>' +
      '</span><span class="button-group automation-pressure-actions">' +
        '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="run-automation-pressure-action" data-pressure-action="execution-overview">打开执行</button>' +
        '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="run-automation-pressure-action" data-pressure-action="executor-diagnostics">执行诊断</button>' +
      '</span>' + statusBadge(workspaceStatusLabel(actionExecutions.status || 'unknown'), pressure.executionVariant) + '</div>',
    checks.length > 0
      ? '<div class="action-row ops-row"><span>' +
        '<strong>提醒渠道</strong>' +
        '<small>' + escapeHtml(checks.map(sourceDiagnosticCheckSummary).join('；')) + '</small>' +
        '</span>' + statusBadge(pressure.channelStatus, statusVariant(pressure.channelStatus)) + '</div>'
      : ''
  ].join('');
}

function renderAutomationFreshness(freshness) {
  const safeFreshness = freshness || {};
  const sources = safeFreshness.sources || [];
  const missingSources = safeFreshness.missingSources || [];
  const visibleSources = sources.slice(0, 12);
  const spanLabel = safeFreshness.spanMs === undefined ? '暂无' : formatDurationMs(safeFreshness.spanMs);
  const rows = [
    '<div class="summary-strip">',
    summaryTile('状态', workspaceStatusLabel(safeFreshness.status), statusVariant(safeFreshness.status)),
    summaryTile('输入', String(safeFreshness.presentSourceCount || 0) + '/' + String(safeFreshness.sourceCount || 0), (safeFreshness.missingSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('缺失', String(safeFreshness.missingSourceCount || 0), (safeFreshness.missingSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('跨度', spanLabel, safeFreshness.spanMs > 60000 ? 'warn' : 'ok'),
    '</div>',
    '<div class="action-row ops-row automation-freshness-row"><span>' +
      '<strong>快照窗口</strong>' +
      '<small>' + escapeHtml('最早 ' + workspaceValue(safeFreshness.oldestGeneratedAt, '未知') + ' · 最新 ' + workspaceValue(safeFreshness.newestGeneratedAt, '未知')) + '</small>' +
      '<small>' + escapeHtml(missingSources.length > 0 ? '缺失输入 ' + missingSources.join('、') : '预期输入都已回传快照时间') + '</small>' +
      '</span><span class="button-group automation-freshness-actions">' +
          '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="refresh-automation-readiness">刷新快照</button>' +
      '</span>' + statusBadge(workspaceStatusLabel(safeFreshness.status), statusVariant(safeFreshness.status)) + '</div>'
  ];
  if (visibleSources.length > 0) {
    rows.push('<div class="automation-freshness-source-list">' + visibleSources.map(function (source) {
      return '<div class="automation-freshness-source ' + (source.present ? 'status-ok' : 'status-warn') + '">' +
        '<strong>' + escapeHtml(source.key || '输入') + '</strong>' +
        '<small>' + escapeHtml(source.generatedAt || '缺失') + '</small>' +
        '</div>';
    }).join('') + '</div>');
  }
  return rows.join('');
}

function formatDurationMs(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return '未知';
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
  if (!commands.length) return '<div class="muted">暂无执行命令。</div>';
  return commands.map(function (worker) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(worker.workerType || worker.key || '执行器') + '</strong>' +
      '<small>' + escapeHtml([worker.leaseKey ? '占用 ' + worker.leaseKey : undefined, worker.intervalMs ? '间隔 ' + formatDurationMs(worker.intervalMs) : undefined].filter(Boolean).join(' · ')) + '</small>' +
      '<small>' + escapeHtml(worker.command || '') + '</small>' +
      '</span></div>';
  }).join('');
}

function renderAutomationOperatorRunbook(runbook) {
  const safeRunbook = runbook || {};
  const sections = safeRunbook.sections || [];
  const rows = [
    '<div class="summary-strip">',
    summaryTile('状态', workspaceStatusLabel(safeRunbook.status), statusVariant(safeRunbook.status)),
    summaryTile('命令', String(safeRunbook.commandCount || 0), (safeRunbook.commandCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('可处理', String(safeRunbook.actionableCommandCount || 0), (safeRunbook.actionableCommandCount || 0) > 0 ? 'warn' : 'muted'),
    summaryTile('可应用', String(safeRunbook.executeCommandCount || 0), (safeRunbook.executeCommandCount || 0) > 0 ? 'warn' : 'muted'),
    summaryTile('分组', String(sections.length), sections.length > 0 ? 'ok' : 'muted'),
    summaryTile('下一步', safeRunbook.nextCommand && safeRunbook.nextCommand.title || '暂无', safeRunbook.nextCommand ? 'warn' : 'muted'),
    '</div>'
  ];
  if (sections.length === 0) {
    rows.push('<div class="muted">暂无操作清单。</div>');
    return rows.join('');
  }
  sections.forEach(function (section) {
    const commands = (section.commands || []).filter(function (command) {
      return command && command.command;
    });
    rows.push('<div class="action-row ops-row automation-runbook-row">' +
      '<span>' +
      '<strong>' + escapeHtml(section.title || section.key || '操作清单分组') + '</strong>' +
      '<small>' + escapeHtml('命令 ' + (section.commandCount || commands.length || 0)) + '</small>' +
      renderAutomationRunbookCommandRows(commands) +
      '</span>' +
      statusBadge(workspaceStatusLabel(section.status), statusVariant(section.status)) +
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
      '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="copy-lifecycle-command">复制</button>' +
      renderAutomationRunbookIntentButton(command.intent) +
      '</span>' +
      '</div>';
  }).join('') + '</div>';
}

function renderAutomationRunbookIntentButton(intent) {
  const safeIntent = intent || {};
  if (safeIntent.type !== 'set-source-schedule' || !safeIntent.sourceId) return '';
  const label = safeIntent.execute ? '立即排期' : '排期检查';
  const className = safeIntent.execute ? 'inline-button compact-inline-button' : 'inline-button secondary-inline-button compact-inline-button';
  return '<button class="' + className + '" type="button" data-action="set-source-schedule"' +
    ' data-source-id="' + escapeHtml(safeIntent.sourceId) + '"' +
    ' data-interval-minutes="' + escapeHtml(String(safeIntent.intervalMinutes || 60)) + '"' +
    ' data-run-now="' + escapeHtml(String(safeIntent.runNow !== false)) + '"' +
    ' data-schedule-enabled="' + escapeHtml(String(safeIntent.scheduleEnabled !== false)) + '"' +
    ' data-execute="' + escapeHtml(String(safeIntent.execute === true)) + '">' + label + '</button>';
}

function renderAutomationRemediation(remediation) {
  if (!remediation) return '<div class="muted">暂无修复计划。</div>';
  const actions = remediation.actions || [];
  const manualActions = remediation.manualActions || [];
  const rows = [
    '<div class="summary-strip">',
    summaryTile('状态', workspaceStatusLabel(remediation.status), statusVariant(remediation.status === 'actionable' ? 'warn' : remediation.status === 'none' ? 'ok' : 'warn')),
    summaryTile('动作', String(remediation.actionCount || 0), (remediation.actionCount || 0) > 0 ? 'warn' : 'muted'),
    summaryTile('手动', String(remediation.manualActionCount || 0), (remediation.manualActionCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('安全', remediation.safeToAutoApply ? '是' : '否', remediation.safeToAutoApply ? 'ok' : 'muted'),
    '</div>'
  ];
  if (!actions.length && !manualActions.length) {
    rows.push('<div class="muted">暂无需要处理的修复动作。</div>');
    return rows.join('');
  }
  actions.slice(0, 8).forEach(function (action) {
    const sourceId = action.scope && action.scope.sourceId;
    const dryRunButton = sourceId
      ? '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-schedule" data-source-id="' + escapeHtml(sourceId) + '" data-interval-minutes="60" data-run-now="true" data-execute="false">排期检查</button>'
      : '';
    const executeButton = sourceId
      ? '<button class="inline-button" type="button" data-action="set-source-schedule" data-source-id="' + escapeHtml(sourceId) + '" data-interval-minutes="60" data-run-now="true" data-execute="true">立即排期</button>'
      : '';
    rows.push('<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.type || action.key || '修复动作') + '</strong>' +
      '<small>' + escapeHtml([action.severity ? workspaceStatusLabel(action.severity) : undefined, action.reason, sourceId ? '来源 ' + sourceId : undefined].filter(Boolean).join(' · ')) + '</small>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      '<small>' + escapeHtml(action.executeCommand || action.command || '') + '</small>' +
      '</span><span class="button-group">' + dryRunButton + executeButton + '</span></div>');
  });
  manualActions.slice(0, 8).forEach(function (action) {
    rows.push('<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.checkKey || action.key || '手动处理') + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      '<small>' + escapeHtml(action.command || '') + '</small>' +
      '</span></div>');
  });
  return rows.join('');
}

function renderAutomationNextActions(actions) {
  if (!actions.length) return '<div class="muted">暂无下一步建议。</div>';
  return actions.map(function (action) {
    const details = [
      '重要程度 ' + workspaceStatusLabel(action.severity || 'info'),
      action.key ? '动作 ' + action.key : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.title || action.summary || '自动运行建议') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(action.summary || '查看这项建议，并保留命令作为证据。') + '</small>' +
      (action.recommendedCommand ? '<small>' + escapeHtml(action.recommendedCommand) + '</small>' : '') +
      '</span>' + statusBadge(workspaceStatusLabel(action.severity || 'info'), attentionStatusVariant(action.severity)) + '</div>';
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
    panel('待处理队列明细', [
      renderSourceOperationsCockpitRows(cockpit.queue || []),
      renderSourceOperationsCockpitNextActions(cockpit.nextActions || [])
    ].join(''), 'wide'),
    panel('采集状态', renderCollectionStatusOverview(schedule), 'wide'),
    panel('采集动作', renderCollectionActionControls(schedule), 'wide'),
    panel('来源关注', renderSourceAttentionRows(attentionItems), 'wide'),
    panel('来源类型运行', renderSourceTypeOperations(sourceTypeOperations), 'wide'),
    panel('来源类型准备度', renderSourceTypeReadiness(sourceTypeReadiness), 'wide'),
    panel('到期来源', renderScheduleDecisionRows(schedule.dueSources || [], '当前没有到期来源。', true), 'wide'),
    panel('等待重试的来源', renderScheduleDecisionRows(filterScheduleSourcesByCollectionStatus(schedule.sources || [], 'retry-waiting'), '当前没有等待重试的来源。', false), 'wide'),
    panel('未排期或已停用来源', renderScheduleDecisionRows(filterScheduleSourcesByCollectionStatus(schedule.sources || [], ['unscheduled', 'disabled']), '当前没有未排期或已停用来源。', false), 'wide'),
    panel('已跳过来源', renderScheduleDecisionRows((schedule.skippedSources || []).slice(0, 10), '当前没有已跳过来源。', false), 'wide'),
    panel('生命周期关注', renderLifecycleAttentionRows(lifecycle.sources || []), 'wide')
  ];
  if (sourceActions.length > 0) {
    panels.push(panel('来源操作建议', renderRunbookActionRows(sourceActions), 'wide'));
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
    '<span class="source-ops-label">来源运行</span>',
    statusBadge(workspaceStatusLabel(cockpit.status || lifecycle.status || schedule.status), statusVariant(cockpit.status || lifecycle.status || schedule.status)),
    '</div>',
    '<h3>' + escapeHtml(headline) + '</h3>',
    '<p>' + escapeHtml([
      '生命周期 ' + workspaceStatusLabel(lifecycle.status),
      '排期 ' + workspaceStatusLabel(schedule.status),
      '操作 ' + workspaceStatusLabel(runbook.status),
      '启用 ' + String(lifecycleSummary.enabled || 0) + '/' + String(lifecycleSummary.total || 0)
    ].join(' · ')) + '</p>',
    '<div class="source-ops-actions button-group">' +
      sourceOpsAlertControl('操作检查', '创建操作提醒', 'synthesize-runbook-events', alertableCount, 'data-limit="100"') +
      sourceOpsAlertControl('关注检查', '创建关注提醒', 'synthesize-source-attention-events', sourceAttentionAlertableCount, 'data-limit="100" data-attention-limit="100" data-priority-score-threshold="70"') +
      sourceOpsAlertControl('类型检查', '创建类型提醒', 'synthesize-source-type-operations-events', sourceTypeOperationsAlertableCount, 'data-limit="100" data-source-type-limit="100" data-attention-limit="100" data-priority-score-threshold="70"') +
    '</div>',
    '</section>',
    '<aside class="source-ops-signals">',
    sourceOpsSignal('队列', summary.total || 0, statusVariant(cockpit.status)),
    sourceOpsSignal('严重', summary.fail || 0, (summary.fail || 0) > 0 ? 'fail' : 'ok'),
    sourceOpsSignal('今日到期', scheduleSummary.due || 0, (scheduleSummary.due || 0) > 0 ? 'warn' : 'ok'),
    sourceOpsSignal('可运行', summary.runnable || 0, (summary.runnable || 0) > 0 ? 'ok' : 'muted'),
    sourceOpsSignal('等待重试', lifecycleSummary.failureRetryWaiting || 0, (lifecycleSummary.failureRetryWaiting || 0) > 0 ? 'warn' : 'ok'),
    sourceOpsSignal('未排期', collectionSummary.unscheduled || 0, (collectionSummary.unscheduled || 0) > 0 ? 'warn' : 'ok'),
    '</aside>',
    '<section class="source-ops-queue">',
    '<span>重点队列</span>',
    renderSourceOperationsHeroQueue(queue),
    '</section>',
    '<section class="source-ops-foot">',
    '<span>自动运行压力</span>',
    '<strong>' + escapeHtml([
      '操作 ' + alertableCount,
      '来源 ' + sourceAttentionAlertableCount,
      '类型 ' + sourceTypeOperationsAlertableCount
    ].join(' · ')) + '</strong>',
    '<small>' + escapeHtml([
      '提醒 ' + (summary.warning || 0),
      '已跳过 ' + (scheduleSummary.skipped || 0),
      '等待重试 ' + (collectionSummary['retry-waiting'] || 0),
      '停用受阻 ' + (lifecycleSummary.disableBlocked || 0)
    ].join(' · ')) + '</small>',
    '</section>',
    '</article>'
  ].join('');
}

function sourceOperationsHeadline(cockpit, schedule, lifecycle) {
  const summary = cockpit.summary || {};
  const scheduleSummary = schedule.summary || {};
  const lifecycleSummary = lifecycle.summary || {};
  if ((summary.fail || 0) > 0) return '有关键来源等待处理计划。';
  if ((scheduleSummary.due || 0) > 0) return '有来源已经到期，先确认下一次采集路径。';
  if ((lifecycleSummary.failureRetryWaiting || 0) > 0) return '重试窗口已打开，恢复工作正在排队。';
  if ((summary.warning || 0) > 0) return '来源运行稳定，但有几处需要关注。';
  return '来源运行清爽，等待下一条有效信号。';
}

function sourceOpsSignal(label, value, variant) {
  return '<div class="source-ops-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function sourceQueueTitle(item) {
  return item.title || item.id || '来源队列项';
}

function sourceScopeLabel(scope) {
  const labels = {
    source: '来源',
    'source-type': '来源类型',
    operations: '运行建议',
    collection: '采集',
    attention: '来源关注'
  };
  return labels[scope] || workspaceValue(scope, '来源');
}

function sourceQueueKindLabel(kind) {
  const labels = {
    'source-attention': '来源关注',
    'source-type-operations': '来源类型运行',
    runbook: '操作建议',
    'due-source': '到期来源',
    operations: '运行建议'
  };
  return labels[kind] || workspaceValue(kind, '来源建议');
}

function renderSourceOperationsHeroQueue(queue) {
  if (!queue || queue.length === 0) {
    return '<div class="source-ops-empty">当前没有待处理的来源队列。</div>';
  }
  return queue.slice(0, 3).map(function (item) {
    const source = item.source || {};
    const details = [
      item.kind ? sourceQueueKindLabel(item.kind) : undefined,
      item.scope ? sourceScopeLabel(item.scope) : undefined,
      '优先级 ' + (item.priorityScore || 0),
      item.signalCount !== undefined ? '信号 ' + item.signalCount : undefined,
      item.recommendedNextAction
    ].filter(Boolean).join(' · ');
    return '<div class="source-ops-queue-row">' +
      '<div>' +
      '<strong>' + escapeHtml('#' + (item.rank || '?') + ' ' + sourceQueueTitle(item)) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</div>' +
      '<span class="button-group source-op-buttons">' +
      renderSourceOperationsCockpitControls(item, source) +
      statusBadge(workspaceStatusLabel(item.severity || 'info'), attentionStatusVariant(item.severity)) +
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
    summaryTile('队列', String(summary.total || 0), statusVariant(cockpit.status)),
    summaryTile('严重', String(summary.fail || 0), (summary.fail || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('提醒', String(summary.warning || 0), (summary.warning || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('可执行', String(summary.runnable || 0), (summary.runnable || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('来源', String(summary.sourceScoped || 0), (summary.sourceScoped || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('类型', String(summary.sourceTypeScoped || 0), (summary.sourceTypeScoped || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('最高优先', String(summary.highestPriorityScore || 0), (summary.highestPriorityScore || 0) >= 100 ? 'warn' : 'ok'),
    '</div>',
    renderSourceOperationsCockpitRows(queue),
    renderSourceOperationsCockpitNextActions(cockpit.nextActions || [])
  ].join('');
}

function renderSourceOperationsCockpitRows(queue) {
  if (!queue.length) return '<div class="muted">当前没有待处理的来源队列。</div>';
  return '<div class="source-work-list">' + queue.map(function (item) {
    const source = item.source || {};
    const sourceLabel = item.sourceType || source.sourceType || source.sourceKey || sourceScopeLabel(item.scope);
    const commands = [item.recommendedCommand].concat(item.relatedCommands || []).filter(Boolean).slice(0, 3);
    return '<div class="source-work-row ' + statusClassName(attentionStatusVariant(item.severity)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(sourceLabel) + '</span>' +
        '<strong>' + escapeHtml('#' + (item.rank || '?') + ' ' + sourceQueueTitle(item)) + '</strong>' +
        '<small>' + escapeHtml([sourceQueueKindLabel(item.kind), sourceScopeLabel(item.scope)].filter(Boolean).join(' · ') || '来源队列') + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(item.summary || item.recommendedNextAction || '先检查来源运行建议，再决定是否自动处理。') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('优先级', item.priorityScore || 0, (item.priorityScore || 0) >= 100 ? 'warn' : 'info') +
          authorMetaChip('信号', item.signalCount === undefined ? 0 : item.signalCount, item.signalCount > 0 ? 'warn' : 'muted') +
          authorMetaChip('可执行', item.runnable ? '是' : '否', item.runnable ? 'ok' : 'muted') +
          authorMetaChip('范围', sourceScopeLabel(item.scope), item.scope === 'source-type' ? 'info' : 'muted') +
        '</div>' +
        renderSourceCommandChips(commands) +
      '</section>' +
      '<section class="source-work-actions button-group source-op-buttons">' +
        renderSourceOperationsCockpitControls(item, source) +
        statusBadge(workspaceStatusLabel(item.severity || 'info'), attentionStatusVariant(item.severity)) +
      '</section>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceOperationsCockpitControls(item, source) {
  const planButton = '<button class="inline-button" type="button" data-action="load-source-cockpit-action-plan" data-rank="' + escapeHtml(item.rank || '') + '" data-item-id="' + escapeHtml(item.id || '') + '" data-source-id="' + escapeHtml(source && source.id || '') + '" data-source-key="' + escapeHtml(source && source.sourceKey || '') + '" data-source-type="' + escapeHtml(item.sourceType || source && source.sourceType || '') + '" data-limit="100" data-cockpit-limit="12">计划</button>';
  if (item.scope === 'source-type' || item.sourceType) {
    return planButton + '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-type-drilldown" data-source-type="' + escapeHtml(item.sourceType || '') + '" data-limit="50" data-scan-limit="250">查看路径</button>';
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
    return [workspaceStatusLabel(action.severity || 'info'), action.summary || action.key, action.recommendedCommand].filter(Boolean).join(' · ');
  })) + '</div>';
}

function renderSourceCockpitActionPlan(plan) {
  const summary = plan.summary || {};
  const item = plan.selectedItem || {};
  return [
    panel('来源动作计划', [
      '<div class="summary-strip">',
      summaryTile('状态', workspaceStatusLabel(plan.status), statusVariant(plan.status === 'actionable' ? 'warn' : 'ok')),
      summaryTile('动作', String(summary.actionCount || 0), (summary.actionCount || 0) > 0 ? 'ok' : 'muted'),
      summaryTile('预演', String(summary.dryRunCount || 0), (summary.dryRunCount || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('执行', String(summary.executeCount || 0), (summary.executeCount || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('高风险', String(summary.destructiveCount || 0), (summary.destructiveCount || 0) > 0 ? 'fail' : 'ok'),
      '</div>',
      metric('队列项', '#' + (item.rank || '?') + ' ' + sourceQueueTitle(item)),
      metric('类型', sourceQueueKindLabel(item.kind)),
      metric('优先级', item.priorityScore || 0),
      metric('下一步', plan.recommendedNextAction || '暂无')
    ].join(''), 'wide'),
    panel('计划动作', renderSourceCockpitActionRows(plan.actions || [], item), 'wide')
  ].join('');
}

function sourceCockpitActionKeyLabel(key) {
  const labels = {
    'source.drilldown': '查看来源路径',
    'source.run-ingest': '采集来源',
    'source.run-insight': '生成洞察',
    'source.failure-reset.preview': '预览恢复',
    'source.failure-reset.execute': '立即重试',
    'source.enable.preview': '预览启用',
    'source.enable.execute': '启用来源',
    'source-attention.events.preview': '预览关注提醒',
    'runbook.events.preview': '预览操作提醒',
    'source-type.drilldown': '查看类型路径',
    'source-type-operations.events.preview': '预览类型提醒',
    'source-type.run-due-insight': '运行到期洞察'
  };
  return labels[key] || undefined;
}

function sourceCockpitActionTitle(action) {
  return sourceCockpitActionKeyLabel(action.key) || action.label || '建议动作';
}

function sourceCockpitActionModeLabel(mode) {
  const labels = {
    manual: '人工确认',
    preview: '先预演',
    'dry-run': '先预演',
    check: '检查',
    execute: '执行'
  };
  return labels[mode] || workspaceStatusLabel(mode);
}

function sourceCockpitActionSafetyLabel(action) {
  if (action.destructive) return '高风险';
  if (action.confirmationRequired) return '需确认';
  if (action.mode === 'execute') return '会改写状态';
  if (action.mode === 'preview' || action.mode === 'dry-run') return '只预览';
  return '安全查看';
}

function sourceCockpitActionVariant(action) {
  if (action.destructive) return 'fail';
  if (action.confirmationRequired || action.mode === 'execute') return 'warn';
  if (action.mode === 'preview' || action.mode === 'dry-run') return 'ok';
  return 'muted';
}

function sourceCockpitActionDetails(action) {
  const api = action.api || {};
  return [
    sourceCockpitActionModeLabel(action.mode),
    api.method && api.path ? '接口 ' + api.method + ' ' + api.path : undefined,
    sourceCockpitActionSafetyLabel(action)
  ].filter(Boolean).join(' · ');
}

function renderSourceCockpitActionRows(actions, item) {
  if (!actions.length) return '<div class="muted">当前没有可用的来源动作。</div>';
  return actions.map(function (action) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(sourceCockpitActionTitle(action)) + '</strong>' +
      '<small>' + escapeHtml(sourceCockpitActionDetails(action)) + '</small>' +
      '<small>' + escapeHtml(action.summary || '查看这项建议，并保留原始命令作为证据。') + '</small>' +
      (action.command ? '<small>' + escapeHtml(action.command) + '</small>' : '') +
      '</span><span class="button-group source-op-buttons">' +
      renderSourceCockpitActionButton(action, item) +
      statusBadge(sourceCockpitActionModeLabel(action.mode), sourceCockpitActionVariant(action)) +
      '</span></div>';
  }).join('');
}

function renderSourceCockpitActionButton(action, item) {
  const source = item.source || {};
  const sourceId = escapeHtml(source.id || '');
  const sourceKey = escapeHtml(source.sourceKey || '');
  const sourceType = escapeHtml(item.sourceType || source.sourceType || '');
  if (action.key === 'source.drilldown') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-drilldown" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">查看路径</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-collection-health" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">健康简报</button>';
  }
  if (action.key === 'source.run-ingest') {
    return '<button class="inline-button" type="button" data-action="run-source" data-source-id="' + sourceId + '">运行</button>';
  }
  if (action.key === 'source.run-insight') {
    return '<button class="inline-button" type="button" data-action="run-source-pipeline" data-source-id="' + sourceId + '">洞察</button>';
  }
  if (action.key === 'source.failure-reset.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="reset-source-failure" data-source-id="' + sourceId + '" data-execute="false" data-retry-now="true">预览</button>';
  }
  if (action.key === 'source.failure-reset.execute') {
    return '<button class="inline-button warning-inline-button" type="button" data-action="reset-source-failure" data-source-id="' + sourceId + '" data-execute="true" data-retry-now="true">立即重试</button>';
  }
  if (action.key === 'source.enable.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="true" data-execute="false">预览</button>';
  }
  if (action.key === 'source.enable.execute') {
    return '<button class="inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="true" data-execute="true">启用</button>';
  }
  if (action.key === 'source-attention.events.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-source-attention-events" data-execute="false" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="100" data-attention-limit="100" data-priority-score-threshold="70">预览</button>';
  }
  if (action.key === 'runbook.events.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-runbook-events" data-execute="false" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="100">预览</button>';
  }
  if (action.key === 'source-type.drilldown') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-type-drilldown" data-source-type="' + sourceType + '" data-limit="50" data-scan-limit="250">打开路径</button>';
  }
  if (action.key === 'source-type-operations.events.preview') {
    return '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-source-type-operations-events" data-execute="false" data-source-type="' + sourceType + '" data-limit="100" data-source-type-limit="100" data-attention-limit="100" data-priority-score-threshold="70">预览</button>';
  }
  if (action.key === 'source-type.run-due-insight') {
    return '<button class="inline-button" type="button" data-action="run-due-pipelines" data-source-type="' + sourceType + '" data-limit="50" data-provider="mock">运行到期洞察</button>';
  }
  return '';
}

function renderSourceTypeOperations(report) {
  const summary = report.summary || {};
  return [
    '<div class="summary-strip">',
    summaryTile('来源类型', String(summary.sourceTypeCount || 0), (summary.failSourceTypeCount || 0) > 0 ? 'fail' : ((summary.warnSourceTypeCount || 0) > 0 ? 'warn' : 'ok')),
    summaryTile('来源', String(summary.sourceCount || 0), (summary.sourceCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('到期', String(summary.dueSourceCount || 0), (summary.dueSourceCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('运行中', String(summary.runningSourceCount || 0), (summary.runningSourceCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('重试等待', String(summary.failureRetryWaitingSourceCount || 0), (summary.failureRetryWaitingSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('关注项', String(summary.attentionSourceCount || 0), (summary.warningAttentionSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('可处理', String(summary.actionableSourceCount || 0), (summary.actionableSourceCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('最高优先级', String(summary.highestPriorityScore || 0), (summary.highestPriorityScore || 0) >= 100 ? 'warn' : 'ok'),
    '</div>',
    renderSourceTypeOperationsRows(report.sourceTypes || [])
  ].join('');
}

function renderSourceTypeOperationsRows(sourceTypes) {
  if (!sourceTypes.length) return '<div class="muted">暂无来源类型运行记录。</div>';
  return '<div class="source-work-list">' + sourceTypes.map(function (sourceType) {
    const readiness = sourceType.readiness || {};
    const schedule = sourceType.schedule || {};
    const lifecycle = sourceType.lifecycle || {};
    const attention = sourceType.attention || {};
    const commands = sourceType.recommendedCommands || [];
    const actions = '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-type-drilldown" data-source-type="' + escapeHtml(sourceType.sourceType || '') + '" data-limit="50" data-scan-limit="250">查看路径</button>';
    return '<div class="source-work-row source-type-work-row ' + statusClassName(statusVariant(sourceType.status)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">来源类型</span>' +
        '<strong>' + escapeHtml(sourceType.sourceType || '未知类型') + '</strong>' +
        '<small>' + escapeHtml('准备度 ' + workspaceStatusLabel(readiness.status)) + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(sourceType.recommendedNextAction || '查看这类来源的运行路径，并保持采集准备度清晰。') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('来源', readiness.sourceCount || lifecycle.total || schedule.total || 0, 'info') +
          authorMetaChip('启用', readiness.enabledSourceCount || lifecycle.enabled || 0, 'ok') +
          authorMetaChip('到期', schedule.due || 0, (schedule.due || 0) > 0 ? 'warn' : 'muted') +
          authorMetaChip('运行中', lifecycle.running || 0, (lifecycle.running || 0) > 0 ? 'ok' : 'muted') +
          authorMetaChip('重试', lifecycle.failureRetryWaiting || 0, (lifecycle.failureRetryWaiting || 0) > 0 ? 'warn' : 'muted') +
          authorMetaChip('关注', attention.total || 0, (attention.total || 0) > 0 ? 'warn' : 'muted') +
          authorMetaChip('优先级', attention.highestPriorityScore || 0, (attention.highestPriorityScore || 0) >= 100 ? 'warn' : 'info') +
        '</div>' +
        renderSourceCommandChips(commands.slice(0, 3)) +
      '</section>' +
      '<section class="source-work-actions button-group source-op-buttons">' +
        actions +
        statusBadge(workspaceStatusLabel(sourceType.status), statusVariant(sourceType.status)) +
      '</section>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceTypeReadiness(report) {
  const summary = report.summary || {};
  const panels = [
    '<div class="summary-strip">',
    summaryTile('类型', String(summary.sourceTypeCount || 0), (summary.failSourceTypeCount || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('就绪', String(summary.readySourceTypeCount || 0), (summary.readySourceTypeCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('提醒', String(summary.warnSourceTypeCount || 0), (summary.warnSourceTypeCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('失败', String(summary.failSourceTypeCount || 0), (summary.failSourceTypeCount || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('未知', String(summary.unknownSourceTypeCount || 0), (summary.unknownSourceTypeCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('来源', String(summary.sourceCount || 0), (summary.sourceCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('已启用', String(summary.enabledSourceCount || 0), (summary.enabledSourceCount || 0) > 0 ? 'ok' : 'muted'),
    '</div>',
    renderSourceTypeReadinessRows(report.sourceTypes || []),
    renderSourceTypeReadinessUnknownRows(report.unknownSourceTypes || [])
  ];
  if ((report.nextActions || []).length > 0) {
    panels.push('<div class="tag-list reason-tags">' + evidenceList(report.nextActions.slice(0, 10).map(function (action) {
      return [workspaceStatusLabel(action.severity), action.summary || action.key].filter(Boolean).join(' · ');
    })) + '</div>');
  }
  return panels.join('');
}

function renderSourceTypeReadinessRows(sourceTypes) {
  if (!sourceTypes.length) return '<div class="muted">当前还没有已登记的来源类型。</div>';
  return '<div class="source-work-list">' + sourceTypes.map(function (sourceType) {
    const compatibleSources = sourceType.compatibleSourceKeys || [];
    const compatible = compatibleSources.length ? '适配来源 ' + compatibleSources.join('、') : '暂无可用来源';
    const checks = (sourceType.checks || []).slice(0, 4);
    return '<div class="source-work-row source-readiness-row ' + statusClassName(statusVariant(sourceType.status)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">接入方式</span>' +
        '<strong>' + escapeHtml(workspaceValue(sourceType.sourceType, '未知类型')) + '</strong>' +
        '<small>' + escapeHtml(compatible) + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(sourceType.description || '这个来源类型还在准备中，先确认可用来源和检查结果。') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('来源', sourceType.sourceCount || 0, (sourceType.sourceCount || 0) > 0 ? 'info' : 'muted') +
          authorMetaChip('已启用', sourceType.enabledSourceCount || 0, (sourceType.enabledSourceCount || 0) > 0 ? 'ok' : 'muted') +
          authorMetaChip('检查', (sourceType.checks || []).length, 'info') +
        '</div>' +
        '<div class="source-work-checks">' + checks.map(function (check) {
          return '<span class="' + statusClassName(statusVariant(check.status)) + '">' + escapeHtml([workspaceStatusLabel(check.status), check.summary || check.key || '检查项'].filter(Boolean).join(' · ')) + '</span>';
        }).join('') + '</div>' +
      '</section>' +
      '<section class="source-work-actions button-group source-op-buttons">' +
        statusBadge(workspaceStatusLabel(sourceType.status), statusVariant(sourceType.status)) +
      '</section>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceTypeReadinessUnknownRows(sourceTypes) {
  if (!sourceTypes.length) return '';
  return '<div class="tag-list reason-tags">' + evidenceList(sourceTypes.map(function (sourceType) {
    return ['未识别', sourceType.sourceType, '来源 ' + sourceType.sourceCount, '已启用 ' + sourceType.enabledSourceCount].filter(Boolean).join(' · ');
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
    label: signal.label || '关注',
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
  if (!items || items.length === 0) return '<div class="muted">暂无需要关注的来源。</div>';
  return '<div class="source-work-list">' + items.map(function (item) {
    const source = item.source || {};
    const runState = source.runState || {};
    const priorityScore = item.priorityScore === undefined ? scoreWebSourceAttention(item) : item.priorityScore;
    const signalLabels = uniqueText((item.signals || []).map(function (signal) {
      return signal.label;
    })).join('、');
    const canRunSourceActions = Boolean(source.id);
    const controls = '<section class="source-work-actions button-group source-op-buttons source-attention-controls">' +
      (item.attentionRank ? statusBadge('#' + item.attentionRank, attentionStatusVariant(item.severity)) : '') +
      statusBadge(signalLabels || workspaceStatusLabel(item.severity || 'info'), attentionStatusVariant(item.severity)) +
      renderSourceDrilldownButton(source) +
      (item.runnable && canRunSourceActions ? renderSourceRunButtons(source) : '') +
      (canRunSourceActions ? renderSourceEnablementButtons(source) : '') +
      (canRunSourceActions ? renderSourceFailureResetButtons(source) : '') +
      '</section>';
    return '<div class="source-work-row source-attention-work-row ' + statusClassName(attentionStatusVariant(item.severity)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(source.sourceType || source.sourceKey || '来源') + '</span>' +
        '<strong>' + escapeHtml(source.displayName || source.id || source.sourceKey || '未知来源') + '</strong>' +
        '<small>' + escapeHtml(source.id || source.sourceKey || item.key || '未知范围') + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(item.recommendedNextAction || item.nextAction || '先检查来源关注项，再自动运行。') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('优先级', priorityScore, priorityScore >= 100 ? 'warn' : 'info') +
          authorMetaChip('运行', runState.status || '未知', statusVariant(runState.status)) +
          authorMetaChip('信号', (item.signals || []).length, (item.signals || []).length > 0 ? 'warn' : 'muted') +
          authorMetaChip('命令', item.commands && item.commands.length || 0, item.commands && item.commands.length ? 'info' : 'muted') +
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
    if (signal.reason) details.push('原因 ' + signal.reason);
    if (signal.action) details.push('动作 ' + signal.action);
    if (signal.retryAt) details.push('重试 ' + signal.retryAt);
    if (signal.backoffMs) details.push('等待 ' + formatDurationMs(signal.backoffMs));
  });
  return uniqueText(details).slice(0, 4).join(' · ');
}

function renderSourceAttentionSignalRows(signals) {
  return (signals || []).slice(0, 4).map(function (signal) {
    return '<small class="source-attention-signal">' +
      escapeHtml((signal.label || '关注') + '：' + (signal.summary || '查看这个来源的关注信号。')) +
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
    panel('来源采集健康', [
      '<div class="summary-strip">',
      summaryTile('状态', profile.status || '未知', statusVariant(profile.status)),
      summaryTile('自动运行', automation.status || '未知', collectionStatusVariant(automation.status)),
      summaryTile('到期', schedule.due ? '是' : '否', schedule.due ? 'warn' : 'ok'),
      summaryTile('游标', cursor.present ? '有' : '无', cursor.present ? 'ok' : 'warn'),
      summaryTile('回放', replay.available ? '可用' : '不可用', replay.available ? 'ok' : 'warn'),
      summaryTile('停滞运行', String(workers.runs && workers.runs.stale || 0), workers.runs && workers.runs.stale > 0 ? 'fail' : 'ok'),
      '</div>',
      metric('来源', [profile.source && profile.source.displayName, profile.source && profile.source.id, profile.source && profile.source.sourceKey, profile.source && profile.source.sourceType].filter(Boolean).join(' · ') || '未知'),
      metric('排期', ['原因 ' + (schedule.reason || '未知'), schedule.nextRunAt ? '下次 ' + schedule.nextRunAt : undefined, schedule.retryAt ? '重试 ' + schedule.retryAt : undefined].filter(Boolean).join(' · ')),
      metric('增量', ['变化 ' + (diff.lastChanged ? '有' : '无'), '新增发言 ' + (diff.newPostCount || 0), '后续发言 ' + (diff.nextPostCount || 0)].join(' · ')),
      metric('回放证据', [(replay.evidenceKinds || []).join(',') || '暂无', '原始页 ' + (replay.rawPageHashCount || 0), replay.taskId ? '任务 ' + replay.taskId : undefined].filter(Boolean).join(' · ')),
      metric('运行记录', ['任务失败 ' + (operations.tasks && operations.tasks.failed || 0), '未确认提醒 ' + (operations.events && operations.events.unacknowledged || 0), '提醒失败 ' + (operations.events && operations.events.failed || 0), '时间线 ' + (operations.timelineCount || 0)].join(' · '))
    ].join(''), 'wide'),
    panel('采集健康检查', evidenceList((profile.checks || []).map(function (check) {
      return workspaceStatusLabel(check.status) + ' · ' + (check.area || '采集') + ' · ' + (check.summary || check.key || '检查项') + ' · ' + workspaceValue(check.value, '暂无');
    })), 'wide'),
    panel('采集健康建议', evidenceList((profile.nextActions || []).map(function (action) {
      return [
        workspaceStatusLabel(action.severity || 'info'),
        action.summary || action.title || '来源建议',
        action.key ? '动作 ' + action.key : undefined,
        action.recommendedCommand || (action.commands || []).join(' · ')
      ].filter(Boolean).join(' · ');
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
    panel('来源概览明细', [
      '<div class="summary-strip">',
      summaryTile('状态', workspaceStatusLabel(report.status), statusVariant(report.status)),
      summaryTile('来源', report.sourceFound ? workspaceStatusLabel(sourceHealth.status || 'found') : '未找到', statusVariant(report.sourceFound ? report.status : 'warn')),
      summaryTile('采集', workspaceStatusLabel(collectionPlan.status), collectionStatusVariant(collectionPlan.status)),
      summaryTile('任务失败', String(tasks.failed || 0), (tasks.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('提醒失败', String(events.failed || 0), (events.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('停滞运行', String(workerRuns.stale || 0), (workerRuns.stale || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('过期占用', String(workerLeases.expired || 0), (workerLeases.expired || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('复核停滞', String(reviewExecutions.staleRunning || 0), (reviewExecutions.staleRunning || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('提醒动作停滞', String(eventActions.staleRunning || 0), (eventActions.staleRunning || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('高优先级', String(authorQueue.highPriorityOpenCount || 0), (authorQueue.highPriorityOpenCount || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('关注', attention.found ? ('#' + (attention.attentionRank || '?') + ' · 分数 ' + (attention.priorityScore || 0)) : '暂无', attentionStatusVariant(attention.severity)),
      '</div>',
      metric('范围', formatEventSourceScope(scope)),
      metric('来源', [source.displayName, source.id, source.sourceKey, source.sourceType].filter(Boolean).join(' · ') || '未找到'),
      metric('采集计划', formatCollectionPlanSummary(collectionPlan)),
      metric('游标', formatCollectionCursorSummary(collectionPlan.cursor)),
      metric('回放证据', formatCollectionReplaySummary(collectionPlan.replay)),
      metric('关注', formatSourceAttentionSummary(attention)),
      attention.recommendedCommand ? metric('关注命令', attention.recommendedCommand) : '',
      metric('排期', formatSourceScheduleDecisionSummary(sourceHealth.schedule)),
      metric('执行类型', compactCountMap(workerRuns.byWorkerType)),
      metric('占用类型', compactCountMap(workerLeases.byWorkerType)),
      metric('任务', formatTaskCountSummary(tasks)),
      metric('提醒', formatNotificationCountSummary(events)),
      metric('复核动作', reviewActionStatusSummary(reviewActions)),
      metric('提醒动作', eventActionStatusSummary(eventActions)),
      metric('作者队列', authorReviewQueueStatusSummary(authorQueue))
    ].join(''), 'wide'),
    panel('来源健康简报', renderSourceHealthBrief(report), 'wide'),
    panel('来源采集计划', renderCollectionPlanDetails(collectionPlan), 'wide'),
    panel('来源关注明细', renderSourceDrilldownAttention(attention), 'wide'),
    panel('来源下一步', renderSourceDrilldownActions(report.nextActions || []), 'wide'),
    panel('来源运行时间线', evidenceList((report.timeline || []).map(formatSourceTimelineRow)), 'wide'),
    panel('最近来源任务', evidenceList((recent.tasks || []).map(formatSourceDrilldownTaskRow)), 'wide'),
    panel('最近来源提醒', evidenceList((recent.events || []).map(formatSourceDrilldownEventRow)), 'wide'),
    panel('最近执行记录', evidenceList((recent.workerRuns || []).map(formatWorkerRunRow).concat((recent.workerLeases || []).map(formatWorkerLeaseRow))), 'wide')
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
    panel('来源类型运行明细', [
      '<div class="summary-strip">',
      summaryTile('状态', workspaceStatusLabel(report.status), statusVariant(report.status)),
      summaryTile('类型', workspaceValue(report.sourceType, '未知'), statusVariant(report.status)),
      summaryTile('来源', String(sources.total || 0), (sources.total || 0) > 0 ? 'ok' : 'muted'),
      summaryTile('到期', String(sources.due || 0), (sources.due || 0) > 0 ? 'ok' : 'muted'),
      summaryTile('失败', String(sources.failed || 0), (sources.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('任务失败', String(tasks.failed || 0), (tasks.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('提醒失败', String(events.failed || 0), (events.failed || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('停滞运行', String(workerRuns.stale || 0), (workerRuns.stale || 0) > 0 ? 'warn' : 'ok'),
      summaryTile('过期占用', String(workerLeases.expired || 0), (workerLeases.expired || 0) > 0 ? 'warn' : 'ok'),
      '</div>',
      metric('范围', [
        '类型 ' + workspaceValue(scope.sourceType || report.sourceType, '未知'),
        '来源数 ' + ((scope.sourceIds || []).length),
        '来源代号 ' + workspaceListText(scope.sourceKeys)
      ].join(' · ')),
      metric('运行', [
        operations.found ? '已接入' : '未接入',
        '状态 ' + workspaceStatusLabel(operations.status),
        '关注 ' + (operations.attention && operations.attention.total || 0),
        '优先级 ' + (operations.attention && operations.attention.highestPriorityScore || 0)
      ].join(' · ')),
      metric('运行状态', compactCountMap(sources.byRunStatus)),
      metric('排期原因', compactCountMap(sources.byScheduleReason)),
      metric('提醒类型', compactCountMap(events.byType)),
      metric('执行类型', compactCountMap(workerRuns.byWorkerType))
    ].join(''), 'wide'),
    panel('来源类型下一步', renderSourceDrilldownActions(report.nextActions || []), 'wide'),
    panel('最近同类来源', evidenceList((recent.sources || []).map(formatSourceTypeDrilldownSourceRow)), 'wide'),
    panel('最近同类任务', evidenceList((recent.tasks || []).map(formatSourceDrilldownTaskRow)), 'wide'),
    panel('最近同类提醒', evidenceList((recent.events || []).map(formatSourceDrilldownEventRow)), 'wide'),
    panel('最近同类执行记录', evidenceList((recent.workerRuns || []).map(formatWorkerRunRow).concat((recent.workerLeases || []).map(formatWorkerLeaseRow))), 'wide')
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
    renderSourceBriefRow('原因', sourceProblemSummary(report), report.status),
    renderSourceBriefRow('下一步', topAction ? ((topAction.summary || topAction.key || '检查来源') + (topAction.recommendedCommand ? ' · ' + topAction.recommendedCommand : '')) : '暂无来源专属动作。', topAction && topAction.severity || 'ok'),
    renderSourceBriefRow('排期', formatSourceScheduleBrief(schedule), schedule.due ? 'ok' : 'muted'),
    renderSourceBriefRow('最新任务', formatLatestTaskBrief(latestTask), latestTask && latestTask.status),
    renderSourceBriefRow('最新提醒', formatLatestEventBrief(latestEvent), latestEvent && (latestEvent.deliveryStatus || latestEvent.severity)),
    renderSourceBriefRow('最新执行', formatLatestWorkerBrief(latestWorkerRun, latestLease), latestWorkerRun && latestWorkerRun.status || latestLease && (latestLease.expired ? 'warning' : 'ok'))
  ];
  return briefRows.join('');
}

function renderSourceBriefRow(label, value, status) {
  return '<div class="source-brief-row ' + statusClassName(sourceBriefStatusVariant(status)) + '">' +
    '<section>' +
      '<span>' + escapeHtml(label) + '</span>' +
      '<strong>' + escapeHtml(value || '暂无') + '</strong>' +
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
  if (!report.sourceFound) return '来源注册缺失或范围不明确。';
  if (action && action.summary) return action.summary;
  if ((workerRuns.stale || 0) > 0) return '来源执行有停滞记录。';
  if ((workerLeases.expired || 0) > 0) return '来源执行占用已过期。';
  if ((tasks.failed || 0) > 0) return '最近的来源任务失败。';
  if ((events.failed || 0) > 0) return '最近的提醒投递失败。';
  if ((eventActions.failed || 0) > 0 || (eventActions.staleRunning || 0) > 0) return '提醒动作需要关注。';
  if ((authorQueue.highPriorityOpenCount || 0) > 0) return '高优先级作者复核仍在等待。';
  if (report.status === 'ok') return '当前窗口内来源健康。';
  return '查看来源健康明细。';
}

function formatSourceAttentionSummary(attention) {
  const safeAttention = attention || {};
  if (!safeAttention.found) return '暂无关注事项';
  return [
    '级别 ' + workspaceStatusLabel(safeAttention.severity || 'info'),
    '分数 ' + (safeAttention.priorityScore || 0),
    '信号 ' + (safeAttention.signalCount || 0),
    safeAttention.recommendedNextAction || safeAttention.recommendedCommand
  ].filter(Boolean).join(' · ');
}

function formatSourceScheduleDecisionSummary(schedule) {
  const safeSchedule = schedule || {};
  if (!safeSchedule.reason && !safeSchedule.baseReason && safeSchedule.due === undefined) return '未知排期';
  return [
    safeSchedule.due ? '当前到期' : '暂未到期',
    '原因 ' + workspaceValue(safeSchedule.reason || safeSchedule.baseReason, '未知'),
    safeSchedule.nextRunAt ? '下次 ' + safeSchedule.nextRunAt : undefined,
    safeSchedule.retryAt ? '重试 ' + safeSchedule.retryAt : undefined
  ].filter(Boolean).join(' · ');
}

function formatTaskCountSummary(tasks) {
  const safeTasks = tasks || {};
  return [
    '总数 ' + (safeTasks.total || 0),
    '运行中 ' + (safeTasks.running || 0),
    '失败 ' + (safeTasks.failed || 0)
  ].join(' · ');
}

function formatNotificationCountSummary(events) {
  const safeEvents = events || {};
  return [
    '未读 ' + (safeEvents.unacknowledged || 0),
    '待投递 ' + (safeEvents.pending || 0),
    '到期 ' + (safeEvents.dueForDelivery || 0)
  ].join(' · ');
}

function formatSourceScheduleBrief(schedule) {
  const safeSchedule = schedule || {};
  const parts = [
    safeSchedule.due ? '当前到期' : '未到期',
    safeSchedule.reason || safeSchedule.baseReason,
    safeSchedule.nextRunAt ? '下次 ' + safeSchedule.nextRunAt : undefined,
    safeSchedule.retryAt ? '重试 ' + safeSchedule.retryAt : undefined,
    safeSchedule.failureCount ? '失败 ' + safeSchedule.failureCount : undefined,
    safeSchedule.backoffMs ? '等待 ' + formatDurationMs(safeSchedule.backoffMs) : undefined
  ];
  return parts.filter(Boolean).join(' · ') || '未知排期';
}

function formatLatestTaskBrief(task) {
  if (!task) return '暂无最近来源任务。';
  return [
    task.status || '未知',
    task.type || 'task',
    task.finishedAt || task.updatedAt || task.createdAt || '未知时间',
    task.error && task.error.message || task.id
  ].filter(Boolean).join(' · ');
}

function formatLatestEventBrief(event) {
  if (!event) return '暂无最近来源提醒。';
  return [
    event.deliveryStatus || event.severity || '未知',
    event.type || 'event',
    event.nextDeliveryAt || event.createdAt || '未知时间',
    event.title || event.summary || event.id
  ].filter(Boolean).join(' · ');
}

function formatLatestWorkerBrief(run, lease) {
  const runPart = run ? [
    '运行 ' + (run.status || '未知'),
    run.workerType || 'worker',
    run.heartbeatAt || run.finishedAt || run.updatedAt || run.startedAt
  ].filter(Boolean).join(' / ') : '暂无运行';
  const leasePart = lease ? [
    '占用 ' + (lease.expired ? '已过期' : '生效中'),
    lease.workerType || 'worker',
    lease.expiresAt || lease.updatedAt || lease.acquiredAt
  ].filter(Boolean).join(' / ') : '暂无占用';
  return runPart + ' · ' + leasePart;
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
    source.id || '未知来源',
    source.sourceKey || '未知论坛',
    source.enabled === false ? '已停用' : '已启用',
    '运行 ' + (runState.status || '未知'),
    '到期 ' + (schedule.due ? '是' : '否'),
    '原因 ' + (schedule.reason || '未知')
  ].join(' · ');
}

function renderSourceDrilldownAttention(attention) {
  if (!attention || !attention.found) return '<div class="muted">当前范围暂无来源关注项。</div>';
  const severityLabel = workspaceStatusLabel(attention.severity || 'info');
  const lines = [
    '排名 #' + (attention.attentionRank || '?') + ' · 优先级 ' + (attention.priorityScore || 0) + ' · 级别 ' + severityLabel,
    attention.recommendedNextAction ? '下一步 ' + attention.recommendedNextAction : undefined,
    attention.recommendedCommand ? '命令 ' + attention.recommendedCommand : undefined
  ].filter(Boolean);
  return '<div class="source-work-row source-attention-work-row ' + statusClassName(attentionStatusVariant(attention.severity)) + '">' +
    '<section class="source-work-anchor">' +
      '<span class="source-work-scope">来源关注</span>' +
      '<strong>' + escapeHtml(severityLabel + ' · 来源关注') + '</strong>' +
      '<small>' + escapeHtml('排名 #' + (attention.attentionRank || '?')) + '</small>' +
    '</section>' +
    '<section class="source-work-brief">' +
      '<p>' + escapeHtml(attention.recommendedNextAction || '查看这个来源的关注信号。') + '</p>' +
      '<div class="source-work-chips">' +
        authorMetaChip('优先级', attention.priorityScore || 0, (attention.priorityScore || 0) >= 100 ? 'warn' : 'info') +
        authorMetaChip('信号', attention.signalCount || (attention.signals || []).length || 0, 'warn') +
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
  if (!actions.length) return '<div class="muted">暂无来源专属动作。</div>';
  return '<div class="source-work-list">' + actions.map(function (action) {
    return '<div class="source-work-row source-action-row ' + statusClassName(action.severity === 'critical' ? 'warn' : statusVariant(action.severity)) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(workspaceStatusLabel(action.severity || 'info')) + '</span>' +
        '<strong>' + escapeHtml(action.title || action.summary || '来源建议') + '</strong>' +
        '<small>' + escapeHtml([action.mode ? sourceCockpitActionModeLabel(action.mode) : '建议', action.key ? '动作 ' + action.key : undefined].filter(Boolean).join(' · ')) + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml(action.summary || '检查来源动作。') + '</p>' +
        renderSourceCommandChips([action.recommendedCommand].filter(Boolean).concat(action.commands || [])) +
      '</section>' +
      '<section class="source-work-actions button-group source-op-buttons">' +
        statusBadge(workspaceStatusLabel(action.severity || 'info'), action.severity === 'critical' ? 'warn' : statusVariant(action.severity)) +
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
    task.status || '未知状态',
    task.type || 'unknown-task',
    task.sourceId || task.sourceKey || '未知来源',
    task.updatedAt || task.createdAt || '未知时间',
    task.error && task.error.message ? task.error.message : task.id || '未知任务'
  ].join(' · ');
}

function formatSourceDrilldownEventRow(event) {
  return [
    event.deliveryStatus || '未知投递',
    event.type || 'event',
    event.sourceId || event.sourceKey || '未知来源',
    event.nextDeliveryAt || event.createdAt || '未知时间',
    event.title || event.summary || event.id || '未知提醒'
  ].join(' · ');
}

function formatSourceTimelineRow(item) {
  return [
    item.timestamp || '未知时间',
    item.severity || 'info',
    item.kind || 'item',
    item.status || '未知状态',
    item.title || item.reference || item.id || '未知事项',
    item.sourceId || item.sourceKey || '未知来源',
    item.summary || item.reference || item.id || ''
  ].filter(Boolean).join(' · ');
}

function renderRunbookEventControls(alertableCount) {
  const disabled = alertableCount > 0 ? '' : ' disabled';
  return '<div class="action-row ops-row"><span>' +
    '<strong>操作清单提醒</strong>' +
    '<small>' + escapeHtml('可提醒=' + alertableCount) + '</small>' +
    '</span>' +
    '<span class="button-group source-op-buttons">' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-runbook-events" data-execute="false" data-limit="100">清单检查</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-runbook-events" data-execute="true" data-limit="100"' + disabled + '>创建提醒</button>' +
    '</span></div>';
}

function renderSourceAttentionEventControls(alertableCount) {
  const disabled = alertableCount > 0 ? '' : ' disabled';
  return '<div class="action-row ops-row"><span>' +
    '<strong>来源关注提醒</strong>' +
    '<small>' + escapeHtml('可提醒=' + alertableCount + ' · 阈值=70') + '</small>' +
    '</span>' +
    '<span class="button-group source-op-buttons">' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-source-attention-events" data-execute="false" data-limit="100" data-attention-limit="100" data-priority-score-threshold="70">关注检查</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-source-attention-events" data-execute="true" data-limit="100" data-attention-limit="100" data-priority-score-threshold="70"' + disabled + '>创建提醒</button>' +
    '</span></div>';
}

function renderSourceTypeOperationsEventControls(alertableCount) {
  const disabled = alertableCount > 0 ? '' : ' disabled';
  return '<div class="action-row ops-row"><span>' +
    '<strong>来源类型运行提醒</strong>' +
    '<small>' + escapeHtml('可提醒=' + alertableCount + ' · 阈值=70') + '</small>' +
    '</span>' +
    '<span class="button-group source-op-buttons">' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="synthesize-source-type-operations-events" data-execute="false" data-limit="100" data-source-type-limit="100" data-attention-limit="100" data-priority-score-threshold="70">类型检查</button>' +
    '<button class="inline-button warning-inline-button" type="button" data-action="synthesize-source-type-operations-events" data-execute="true" data-limit="100" data-source-type-limit="100" data-attention-limit="100" data-priority-score-threshold="70"' + disabled + '>创建提醒</button>' +
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
  if (reasons.length === 0) return '<span class="muted">暂无排期原因。</span>';
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
    return '<span class="tag">' + escapeHtml(workspaceStatusLabel(status) + ' ' + byStatus[status]) + '</span>';
  }).join('');
  const filtered = schedule && schedule.collectionStatus && schedule.collectionStatus.length
    ? '<small>' + escapeHtml('筛选 ' + schedule.collectionStatus.map(workspaceStatusLabel).join('、')) + '</small>'
    : '';
  return '<div class="tag-list reason-tags">' + (statusTags || '<span class="tag">暂无采集状态</span>') + '</div>' + filtered;
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
      '<span class="source-work-scope">采集</span>' +
      '<strong>到期采集</strong>' +
      '<small>' + escapeHtml(dueCount > 0 ? '可立即处理' : '队列清爽') + '</small>' +
    '</section>' +
    '<section class="source-work-brief">' +
      '<p>先采集到期来源，再为新证据生成洞察。</p>' +
      '<div class="source-work-chips">' +
        authorMetaChip('到期', dueCount, dueCount > 0 ? 'warn' : 'muted') +
        authorMetaChip('已排期', scheduled, scheduled > 0 ? 'info' : 'muted') +
        authorMetaChip('待重试', retryWaiting, retryWaiting > 0 ? 'warn' : 'muted') +
        authorMetaChip('受阻', blocked, blocked > 0 ? 'warn' : 'muted') +
        authorMetaChip('已跳过', summary.skipped || 0, (summary.skipped || 0) > 0 ? 'muted' : 'ok') +
      '</div>' +
    '</section>' +
    '<section class="source-work-actions button-group source-op-buttons">' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-due-sources" data-limit="25"' + disabled + '>采集到期</button>' +
      '<button class="inline-button" type="button" data-action="run-due-pipelines" data-provider="mock" data-limit="25"' + disabled + '>生成洞察</button>' +
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
        '<span class="source-work-scope">' + escapeHtml(source.sourceType || source.sourceKey || '来源') + '</span>' +
        '<strong>' + escapeHtml(source.displayName || source.sourceKey || source.id || '未命名来源') + '</strong>' +
        '<small>' + escapeHtml(source.id || source.sourceKey || '未知来源') + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml('原因 ' + (decision.reason || '未知')) + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('计划', workspaceStatusLabel(collectionPlan.status), collectionStatusVariant(collectionPlan.status)) +
          authorMetaChip('运行', workspaceStatusLabel(runState.status), statusVariant(runState.status)) +
          authorMetaChip('间隔', schedule.intervalMinutes ? schedule.intervalMinutes + 'm' : '暂无', schedule.intervalMinutes ? 'info' : 'muted') +
          authorMetaChip('下次', decision.nextRunAt || '暂无', decision.nextRunAt ? 'info' : 'muted') +
          authorMetaChip('重试', decision.retryAt || '暂无', decision.retryAt ? 'warn' : 'muted') +
        '</div>' +
        renderSourceCommandChips(source.recommendedCommands || collectionPlan.recommendedCommands || []) +
      '</section>' +
      renderScheduleSourceControls(source, runnable) +
      '</div>';
  }).join('') + '</div>';
}

function renderScheduleSourceControls(source, runnable) {
  return '<section class="source-work-actions button-group source-op-buttons schedule-op-buttons">' +
    statusBadge(runnable ? '到期' : '暂缓', runnable ? 'ok' : 'muted') +
    renderSourceDrilldownButton(source) +
    renderSourceScheduleButtons(source) +
    (runnable ? renderSourceRunButtons(source) : '') +
    '</section>';
}

function renderCollectionPlanDetails(plan) {
  if (!plan || !plan.status) return '<div class="muted">暂无采集计划。</div>';
  const schedule = plan.schedule || {};
  const decision = schedule.decision || {};
  const incremental = plan.incremental || {};
  return '<div class="source-work-row source-action-row ' + statusClassName(collectionStatusVariant(plan.status)) + '">' +
    '<section class="source-work-anchor">' +
      '<span class="source-work-scope">计划</span>' +
      '<strong>' + escapeHtml(workspaceStatusLabel(plan.status)) + '</strong>' +
      '<small>' + escapeHtml(plan.strategy && plan.strategy.mode || '采集') + '</small>' +
    '</section>' +
    '<section class="source-work-brief">' +
      '<p>' + escapeHtml('原因 ' + (decision.reason || '未知')) + '</p>' +
      '<div class="source-work-chips">' +
        authorMetaChip('下次', decision.nextRunAt || '暂无', decision.nextRunAt ? 'info' : 'muted') +
        authorMetaChip('重试', decision.retryAt || '暂无', decision.retryAt ? 'warn' : 'muted') +
        authorMetaChip('游标', formatCollectionCursorSummary(plan.cursor), plan.cursor && plan.cursor.present ? 'ok' : 'warn') +
        authorMetaChip('变化', incremental.lastChanged ? '有' : '无', incremental.lastChanged ? 'ok' : 'muted') +
        authorMetaChip('新增', incremental.newPostCount || 0, (incremental.newPostCount || 0) > 0 ? 'ok' : 'muted') +
        authorMetaChip('回放', formatCollectionReplaySummary(plan.replay), plan.replay && plan.replay.available ? 'ok' : 'muted') +
      '</div>' +
      renderSourceCommandChips(plan.recommendedCommands || []) +
    '</section>' +
    '<section class="source-work-actions button-group source-op-buttons">' +
      statusBadge(workspaceStatusLabel(plan.status), collectionStatusVariant(plan.status)) +
    '</section>' +
    '</div>';
}

function formatCollectionPlanSummary(plan) {
  if (!plan || !plan.status) return '未知';
  const schedule = plan.schedule || {};
  const decision = schedule.decision || {};
  return [
    workspaceStatusLabel(plan.status),
    plan.strategy && plan.strategy.mode,
    '原因 ' + (decision.reason || '未知'),
    decision.nextRunAt ? '下次 ' + decision.nextRunAt : undefined,
    decision.retryAt ? '重试 ' + decision.retryAt : undefined
  ].filter(Boolean).join(' · ');
}

function formatCollectionCursorSummary(cursor) {
  const safeCursor = cursor || {};
  if (!safeCursor.present) return '暂无';
  return [
    '发言 ' + (safeCursor.postCount || 0),
    safeCursor.lastFloor !== undefined ? '楼层 ' + safeCursor.lastFloor : undefined,
    safeCursor.lastPostId ? '发言ID ' + safeCursor.lastPostId : undefined,
    safeCursor.capturedAt ? '采集 ' + safeCursor.capturedAt : undefined
  ].filter(Boolean).join(' · ');
}

function formatCollectionReplaySummary(replay) {
  const safeReplay = replay || {};
  if (!safeReplay.available) return '暂无';
  return [
    safeReplay.taskId ? '任务 ' + safeReplay.taskId : undefined,
    (safeReplay.rawPageHashes || []).length ? '原始页 ' + safeReplay.rawPageHashes.length : undefined,
    (safeReplay.pageNumbers || []).length ? '页数 ' + safeReplay.pageNumbers.join(',') : undefined,
    (safeReplay.evidenceKinds || []).length ? '证据 ' + safeReplay.evidenceKinds.join(',') : undefined
  ].filter(Boolean).join(' · ') || '可用';
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
  if (rows.length === 0) return '<div class="muted">还没有跟踪来源。</div>';
  if (attentionSources.length === 0) {
    return '<div class="muted">当前没有生命周期事项需要处理。</div>' + rows.map(renderLifecycleSourceRow).join('');
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
      '<span class="source-work-scope">' + escapeHtml(source.sourceType || source.sourceKey || '来源') + '</span>' +
      '<strong>' + escapeHtml(source.displayName || source.id) + '</strong>' +
      '<small>' + escapeHtml(source.id || source.sourceKey || '未知来源') + '</small>' +
    '</section>' +
    '<section class="source-work-brief">' +
      '<p>' + escapeHtml(source.nextAction || '这个来源已准备好下一步。') + '</p>' +
      '<div class="source-work-chips">' +
        authorMetaChip('运行', runState.status || '未知', statusVariant(runState.status)) +
        authorMetaChip('状态', label, variant) +
        authorMetaChip('开始', guard.lastStartedAt || '暂无', guard.lastStartedAt ? 'info' : 'muted') +
        authorMetaChip('重试', retry.retryAt || '暂无', retry.retryAt ? 'warn' : 'muted') +
        authorMetaChip('任务', source.latestLifecycleTask ? source.latestLifecycleTask.status || 'task' : '暂无', source.latestLifecycleTask ? statusVariant(source.latestLifecycleTask.status) : 'muted') +
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
      '<button class="inline-button secondary-inline-button compact-inline-button" type="button" data-action="copy-lifecycle-command">复制</button>' +
      '</div>';
  }).join('') + '</div>';
}

function renderSourceDrilldownButton(source) {
  const sourceId = escapeHtml(source.id || '');
  const sourceKey = escapeHtml(source.sourceKey || '');
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-drilldown" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">查看路径</button>' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-collection-health" data-source-id="' + sourceId + '" data-source-key="' + sourceKey + '" data-limit="50">健康简报</button>';
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
    '<button class="inline-button secondary-inline-button" type="button" data-action="run-source" data-source-id="' + sourceId + '">运行</button>',
    '<button class="inline-button secondary-inline-button" type="button" data-action="run-source-pipeline" data-source-id="' + sourceId + '">洞察</button>'
  ].join('');
}

function renderSourceScheduleButtons(source) {
  const sourceId = escapeHtml(source.id);
  if (!sourceId) return '';
  return [
    '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-schedule" data-source-id="' + sourceId + '" data-interval-minutes="60" data-run-now="true" data-execute="false">排期检查</button>',
    '<button class="inline-button" type="button" data-action="set-source-schedule" data-source-id="' + sourceId + '" data-interval-minutes="60" data-run-now="true" data-execute="true">立即排期</button>'
  ].join('');
}

function renderSourceEnablementButtons(source) {
  const sourceId = escapeHtml(source.id);
  if (source.enabled === false) {
    return [
      '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="true" data-execute="false">启用检查</button>',
      '<button class="inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="true" data-execute="true">启用来源</button>'
    ].join('');
  }
  return [
    '<button class="inline-button secondary-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="false" data-execute="false">停用检查</button>',
    '<button class="inline-button warning-inline-button" type="button" data-action="set-source-enabled" data-source-id="' + sourceId + '" data-enabled="false" data-execute="true">停用来源</button>'
  ].join('');
}

function renderSourceFailureResetButtons(source) {
  const runState = source.runState || {};
  const retry = source.failureRetry || {};
  if (runState.status !== 'failed' && !retry.active) return '';
  const sourceId = escapeHtml(source.id);
  return [
    '<button class="inline-button secondary-inline-button" type="button" data-action="reset-source-failure" data-source-id="' + sourceId + '" data-execute="false" data-retry-now="true">重试检查</button>',
    '<button class="inline-button warning-inline-button" type="button" data-action="reset-source-failure" data-source-id="' + sourceId + '" data-execute="true" data-retry-now="true">立即重试</button>'
  ].join('');
}

function renderSourceLifecycleUpdateResult(result) {
  const update = result.result || result;
  const task = result.task || {};
  const before = update.sourceBefore || {};
  const after = update.sourceAfter || {};
  const guard = update.guard || {};
  return panel(after.enabled ? '来源已启用' : '来源已停用', [
    metric('状态', update.status || '未知'),
    metric('任务', task.id || '暂无'),
    metric('模式', update.dryRun ? '预演' : '执行'),
    metric('变化', update.changed ? '是' : '否'),
    metric('来源', (before.id || after.id || '未知') + ' · ' + (after.displayName || before.displayName || '未知')),
    metric('此前启用', before.enabled === undefined ? '未知' : before.enabled),
    metric('当前启用', after.enabled === undefined ? '未知' : after.enabled),
    metric('守护', guard.running ? '运行 ' + guard.running + ' · 阻塞 ' + guard.blocked + ' · 停滞 ' + guard.stale : '未运行'),
    renderTaskTraceButton(task)
  ].join(''), 'wide');
}

function renderSourceScheduleUpdateResult(result) {
  const update = result.result || result;
  const task = result.task || {};
  const before = update.sourceBefore || {};
  const after = update.sourceAfter || {};
  return panel('来源排期', [
    metric('状态', update.status || '未知'),
    metric('任务', task.id || '暂无'),
    metric('模式', update.dryRun ? '预演' : '执行'),
    metric('变化', update.changed ? '是' : '否'),
    metric('来源', (before.id || after.id || '未知') + ' · ' + (after.displayName || before.displayName || '未知')),
    metric('此前', formatScheduleBrief(before.schedule)),
    metric('当前', formatScheduleBrief(after.schedule)),
    renderTaskTraceButton(task)
  ].join(''), 'wide');
}

function formatScheduleBrief(schedule) {
  const safeSchedule = schedule || {};
  return [
    '启用 ' + (safeSchedule.enabled === undefined ? '默认' : safeSchedule.enabled),
    '间隔 ' + (safeSchedule.intervalMinutes || '暂无'),
    '下次 ' + (safeSchedule.nextRunAt || '暂无')
  ].join(' · ');
}

function renderSourceFailureResetResult(result) {
  const reset = result.result || result;
  const task = result.task || {};
  const sourceAfter = reset.sourceAfter || {};
  const runState = sourceAfter.runState || {};
  const schedule = sourceAfter.schedule || {};
  return panel('来源重试重置', [
    metric('状态', reset.status || '未知'),
    metric('任务', task.id || '暂无'),
    metric('模式', reset.dryRun ? '预演' : '执行'),
    metric('变化', reset.changed ? '是' : '否'),
    metric('原因', reset.reason || '未知'),
    metric('运行状态', runState.status || '未知'),
    metric('失败次数', runState.failureCount === undefined ? '未知' : runState.failureCount),
    metric('下次运行', schedule.nextRunAt || reset.nextRunAt || '未变化'),
    renderTaskTraceButton(task)
  ].join(''), 'wide');
}

function renderRunbookNotificationEventResult(result) {
  const items = result.results || [];
  return panel('操作清单提醒', [
    metric('状态', result.status || '未知'),
    metric('模式', result.dryRun ? '预演' : '执行'),
    metric('动作', result.actionCount || 0),
    metric('提醒', result.eventCount || 0),
    metric('新建', result.createdCount || 0),
    metric('更新', result.updatedCount || 0),
    metric('解决', result.resolvedCount || 0),
    metric('重开', result.reopenedCount || 0),
    metric('跳过', result.skippedCount || 0),
    evidenceList(items.map(formatRunbookNotificationEventRow))
  ].join(''), 'wide');
}

function formatRunbookNotificationEventRow(item) {
  const safeItem = item || {};
  const event = safeItem.event || {};
  return [
    workspaceStatusLabel(safeItem.status || 'unknown'),
    safeItem.actionKey ? '操作 ' + safeItem.actionKey : '未知操作',
    event.id ? '提醒 ' + event.id : '暂无提醒',
    '级别 ' + workspaceStatusLabel(event.severity || 'unknown'),
    safeItem.reason ? '原因 ' + safeItem.reason : undefined
  ].filter(Boolean).join(' · ');
}

function renderSourceAttentionNotificationEventResult(result) {
  const items = result.results || [];
  return panel('来源关注提醒', [
    metric('状态', result.status || '未知'),
    metric('模式', result.dryRun ? '预演' : '执行'),
    metric('来源', result.sourceCount || 0),
    metric('阈值', result.priorityScoreThreshold || 0),
    metric('提醒', result.eventCount || 0),
    metric('新建', result.createdCount || 0),
    metric('更新', result.updatedCount || 0),
    metric('解决', result.resolvedCount || 0),
    metric('重开', result.reopenedCount || 0),
    metric('跳过', result.skippedCount || 0),
    evidenceList(items.map(formatSourceAttentionNotificationEventRow))
  ].join(''), 'wide');
}

function formatSourceAttentionNotificationEventRow(item) {
  const safeItem = item || {};
  const event = safeItem.event || {};
  const source = event.payload && event.payload.source || {};
  const sourceLabel = safeItem.attentionKey || source.displayName || source.id || source.sourceKey || '未知来源';
  return [
    workspaceStatusLabel(safeItem.status || 'unknown'),
    '来源 ' + sourceLabel,
    event.id ? '提醒 ' + event.id : '暂无提醒',
    '级别 ' + workspaceStatusLabel(event.severity || 'unknown'),
    safeItem.reason ? '原因 ' + safeItem.reason : undefined
  ].filter(Boolean).join(' · ');
}

function renderSourceTypeOperationsNotificationEventResult(result) {
  const items = result.results || [];
  return panel('来源类型运行提醒', [
    metric('状态', workspaceStatusLabel(workspaceValue(result.status, 'unknown'))),
    metric('模式', result.dryRun ? '预演' : '执行'),
    metric('来源类型', result.sourceTypeCount || 0),
    metric('阈值', result.priorityScoreThreshold || 0),
    metric('准备度提醒', result.includeReadinessWarnings ? '一并关注' : '暂不加入'),
    metric('提醒', result.eventCount || 0),
    metric('新建', result.createdCount || 0),
    metric('更新', result.updatedCount || 0),
    metric('解决', result.resolvedCount || 0),
    metric('重开', result.reopenedCount || 0),
    metric('跳过', result.skippedCount || 0),
    evidenceList(items.map(formatSourceTypeNotificationEventRow))
  ].join(''), 'wide');
}

function formatSourceTypeNotificationEventRow(item) {
  const safeItem = item || {};
  const event = safeItem.event || {};
  const sourceType = safeItem.sourceType || event.payload && event.payload.sourceType || '未知来源类型';
  return [
    workspaceStatusLabel(safeItem.status || 'unknown'),
    '来源类型 ' + sourceType,
    event.id ? '提醒 ' + event.id : '暂无提醒',
    '级别 ' + workspaceStatusLabel(event.severity || 'unknown'),
    safeItem.reason ? '原因 ' + safeItem.reason : undefined
  ].filter(Boolean).join(' · ');
}

function renderRunbookActionRows(actions) {
  return actions.slice(0, 10).map(function (action) {
    const command = action.recommendedCommand ? '<small>' + escapeHtml(action.recommendedCommand) + '</small>' : '';
    const evidence = action.evidenceSummary || action.evidence && action.evidence.evidenceSummary;
    const evidenceRow = evidence ? '<small>' + escapeHtml('证据 ' + evidence) + '</small>' : '';
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(action.title || action.key) + '</strong>' +
      '<small>' + escapeHtml(action.summary || '') + '</small>' +
      evidenceRow +
      command +
      '</span>' +
      statusBadge(workspaceStatusLabel(action.severity || 'info'), action.severity === 'critical' ? 'fail' : 'warn') +
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

function workspaceValue(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback || '暂无';
  return String(value);
}

function workspaceListText(items, fallback) {
  const values = (items || []).filter(function (item) {
    return item !== undefined && item !== null && item !== '';
  });
  return values.length ? values.join('、') : fallback || '暂无';
}

function workspaceStatusLabel(status) {
  const labels = {
    ok: '正常',
    noop: '无需处理',
    none: '无需处理',
    fail: '失败',
    failed: '失败',
    critical: '严重',
    warn: '需关注',
    warning: '需关注',
    review: '待复核',
    actionable: '可处理',
    preview: '预演',
    info: '信息',
    pending: '待处理',
    running: '运行中',
    completed: '已完成',
    resolved: '已解决',
    delivered: '已投递',
    due: '到期',
    candidate: '候选',
    skip: '暂缓',
    scheduled: '已排期',
    'retry-waiting': '等待重试',
    'failed-waiting': '失败待处理',
    unscheduled: '未排期',
    disabled: '已停用',
    enabled: '已启用',
    found: '已找到',
    missing: '缺失',
    ready: '就绪',
    stale: '停滞',
    expired: '已过期',
    available: '可用',
    unknown: '未知',
    'unknown-status': '未知状态',
    'not-evaluated': '未评估',
    'not-run': '未试跑',
    'never-run': '未运行',
    'not run': '未运行'
  };
  return labels[status] || workspaceValue(status, '未知');
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
  const sourceName = run.source && run.source.displayName ? run.source.displayName : run.sourceId || '未知来源';
  const cursorDiff = run.cursorDiff || {};
  const semantic = run.semantic || {};
  const changed = cursorDiff.changed === undefined ? '未知变化' : (cursorDiff.changed ? '有变化' : '无变化');
  const newPosts = cursorDiff.newPostCount === undefined ? '' : ' · 新增 ' + cursorDiff.newPostCount;
  const semanticLabel = semantic.status ? ' · 语义 ' + semantic.status + (semantic.reason ? ' / ' + semantic.reason : '') : '';
  const timestamp = run.finishedAt || run.updatedAt || run.createdAt || '';
  return run.status + ' · ' + sourceName + ' · ' + changed + newPosts + semanticLabel + ' · ' + timestamp;
}

function renderContextReviewResultSubmission(result) {
  if (result.valid === false) {
    const checks = result.validation && result.validation.checks ? result.validation.checks : [];
    return panel('复核结果未保存', [
      metric('状态', result.status || 'invalid'),
      metric('校验', result.validation ? result.validation.status : 'fail'),
      evidenceList(checks.filter(function (check) {
        return check.status === 'fail';
      }).slice(0, 8).map(function (check) {
        return check.key + ' · ' + check.summary;
      }))
    ].join(''), 'wide');
  }
  const record = result.record || {};
  const summary = record.summary || {};
  return panel('复核结果已保存', [
    metric('记录', record.id || '未知'),
    metric('状态', record.status || 'unknown'),
    metric('交接', record.handoffId || '暂无'),
    metric('级别', summary.notification ? summary.notification.severity : 'unknown'),
    metric('剩余事项', summary.remainingCount || 0),
    metric('下一步', summary.recommendedNextAction || '暂无')
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
    summaryTile('复核', String(overview.count || 0)),
    summaryTile('提醒', String(attention.warningCount || 0), (attention.warningCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('严重', String(attention.criticalCount || 0), (attention.criticalCount || 0) > 0 ? 'fail' : 'ok'),
    summaryTile('剩余事项', String(overview.remainingTaskCount || 0), (overview.remainingTaskCount || 0) > 0 ? 'warn' : 'ok'),
    summaryTile('合并候选', String(overview.mergeCandidateCount || 0), (overview.mergeCandidateCount || 0) > 0 ? 'ok' : 'muted')
  ].join('') + '</div>';
  return [
    panel('复核结果概览', [
      tiles,
      metric('生成时间', overview.generatedAt || '未知'),
      metric('下一步', overview.recommendedNextAction || '暂无')
    ].join(''), 'wide'),
    renderContextReviewResultActionPlan(actionPlan),
    renderContextReviewResultActionGate(actionGate),
    renderContextReviewActionAuditPanel({
      overview: actionAuditOverview,
      audits: actionAudits.audits || []
    }),
    panel('复核关注', renderContextReviewAttentionRows(attention.topRecords || []), 'wide'),
    panel('最近复核结果', renderContextReviewResultRows(records), 'wide')
  ].join('');
}

function renderContextReviewResultActionPlan(plan) {
  const risk = plan.risk || {};
  const attention = plan.attention || {};
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('可关闭', String((plan.closeTaskIds || []).length), (plan.closeTaskIds || []).length > 0 ? 'ok' : 'muted'),
    summaryTile('保持打开', String((plan.keepOpenTaskIds || []).length), (plan.keepOpenTaskIds || []).length > 0 ? 'warn' : 'ok'),
    summaryTile('合并候选', String((plan.mergeCandidates || []).length), (plan.mergeCandidates || []).length > 0 ? 'ok' : 'muted'),
    summaryTile('受阻', String((plan.blockedTasks || []).length), (plan.blockedTasks || []).length > 0 ? 'warn' : 'ok'),
    summaryTile('冲突', String((attention.conflictTaskIds || []).length), (attention.conflictTaskIds || []).length > 0 ? 'fail' : 'ok')
  ].join('') + '</div>';
  return panel('复核动作计划', [
    tiles,
    metric('生成时间', plan.generatedAt || '未知'),
    metric('风险', risk.level || '未知'),
    metric('下一步', plan.recommendedNextAction || '暂无'),
    '<h4>合并候选</h4>',
    renderReviewMergeCandidateRows(plan.mergeCandidates || []),
    '<h4>受阻任务</h4>',
    renderReviewBlockedTaskRows(plan.blockedTasks || [])
  ].join(''), 'wide');
}

function renderContextReviewResultActionGate(gateReport) {
  const executable = gateReport.executable || {};
  const gates = gateReport.gates || [];
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('门禁状态', gateReport.status || '未知', statusVariant(gateReport.status)),
    summaryTile('可关闭', executable.canCloseTasks ? '是' : '否', executable.canCloseTasks ? 'ok' : 'muted'),
    summaryTile('可合并', executable.canMergeContext ? '是' : '否', executable.canMergeContext ? 'ok' : 'muted'),
    summaryTile('人工复核', executable.requiresHumanReview ? '是' : '否', executable.requiresHumanReview ? 'warn' : 'ok'),
    summaryTile('下一步', String((gateReport.nextActions || []).length), (gateReport.nextActions || []).length > 0 ? 'warn' : 'ok')
  ].join('') + '</div>';
  return panel('复核动作门禁', [
    tiles,
    metric('生成时间', gateReport.generatedAt || '未知'),
    metric('下一步', gateReport.recommendedNextAction || '暂无'),
    renderReviewActionGateRows(gates)
  ].join(''), 'wide');
}

function renderContextReviewActionApplyResult(result) {
  const task = result.task || {};
  const report = result.report || {};
  return panel('复核动作应用', [
    metric('任务', workspaceValue(task.id, '暂无')),
    metric('任务状态', workspaceStatusLabel(task.status)),
    metric('报告', workspaceStatusLabel(report.status)),
    metric('模式', report.dryRun ? '预演' : '执行'),
    metric('已执行', report.executed ? '是' : '否'),
    metric('已应用', report.applied ? '是' : '否'),
    metric('关闭任务', report.closeTaskCount || 0),
    metric('合并候选', report.mergeCandidateCount || 0),
    renderReviewActionApplyStepRows(report.steps || [])
  ].join(''), 'wide');
}

function renderContextReviewActionAuditPanel(result) {
  const overview = result.overview || {};
  const audits = result.audits || overview.recentAudits || [];
  const sourceSummary = compactCountMap(overview.bySourceKey);
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('审计', String(overview.count || audits.length || 0), (overview.count || audits.length || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('任务', String(overview.taskCount || 0), (overview.taskCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('计划关闭', String(overview.plannedClosureCount || 0), (overview.plannedClosureCount || 0) > 0 ? 'ok' : 'muted'),
    summaryTile('计划合并', String(overview.plannedMergeCandidateCount || 0), (overview.plannedMergeCandidateCount || 0) > 0 ? 'ok' : 'muted')
  ].join('') + '</div>';
  return panel('复核审计', [
    tiles,
    metric('生成时间', overview.generatedAt || '未知'),
    metric('最新审计', overview.latestGeneratedAt || '暂无'),
    metric('来源', sourceSummary),
    metric('下一步', overview.recommendedNextAction || '暂无'),
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
    summaryTile('状态', workspaceStatusLabel(result.status || 'ok'), statusVariant(result.status || 'ok')),
    summaryTile('执行', String(result.count || executions.length || 0), executions.length > 0 ? 'ok' : 'muted'),
    summaryTile('完成', String(completed), completed > 0 ? 'ok' : 'muted'),
    summaryTile('运行中', String(running), running > 0 ? 'warn' : 'muted'),
    summaryTile('停滞', String(staleRunning), staleRunning > 0 ? 'fail' : 'muted'),
    summaryTile('失败', String(failed), failed > 0 ? 'fail' : 'muted')
  ].join('') + '</div>';
  return panel('复核执行', [
    tiles,
    metric('生成时间', workspaceValue(result.generatedAt, '未知')),
    metric('停滞窗口', result.runningStaleAfterMs === undefined ? '未知' : formatDurationMs(result.runningStaleAfterMs)),
    metric('来源', compactCountMap(result.bySourceKey)),
    metric('停滞来源', compactCountMap(result.staleRunningBySourceKey)),
    result.message ? '<div class="muted">' + escapeHtml(result.message) + '</div>' : '',
    renderContextReviewActionExecutionRows(executions)
  ].join(''), 'wide');
}

function renderContextReviewActionExecutorDiagnostics(result) {
  const methods = result.methods || {};
  const audit = result.audit || {};
  const tiles = '<div class="summary-strip event-summary-strip">' + [
    summaryTile('状态', workspaceStatusLabel(result.status), statusVariant(result.status)),
    summaryTile('模式', workspaceValue(result.mode, '暂无'), result.ready ? 'ok' : 'warn'),
    summaryTile('就绪', result.ready ? '是' : '否', result.ready ? 'ok' : 'warn'),
    summaryTile('仅预演', result.dryRunOnly ? '是' : '否', result.dryRunOnly ? 'warn' : 'ok'),
    summaryTile('审计', String(audit.count || 0), (audit.count || 0) > 0 ? 'ok' : 'muted')
  ].join('') + '</div>';
  return panel('复核执行诊断', [
    tiles,
    metric('来源', workspaceValue(result.source, '未知')),
    metric('会改写真值', result.mutatesSourceTruth ? '是' : '否'),
    metric('关闭任务能力', methods.closeTasks ? '可用' : '缺失'),
    metric('合并上下文能力', methods.mergeContext ? '可用' : '缺失'),
    metric('最新审计', audit.latestGeneratedAt || '暂无'),
    '<h4>检查项</h4>',
    renderDiagnosticCheckRows(result.checks || []),
    '<h4>下一步</h4>',
    evidenceList((result.nextActions || []).map(function (action) {
      return [
        '级别 ' + workspaceStatusLabel(action.severity || 'info'),
        action.key ? '建议 ' + action.key : undefined,
        action.summary
      ].filter(Boolean).join(' · ');
    }))
  ].join(''), 'wide');
}

function renderContextReviewResultEventSynthesis(result) {
  const rows = result.results || [];
  return panel('复核提醒整理', [
    metric('模式', result.dryRun ? '预演' : '执行'),
    metric('复核结果', result.reviewResultCount || 0),
    metric('动作', result.actionCount || 0),
    metric('新建', result.createdCount || 0),
    metric('更新', result.updatedCount || 0),
    metric('跳过', result.skippedCount || 0),
    evidenceList(rows.map(function (item) {
      const event = item.event || {};
      return [
        workspaceStatusLabel(item.status || 'unknown'),
        item.recordId ? '记录 ' + item.recordId : '未知记录',
        event.id ? '提醒 ' + event.id : '暂无提醒',
        '级别 ' + workspaceStatusLabel(event.severity || 'unknown'),
        item.reason ? '原因 ' + item.reason : undefined
      ].filter(Boolean).join(' · ');
    }))
  ].join(''), 'wide');
}

function renderContextReviewAttentionRows(records) {
  if (records.length === 0) return '<div class="muted">暂无需要关注的复核结果。</div>';
  return records.map(function (record) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(workspaceStatusLabel(record.status || 'unknown') + ' · ' + (record.handoffId || record.id || '未知记录')) + '</strong>' +
      '<small>' + escapeHtml(record.reason || '需要关注') + '</small>' +
      '<small>' + escapeHtml(record.recommendedNextAction || '') + '</small>' +
      '</span>' +
      statusBadge(workspaceStatusLabel(record.severity || 'info'), statusVariant(record.severity)) +
      '</div>';
  }).join('');
}

function renderContextReviewResultRows(records) {
  if (records.length === 0) return '<div class="muted">暂无已提交的复核结果。</div>';
  return records.map(function (record) {
    const summary = record.summary || {};
    const notification = summary.notification || {};
    const reviewer = record.reviewer || {};
    const details = [
      record.id,
      record.submittedAt,
      reviewer.id ? '复核人 ' + reviewer.id : undefined,
      '剩余 ' + (summary.remainingCount || 0),
      '合并候选 ' + (Array.isArray(summary.mergeCandidates) ? summary.mergeCandidates.length : 0)
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(workspaceStatusLabel(record.status || 'unknown') + ' · ' + (record.handoffId || '无交接')) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(summary.recommendedNextAction || '') + '</small>' +
      '</span>' +
      statusBadge(workspaceStatusLabel(notification.severity || 'info'), statusVariant(notification.severity)) +
      '</div>';
  }).join('');
}

function renderReviewMergeCandidateRows(candidates) {
  if (candidates.length === 0) return '<div class="muted">暂无合并候选。</div>';
  return candidates.slice(0, 10).map(function (candidate) {
    const details = [
      candidate.recordId ? '记录 ' + candidate.recordId : undefined,
      candidate.taskType ? '任务 ' + candidate.taskType : undefined,
      candidate.decision ? '决定 ' + candidate.decision : undefined,
      candidate.confidence === undefined ? undefined : '可信度 ' + candidate.confidence
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(candidate.taskId || '未知任务') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(candidate.rationale || '') + '</small>' +
      '</span>' +
      statusBadge(workspaceStatusLabel(candidate.severity || 'info'), statusVariant(candidate.severity)) +
      '</div>';
  }).join('');
}

function renderReviewBlockedTaskRows(tasks) {
  if (tasks.length === 0) return '<div class="muted">暂无受阻事项。</div>';
  return tasks.slice(0, 10).map(function (task) {
    const details = [
      task.recordId ? '记录 ' + task.recordId : undefined,
      task.taskType ? '任务 ' + task.taskType : undefined,
      task.decision ? '决定 ' + task.decision : undefined,
      task.confidence === undefined ? undefined : '可信度 ' + task.confidence
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(task.taskId || '未知任务') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(task.reason || '') + '</small>' +
      '</span>' +
      statusBadge(workspaceStatusLabel(task.severity || 'warning'), statusVariant(task.severity || 'warning')) +
      '</div>';
  }).join('');
}

function renderReviewActionGateRows(gates) {
  if (gates.length === 0) return '<div class="muted">暂无复核门禁。</div>';
  return gates.map(function (gate) {
    const evidence = gate.evidence || {};
    const details = Object.keys(evidence).slice(0, 4).map(function (key) {
      const value = Array.isArray(evidence[key]) ? evidence[key].length : evidence[key];
      return key + ' ' + value;
    }).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(gate.key || '未知门禁') + '</strong>' +
      '<small>' + escapeHtml(gate.summary || '') + '</small>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' +
      statusBadge(workspaceStatusLabel(gate.status || 'warn'), statusVariant(gate.status)) +
      '</div>';
  }).join('');
}

function renderReviewActionApplyStepRows(steps) {
  if (steps.length === 0) return '<div class="muted">暂无应用步骤。</div>';
  return steps.map(function (step) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(step.key || '未知步骤') + '</strong>' +
      '<small>' + escapeHtml(step.summary || '') + '</small>' +
      '</span>' +
      statusBadge(workspaceStatusLabel(step.status || 'warn'), statusVariant(step.status)) +
      '</div>';
  }).join('');
}

function renderDiagnosticCheckRows(checks) {
  if (checks.length === 0) return '<div class="muted">暂无诊断检查。</div>';
  return checks.map(function (check) {
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(check.key || '未知检查') + '</strong>' +
      '<small>' + escapeHtml(check.summary || '') + '</small>' +
      '<small>' + escapeHtml(check.value === undefined ? '' : String(check.value)) + '</small>' +
      '</span>' +
      statusBadge(workspaceStatusLabel(check.status || 'warn'), statusVariant(check.status)) +
      '</div>';
  }).join('');
}

function renderContextReviewActionAuditRows(audits) {
  if (audits.length === 0) return '<div class="muted">暂无复核动作审计。</div>';
  return audits.map(function (audit) {
    const request = audit.request || {};
    const details = [
      audit.generatedAt,
      audit.sourceKey ? '来源 ' + audit.sourceKey : undefined,
      audit.sourceId ? '来源 ID ' + audit.sourceId : undefined,
      request.taskId ? '任务 ' + request.taskId : undefined,
      request.closeTaskIds ? '关闭 ' + request.closeTaskIds.length : undefined,
      request.mergeCandidates ? '合并候选 ' + request.mergeCandidates.length : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(audit.action || '未知动作') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(audit.filePath || '') + '</small>' +
      '</span>' +
      statusBadge(audit.adapter || '文件审计', 'ok') +
      '</div>';
  }).join('');
}

function renderContextReviewActionExecutionRows(executions) {
  if (executions.length === 0) return '<div class="muted">暂无复核动作执行记录。</div>';
  return executions.map(function (execution) {
    const details = [
      execution.updatedAt || execution.createdAt,
      execution.sourceKey ? '来源 ' + execution.sourceKey : undefined,
      execution.sourceId ? '来源 ID ' + execution.sourceId : undefined,
      execution.taskId ? '任务 ' + execution.taskId : undefined,
      execution.requestHash ? '请求 ' + String(execution.requestHash).slice(0, 12) : undefined,
      execution.attemptCount ? '尝试 ' + execution.attemptCount : undefined,
      execution.runningAgeMs === undefined ? undefined : '运行 ' + formatDurationMs(execution.runningAgeMs)
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(execution.action || '未知动作') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '<small>' + escapeHtml(execution.key || '') + '</small>' +
      '<small>' + escapeHtml(execution.filePath || '') + '</small>' +
      '</span>' +
      statusBadge(execution.staleRunning ? '停滞运行' : workspaceStatusLabel(execution.status), execution.staleRunning ? 'fail' : statusVariant(execution.status)) +
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
    panel('提醒详情', [
      '<div class="summary-strip event-summary-strip">' + [
        summaryTile('状态', workspaceStatusLabel(event.deliveryStatus || 'pending'), statusVariant(event.deliveryStatus || 'pending')),
        summaryTile('级别', workspaceStatusLabel(event.severity || 'unknown'), statusVariant(event.severity)),
        summaryTile('类型', notificationEventTypeLabel(event.type)),
        summaryTile('来源', sourceScope.sourceId || sourceScope.sourceKey || '未绑定', sourceScope.sourceId || sourceScope.sourceKey ? 'ok' : 'muted')
      ].join('') + '</div>',
      metric('提醒 ID', event.id || '暂无'),
      metric('创建时间', event.createdAt || '暂无'),
      metric('下次投递', event.nextDeliveryAt || '暂无'),
      metric('尝试次数', event.deliveryAttempts || 0),
      metric('确认状态', event.acknowledgedAt || '未确认'),
      metric('来源范围', formatTaskSourceScope(sourceScope)),
      metric('关联任务', relatedTask.id ? relatedTask.id + (relatedTask.missing ? '（未找到）' : ' · ' + [workspaceStatusLabel(relatedTask.status), relatedTask.type].filter(Boolean).join(' / ')) : '无'),
      renderNotificationEventDetailButtons(result)
    ].join(''), 'wide'),
    panel('动作准备', renderNotificationEventActionReadiness(result.actionReadiness), 'wide'),
    panel('建议动作', renderNotificationEventDetailActions(result.nextActions || [], event.id), 'wide'),
    panel('提醒证据', '<pre>' + escapeHtml(JSON.stringify({
      title: event.title,
      summary: event.summary,
      payload: event.payload,
      deliveryResult: event.deliveryResult,
      lastDeliveryError: event.lastDeliveryError
    }, null, 2)) + '</pre>', 'wide')
  ].join('');
}

function renderNotificationEventActionReadiness(readiness) {
  if (!readiness) return '<div class="muted">暂无动作准备报告。</div>';
  const gates = readiness.gates || [];
  return [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('状态', workspaceStatusLabel(readiness.status || 'unknown'), statusVariant(readiness.status)),
      summaryTile('检查项', readiness.gateCount || gates.length),
      summaryTile('提醒', readiness.warningCount || 0, readiness.warningCount ? 'warn' : 'ok'),
      summaryTile('可执行', (readiness.executableActionKeys || []).length)
    ].join('') + '</div>',
    gates.map(function (gate) {
      return '<div class="action-row ops-row"><span>' +
        '<strong>' + escapeHtml(notificationEventGateTitle(gate)) + '</strong>' +
        '<small>' + escapeHtml(gate.summary || '这项检查没有返回额外说明。') + '</small>' +
        '<small>' + escapeHtml(notificationEventGateDetails(gate)) + '</small>' +
        '</span>' +
        statusBadge(workspaceStatusLabel(gate.status || 'unknown'), gate.status === 'warn' ? 'warn' : statusVariant(gate.status)) +
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
    (relatedTask.id ? '<button class="inline-button secondary-inline-button" type="button" data-action="load-task-detail" data-task-id="' + escapeHtml(relatedTask.id) + '" data-trace-limit="20">关联任务</button>' : '') +
    (event.acknowledgedAt ? '' : '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id || '') + '">确认提醒</button>') +
    '</div>';
}

function renderNotificationEventDetailActions(actions, eventId) {
  if (!actions.length) return '<div class="muted">暂无建议动作。</div>';
  return actions.map(function (action) {
    const intentButton = eventId && action.key
      ? '<button class="inline-button secondary-inline-button" type="button" data-action="prepare-event-action-intent" data-event-id="' + escapeHtml(eventId) + '" data-action-key="' + escapeHtml(action.key) + '">预演</button>'
      : '';
    const executeButton = eventId && action.key === 'event.acknowledge'
      ? '<button class="inline-button" type="button" data-action="execute-event-action" data-event-id="' + escapeHtml(eventId) + '" data-action-key="' + escapeHtml(action.key) + '">执行确认</button>'
      : '';
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(notificationEventActionLabel(action)) + '</strong>' +
      '<small>' + escapeHtml(notificationEventActionDetails(action)) + '</small>' +
      '<small>' + escapeHtml(action.summary || '查看这项提醒建议，并保留动作证据。') + '</small>' +
      (action.command ? '<small>' + escapeHtml(action.command) + '</small>' : '') +
      '</span>' +
      '<span class="button-group source-op-buttons">' +
      intentButton +
      executeButton +
      statusBadge(workspaceStatusLabel(action.severity || 'info'), action.severity === 'warning' ? 'warn' : statusVariant(action.severity)) +
      '</span>' +
      '</div>';
  }).join('');
}

function notificationEventTypeLabel(type) {
  const labels = {
    'author-review': '作者复核',
    'context-review-result': '上下文复核',
    'runbook-action': '操作提醒',
    'source-attention': '来源关注',
    'source-type-operations': '来源类型',
    'system-readiness': '工作区状态'
  };
  return labels[type] || workspaceValue(type, '未知类型');
}

function notificationEventGateTitle(gate) {
  const safeGate = gate || {};
  const labels = {
    acknowledged: '确认状态',
    delivered: '投递状态',
    event: '提醒记录',
    'event-exists': '提醒记录',
    'event-open': '提醒仍需处理',
    'event-source-scope': '来源范围',
    'event-task-scope': '任务关联',
    'not-acknowledged': '尚未确认',
    source: '来源范围',
    task: '任务关联'
  };
  return labels[safeGate.key] || safeGate.title || '提醒检查';
}

function notificationEventGateDetails(gate) {
  const safeGate = gate || {};
  return [
    '状态 ' + workspaceStatusLabel(safeGate.status || 'unknown'),
    safeGate.key ? '检查 ' + safeGate.key : undefined
  ].filter(Boolean).join(' · ');
}

function notificationEventActionLabel(action) {
  const safeAction = action || {};
  const labels = {
    'event.acknowledge': '确认提醒',
    'event.dispatch': '投递提醒',
    'event.source-drilldown': '查看来源路径',
    'event.task-detail': '查看任务路径'
  };
  return safeAction.title || labels[safeAction.key] || safeAction.summary || '提醒动作';
}

function notificationEventActionDetails(action) {
  const safeAction = action || {};
  return [
    '重要程度 ' + workspaceStatusLabel(safeAction.severity || 'info'),
    safeAction.key ? '动作 ' + safeAction.key : undefined
  ].filter(Boolean).join(' · ');
}

function notificationEventModeLabel(mode) {
  const labels = {
    'dry-run': '预演',
    preview: '预演',
    execute: '执行',
    executed: '已执行'
  };
  return labels[mode] || workspaceStatusLabel(mode);
}

function renderNotificationEventActionIntent(result) {
  if (result && result.error) {
    return panel('动作预演失败', [
      metric('代码', result.error.code || 'error'),
      metric('说明', result.error.message || '动作预演无法准备。')
    ].join(''), 'wide');
  }
  const intent = result.intent || {};
  const api = intent.api || {};
  const gate = result.readinessGate || {};
  const ledger = result.ledger || {};
  const executionLedger = result.executionLedger || {};
  const executed = result.executed === true;
  return [
    panel(executed ? '提醒动作已执行' : '提醒动作预演', [
      '<div class="summary-strip event-summary-strip">' + [
        summaryTile('状态', workspaceStatusLabel(workspaceValue(result.status, 'unknown')), statusVariant(result.status)),
        summaryTile('模式', notificationEventModeLabel(result.mode || 'dry-run'), 'ok'),
        summaryTile('已执行', executed ? '是' : '否', executed ? 'warn' : 'ok'),
        summaryTile('动作', notificationEventActionLabel(result.action))
      ].join('') + '</div>',
      metric('意图 ID', intent.id || '暂无'),
      metric('提醒 ID', result.event && result.event.id || intent.eventId || '暂无'),
      metric('执行者', intent.actor || '工作区'),
      metric('原因', intent.reason || '暂无'),
      metric('审计记录', ledger.recorded ? ledger.recordId || '已记录' : ledger.reason || '未记录'),
      metric('执行记录', executionLedger.recorded ? [workspaceStatusLabel(executionLedger.status), executionLedger.key, executionLedger.replayed ? '已复用' : '新记录'].filter(Boolean).join(' · ') : executionLedger.reason || '未记录'),
      metric('接口计划', [api.method, api.path].filter(Boolean).join(' ') || '无需接口'),
      metric('命令', intent.command || '暂无'),
      metric('确认时间', result.event && result.event.acknowledgedAt || '暂无'),
      metric('门禁', gate.key ? workspaceStatusLabel(gate.status) + ' · ' + gate.key + ' · ' + gate.summary : '暂无')
    ].join(''), 'wide'),
    panel('动作证据', '<pre>' + escapeHtml(JSON.stringify({
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
  const sourceSummary = compactCountMap(overview.bySourceKey);
  return panel('提醒箱概览', [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('状态', workspaceStatusLabel(workspaceValue(overview.status, 'unknown')), statusVariant(overview.status)),
      summaryTile('窗口', String(overview.eventCount || 0)),
      summaryTile('未确认', String(overview.unacknowledgedCount || 0), overview.unacknowledgedCount > 0 ? 'warn' : 'ok'),
      summaryTile('到期', String(overview.dueForDeliveryCount || 0), overview.dueForDeliveryCount > 0 ? 'warn' : 'ok'),
      summaryTile('失败', String(overview.failedCount || 0), overview.failedCount > 0 ? 'fail' : 'ok')
    ].join('') + '</div>',
    metric('投递状态', formatStanceSummary(overview.byDeliveryStatus)),
    metric('未确认状态', formatStanceSummary(overview.byOpenDeliveryStatus)),
    metric('提醒类型', formatStanceSummary(overview.byType)),
    metric('级别', formatStanceSummary(overview.bySeverity)),
    metric('来源', sourceSummary === 'none' ? '暂无' : sourceSummary),
    metric('未确认来源', compactCountMap(overview.byOpenSourceKey)),
    metric('下次投递', overview.nextDeliveryAt || '暂无'),
    metric('最早未确认', overview.oldestUnacknowledgedAt || '暂无'),
    metric('下一步', overview.recommendedNextAction || '暂无'),
    renderNotificationSourceHotspots(overview.sourceHotspots || []),
    evidenceList((attention.failedEvents || []).slice(0, 5).map(function (event) {
      return notificationLegacyAttentionLine(event, 'failed');
    }).concat((attention.reviewableEvents || []).slice(0, 5).map(function (event) {
      return notificationLegacyAttentionLine(event, 'reviewable');
    })))
  ].join(''), 'wide');
}

function notificationLegacyAttentionLine(event, kind) {
  const safeEvent = event || {};
  const details = [
    workspaceStatusLabel(workspaceValue(safeEvent.deliveryStatus, kind === 'failed' ? 'failed' : 'delivered')),
    notificationEventTypeLabel(safeEvent.type),
    safeEvent.id ? '提醒 ' + safeEvent.id : undefined,
    kind === 'failed' ? '尝试 ' + String(safeEvent.deliveryAttempts || 0) : undefined,
    kind === 'reviewable' ? '待复核' : undefined
  ];
  return details.filter(Boolean).join(' · ');
}

function renderNotificationSynthesisPolicyLegacy(policy) {
  const defaults = policy.defaults || {};
  return panel('提醒生成规则', [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('预演', defaults.dryRun ? '是' : '否', defaults.dryRun ? 'ok' : 'warn'),
      summaryTile('提醒级别', String((defaults.alertSeverities || []).length), 'warn'),
      summaryTile('来源阈值', String(defaults.sourceAttentionPriorityScoreThreshold || 0), 'warn'),
      summaryTile('提醒类型', String((policy.eventTypes || []).length), 'ok')
    ].join('') + '</div>',
    metric('不改动状态', workspaceListText(defaults.immutableExistingStates)),
    metric('可变更状态', workspaceListText(defaults.mutationStatuses)),
    metric('下一步', policy.recommendedNextAction || '暂无'),
    renderNotificationSynthesisPolicyRows(policy.eventTypes || []),
    evidenceList((policy.sharedRules || []).map(function (rule) {
      return notificationPolicyRuleSummary(rule);
    }))
  ].join(''), 'wide');
}

function renderNotificationSynthesisPolicyRowsLegacy(eventTypes) {
  if (!eventTypes.length) return '<div class="muted">暂无提醒生成规则。</div>';
  return '<div class="source-hotspot-list">' + eventTypes.map(function (item) {
    const rules = (item.alertRules || []).map(function (rule) {
      return notificationPolicyRuleSummary(rule);
    }).join('；');
    const details = [
      item.sourceScoped ? '按来源' : '全局',
      item.staleResolution ? '会维护过期提醒' : '不自动维护过期提醒',
      item.reopensAutoResolved ? '信号回来会重新打开' : '不自动重开',
      item.preservesDeliveryState ? '保留投递状态' : undefined,
      rules ? '规则 ' + rules : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(notificationEventTypeLabel(item.type)) + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</span>' +
      statusBadge(item.staleResolution ? '自动维护' : '直接生成', item.staleResolution ? 'ok' : 'muted') +
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
  const title = event.title || event.summary || event.id || '未命名提醒';
  const summary = event.summary && event.summary !== title ? '<small>' + escapeHtml(event.summary) + '</small>' : '';
  const meta = eventMetadata(event).join(' · ');
  const controls = '<span class="button-group source-op-buttons">' +
    renderEventSourceDrilldownButton(event) +
    '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id) + '"' + disabled + '>' + ackLabel + '</button>' +
    '</span>';
  return '<div class="action-row event-row"><span><strong>' + escapeHtml(title) + '</strong>' + summary + '<small>' + escapeHtml(meta) + '</small></span>' + controls + '</div>';
}

function renderNotificationEventRowLegacy2(event) {
  const ackLabel = event.acknowledgedAt ? '已确认' : '确认提醒';
  const disabled = event.acknowledgedAt ? ' disabled' : '';
  const title = event.title || event.summary || event.id || '未命名提醒';
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
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-event-detail" data-event-id="' + escapeHtml(event.id) + '">详情</button>';
}

function renderEventTaskDetailButton(event) {
  if (!event || !event.taskId) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-task-detail" data-task-id="' + escapeHtml(event.taskId) + '" data-trace-limit="20">任务</button>';
}

function renderNotificationSourceHotspotsLegacy(hotspots) {
  if (!hotspots.length) return '';
  return '<div class="source-hotspot-list">' + hotspots.slice(0, 5).map(function (hotspot) {
    const details = [
      '未读 ' + (hotspot.openCount || 0),
      '失败 ' + (hotspot.failedCount || 0),
      '到期 ' + (hotspot.dueForDeliveryCount || 0),
      '耗尽 ' + (hotspot.retryExhaustedCount || 0),
      hotspot.oldestUnacknowledgedAt ? '最早 ' + hotspot.oldestUnacknowledgedAt : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row ops-row"><span>' +
      '<strong>' + escapeHtml(hotspot.sourceKey || hotspot.sourceId || '未知来源') + '</strong>' +
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
  const title = '提醒流 · ' + currentEventFilterSummary();
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
          '<span class="notification-outbox-label">提醒箱</span>',
          statusBadge(workspaceStatusLabel(workspaceValue(overview.status, 'unknown')), statusVariant(overview.status)),
        '</div>',
        '<h3>' + escapeHtml(overview.recommendedNextAction || '当前窗口内没有需要处理的提醒。') + '</h3>',
        '<p>' + escapeHtml([
          '投递=' + formatStanceSummary(overview.byDeliveryStatus),
          '级别 ' + formatStanceSummary(overview.bySeverity),
          '来源 ' + compactCountMap(overview.bySourceKey)
        ].filter(Boolean).join(' · ')) + '</p>',
      '</section>',
      '<aside class="notification-outbox-signals">',
        notificationOutboxSignal('窗口', overview.eventCount || 0, (overview.eventCount || 0) > 0 ? 'info' : 'muted'),
        notificationOutboxSignal('未读', overview.unacknowledgedCount || 0, (overview.unacknowledgedCount || 0) > 0 ? 'warn' : 'ok'),
        notificationOutboxSignal('到期', overview.dueForDeliveryCount || 0, (overview.dueForDeliveryCount || 0) > 0 ? 'warn' : 'ok'),
        notificationOutboxSignal('失败', overview.failedCount || 0, (overview.failedCount || 0) > 0 ? 'fail' : 'ok'),
      '</aside>',
      '<section class="notification-outbox-next">',
        '<span>时间</span>',
        '<strong>' + escapeHtml(overview.nextDeliveryAt || '暂无排期投递') + '</strong>',
        '<small>' + escapeHtml('最早未读 ' + workspaceValue(overview.oldestUnacknowledgedAt, '暂无') + ' · 未读来源 ' + compactCountMap(overview.byOpenSourceKey)) + '</small>',
      '</section>',
      '<section class="notification-outbox-attention">',
        '<span>关注队列</span>',
        (attentionRows.length ? attentionRows.join('') : '<div class="notification-outbox-empty">暂无失败或待复核提醒。</div>'),
      '</section>',
      renderNotificationSourceHotspots(overview.sourceHotspots || []),
    '</article>'
  ].join('');
}

function renderNotificationDispatchPreview(overview) {
  const safeOverview = overview || {};
  const dueCount = safeOverview.dueForDeliveryCount || 0;
  const failedCount = safeOverview.failedCount || 0;
  const retryExhaustedCount = safeOverview.retryExhaustedCount || 0;
  const candidateCount = dueCount + failedCount;
  const command = 'node src/presentation/cli/threadtrace.js dispatch-events --limit 50';
  const hotspotRows = (safeOverview.sourceHotspots || []).slice(0, 5).map(function (hotspot) {
    return (hotspot.sourceKey || '未知来源') +
      ' · 到期 ' + (hotspot.dueForDeliveryCount || 0) +
      ' · 失败 ' + (hotspot.failedCount || 0) +
      ' · 未读 ' + (hotspot.openCount || 0);
  });
  return panel('提醒投递预览', [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('模式', '预演', 'warn'),
      summaryTile('候选', String(candidateCount), candidateCount > 0 ? 'warn' : 'ok'),
      summaryTile('到期', String(dueCount), dueCount > 0 ? 'warn' : 'ok'),
      summaryTile('失败', String(failedCount), failedCount > 0 ? 'fail' : 'ok'),
      summaryTile('重试耗尽', String(retryExhaustedCount), retryExhaustedCount > 0 ? 'fail' : 'ok')
    ].join('') + '</div>',
    metric('副作用', '无'),
    metric('渠道准备', safeOverview.channelStatus || safeOverview.channel || '未评估'),
    metric('下次投递', safeOverview.nextDeliveryAt || '暂无'),
    metric('复核后命令', command),
    metric('下一步', dispatchPreviewNextAction(safeOverview)),
    evidenceList(hotspotRows)
  ].join(''), 'wide');
}

function dispatchPreviewNextAction(overview) {
  const safeOverview = overview || {};
  if ((safeOverview.retryExhaustedCount || 0) > 0) return '正式投递前先检查重试耗尽的提醒。';
  if ((safeOverview.failedCount || 0) > 0) return '确认渠道健康后，可以重试失败提醒。';
  if ((safeOverview.dueForDeliveryCount || 0) > 0) return '当前窗口有到期提醒，可以从提醒处理或命令行投递。';
  return safeOverview.recommendedNextAction || '当前窗口没有可投递提醒。';
}

function notificationOutboxSignal(label, value, variant) {
  return '<div class="notification-outbox-signal ' + statusClassName(variant) + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function notificationOutboxAttentionRow(event, label) {
  const labelText = {
    failed: '失败',
    reviewable: '待复核'
  }[label] || label;
  return '<div class="notification-outbox-attention-row">' +
    '<strong>' + escapeHtml(notificationEventTypeLabel(event.type)) + '</strong>' +
    '<small>' + escapeHtml([labelText, workspaceStatusLabel(workspaceValue(event.deliveryStatus, 'unknown')), event.id ? '提醒 ' + event.id : undefined, event.deliveryAttempts === undefined ? undefined : '尝试 ' + event.deliveryAttempts].filter(Boolean).join(' · ')) + '</small>' +
    '</div>';
}

function renderNotificationSynthesisPolicy(policy) {
  const defaults = policy.defaults || {};
  return panel('提醒生成规则', [
    '<div class="notification-policy-shell">',
      '<section class="notification-policy-head">',
        '<span>规则保护</span>',
        '<strong>' + escapeHtml(policy.recommendedNextAction || '创建提醒前先预演，确认不会重复打扰。') + '</strong>',
        '<small>' + escapeHtml('保留状态 ' + workspaceListText(defaults.immutableExistingStates) + ' · 可变更 ' + workspaceListText(defaults.mutationStatuses)) + '</small>',
      '</section>',
      '<div class="summary-strip event-summary-strip notification-policy-summary">' + [
        summaryTile('预演', defaults.dryRun ? '是' : '否', defaults.dryRun ? 'ok' : 'warn'),
        summaryTile('提醒级别', String((defaults.alertSeverities || []).length), 'warn'),
        summaryTile('来源阈值', String(defaults.sourceAttentionPriorityScoreThreshold || 0), 'warn'),
        summaryTile('提醒类型', String((policy.eventTypes || []).length), 'ok')
      ].join('') + '</div>',
      renderNotificationSynthesisPolicyRows(policy.eventTypes || []),
      '<div class="notification-policy-rules">' + (policy.sharedRules || []).map(function (rule) {
        return '<span>' + escapeHtml(notificationPolicyRuleSummary(rule)) + '</span>';
      }).join('') + '</div>',
    '</div>'
  ].join(''), 'wide');
}

function renderNotificationSynthesisPolicyRows(eventTypes) {
  if (!eventTypes.length) return '<div class="muted">暂无提醒生成规则。</div>';
  return '<div class="notification-policy-list">' + eventTypes.map(function (item) {
    const rules = (item.alertRules || []).map(function (rule) {
      return notificationPolicyRuleSummary(rule);
    }).join('；');
    const details = [
      item.staleResolution ? '会维护过期提醒' : '不自动维护过期提醒',
      item.reopensAutoResolved ? '信号回来会重新打开' : '不自动重开',
      item.preservesDeliveryState ? '保留投递状态' : undefined,
      rules ? '规则 ' + rules : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="notification-policy-row">' +
      '<section>' +
        '<span class="notification-policy-type">' + escapeHtml(item.sourceScoped ? '按来源' : '全局') + '</span>' +
        '<strong>' + escapeHtml(notificationEventTypeLabel(item.type)) + '</strong>' +
        '<small>' + escapeHtml(details) + '</small>' +
      '</section>' +
      '<div class="notification-policy-state">' +
        statusBadge(item.staleResolution ? '自动维护' : '直接生成', item.staleResolution ? 'ok' : 'muted') +
      '</div>' +
      '</div>';
  }).join('') + '</div>';
}

function notificationPolicyRuleSummary(rule) {
  const safeRule = rule || {};
  return [
    safeRule.summary || safeRule.key || '提醒规则',
    safeRule.threshold === undefined ? undefined : '阈值 ' + safeRule.threshold,
    safeRule.key ? '规则 ' + safeRule.key : undefined
  ].filter(Boolean).join(' · ');
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
  const ackLabel = event.acknowledgedAt ? '已确认' : '确认提醒';
  const disabled = event.acknowledgedAt ? ' disabled' : '';
  const title = event.title || event.summary || event.id || '未命名提醒';
  const summary = event.summary && event.summary !== title ? event.summary : '这条提醒正在当前窗口等待处理。';
  const source = formatNotificationSourceLabel(event);
  const controls = '<section class="notification-event-actions button-group source-op-buttons">' +
    renderEventDetailButtonControl(event) +
    renderEventSourceDrilldownButton(event) +
    renderEventTaskDetailButton(event) +
    '<button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id) + '"' + disabled + '>' + ackLabel + '</button>' +
    '</section>';
  return '<div class="notification-event-row ' + statusClassName(statusVariant(event.severity || event.deliveryStatus)) + '">' +
    '<section class="notification-event-anchor">' +
      '<span class="notification-event-source">' + escapeHtml(source) + '</span>' +
      '<strong>' + escapeHtml(notificationEventTypeLabel(event.type)) + '</strong>' +
      '<small>' + escapeHtml(event.createdAt || '未知时间') + '</small>' +
    '</section>' +
    '<section class="notification-event-brief">' +
      '<p>' + escapeHtml(title) + '</p>' +
      '<small>' + escapeHtml(summary) + '</small>' +
      '<div class="notification-event-chips">' +
        authorMetaChip('级别', workspaceStatusLabel(event.severity || 'unknown'), statusVariant(event.severity)) +
        authorMetaChip('投递', workspaceStatusLabel(event.deliveryStatus || 'pending'), statusVariant(event.deliveryStatus || 'pending')) +
        authorMetaChip('尝试', event.deliveryAttempts || 0, (event.deliveryAttempts || 0) > 0 ? 'warn' : 'muted') +
        authorMetaChip('确认', event.acknowledgedAt ? '是' : '否', event.acknowledgedAt ? 'ok' : 'warn') +
      '</div>' +
    '</section>' +
    controls +
    '</div>';
}

function renderNotificationEventEmptyState(overview) {
  return '<div class="notification-empty-state">' +
    '<span>清爽</span>' +
    '<strong>当前筛选下没有提醒。</strong>' +
    '<small>' + escapeHtml(overview && overview.recommendedNextAction || '当来源关注、作者复核或操作清单需要处理时，会在这里生成提醒。') + '</small>' +
    '</div>';
}

function renderNotificationSourceHotspots(hotspots) {
  if (!hotspots.length) return '';
  return '<section class="notification-hotspots"><span>来源关注</span>' + hotspots.slice(0, 5).map(function (hotspot) {
    const details = [
      '未读 ' + (hotspot.openCount || 0),
      '失败 ' + (hotspot.failedCount || 0),
      '到期 ' + (hotspot.dueForDeliveryCount || 0),
      '耗尽 ' + (hotspot.retryExhaustedCount || 0),
      hotspot.oldestUnacknowledgedAt ? '最早 ' + hotspot.oldestUnacknowledgedAt : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="notification-hotspot-row"><section>' +
      '<strong>' + escapeHtml(hotspot.sourceKey || hotspot.sourceId || '未知来源') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small>' +
      '</section><span class="button-group source-op-buttons">' +
      renderEventSourceDrilldownButton(hotspot) +
      '</span></div>';
  }).join('') + '</section>';
}

function renderEventSourceDrilldownButton(source) {
  if (!source || (!source.sourceId && !source.sourceKey)) return '';
  return '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-drilldown" data-source-id="' + escapeHtml(source.sourceId || '') + '" data-source-key="' + escapeHtml(source.sourceKey || '') + '" data-limit="50">查看路径</button>' +
    '<button class="inline-button secondary-inline-button" type="button" data-action="load-source-collection-health" data-source-id="' + escapeHtml(source.sourceId || '') + '" data-source-key="' + escapeHtml(source.sourceKey || '') + '" data-limit="50">健康简报</button>';
}

function formatNotificationSourceLabel(source, fallback) {
  const safeSource = source || {};
  const parts = [
    safeSource.sourceKey ? '代号 ' + safeSource.sourceKey : undefined,
    safeSource.sourceId ? '编号 ' + safeSource.sourceId : undefined
  ].filter(Boolean);
  return parts.length ? '来源 ' + parts.join(' · ') : (fallback === undefined ? '全部来源' : fallback);
}

function eventMetadata(event) {
  const source = formatNotificationSourceLabel(event, '');
  const ack = event.acknowledgedAt ? '确认 ' + [event.acknowledgedBy, event.acknowledgedAt].filter(Boolean).join(' ') : '未确认';
  return [
    event.createdAt,
    notificationEventTypeLabel(event.type),
    workspaceStatusLabel(event.severity),
    workspaceStatusLabel(event.deliveryStatus || 'pending'),
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
    sourceId || '全部来源编号'
  ].join(' · ');
}

function renderEventDispatchResult(result) {
  const filters = result.filters || {};
  return panel('事件投递完成', [
    metric('通道', result.channelKey),
    metric('范围', formatEventSourceScope(filters)),
    metric('数量', filters.limit || '默认'),
    metric('已投递', result.dispatchedCount),
    metric('失败', result.failedCount),
    metric('跳过', result.skippedCount)
  ].join(''), 'wide');
}

function formatEventSourceScope(filters) {
  const parts = [
    filters.sourceKey ? '来源代号 ' + filters.sourceKey : undefined,
    filters.sourceId ? '来源编号 ' + filters.sourceId : undefined
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '全部来源';
}

function renderEventAckResult(result) {
  return panel('事件已确认', [
    metric('提醒', result.event.id),
    metric('确认时间', result.event.acknowledgedAt),
    metric('确认人', result.event.acknowledgedBy)
  ].join(''), 'wide');
}

function renderEventBatchAckResult(result) {
  const title = result.dryRun ? '提醒确认预览' : '提醒已确认';
  return panel(title, [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('状态', workspaceStatusLabel(workspaceValue(result.status, 'unknown')), statusVariant(result.status)),
      summaryTile('预演', result.dryRun ? '是' : '否', result.dryRun ? 'warn' : 'ok'),
      summaryTile('候选', String(result.candidateCount || 0), result.candidateCount > 0 ? 'warn' : 'muted'),
      summaryTile('已确认', String(result.acknowledgedCount || 0), result.acknowledgedCount > 0 ? 'ok' : 'muted'),
      summaryTile('跳过', String(result.skippedCount || 0), result.skippedCount > 0 ? 'warn' : 'ok'),
      summaryTile('窗口', String(result.eventCount || 0))
    ].join('') + '</div>',
    metric('确认人', result.acknowledgedBy || '系统'),
    evidenceList((result.results || []).slice(0, 8).map(function (item) {
      return notificationBatchResultLine(item);
    }))
  ].join(''), 'wide');
}

function renderEventArchiveResult(result) {
  const rows = result.results && result.results.length ? result.results : result.candidates || [];
  return panel('提醒归档', [
    '<div class="summary-strip event-summary-strip">' + [
      summaryTile('状态', workspaceStatusLabel(workspaceValue(result.status, 'unknown')), statusVariant(result.status)),
      summaryTile('预演', result.dryRun ? '是' : '否', result.dryRun ? 'warn' : 'ok'),
      summaryTile('候选', String(result.candidateCount || 0), result.candidateCount > 0 ? 'warn' : 'ok'),
      summaryTile('已归档', String(result.archivedCount || 0), result.archivedCount > 0 ? 'ok' : 'muted')
    ].join('') + '</div>',
    metric('归档线', workspaceValue(result.cutoffAt, '暂无')),
    metric('批次', workspaceValue(result.batchId, '暂无')),
    evidenceList(rows.slice(0, 8).map(function (item) {
      return notificationArchiveResultLine(item);
    })),
    metric('下一步', result.recommendedNextAction || '暂无')
  ].join(''), 'wide');
}

function notificationBatchResultLine(item) {
  const safeItem = item || {};
  return [
    workspaceStatusLabel(safeItem.status || 'unknown'),
    safeItem.eventId ? '提醒 ' + safeItem.eventId : '提醒未记录',
    safeItem.reason ? '原因 ' + safeItem.reason : undefined
  ].filter(Boolean).join(' · ');
}

function notificationArchiveResultLine(item) {
  const safeItem = item || {};
  const event = safeItem.event || {};
  const eventId = safeItem.eventId || safeItem.id || event.id;
  const source = safeItem.sourceKey || event.sourceKey || safeItem.sourceId || event.sourceId;
  return [
    workspaceStatusLabel(safeItem.status || 'candidate'),
    eventId ? '提醒 ' + eventId : '提醒待确认',
    source ? '来源 ' + source : '来源未记录'
  ].filter(Boolean).join(' · ');
}

function renderSemanticInsights(insights) {
  return panel('语义增强', [
    metric('提供方', insights.provider),
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
  const rawPage = result.rawPage || {};
  return panel('原始页面已收入证据库', [
    metric('内容指纹', formatEvidenceFingerprint(rawPage.contentSha1)),
    metric('来源', workspaceValue(rawPage.sourceKey, '未知来源')),
    metric('页面地址', workspaceValue(rawPage.sourceUrl, '未记录')),
    metric('收录状态', result.duplicate ? '已存在' : '新收录')
  ].join(''), 'wide');
}

function renderRawPageFetchWindowResult(windowResult) {
  if (!windowResult || !Array.isArray(windowResult.results) || windowResult.results.length === 0) {
    return '<div class="muted">没有抓取到原始页。</div>';
  }
  if (windowResult.results.length === 1) return renderRawPageFetchResult(windowResult.results[0].result);
  const rows = windowResult.results.map(function (item) {
    const rawPage = item.result && item.result.rawPage || {};
    const details = [
      '页码 ' + workspaceValue(item.page, '未知'),
      '内容指纹 ' + formatEvidenceFingerprint(rawPage.contentSha1),
      rawPage.sourceUrl ? '页面地址 ' + rawPage.sourceUrl : undefined,
      item.result && item.result.duplicate ? '已存在' : '新收录'
    ].filter(Boolean).join(' · ');
    return '<div class="action-row"><span>' +
      escapeHtml(rawPage.sourceUrl || ('第 ' + item.page + ' 页')) +
      '<small>' + escapeHtml(details) + '</small></span></div>';
  }).join('');
  return panel('原始页面已收入证据库', [
    metric('起始页', windowResult.startPage),
    metric('页数', windowResult.pageCount),
    rows
  ].join(''), 'wide');
}

function renderRawPageReplayResult(result) {
  return panel('原始页面回放完成', [
    metric('任务', result.task.id),
    metric('状态', workspaceStatusLabel(result.task.status)),
    metric('主题', result.report.thread.title),
    metric('楼层', result.report.thread.parsedPostCount)
  ].join(''), 'wide');
}

function renderRawPageList(result) {
  const pages = result.pages || [];
  if (pages.length === 0) return panel('原始页面证据', '<div class="muted">暂无原始页面证据。</div>', 'wide');
  return panel('原始页面证据', pages.map(function (page) {
    const meta = page.metadata || {};
    const details = [
      '来源 ' + workspaceValue(page.sourceKey, '未知来源'),
      '主题 ' + workspaceValue(page.sourceThreadId, '未归档'),
      '内容指纹 ' + formatEvidenceFingerprint(page.contentSha1),
      meta.status ? '抓取状态 ' + meta.status : undefined,
      page.fetchedAt ? '抓取时间 ' + page.fetchedAt : undefined
    ].filter(Boolean).join(' · ');
    return '<div class="action-row"><span>' +
      '<strong>' + escapeHtml(page.sourceUrl || '未命名页面') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small></span>' +
      '<button class="inline-button" type="button" data-action="replay-raw-page" data-source-key="' + escapeHtml(page.sourceKey) + '" data-content-sha1="' + escapeHtml(page.contentSha1) + '">回放</button></div>';
  }).join(''), 'wide');
}

function formatEvidenceFingerprint(value) {
  if (!value) return '未记录';
  const text = String(value);
  return text.length > 16 ? text.slice(0, 12) + '...' : text;
}

function renderSourceList(result) {
  const sources = result.sources || [];
  const sourceDiagnostics = result.diagnostics || {};
  const diagnosticsBySourceId = sourceDiagnosticMap(sourceDiagnostics);
  const diagnosticsPanel = renderSourceDiagnostics(sourceDiagnostics);
  if (sources.length === 0) return diagnosticsPanel + panel('跟踪来源', '<div class="muted">还没有添加跟踪来源。</div>', 'wide');
  return diagnosticsPanel + panel('跟踪来源', sources.map(function (source) {
    const runState = source.runState || {};
    const schedule = source.schedule || {};
    const cursor = source.cursor || {};
    const cursorDiff = runState.lastCursorDiff || {};
    const diagnostics = diagnosticsBySourceId[source.id];
    const details = [
      '类型 ' + workspaceValue(source.sourceType, '未设置'),
      '代号 ' + workspaceValue(source.sourceKey || source.id, '未命名'),
      '运行 ' + formatSourceRunLabel(runState.status),
      diagnostics ? '配置 ' + workspaceStatusLabel(diagnostics.status) : '配置 未检查',
      formatSourceScheduleLabel(schedule),
      formatSourceCursorLabel(cursor),
      formatSourceNewPostLabel(cursorDiff),
      formatSourceTaskLabel(runState.lastTaskId)
    ].filter(Boolean).join(' · ');
    return '<div class="action-row"><span>' +
      '<strong>' + escapeHtml(source.displayName || source.sourceKey || source.id || '未命名来源') + '</strong>' +
      '<small>' + escapeHtml(details) + '</small></span><span class="button-group"><button class="inline-button" type="button" data-action="run-source" data-source-id="' + escapeHtml(source.id) + '">运行</button><button class="inline-button secondary-inline-button" type="button" data-action="run-source-pipeline" data-source-id="' + escapeHtml(source.id) + '">洞察</button></span></div>';
  }).join(''), 'wide');
}

function renderSourceOpsList(result) {
  const sources = result.sources || [];
  const sourceDiagnostics = result.diagnostics || {};
  const diagnosticsBySourceId = sourceDiagnosticMap(sourceDiagnostics);
  const diagnosticsPanel = renderSourceDiagnostics(sourceDiagnostics);
  if (sources.length === 0) return diagnosticsPanel + panel('跟踪来源', '<div class="muted">还没有跟踪来源。</div>', 'wide');
  return diagnosticsPanel + panel('跟踪来源', sources.map(function (source) {
    const runState = source.runState || {};
    const schedule = source.schedule || {};
    const cursor = source.cursor || {};
    const cursorDiff = runState.lastCursorDiff || {};
    const diagnostics = diagnosticsBySourceId[source.id];
    const runLabel = formatSourceRunLabel(runState.status);
    const controls = '<section class="source-work-actions button-group source-op-buttons">' +
      renderSourceDrilldownButton(source) +
      '<button class="inline-button" type="button" data-action="run-source" data-source-id="' + escapeHtml(source.id) + '">运行</button>' +
      '<button class="inline-button secondary-inline-button" type="button" data-action="run-source-pipeline" data-source-id="' + escapeHtml(source.id) + '">洞察</button>' +
      '</section>';
    return '<div class="source-work-row tracked-source-row ' + statusClassName(statusVariant(runState.status || diagnostics && diagnostics.status || 'ok')) + '">' +
      '<section class="source-work-anchor">' +
        '<span class="source-work-scope">' + escapeHtml(source.sourceType || '来源') + '</span>' +
        '<strong>' + escapeHtml(source.displayName || source.sourceKey || source.id || '未命名来源') + '</strong>' +
        '<small>' + escapeHtml('代号 ' + workspaceValue(source.sourceKey || source.id, '未命名')) + '</small>' +
      '</section>' +
      '<section class="source-work-brief">' +
        '<p>' + escapeHtml([formatSourceLocationSummary(source.location || {}), formatSourceTaskLabel(runState.lastTaskId)].filter(Boolean).join(' · ') || '这个来源已准备好运行。') + '</p>' +
        '<div class="source-work-chips">' +
          authorMetaChip('代号', workspaceValue(source.sourceKey || source.id, '未命名'), source.sourceKey ? 'info' : 'muted') +
          authorMetaChip('运行', runLabel, statusVariant(runState.status)) +
          authorMetaChip('配置', diagnostics ? workspaceStatusLabel(diagnostics.status) : '未检查', diagnostics ? statusVariant(diagnostics.status) : 'muted') +
          authorMetaChip('排期', formatSourceScheduleLabel(schedule), schedule.intervalMinutes ? 'info' : 'muted') +
          authorMetaChip('楼层', formatSourceCursorLabel(cursor), cursor.postCount !== undefined ? 'ok' : 'muted') +
          authorMetaChip('新增', formatSourceNewPostLabel(cursorDiff), cursorDiff.newPostCount > 0 ? 'ok' : 'muted') +
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
    parts.push('页 ' + startPage + '-' + (startPage + pageCount - 1));
  }
  if (location.url) parts.push('在线链接');
  if (location.inputDir) parts.push('本地目录');
  if (location.inputFile) parts.push('本地文件');
  return parts.length ? parts.join(' · ') : undefined;
}

function formatSourceRunLabel(status) {
  return workspaceStatusLabel(status || 'not-run');
}

function formatSourceScheduleLabel(schedule) {
  const safeSchedule = schedule || {};
  return safeSchedule.intervalMinutes ? '每 ' + safeSchedule.intervalMinutes + ' 分钟' : '未排期';
}

function formatSourceCursorLabel(cursor) {
  const safeCursor = cursor || {};
  if (safeCursor.postCount === undefined) return '暂无楼层记录';
  const parts = ['已收录 ' + safeCursor.postCount + ' 层'];
  if (safeCursor.lastFloor !== undefined) parts.push('最近楼层 ' + safeCursor.lastFloor);
  return parts.join(' · ');
}

function formatSourceNewPostLabel(cursorDiff) {
  const safeDiff = cursorDiff || {};
  if (safeDiff.newPostCount === undefined) return '暂无新增记录';
  return safeDiff.newPostCount > 0 ? '新增 ' + safeDiff.newPostCount + ' 层' : '暂无新增';
}

function formatSourceTaskLabel(taskId) {
  return taskId ? '最近任务 ' + taskId : undefined;
}

function renderSourceDiagnostics(diagnostics) {
  const sources = diagnostics.sources || [];
  if (sources.length === 0) return panel('来源接入诊断', '<div class="muted">暂无来源诊断。</div>', 'wide');
  const rows = sources.slice(0, 10).map(function (source) {
    return sourceDiagnosticSummaryLine(source);
  });
  const actions = (diagnostics.nextActions || []).slice(0, 8).map(function (action) {
    return sourceDiagnosticActionSummary(action);
  });
  return panel('来源接入诊断', evidenceList(rows.concat(actions)), 'wide');
}

function sourceDiagnosticActionSummary(action) {
  const safeAction = action || {};
  const commands = safeAction.commands || (safeAction.command ? [safeAction.command] : []);
  return [
    workspaceStatusLabel(safeAction.severity),
    '来源 ' + workspaceValue(safeAction.sourceName || safeAction.sourceKey || safeAction.sourceId, '未指明'),
    '建议 ' + workspaceValue(safeAction.summary || safeAction.title || safeAction.label, '查看接入建议'),
    commands.length ? '建议命令 ' + commands.length + ' 条' : undefined,
    safeAction.evidenceSummary ? '证据 ' + safeAction.evidenceSummary : undefined
  ].filter(Boolean).join(' · ');
}

function sourceDiagnosticSummaryLine(source) {
  const safeSource = source || {};
  const failedChecks = (safeSource.checks || []).filter(function (check) {
    return check.status !== 'ok';
  }).map(sourceDiagnosticCheckSummary);
  return [
    workspaceStatusLabel(safeSource.status || 'unknown'),
    '来源 ' + workspaceValue(safeSource.displayName || safeSource.sourceKey || safeSource.sourceId, '未知来源'),
    failedChecks.length ? '需要处理 ' + failedChecks.join('；') : '检查通过'
  ].join(' · ');
}

function sourceDiagnosticCheckSummary(check) {
  const safeCheck = check || {};
  return [
    safeCheck.summary || safeCheck.key || '检查项',
    workspaceStatusLabel(safeCheck.status || 'unknown'),
    safeCheck.value ? '证据 ' + safeCheck.value : undefined
  ].filter(Boolean).join(' · ');
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
  if (!items || items.length === 0) return emptySignal('暂无证据信号。', '清爽');
  return items.map(function (item) {
    return '<div class="evidence-row"><span>' + escapeHtml(item) + '</span></div>';
  }).join('');
}

function emptySignal(message, label) {
  return '<div class="empty-signal" role="status">' +
    '<span>' + escapeHtml(label || '清爽') + '</span>' +
    '<strong>' + escapeHtml(message || '暂时没有需要处理的信号。') + '</strong>' +
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
  if (!items || items.length === 0) return emptySignal('暂无标签。', '清爽');
  return '<div class="tag-list">' + items.map(function (item) {
    return '<span class="tag">' + escapeHtml(item) + '</span>';
  }).join('') + '</div>';
}

function reviewActionStatusSummary(reviewActions) {
  const summary = reviewActions || {};
  const executions = summary.executions || {};
  return [
    '审计 ' + (summary.auditCount || 0),
    '执行 ' + (executions.count || 0),
    '运行中 ' + (executions.running || 0),
    '失败 ' + (executions.failed || 0),
    '来源 ' + compactCountMap(summary.bySourceKey || executions.bySourceKey),
    '最近 ' + workspaceValue(summary.latestGeneratedAt || executions.latestUpdatedAt, '暂无')
  ].join(' · ');
}

function eventActionStatusSummary(eventActions) {
  const summary = eventActions || {};
  const executions = summary.executions || summary;
  return [
    '执行 ' + (executions.count || 0),
    '运行中 ' + (executions.running || 0),
    '停滞 ' + (executions.staleRunning || 0),
    '失败 ' + (executions.failed || 0),
    '来源 ' + compactCountMap(executions.bySourceKey),
    '最近 ' + workspaceValue(executions.latestUpdatedAt, '暂无')
  ].join(' · ');
}

function authorReviewQueueStatusSummary(queue) {
  const summary = queue || {};
  return [
    '打开 ' + (summary.openCount || 0),
    '高优先级 ' + (summary.highPriorityOpenCount || 0),
    '来源 ' + compactCountMap(summary.openBySourceKey || summary.bySourceKey),
    '最近 ' + workspaceValue(summary.latestUpdatedAt, '暂无')
  ].join(' · ');
}

function compactCountMap(counts) {
  const entries = Object.entries(counts || {}).filter(function (entry) {
    return entry[1] > 0;
  });
  if (entries.length === 0) return '暂无';
  return entries.slice(0, 4).map(function (entry) {
    return entry[0] + ' ' + entry[1];
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
    button.textContent = '已复制';
  } catch (error) {
    button.textContent = '复制失败';
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
  const safeMessage = escapeHtml(message || (isError ? '请求失败。' : '正在加载...'));
  const role = isError ? 'alert' : 'status';
  const label = isError ? '受阻' : '处理中';
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
