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
  const viewName = normalizeViewName(window.location.hash ? window.location.hash.slice(1) : '') || state.currentView;
  setView(viewName, { syncHash: false });
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
  if (safeViewName === 'overview') loadOverview();
  if (safeViewName === 'operations') {
    renderAutomationActionHistoryStandby();
    loadSystemStatus();
    loadAutomationReadiness();
  }
  syncAutomationAutoRefresh();
}

async function loadOverview() {
  const target = document.getElementById('overviewResult');
  if (!target) return;
  target.innerHTML = renderOverview(null);
  const [health, events, sources] = await Promise.all([
    fetchJson('/health').catch(function () { return null; }),
    fetchJson('/api/events?acknowledged=false&limit=50').catch(function () { return null; }),
    fetchJson('/api/sources?limit=100').catch(function () { return null; })
  ]);
  target.innerHTML = renderOverview({
    health: health,
    pendingAlerts: events && Array.isArray(events.events) ? events.events.length : null,
    sourceCount: sources && Array.isArray(sources.sources) ? sources.sources.length : null
  });
}

function renderOverview(data) {
  const groups = [
    {
      label: '工作区',
      items: [
        { view: 'history', title: '历史分析', desc: '解析保存页目录，生成作者、实体与证据概览。' },
        { view: 'context', title: '新发言解读', desc: '输入新发言，召回相关历史楼层与匹配理由。' },
        { view: 'search', title: '历史检索', desc: '把保存页写入索引，按关键词检索可引用证据。' }
      ]
    },
    {
      label: '运营',
      items: [
        { view: 'sources', title: '来源', desc: '导入本地资料、跟踪来源、接入在线主题。' },
        { view: 'operations', title: '运行', desc: '运行队列、worker、runbook 与自动化就绪。' },
        { view: 'alerts', title: '提醒', desc: '筛选通知事件、确认归档与人工复核。' },
        { view: 'publish', title: '发布', desc: '连接器校验、来源试跑、清单门禁与审计。' }
      ]
    }
  ];
  const moduleGroups = groups.map(function (group) {
    const rows = group.items.map(function (item) {
      return '<button type="button" class="overview-row" data-view="' + item.view + '">'
        + '<span class="overview-row-text">'
        + '<strong>' + escapeHtml(item.title) + '</strong>'
        + '<span>' + escapeHtml(item.desc) + '</span>'
        + '</span>'
        + '<span class="overview-row-go" aria-hidden="true">→</span>'
        + '</button>';
    }).join('');
    return '<div class="overview-group">'
      + '<div class="overview-group-head">' + escapeHtml(group.label) + '</div>'
      + '<div class="overview-rows">' + rows + '</div>'
      + '</div>';
  }).join('');
  return '<section class="overview-board">'
    + '<div class="overview-signals">' + renderOverviewSignals(data) + '</div>'
    + '<div class="overview-modules">' + moduleGroups + '</div>'
    + '</section>';
}

function renderOverviewSignals(data) {
  if (!data) {
    return [0, 1, 2].map(function () {
      return '<div class="overview-card is-loading"><div class="feedback-skeleton"><span></span><span></span></div></div>';
    }).join('');
  }
  const alerts = data.pendingAlerts;
  const sources = data.sourceCount;
  const healthStatus = data.health && data.health.status ? String(data.health.status) : null;
  const healthLabel = healthStatus === 'ok'
    ? '正常'
    : healthStatus === 'warn'
      ? '注意'
      : healthStatus
        ? '异常'
        : '未知';
  const healthState = healthStatus === 'ok'
    ? 'ok'
    : healthStatus === 'warn'
      ? 'warn'
      : healthStatus
        ? 'fail'
        : 'idle';
  const alertState = alerts == null ? 'idle' : (Number(alerts) > 0 ? 'warn' : 'ok');
  const sourceState = sources == null ? 'idle' : 'info';
  return [
    overviewCard('alerts', alertState, '待确认提醒', alerts == null ? '—' : String(alerts), '前往提醒处理'),
    overviewCard('sources', sourceState, '跟踪来源', sources == null ? '—' : String(sources), '前往来源管理'),
    overviewCard('operations', healthState, '系统健康', healthLabel, '前往运行概览')
  ].join('');
}

function overviewCard(view, signalState, label, value, hint) {
  return '<button type="button" class="overview-card overview-card-' + signalState + '" data-view="' + view + '">'
    + '<span class="overview-card-top">'
    + '<span class="overview-card-label">' + escapeHtml(label) + '</span>'
    + '<span class="overview-card-dot" aria-hidden="true"></span>'
    + '</span>'
    + '<strong class="overview-card-value">' + escapeHtml(value) + '</strong>'
    + '<span class="overview-card-hint">' + escapeHtml(hint)
    + '<span class="overview-card-hint-go" aria-hidden="true">→</span></span>'
    + '</button>';
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
    renderError('eventResult', new Error('找不到这条提醒的编号。'));
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
    renderError('eventResult', new Error('需要提醒编号和动作名称，才能预演动作。'));
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
    renderError('eventResult', new Error('需要提醒编号和动作名称，才能执行动作。'));
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

