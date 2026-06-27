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
    scope.sourceId ? '来源编号 ' + scope.sourceId : undefined,
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
    value.sourceId ? '来源编号 ' + value.sourceId : undefined,
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
    metric('活跃来源编号', compactCountMap(safeLeases.activeBySourceId)),
    metric('过期来源编号', compactCountMap(safeLeases.expiredBySourceId)),
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
    metric('来源编号', compactCountMap(safeWorkers.bySourceId)),
    metric('来源代号', compactCountMap(safeWorkers.bySourceKey)),
    metric('运行中来源编号', compactCountMap(safeWorkers.runningBySourceId)),
    metric('停滞来源编号', compactCountMap(safeWorkers.staleBySourceId)),
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
    ? '来源编号 ' + scope.sourceId
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
    ? '来源编号 ' + scope.sourceId
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

