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
  lines.push('## 解读摘要');
  lines.push('');
  appendInterpretationSummary(lines, report.interpretationSummary);

  lines.push('');
  lines.push('## 新发言实体候选');
  lines.push('');
  appendEntities(lines, report.newEntities || []);

  lines.push('');
  lines.push('## 新发言观点候选');
  lines.push('');
  appendOpinions(lines, report.newOpinions || []);

  lines.push('');
  lines.push('## 新发言隐晦表达候选');
  lines.push('');
  appendImplicitReferences(lines, report.newImplicitReferences || []);

  lines.push('');
  lines.push('## 可能承接的历史观点链');
  lines.push('');
  appendContextMatchSummary(lines, report.contextMatchSummary);
  lines.push('');
  appendContextChainMatches(lines, report.contextChainMatches || []);

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

function appendInterpretationSummary(lines, summary) {
  if (!summary) {
    lines.push('暂无。');
    return;
  }
  lines.push('- 状态：' + summary.status);
  lines.push('- 证据级别：' + summary.evidenceLevel);
  lines.push('- 置信度：' + summary.confidence);
  lines.push('- 摘要：' + safeInline(summary.summary));
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

function appendImplicitReferences(lines, candidates) {
  if (candidates.length === 0) {
    lines.push('暂无。');
    return;
  }
  candidates.forEach(function (candidate) {
    lines.push('- #' + candidate.floor + ' ' + candidate.label + '：`' + safeInline(candidate.phrase) + '`；置信度：' + candidate.confidence);
  });
}

function appendContextMatchSummary(lines, summary) {
  if (!summary) {
    lines.push('匹配摘要：暂无。');
    return;
  }
  lines.push('- 匹配状态：' + summary.status);
  lines.push('- 匹配数量：' + summary.total + '；需复核：' + summary.reviewRequiredCount);
  lines.push('- Top 对象：' + (summary.topEntity || '暂无'));
  lines.push('- 摘要：' + safeInline(summary.summary));
  if (summary.reviewReasons && summary.reviewReasons.length > 0) {
    lines.push('- 复核原因：' + summary.reviewReasons.map(function (item) {
      return item.reason + ' ' + item.count;
    }).join(' / '));
  }
}

function appendContextChainMatches(lines, matches) {
  if (matches.length === 0) {
    lines.push('暂无。');
    return;
  }
  matches.forEach(function (match) {
    const chain = match.chain || {};
    const entity = chain.entity || {};
    lines.push('- ' + safeInline(entity.displayName || chain.key) +
      '：' + match.relationType +
      '；关系族：' + (match.relationFamily || 'unknown') +
      '；证据级别：' + (match.relationEvidenceLevel || 'unknown') +
      '；置信度：' + match.confidence +
      '；最新态度：' + (chain.latestAttitude || 'unknown'));
    lines.push('  判断：' + safeInline(match.relationSummary));
    lines.push('  理由：' + (match.reasons || []).join(', '));
    if (match.reviewRequired) {
      lines.push('  复核：' + (match.reviewReasons || []).join(', '));
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
