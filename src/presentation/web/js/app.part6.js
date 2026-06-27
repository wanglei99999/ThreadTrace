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
      '<small>' + escapeHtml([check.area, check.value].filter(Boolean).join(' · ')) + '</small>' +
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

