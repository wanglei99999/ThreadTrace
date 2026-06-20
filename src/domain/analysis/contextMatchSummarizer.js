'use strict';

function summarizeContextMatches(matches) {
  const safeMatches = matches || [];
  const relationFamilyCounts = countBy(safeMatches, function (match) {
    return match.relationFamily || 'unknown';
  });
  const evidenceLevelCounts = countBy(safeMatches, function (match) {
    return match.relationEvidenceLevel || 'unknown';
  });
  const reviewReasons = topReviewReasons(safeMatches);
  const reviewRequiredCount = safeMatches.filter(function (match) {
    return Boolean(match.reviewRequired);
  }).length;
  const topMatch = safeMatches[0];
  const status = summaryStatus({
    total: safeMatches.length,
    reviewRequiredCount,
    topMatch
  });

  return {
    status,
    total: safeMatches.length,
    reviewRequiredCount,
    topRelationType: topMatch && topMatch.relationType,
    topRelationFamily: topMatch && topMatch.relationFamily,
    topEntity: topMatch && topMatch.chain && topMatch.chain.entity && topMatch.chain.entity.displayName,
    relationFamilyCounts,
    evidenceLevelCounts,
    reviewReasons,
    summary: summaryText({
      status,
      total: safeMatches.length,
      reviewRequiredCount,
      topMatch
    })
  };
}

function summaryStatus(input) {
  if (input.total === 0) return 'unmatched';
  if (input.reviewRequiredCount > 0) return 'review-required';
  if (input.topMatch && input.topMatch.relationEvidenceLevel === 'explicit') return 'well-supported';
  return 'matched';
}

function summaryText(input) {
  if (input.status === 'unmatched') {
    return '暂未匹配到可承接的历史观点链。';
  }
  const entity = input.topMatch && input.topMatch.chain && input.topMatch.chain.entity
    ? input.topMatch.chain.entity.displayName
    : '未知对象';
  if (input.status === 'review-required') {
    return '已匹配到“' + entity + '”等历史链，但存在推断或待核验因素，应回看原始楼层。';
  }
  if (input.status === 'well-supported') {
    return '已匹配到“' + entity + '”历史链，主要由明确证据支撑。';
  }
  return '已匹配到“' + entity + '”历史链，可作为语境还原候选。';
}

function countBy(items, keyFn) {
  return items.reduce(function (counts, item) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function topReviewReasons(matches) {
  const counts = {};
  matches.forEach(function (match) {
    (match.reviewReasons || []).forEach(function (reason) {
      counts[reason] = (counts[reason] || 0) + 1;
    });
  });
  return Object.keys(counts).sort(function (a, b) {
    return counts[b] - counts[a] || a.localeCompare(b);
  }).slice(0, 6).map(function (reason) {
    return {
      reason,
      count: counts[reason]
    };
  });
}

module.exports = {
  summarizeContextMatches
};
