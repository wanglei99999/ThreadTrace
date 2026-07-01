function renderContextReviewActionExecutionRows(executions) {
  if (executions.length === 0) return '<div class="muted">暂无复核动作执行记录。</div>';
  return executions.map(function (execution) {
    const details = [
      execution.updatedAt || execution.createdAt,
      execution.sourceKey ? '来源 ' + execution.sourceKey : undefined,
      execution.sourceId ? '来源编号 ' + execution.sourceId : undefined,
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
      metric('提醒编号', event.id || '暂无'),
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
      metric('动作编号', intent.id || '暂无'),
      metric('提醒编号', result.event && result.event.id || intent.eventId || '暂无'),
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
  const meta = eventMetadata(event).join(' · ');
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
      return '实体 ' + item.name + ' · ' + localizeEnum(item.confidence) + ' · ' + refs;
    })),
    evidenceList((insights.opinionInsights || []).slice(0, 5).map(function (item) {
      return '观点 #' + item.floor + ' · ' + localizeEnum(item.attitude) + ' · ' + localizeEnum(item.confidence);
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
