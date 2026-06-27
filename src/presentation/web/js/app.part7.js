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
      audit.sourceId ? '来源编号 ' + audit.sourceId : undefined,
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

