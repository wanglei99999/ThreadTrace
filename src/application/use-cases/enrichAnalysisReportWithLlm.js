'use strict';

const { assertLlmProvider } = require('../ports/llmProvider');

async function enrichAnalysisReportWithLlm(options) {
  const safeOptions = options || {};
  const llmProvider = assertLlmProvider(safeOptions.llmProvider);
  const report = safeOptions.report;
  if (!report || !report.thread) {
    throw new Error('enrichAnalysisReportWithLlm requires a basic analysis report.');
  }

  const traceId = safeOptions.traceId || [
    report.thread.sourceKey,
    report.thread.sourceThreadId,
    'semantic-enrichment'
  ].filter(Boolean).join(':');
  const response = await llmProvider.completeStructured({
    task: 'thread-history-semantic-enrichment',
    traceId,
    schema: semanticEnrichmentSchema(),
    input: buildLlmInput(report)
  });

  return Object.assign({}, report, {
    semanticInsights: normalizeSemanticInsights(response.output, {
      provider: response.provider || safeOptions.providerKey || 'unknown',
      generatedAt: new Date().toISOString(),
      traceId,
      usage: response.usage
    })
  });
}

function buildLlmInput(report) {
  return {
    thread: report.thread,
    primaryAuthor: report.primaryAuthor,
    topEntities: (report.entityCandidates || []).slice(0, 12),
    topOpinions: (report.opinionCandidates || []).slice(0, 12),
    highSignalEvidence: ((report.evidenceCandidates && report.evidenceCandidates.highSignalPosts) || []).slice(0, 12),
    relations: (report.relationCandidates || []).slice(0, 12)
  };
}

function normalizeSemanticInsights(output, meta) {
  const safeOutput = output || {};
  return {
    provider: meta.provider,
    generatedAt: meta.generatedAt,
    traceId: meta.traceId,
    summary: safeOutput.summary || '',
    entityInsights: Array.isArray(safeOutput.entityInsights) ? safeOutput.entityInsights : [],
    opinionInsights: Array.isArray(safeOutput.opinionInsights) ? safeOutput.opinionInsights : [],
    evidenceQuestions: Array.isArray(safeOutput.evidenceQuestions) ? safeOutput.evidenceQuestions : [],
    limitations: Array.isArray(safeOutput.limitations) ? safeOutput.limitations : [],
    usage: meta.usage
  };
}

function semanticEnrichmentSchema() {
  return {
    type: 'object',
    required: ['summary', 'entityInsights', 'opinionInsights', 'evidenceQuestions', 'limitations'],
    properties: {
      summary: { type: 'string' },
      entityInsights: { type: 'array' },
      opinionInsights: { type: 'array' },
      evidenceQuestions: { type: 'array' },
      limitations: { type: 'array' }
    }
  };
}

module.exports = {
  enrichAnalysisReportWithLlm,
  semanticEnrichmentSchema
};
