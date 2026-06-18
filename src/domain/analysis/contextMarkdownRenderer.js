'use strict';

function renderNewPostContextMarkdown(report) {
  const lines = [];

  lines.push('# 新发言语境还原');
  lines.push('');
  lines.push('## 新发言');
  lines.push('');
  lines.push('- 主题：' + report.thread.title + '（' + report.thread.sourceThreadId + '）');
  lines.push('- 作者：' + (report.newPost.author.displayName || 'unknown'));
  lines.push('- 内容：' + safeInline(report.newPost.contentText));

  lines.push('');
  lines.push('## 新发言实体候选');
  lines.push('');
  appendEntities(lines, report.newEntities || []);

  lines.push('');
  lines.push('## 新发言观点候选');
  lines.push('');
  appendOpinions(lines, report.newOpinions || []);

  lines.push('');
  lines.push('## 相关历史证据');
  lines.push('');
  appendEvidence(lines, report.relatedEvidence || []);

  lines.push('');
  lines.push('> 说明：当前是规则型语境还原 MVP，只做可解释召回，不替代后续 LLM 的深度判断。');
  lines.push('');

  return lines.join('\n');
}

function appendEntities(lines, entities) {
  if (entities.length === 0) {
    lines.push('暂无。');
    return;
  }
  entities.forEach(function (entity) {
    lines.push('- ' + entity.displayName + '（' + entity.type + '）：出现 ' + entity.mentions.length + ' 次');
  });
}

function appendOpinions(lines, opinions) {
  if (opinions.length === 0) {
    lines.push('暂无。');
    return;
  }
  opinions.forEach(function (opinion) {
    lines.push('- 范围：' + (opinion.scope || 'unknown') + '；态度：' + opinion.attitude + '；置信度：' + opinion.confidence);
    if (opinion.conditionSignals && opinion.conditionSignals.length > 0) {
      lines.push('  条件：' + opinion.conditionSignals.join(' / '));
    }
  });
}

function appendEvidence(lines, evidenceItems) {
  if (evidenceItems.length === 0) {
    lines.push('暂无。');
    return;
  }
  evidenceItems.forEach(function (item) {
    lines.push('- #' + item.floor + ' ' + item.author + '；匹配分：' + item.score + '；置信度：' + item.confidence);
    lines.push('  理由：' + item.reasons.join(', '));
    lines.push('  证据：' + safeInline(item.evidenceText));
  });
}

function safeInline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  renderNewPostContextMarkdown
};
