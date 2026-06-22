'use strict';

const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');

async function getAuthorIntelligenceDashboard(options) {
  const safeOptions = options || {};
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const limit = safeOptions.limit || 100;
  const now = safeOptions.now || new Date().toISOString();
  const authorFilter = normalizeAuthorFilter(safeOptions);
  const rawReports = await reportRepository.listReports({
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    sourceThreadId: safeOptions.sourceThreadId,
    reportType: safeOptions.reportType || 'basic-history',
    limit
  });
  const revisionMode = safeOptions.includeReportRevisions === true ? 'all-revisions' : 'latest-per-thread';
  const reports = revisionMode === 'all-revisions' ? rawReports : latestReportsByThread(rawReports);

  if (rawReports.length === 0) {
    return emptyDashboard({
      now,
      limit,
      sourceKey: safeOptions.sourceKey || safeOptions.forum,
      sourceThreadId: safeOptions.sourceThreadId,
      authorFilter,
      revisionMode
    });
  }

  const authorMap = new Map();
  const entityMap = new Map();
  const opinionTimeline = [];
  const evidenceGaps = [];
  const evidence = [];
  const threads = [];

  reports.forEach(function (report) {
    const thread = summarizeThread(report);
    threads.push(thread);
    collectAuthors(authorMap, report, thread, authorFilter);
    collectPrimaryAuthorSignals(entityMap, evidenceGaps, report, thread, authorFilter);
    collectOpinions(authorMap, opinionTimeline, report, thread, authorFilter);
    collectEvidence(evidence, report, thread, authorFilter);
  });

  const authors = Array.from(authorMap.values())
    .map(finalizeAuthorSummary)
    .sort(compareAuthors)
    .slice(0, safeOptions.authorLimit || 20);
  const focusEntities = Array.from(entityMap.values())
    .map(finalizeEntitySummary)
    .sort(compareEntities)
    .slice(0, safeOptions.entityLimit || 20);
  const timeline = opinionTimeline
    .sort(compareTimeline)
    .slice(0, safeOptions.timelineLimit || 50);
  const evidenceRows = evidence
    .sort(compareEvidence)
    .slice(0, safeOptions.evidenceLimit || 20);
  const gapRows = evidenceGaps
    .sort(compareGaps)
    .slice(0, safeOptions.gapLimit || 20);

  return {
    generatedAt: now,
    status: reports.length > 0 ? 'ok' : 'warn',
    reportType: safeOptions.reportType || 'basic-history',
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    sourceThreadId: safeOptions.sourceThreadId,
    authorFilter,
    windowLimit: limit,
    revisionMode,
    reportCount: reports.length,
    reportRevisionCount: rawReports.length,
    summary: {
      threadCount: uniqueCount(threads.map(function (thread) { return thread.key; })),
      reportRevisionCount: rawReports.length,
      authorCount: authors.length,
      focusEntityCount: focusEntities.length,
      opinionCount: timeline.length,
      evidenceGapCount: gapRows.length,
      highSignalEvidenceCount: evidenceRows.length
    },
    authors,
    focusEntities,
    opinionTimeline: timeline,
    evidenceGaps: gapRows,
    evidence: evidenceRows,
    threads: threads.slice(0, safeOptions.threadLimit || 20),
    recommendedNextAction: recommendedNextAction({
      reportCount: reports.length,
      authorCount: authors.length,
      evidenceGapCount: gapRows.length,
      authorFilter
    })
  };
}

function emptyDashboard(options) {
  return {
    generatedAt: options.now,
    status: 'warn',
    reportType: 'basic-history',
    sourceKey: options.sourceKey,
    sourceThreadId: options.sourceThreadId,
    authorFilter: options.authorFilter,
    windowLimit: options.limit,
    revisionMode: options.revisionMode || 'latest-per-thread',
    reportCount: 0,
    reportRevisionCount: 0,
    summary: {
      threadCount: 0,
      reportRevisionCount: 0,
      authorCount: 0,
      focusEntityCount: 0,
      opinionCount: 0,
      evidenceGapCount: 0,
      highSignalEvidenceCount: 0
    },
    authors: [],
    focusEntities: [],
    opinionTimeline: [],
    evidenceGaps: [],
    evidence: [],
    threads: [],
    message: 'No basic-history reports found for the requested scope.',
    recommendedNextAction: 'Run an ingest or insight pipeline task to create basic-history reports before opening this dashboard.'
  };
}

function latestReportsByThread(reports) {
  const byThread = new Map();
  (reports || []).forEach(function (report, index) {
    const key = reportThreadKey(report, index);
    const existing = byThread.get(key);
    if (!existing || compareReportFreshness(report, existing) < 0) {
      byThread.set(key, report);
    }
  });
  return Array.from(byThread.values()).sort(compareReportFreshness);
}

function reportThreadKey(report, index) {
  const thread = report && report.thread || {};
  if (thread.sourceKey && thread.sourceThreadId) {
    return [thread.sourceKey, thread.sourceThreadId].join(':');
  }
  return 'report:' + index;
}

function compareReportFreshness(a, b) {
  return String(b && b.generatedAt || '').localeCompare(String(a && a.generatedAt || ''));
}

function collectAuthors(authorMap, report, thread, authorFilter) {
  (report.authorStats || []).forEach(function (item) {
    const author = item.author || {};
    if (!matchesAuthorFilter(author, authorFilter)) return;
    const key = authorKey(thread.sourceKey, author);
    const summary = getOrCreateAuthor(authorMap, key, thread.sourceKey, author);
    summary.postCount += numeric(item.postCount);
    summary.threadKeys.add(thread.key);
    summary.firstFloor = minFloor(summary.firstFloor, item.firstFloor);
    summary.lastFloor = maxFloor(summary.lastFloor, item.lastFloor);
    summary.floors = summary.floors.concat((item.floors || []).slice(0, 20));
    summary.lastSeenAt = latestTimestamp([summary.lastSeenAt, thread.generatedAt]);
    addThreadSummary(summary.threads, thread);
  });

  const profile = report.primaryAuthorProfile;
  if (!profile || !matchesAuthorFilter(profile.author || {}, authorFilter)) return;
  const key = authorKey(thread.sourceKey, profile.author || {});
  const summary = getOrCreateAuthor(authorMap, key, thread.sourceKey, profile.author || {});
  summary.primaryThreadCount += 1;
  summary.focusEntityCount += (profile.focusEntities || []).length;
  summary.evidenceGapCount += (profile.evidenceGaps || []).length;
  (profile.focusEntities || []).slice(0, 8).forEach(function (item) {
    summary.focusEntities.push({
      key: item.key,
      entity: item.entity,
      mentionCount: item.mentionCount,
      primaryAuthorOpinionCount: item.primaryAuthorOpinionCount,
      latestAttitude: item.latestAttitude,
      confidence: item.confidence,
      evidenceLevels: item.evidenceLevels,
      thread
    });
  });
}

function collectPrimaryAuthorSignals(entityMap, evidenceGaps, report, thread, authorFilter) {
  const profile = report.primaryAuthorProfile;
  if (!profile || !matchesAuthorFilter(profile.author || {}, authorFilter)) return;
  const author = profile.author || {};
  (profile.focusEntities || []).forEach(function (item) {
    const entity = item.entity || {};
    const key = item.key || entityKey(entity);
    const summary = getOrCreateEntity(entityMap, key, entity);
    summary.mentionCount += numeric(item.mentionCount);
    summary.primaryAuthorOpinionCount += numeric(item.primaryAuthorOpinionCount);
    summary.threadKeys.add(thread.key);
    summary.authorKeys.add(authorKey(thread.sourceKey, author));
    summary.latestAttitude = item.latestAttitude || summary.latestAttitude;
    summary.confidence = Math.max(summary.confidence || 0, numeric(item.confidence));
    mergeCounts(summary.evidenceLevels, item.evidenceLevels);
    addThreadSummary(summary.threads, thread);
  });
  (profile.evidenceGaps || []).forEach(function (gap) {
    evidenceGaps.push({
      key: gap.key,
      entity: gap.entity,
      reason: gap.reason,
      summary: gap.summary,
      firstFloor: gap.firstFloor,
      lastFloor: gap.lastFloor,
      author,
      thread
    });
  });
}

function collectOpinions(authorMap, opinionTimeline, report, thread, authorFilter) {
  (report.opinionCandidates || []).forEach(function (opinion) {
    const author = {
      sourceAuthorId: opinion.authorId,
      displayName: opinion.author
    };
    if (!matchesAuthorFilter(author, authorFilter)) return;
    collectOpinionForAuthor(authorMap, opinion, thread);
    opinionTimeline.push({
      thread,
      floor: opinion.floor,
      sourcePostId: opinion.sourcePostId,
      author,
      scope: opinion.scope,
      attitude: opinion.attitude,
      confidence: opinion.confidence,
      horizon: opinion.horizon,
      conditionSignals: opinion.conditionSignals || [],
      matchedKeywords: opinion.matchedKeywords || [],
      publishedAt: opinion.publishedAt,
      evidenceText: opinion.evidence && opinion.evidence.text
    });
  });
}

function collectOpinionForAuthor(authorMap, opinion, thread) {
  const author = {
    sourceAuthorId: opinion.authorId,
    displayName: opinion.author
  };
  const summary = getOrCreateAuthor(authorMap, authorKey(thread.sourceKey, author), thread.sourceKey, author);
  summary.opinionCount += 1;
  summary.opinionThreadKeys.add(thread.key);
  if (typeof opinion.confidence === 'number' && Number.isFinite(opinion.confidence)) {
    summary.opinionConfidenceTotal += opinion.confidence;
    summary.opinionConfidenceCount += 1;
  }
  const attitude = opinion.attitude || 'unknown';
  summary.stanceSummary[attitude] = (summary.stanceSummary[attitude] || 0) + 1;
  if (!summary.latestOpinionAt || String(opinion.publishedAt || thread.generatedAt || '').localeCompare(String(summary.latestOpinionAt)) >= 0) {
    summary.latestOpinionAt = opinion.publishedAt || thread.generatedAt;
    summary.latestAttitude = attitude;
  }
}

function collectEvidence(evidence, report, thread, authorFilter) {
  const candidates = report.evidenceCandidates || {};
  (candidates.highSignalPosts || []).forEach(function (item) {
    const author = {
      sourceAuthorId: item.authorId,
      displayName: item.author
    };
    if (!matchesAuthorFilter(author, authorFilter)) return;
    evidence.push({
      thread,
      floor: item.floor,
      sourcePostId: item.sourcePostId,
      author,
      publishedAt: item.publishedAt,
      score: item.score,
      subject: item.subject,
      excerpt: item.excerpt,
      links: item.links || []
    });
  });
}

function summarizeThread(report) {
  const thread = report.thread || {};
  return {
    key: [thread.sourceKey || 'unknown', thread.sourceThreadId || 'unknown'].join(':'),
    sourceKey: thread.sourceKey,
    sourceThreadId: thread.sourceThreadId,
    title: thread.title,
    url: thread.url,
    parsedPostCount: thread.parsedPostCount,
    totalPages: thread.totalPages,
    generatedAt: report.generatedAt,
    reportType: report.reportType
  };
}

function getOrCreateAuthor(map, key, sourceKey, author) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      sourceKey,
      author: {
        sourceKey: author.sourceKey || sourceKey,
        sourceAuthorId: author.sourceAuthorId,
        displayName: author.displayName
      },
      postCount: 0,
      opinionCount: 0,
      primaryThreadCount: 0,
      threadKeys: new Set(),
      threads: [],
      firstFloor: undefined,
      lastFloor: undefined,
      floors: [],
      stanceSummary: {},
      opinionThreadKeys: new Set(),
      latestOpinionAt: undefined,
      latestAttitude: undefined,
      opinionConfidenceTotal: 0,
      opinionConfidenceCount: 0,
      focusEntityCount: 0,
      evidenceGapCount: 0,
      focusEntities: [],
      lastSeenAt: undefined
    });
  }
  return map.get(key);
}

function getOrCreateEntity(map, key, entity) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      entity,
      mentionCount: 0,
      primaryAuthorOpinionCount: 0,
      latestAttitude: 'unknown',
      confidence: 0,
      evidenceLevels: {},
      threadKeys: new Set(),
      authorKeys: new Set(),
      threads: []
    });
  }
  return map.get(key);
}

function finalizeAuthorSummary(summary) {
  const focusEntities = mergeAuthorFocusEntities(summary.focusEntities)
    .slice(0, 8);
  const inferredFocusEntityCount = focusEntities.filter(function (item) {
    return item.evidenceLevels && item.evidenceLevels.inferred > 0;
  }).length;
  const intelligence = buildAuthorIntelligenceSummary({
    stanceSummary: summary.stanceSummary,
    opinionCount: summary.opinionCount,
    opinionThreadCount: summary.opinionThreadKeys.size,
    latestOpinionAt: summary.latestOpinionAt,
    latestAttitude: summary.latestAttitude,
    opinionConfidenceTotal: summary.opinionConfidenceTotal,
    opinionConfidenceCount: summary.opinionConfidenceCount,
    evidenceGapCount: summary.evidenceGapCount,
    inferredFocusEntityCount
  });
  return {
    key: summary.key,
    sourceKey: summary.sourceKey,
    author: summary.author,
    postCount: summary.postCount,
    opinionCount: summary.opinionCount,
    primaryThreadCount: summary.primaryThreadCount,
    threadCount: summary.threadKeys.size,
    firstFloor: summary.firstFloor,
    lastFloor: summary.lastFloor,
    floors: uniqueValues(summary.floors).slice(0, 40),
    stanceSummary: summary.stanceSummary,
    dominantStance: intelligence.dominantStance,
    latestAttitude: intelligence.latestAttitude,
    latestOpinionAt: intelligence.latestOpinionAt,
    averageOpinionConfidence: intelligence.averageOpinionConfidence,
    opinionThreadCount: summary.opinionThreadKeys.size,
    focusEntityCount: focusEntities.length,
    focusEntityMentionCount: focusEntities.reduce(function (total, item) {
      return total + numeric(item.mentionCount);
    }, 0),
    evidenceGapCount: summary.evidenceGapCount,
    inferredFocusEntityCount,
    intelligence,
    topFocusEntities: focusEntities,
    lastSeenAt: summary.lastSeenAt,
    threads: summary.threads.slice(0, 8)
  };
}

function mergeAuthorFocusEntities(items) {
  const byEntity = new Map();
  (items || []).forEach(function (item) {
    const key = item.key || entityKey(item.entity || {});
    if (!byEntity.has(key)) {
      byEntity.set(key, {
        key,
        entity: item.entity,
        mentionCount: 0,
        primaryAuthorOpinionCount: 0,
        latestAttitude: item.latestAttitude || 'unknown',
        confidence: 0,
        evidenceLevels: {},
        threadKeys: new Set(),
        threads: []
      });
    }
    const summary = byEntity.get(key);
    summary.mentionCount += numeric(item.mentionCount);
    summary.primaryAuthorOpinionCount += numeric(item.primaryAuthorOpinionCount);
    summary.latestAttitude = item.latestAttitude || summary.latestAttitude;
    summary.confidence = Math.max(summary.confidence || 0, numeric(item.confidence));
    mergeCounts(summary.evidenceLevels, item.evidenceLevels);
    if (item.thread) {
      summary.threadKeys.add(item.thread.key);
      addThreadSummary(summary.threads, item.thread);
    }
  });
  return Array.from(byEntity.values()).map(function (item) {
    return {
      key: item.key,
      entity: item.entity,
      mentionCount: item.mentionCount,
      primaryAuthorOpinionCount: item.primaryAuthorOpinionCount,
      latestAttitude: item.latestAttitude,
      confidence: item.confidence,
      evidenceLevels: item.evidenceLevels,
      threadCount: item.threadKeys.size,
      threads: item.threads.slice(0, 4)
    };
  }).sort(function (a, b) {
    return numeric(b.primaryAuthorOpinionCount) - numeric(a.primaryAuthorOpinionCount)
      || numeric(b.mentionCount) - numeric(a.mentionCount)
      || numeric(b.confidence) - numeric(a.confidence)
      || String(a.entity && a.entity.displayName || a.key).localeCompare(String(b.entity && b.entity.displayName || b.key));
  });
}

function buildAuthorIntelligenceSummary(input) {
  const dominantStance = dominantCountKey(input.stanceSummary);
  const evidenceStatus = input.evidenceGapCount > 0 || input.inferredFocusEntityCount > 0 ? 'needs-review' : 'ready';
  return {
    dominantStance: dominantStance || 'unknown',
    latestAttitude: input.latestAttitude || 'unknown',
    latestOpinionAt: input.latestOpinionAt,
    opinionThreadCount: input.opinionThreadCount,
    averageOpinionConfidence: input.opinionConfidenceCount > 0
      ? Number((input.opinionConfidenceTotal / input.opinionConfidenceCount).toFixed(2))
      : undefined,
    evidenceStatus,
    summary: buildAuthorIntelligenceText({
      dominantStance,
      latestAttitude: input.latestAttitude,
      opinionCount: input.opinionCount,
      opinionThreadCount: input.opinionThreadCount,
      evidenceStatus,
      evidenceGapCount: input.evidenceGapCount,
      inferredFocusEntityCount: input.inferredFocusEntityCount
    })
  };
}

function buildAuthorIntelligenceText(input) {
  if (!input.opinionCount) {
    return 'No explicit opinion signal in the current report window.';
  }
  const stance = input.dominantStance || 'unknown';
  const latest = input.latestAttitude || 'unknown';
  const scope = input.opinionThreadCount > 1 ? ' across ' + input.opinionThreadCount + ' threads' : '';
  const evidenceNote = input.evidenceStatus === 'needs-review'
    ? ' Evidence review needed: gaps=' + input.evidenceGapCount + ', inferred=' + input.inferredFocusEntityCount + '.'
    : ' Evidence state looks ready.';
  return 'Dominant stance ' + stance + ', latest ' + latest + ', opinions=' + input.opinionCount + scope + '.' + evidenceNote;
}

function finalizeEntitySummary(summary) {
  return {
    key: summary.key,
    entity: summary.entity,
    mentionCount: summary.mentionCount,
    primaryAuthorOpinionCount: summary.primaryAuthorOpinionCount,
    latestAttitude: summary.latestAttitude,
    confidence: summary.confidence,
    evidenceLevels: summary.evidenceLevels,
    threadCount: summary.threadKeys.size,
    authorCount: summary.authorKeys.size,
    threads: summary.threads.slice(0, 8)
  };
}

function addThreadSummary(threads, thread) {
  if (threads.some(function (item) { return item.key === thread.key; })) return;
  threads.push(thread);
}

function normalizeAuthorFilter(options) {
  const authorId = options.authorId || options.sourceAuthorId;
  const displayName = options.author || options.authorName || options.displayName;
  if (!authorId && !displayName) return undefined;
  return {
    authorId,
    displayName
  };
}

function matchesAuthorFilter(author, filter) {
  if (!filter) return true;
  if (filter.authorId && author && author.sourceAuthorId === filter.authorId) return true;
  if (filter.displayName && author && author.displayName === filter.displayName) return true;
  return false;
}

function authorKey(sourceKey, author) {
  return [
    sourceKey || author.sourceKey || 'unknown',
    author.sourceAuthorId || author.displayName || 'unknown'
  ].join(':');
}

function entityKey(entity) {
  return [entity.type || 'entity', entity.normalized || entity.displayName || 'unknown'].join(':');
}

function mergeCounts(target, source) {
  Object.keys(source || {}).forEach(function (key) {
    target[key] = numeric(target[key]) + numeric(source[key]);
  });
}

function dominantCountKey(summary) {
  return Object.keys(summary || {}).sort(function (a, b) {
    return numeric(summary[b]) - numeric(summary[a]) || a.localeCompare(b);
  })[0];
}

function compareAuthors(a, b) {
  return b.primaryThreadCount - a.primaryThreadCount
    || b.opinionCount - a.opinionCount
    || b.postCount - a.postCount
    || String(a.author.displayName || '').localeCompare(String(b.author.displayName || ''));
}

function compareEntities(a, b) {
  return b.primaryAuthorOpinionCount - a.primaryAuthorOpinionCount
    || b.mentionCount - a.mentionCount
    || b.confidence - a.confidence
    || String(a.entity.displayName || '').localeCompare(String(b.entity.displayName || ''));
}

function compareTimeline(a, b) {
  return String(b.publishedAt || b.thread.generatedAt || '').localeCompare(String(a.publishedAt || a.thread.generatedAt || ''))
    || numeric(a.floor) - numeric(b.floor);
}

function compareEvidence(a, b) {
  return numeric(b.score) - numeric(a.score)
    || String(b.publishedAt || b.thread.generatedAt || '').localeCompare(String(a.publishedAt || a.thread.generatedAt || ''));
}

function compareGaps(a, b) {
  return String(b.thread.generatedAt || '').localeCompare(String(a.thread.generatedAt || ''))
    || numeric(a.firstFloor) - numeric(b.firstFloor);
}

function recommendedNextAction(input) {
  if (input.reportCount === 0) {
    return 'Run an ingest or insight pipeline task to generate basic-history reports.';
  }
  if (input.authorFilter && input.authorCount === 0) {
    return 'No matching author was found in the current report window; widen the filter or ingest more source history.';
  }
  if (input.evidenceGapCount > 0) {
    return 'Review evidence gaps before treating inferred author opinions as confirmed intelligence.';
  }
  return 'Use top authors, focus entities, and opinion timeline as the next review queue.';
}

function uniqueCount(values) {
  return uniqueValues(values).length;
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(function (value) {
    return value !== undefined && value !== null && value !== '';
  })));
}

function minFloor(current, next) {
  if (next === undefined || next === null) return current;
  if (current === undefined || current === null) return next;
  return Math.min(current, next);
}

function maxFloor(current, next) {
  if (next === undefined || next === null) return current;
  if (current === undefined || current === null) return next;
  return Math.max(current, next);
}

function latestTimestamp(values) {
  return (values || []).filter(Boolean).sort().reverse()[0];
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

module.exports = {
  getAuthorIntelligenceDashboard
};
