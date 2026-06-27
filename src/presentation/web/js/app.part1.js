'use strict';

const state = {
  adapters: [],
  sourceTypes: [],
  connectorPackages: [],
  connectorModuleErrors: [],
  currentView: 'overview',
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
  overview: {
    title: '概览',
    subtitle: '今天需要处理的来源、提醒和复核都收在这里。',
    mode: '概览',
    focus: '今日要处理'
  },
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
  sources: {
    title: '来源',
    subtitle: '导入本地资料、跟踪来源、接入在线主题与新连接器。',
    mode: '来源采集',
    focus: '采集与接入'
  },
  operations: {
    title: '运行',
    subtitle: '运行队列、worker、runbook 与自动化就绪状态。',
    mode: '运行概览',
    focus: '运行与自动化'
  },
  alerts: {
    title: '提醒',
    subtitle: '筛选通知事件、确认归档，并处理人工复核结果。',
    mode: '提醒处理',
    focus: '事件与复核'
  },
  publish: {
    title: '发布',
    subtitle: '连接器校验、来源试跑、清单门禁与应用审计。',
    mode: '发布检查',
    focus: '连接器与门禁'
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
  const overviewResultEl = document.getElementById('overviewResult');
  if (overviewResultEl) {
    overviewResultEl.addEventListener('click', function (event) {
      const target = event.target.closest('[data-view]');
      if (target) setView(target.dataset.view);
    });
  }
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
    if (state.currentView === 'operations') {
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

