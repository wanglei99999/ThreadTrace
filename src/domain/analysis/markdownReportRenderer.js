'use strict';

function renderBasicHistoryMarkdown(report) {
  const lines = [];
  const thread = report.thread;

  lines.push('# ' + thread.title);
  lines.push('');
  lines.push('## 分析概览');
  lines.push('');
  lines.push('- 来源：' + thread.sourceKey);
  lines.push('- 主题 ID：' + thread.sourceThreadId);
  lines.push('- 已解析楼层：' + thread.parsedPostCount);
  if (thread.totalPages) {
    lines.push('- 页数：第 ' + (thread.page || '?') + ' 页 / 共 ' + thread.totalPages + ' 页');
  }
  if (report.primaryAuthor) {
    lines.push('- 主楼作者：' + report.primaryAuthor.displayName + '（' + report.primaryAuthor.sourceAuthorId + '）');
  }

  lines.push('');
  lines.push('## 作者参与度');
  lines.push('');
  report.authorStats.slice(0, 12).forEach(function (item) {
    lines.push('- ' + item.author.displayName + '：' + item.postCount + ' 楼，楼层 ' + item.floors.join(', '));
  });

  lines.push('');
  lines.push('## 高信号楼层候选');
  lines.push('');
  appendEvidenceList(lines, report.evidenceCandidates.highSignalPosts);

  lines.push('');
  lines.push('## 外链线索');
  lines.push('');
  if (report.evidenceCandidates.externalLinks.length === 0) {
    lines.push('暂无。');
  } else {
    report.evidenceCandidates.externalLinks.forEach(function (link) {
      lines.push('- #' + link.floor + ' ' + link.author + '：[' + safeInline(link.text || link.url) + '](' + link.url + ')');
    });
  }

  lines.push('');
  lines.push('## 低信号楼层候选');
  lines.push('');
  appendEvidenceList(lines, report.evidenceCandidates.lowSignalPosts.slice(0, 12));

  lines.push('');
  lines.push('## 后续分析插槽');
  lines.push('');
  report.nextAnalysisSlots.forEach(function (slot) {
    lines.push('- `' + slot + '`');
  });

  lines.push('');
  lines.push('> 说明：当前报告是规则型基础报告，用于验证解析结构和证据组织。后续 LLM 分析会在此基础上区分明确证据、模型推测和置信度。');
  lines.push('');

  return lines.join('\n');
}

function appendEvidenceList(lines, items) {
  if (!items || items.length === 0) {
    lines.push('暂无。');
    return;
  }

  items.forEach(function (item) {
    lines.push('- #' + item.floor + ' ' + item.author + timeText(item) + scoreText(item));
    if (item.subject) {
      lines.push('  主题：' + safeInline(item.subject));
    }
    lines.push('  摘要：' + safeInline(item.excerpt || ''));
  });
}

function timeText(item) {
  return item.publishedAt ? '，' + item.publishedAt : '';
}

function scoreText(item) {
  return typeof item.score === 'number' ? '，推荐值 ' + item.score : '';
}

function safeInline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  renderBasicHistoryMarkdown
};
