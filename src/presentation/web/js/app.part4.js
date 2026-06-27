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

