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
    semanticInsights: normalizeSemanticInsights(validateSemanticEnrichmentOutput(response.output), {
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
    validation: safeOutput.validation,
    usage: meta.usage
  };
}

function validateSemanticEnrichmentOutput(output) {
  const checks = [];
  const safeOutput = output || {};
  const required = [
    { key: 'summary', type: 'string' },
    { key: 'entityInsights', type: 'array' },
    { key: 'opinionInsights', type: 'array' },
    { key: 'evidenceQuestions', type: 'array' },
    { key: 'limitations', type: 'array' }
  ];

  required.forEach(function (field) {
    const value = safeOutput[field.key];
    const valid = field.type === 'array' ? Array.isArray(value) : typeof value === field.type;
    checks.push({
      key: 'semantic.' + field.key,
      status: valid ? 'ok' : 'fail',
      expected: field.type,
      actual: Array.isArray(value) ? 'array' : typeof value
    });
  });

  const failed = checks.filter(function (check) {
    return check.status === 'fail';
  });
  if (failed.length > 0) {
    const summary = failed.map(function (check) {
      return check.key + ' expected ' + check.expected + ' got ' + check.actual;
    }).join('; ');
    const error = new Error('Semantic enrichment output validation failed: ' + summary + '.');
    error.validation = {
      status: 'fail',
      checks
    };
    throw error;
  }

  return Object.assign({}, safeOutput, {
    validation: {
      status: 'ok',
      schemaVersion: 'semantic-enrichment.v1',
      checks
    }
  });
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
  semanticEnrichmentSchema,
  validateSemanticEnrichmentOutput
};
