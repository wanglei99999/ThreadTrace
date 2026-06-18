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
  document.getElementById('refreshTasksButton').addEventListener('click', loadTasks);
  document.getElementById('refreshSourcesButton').addEventListener('click', loadSources);
  document.getElementById('refreshEventsButton').addEventListener('click', loadEvents);
  document.getElementById('refreshRawPagesButton').addEventListener('click', loadRawPages);
  document.getElementById('dispatchEventsButton').addEventListener('click', dispatchEvents);
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
  });

  document.getElementById('sourceResult').addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action="run-source"],button[data-action="run-source-pipeline"]');
    if (!button) return;
    const isPipeline = button.dataset.action === 'run-source-pipeline';
    await renderAsync('taskResult', function () {
      const taskPath = isPipeline ? '/tasks/insight-pipeline' : '/tasks/ingest';
      return requestJson('/api/sources/' + encodeURIComponent(button.dataset.sourceId) + taskPath, {
        provider: 'mock'
      });
    }, isPipeline ? renderSourcePipelineRunResult : renderSourceTaskRunResult);
    await loadSystemStatus();
    await loadTasks();
    await loadEvents();
    await loadRawPages();
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
  if (viewName === 'system') loadEvents();
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
      statusRow('存储', overview.storageMode),
      statusRow('Adapters', adapterDiagnostics.status + ' · ' + adapterDiagnostics.adapterCount),
      statusRow('Source config', sourceDiagnostics.status + ' · ' + sourceDiagnostics.sourceCount),
      statusRow('Source mode', diagnostics.configuration.workers.sourceTaskMode),
      statusRow('LLM', diagnostics.configuration.llm.provider),
    ].concat(resourceStatusRows, [
      statusRow('适配器', String((adapters.adapters || []).length)),
      statusRow('API 契约', openApi.openapi),
      statusRow('端点', String(Object.keys(openApi.paths || {}).length)),
      statusRow('来源', overview.sources.enabled + '/' + overview.sources.total + ' · due ' + overview.sources.due),
      statusRow('任务', 'running ' + overview.tasks.running + ' · failed ' + overview.tasks.failed),
      statusRow('事件', 'pending ' + overview.events.pending + ' · failed ' + overview.events.failed + ' · open ' + overview.events.unacknowledged),
      statusRow('原始页', String(overview.rawPages.total)),
      statusRow('生成时间', overview.generatedAt)
    ]);
    target.innerHTML = rows.join('');
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

async function loadEvents() {
  await renderAsync('eventResult', function () {
    return fetchJson('/api/events?limit=10');
  }, renderEventList);
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
  await loadEvents();
  await loadRawPages();
}

async function dispatchEvents() {
  await renderAsync('eventResult', function () {
    return requestJson('/api/events/dispatch', {});
  }, renderEventDispatchResult);
  await loadSystemStatus();
  await loadEvents();
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
    panel('实体线索', tagList((report.entityCandidates || []).slice(0, 12).map(function (entity) {
      return entity.displayName + ' · ' + entity.mentions.length;
    }))),
    panel('观点候选', evidenceList((report.opinionCandidates || []).slice(0, 8).map(function (opinion) {
      return '#' + opinion.floor + ' ' + opinion.attitude + ' · ' + opinion.confidence;
    }))),
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

function renderContextReport(report) {
  return [
    panel('新发言', [
      metric('内容', report.newPost.contentText),
      metric('实体', (report.newEntities || []).map(function (entity) { return entity.displayName; }).join(', ') || '暂无'),
      metric('观点', (report.newOpinions || []).map(function (opinion) { return opinion.attitude + ' · ' + opinion.confidence; }).join(', ') || '暂无')
    ].join('')),
    panel('相关历史证据', evidenceList((report.relatedEvidence || []).map(function (item) {
      return '#' + item.floor + ' ' + item.author + ' · ' + item.confidence + '：' + item.reasons.join(', ');
    })), 'wide')
  ].join('');
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

function renderEventList(result) {
  const events = result.events || [];
  if (events.length === 0) return panel('通知事件', '<div class="muted">暂无</div>', 'wide');
  return panel('通知事件', events.map(function (event) {
    const ackLabel = event.acknowledgedAt ? '已确认' : '确认';
    const disabled = event.acknowledgedAt ? ' disabled' : '';
    const delivery = event.deliveryStatus || 'pending';
    return '<div class="action-row"><span>' + escapeHtml(event.createdAt + ' · ' + event.type + ' · ' + delivery + ' · ' + event.summary) + '</span><button class="inline-button" type="button" data-action="ack-event" data-event-id="' + escapeHtml(event.id) + '"' + disabled + '>' + ackLabel + '</button></div>';
  }).join(''), 'wide');
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

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
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
