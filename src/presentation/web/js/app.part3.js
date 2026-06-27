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
    const focus = focusEntities.join(' · ');
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

