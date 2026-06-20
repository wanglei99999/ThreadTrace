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
  lines.push('## 主作者历史画像');
  lines.push('');
  appendPrimaryAuthorProfile(lines, report.primaryAuthorProfile);

  lines.push('');
  lines.push('## 实体与线索候选');
  lines.push('');
  appendEntityCandidates(lines, report.entityCandidates || []);

  lines.push('');
  lines.push('## 引用与回复关系候选');
  lines.push('');
  appendRelationCandidates(lines, report.relationCandidates || []);

  lines.push('');
  lines.push('## 观点候选');
  lines.push('');
  appendOpinionCandidates(lines, report.opinionCandidates || []);

  lines.push('');
  lines.push('## 观点链候选');
  lines.push('');
  appendOpinionChains(lines, report.opinionChains || []);

  lines.push('');
  lines.push('## 隐晦表达候选');
  lines.push('');
  appendImplicitReferenceCandidates(lines, report.implicitReferenceCandidates || []);

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

function appendEntityCandidates(lines, entities) {
  if (!entities || entities.length === 0) {
    lines.push('暂无。');
    return;
  }

  entities.slice(0, 20).forEach(function (entity) {
    lines.push('- ' + entity.displayName + '（' + entity.type + '）：出现 ' + entity.mentions.length + ' 次');
    entity.mentions.slice(0, 3).forEach(function (mention) {
      lines.push('  - #' + mention.floor + ' ' + mention.author + '：' + safeInline(mention.excerpt));
    });
  });
}

function appendPrimaryAuthorProfile(lines, profile) {
  if (!profile) {
    lines.push('暂无。');
    return;
  }

  lines.push('- 作者：' + profile.author.displayName + '（' + profile.author.sourceAuthorId + '）');
  lines.push('- 发言楼层：' + profile.postCount + ' 楼，范围 #' + profile.firstFloor + ' - #' + profile.lastFloor);
  lines.push('- 观点候选：' + profile.opinionCount + ' 条');
  lines.push('- 态度分布：' + stanceSummaryText(profile.stanceSummary));
  lines.push('');
  lines.push('### 关注对象');
  if (!profile.focusEntities || profile.focusEntities.length === 0) {
    lines.push('暂无。');
  } else {
    profile.focusEntities.slice(0, 8).forEach(function (item) {
      lines.push('- ' + safeInline(item.entity.displayName) +
        '：提及 ' + item.mentionCount +
        ' 次，主作者观点 ' + item.primaryAuthorOpinionCount +
        ' 条，最新态度 ' + (item.latestAttitude || 'unknown') +
        '，置信度 ' + item.confidence);
    });
  }
  lines.push('');
  lines.push('### 证据缺口');
  if (!profile.evidenceGaps || profile.evidenceGaps.length === 0) {
    lines.push('暂无。');
  } else {
    profile.evidenceGaps.forEach(function (gap) {
      lines.push('- ' + safeInline(gap.entity.displayName) + '：' + gap.summary + '（#' + gap.firstFloor + ' - #' + gap.lastFloor + '）');
    });
  }
}

function stanceSummaryText(summary) {
  const keys = Object.keys(summary || {});
  if (keys.length === 0) return '暂无';
  return keys.sort().map(function (key) {
    return key + ' ' + summary[key];
  }).join(' / ');
}

function appendOpinionCandidates(lines, opinions) {
  if (!opinions || opinions.length === 0) {
    lines.push('暂无。');
    return;
  }

  opinions.slice(0, 20).forEach(function (opinion) {
    const parts = [
      '- #' + opinion.floor + ' ' + opinion.author,
      '范围：' + (opinion.scope || 'unknown'),
      '态度：' + opinion.attitude,
      '置信度：' + opinion.confidence
    ];
    if (opinion.horizon) {
      parts.push('周期：' + opinion.horizon);
    }
    if (opinion.matchedKeywords && opinion.matchedKeywords.length > 0) {
      parts.push('关键词：' + opinion.matchedKeywords.join(', '));
    }
    lines.push(parts.join('；'));
    if (opinion.conditionSignals && opinion.conditionSignals.length > 0) {
      lines.push('  条件：' + opinion.conditionSignals.join(' / '));
    }
    lines.push('  证据：' + safeInline(opinion.evidence && opinion.evidence.text));
  });
}

function appendOpinionChains(lines, chains) {
  if (!chains || chains.length === 0) {
    lines.push('暂无。');
    return;
  }

  chains.slice(0, 12).forEach(function (chain) {
    const entity = chain.entity || {};
    lines.push('- ' + safeInline(entity.displayName || chain.key) +
      '：观点 ' + chain.opinionCount +
      ' 条，提及 ' + chain.mentionCount +
      ' 次，主作者观点 ' + chain.primaryAuthorOpinionCount +
      ' 条，最新态度 ' + (chain.latestAttitude || 'unknown') +
      '，置信度 ' + chain.confidence);
    lines.push('  证据级别：明确 ' + ((chain.evidenceLevels && chain.evidenceLevels.explicit) || 0) +
      ' / 推断 ' + ((chain.evidenceLevels && chain.evidenceLevels.inferred) || 0));
    (chain.timeline || []).slice(0, 5).forEach(function (event) {
      const label = event.eventType === 'opinion'
        ? '观点 ' + (event.attitude || 'unknown') + ' / ' + event.evidenceLevel
        : '实体提及 / explicit';
      lines.push('  - #' + event.floor + ' ' + event.author + '：' + label + '：' + safeInline(event.evidenceText || event.summary || ''));
      if (event.conditionSignals && event.conditionSignals.length > 0) {
        lines.push('    条件：' + event.conditionSignals.join(' / '));
      }
    });
  });
}

function appendImplicitReferenceCandidates(lines, candidates) {
  if (!candidates || candidates.length === 0) {
    lines.push('暂无。');
    return;
  }

  candidates.slice(0, 16).forEach(function (candidate) {
    lines.push('- #' + candidate.floor + ' ' + candidate.author +
      '：' + candidate.label +
      ' `' + safeInline(candidate.phrase) + '`' +
      '，置信度 ' + candidate.confidence);
    if (candidate.nearbyEntities && candidate.nearbyEntities.length > 0) {
      lines.push('  附近对象：' + candidate.nearbyEntities.map(function (entity) {
        return entity.displayName + '/' + entity.evidenceLevel + '/#' + entity.floor;
      }).join('，'));
    }
    if (candidate.sameFloorOpinions && candidate.sameFloorOpinions.length > 0) {
      lines.push('  同楼层观点：' + candidate.sameFloorOpinions.map(function (opinion) {
        return opinion.attitude + ' ' + opinion.confidence;
      }).join('，'));
    }
    lines.push('  证据：' + safeInline(candidate.evidenceText));
  });
}

function appendRelationCandidates(lines, relations) {
  if (!relations || relations.length === 0) {
    lines.push('暂无。');
    return;
  }

  relations.slice(0, 30).forEach(function (relation) {
    const target = relation.targetFloor !== undefined
      ? '目标楼层线索 #' + relation.targetFloor
      : relation.targetPostId
        ? '目标帖子 ' + relation.targetPostId
        : '目标主题 ' + (relation.targetThreadId || 'unknown');
    lines.push('- #' + relation.sourceFloor + ' ' + relation.sourceAuthor + ' -> ' + target + '（' + relation.type + '）');
  });
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
