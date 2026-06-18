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
  system: {
    title: '系统状态',
    subtitle: '查看 API、适配器和本地服务状态。'
  }
};

document.addEventListener('DOMContentLoaded', function () {
  bindNavigation();
  bindForms();
  document.getElementById('refreshAdaptersButton').addEventListener('click', loadAdapters);
  document.getElementById('refreshTasksButton').addEventListener('click', loadTasks);
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
}

async function loadAdapters() {
  try {
    const result = await fetchJson('/adapters');
    state.adapters = result.adapters || [];
    fillAdapterSelect('historyForum');
    fillAdapterSelect('contextForum');
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
    const tasks = await fetchJson('/api/tasks?limit=5');
    target.innerHTML = [
      statusRow('服务', health.ok ? '运行中' : '异常'),
      statusRow('适配器', String((adapters.adapters || []).length)),
      statusRow('API 契约', openApi.openapi),
      statusRow('端点', String(Object.keys(openApi.paths || {}).length)),
      statusRow('最近任务', String((tasks.tasks || []).length))
    ].join('');
  } catch (error) {
    target.innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
  }
}

async function loadTasks() {
  await renderAsync('taskResult', function () {
    return fetchJson('/api/tasks?limit=10');
  }, renderTaskList);
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
  return [
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
  ].join('');
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

function renderTaskRunResult(result) {
  return panel('任务完成', [
    metric('任务 ID', result.task.id),
    metric('状态', result.task.status),
    metric('主题', result.task.output ? result.task.output.title : ''),
    metric('楼层', result.task.output ? result.task.output.parsedPostCount : '')
  ].join(''), 'wide');
}

function renderTaskList(result) {
  const tasks = result.tasks || [];
  return panel('最近任务', evidenceList(tasks.map(function (task) {
    const output = task.output || {};
    return task.status + ' · ' + task.type + ' · ' + (output.title || task.id);
  })), 'wide');
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

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.statusText);
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
