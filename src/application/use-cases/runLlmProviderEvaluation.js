'use strict';

const {
  semanticEnrichmentSchema,
  validateSemanticEnrichmentOutput
} = require('./enrichAnalysisReportWithLlm');
const { buildDefaultPreflightInput } = require('./runLlmProviderPreflight');

async function runLlmProviderEvaluation(options) {
  const safeOptions = options || {};
  const provider = safeOptions.llmProvider;
  const providerKey = safeOptions.providerKey || 'mock';
  const generatedAt = safeOptions.now || new Date().toISOString();
  const traceId = safeOptions.traceId || ['llm-evaluation', providerKey, generatedAt].join(':');
  const samples = normalizeSamples(safeOptions.samples);

  if (!provider || typeof provider.completeStructured !== 'function') {
    const creationMessage = safeOptions.providerCreationError && safeOptions.providerCreationError.message;
    return buildEvaluationReport({
      generatedAt,
      provider: providerKey,
      traceId,
      samples,
      results: samples.map(function (sample) {
        return sampleFailure(sample, creationMessage || 'LlmProvider must implement completeStructured(request).');
      })
    });
  }

  const results = [];
  for (let index = 0; index < samples.length; index += 1) {
    results.push(await evaluateSample({
      provider,
      providerKey,
      traceId,
      sample: samples[index]
    }));
  }

  return buildEvaluationReport({
    generatedAt,
    provider: results.find(function (result) { return result.provider; }) && results.find(function (result) { return result.provider; }).provider || providerKey,
    traceId,
    samples,
    results
  });
}

async function evaluateSample(options) {
  const sample = options.sample;
  const sampleTraceId = [options.traceId, sample.id].join(':');
  try {
    const response = await options.provider.completeStructured({
      task: 'thread-history-semantic-enrichment',
      traceId: sampleTraceId,
      schema: semanticEnrichmentSchema(),
      input: sample.input
    });
    const validated = validateSemanticEnrichmentOutput(response.output);
    const qualityChecks = buildQualityChecks(validated, sample);
    return {
      id: sample.id,
      title: sample.title,
      status: aggregateStatus(qualityChecks),
      provider: response.provider || options.providerKey,
      traceId: sampleTraceId,
      validation: validated.validation,
      qualityChecks,
      usage: response.usage,
      outputPreview: outputPreview(validated)
    };
  } catch (error) {
    return sampleFailure(sample, error.message, error.validation, sampleTraceId);
  }
}

function buildQualityChecks(output, sample) {
  const entityCount = (output.entityInsights || []).length;
  const opinionCount = (output.opinionInsights || []).length;
  const evidenceRefCount = countEvidenceRefs(output);
  const checks = [
    check('llm.output.summary.nonEmpty', output.summary && output.summary.trim() ? 'ok' : 'warn', 'Summary should be non-empty.'),
    check('llm.output.limitations.present', (output.limitations || []).length > 0 ? 'ok' : 'warn', 'Limitations should describe uncertainty or provider constraints.'),
    check('llm.output.evidenceRefs.present', evidenceRefCount > 0 ? 'ok' : 'warn', 'Insights should cite source evidence references.'),
    check('llm.output.insights.present', entityCount + opinionCount > 0 ? 'ok' : 'warn', 'Provider should return at least one entity or opinion insight for the sample.')
  ];
  if (sample.expected && sample.expected.minEvidenceRefs !== undefined) {
    checks.push(check(
      'llm.output.evidenceRefs.minimum',
      evidenceRefCount >= sample.expected.minEvidenceRefs ? 'ok' : 'warn',
      'Expected at least ' + sample.expected.minEvidenceRefs + ' evidence reference(s).'
    ));
  }
  return checks;
}

function buildEvaluationReport(options) {
  const results = options.results || [];
  const failed = results.filter(function (result) { return result.status === 'fail'; }).length;
  const warned = results.filter(function (result) { return result.status === 'warn'; }).length;
  const status = failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'ok';
  return {
    generatedAt: options.generatedAt,
    status,
    provider: options.provider,
    traceId: options.traceId,
    task: 'thread-history-semantic-enrichment',
    schemaVersion: 'semantic-enrichment.v1',
    sampleCount: results.length,
    summary: {
      ok: results.filter(function (result) { return result.status === 'ok'; }).length,
      warn: warned,
      fail: failed
    },
    results,
    nextActions: buildNextActions(status, options.provider)
  };
}

function normalizeSamples(samples) {
  const safeSamples = Array.isArray(samples) && samples.length > 0 ? samples : buildDefaultEvaluationSamples();
  return safeSamples.map(function (sample, index) {
    return {
      id: String(sample.id || 'sample-' + (index + 1)),
      title: sample.title || sample.name || 'LLM evaluation sample ' + (index + 1),
      input: sample.input || sample,
      expected: sample.expected || {}
    };
  });
}

function buildDefaultEvaluationSamples() {
  const preflight = buildDefaultPreflightInput();
  return [{
    id: 'preflight-evidence',
    title: 'Evidence-grounded semantic enrichment',
    input: preflight,
    expected: {
      minEvidenceRefs: 1
    }
  }, {
    id: 'implicit-context',
    title: 'Implicit context and caution handling',
    input: Object.assign({}, preflight, {
      thread: Object.assign({}, preflight.thread, {
        sourceThreadId: 'llm-evaluation-implicit-context',
        title: 'Evaluate implicit context recovery'
      }),
      topEntities: [{
        displayName: 'AI analysis',
        type: 'capability',
        mentions: [{
          floor: 3,
          sourcePostId: 'eval-3',
          evidenceText: 'The later reply says it is still promising, but only after checking the original claim.'
        }, {
          floor: 4,
          sourcePostId: 'eval-4',
          evidenceText: 'Another poster warns that the earlier optimism depended on a narrow benchmark.'
        }]
      }],
      topOpinions: [{
        floor: 4,
        sourcePostId: 'eval-4',
        author: 'Evaluator',
        attitude: 'cautious',
        confidence: 'medium',
        scope: 'claim follow-up',
        evidence: {
          text: 'The earlier optimism depended on a narrow benchmark.'
        }
      }],
      highSignalEvidence: [{
        floor: 4,
        sourcePostId: 'eval-4',
        excerpt: 'The earlier optimism depended on a narrow benchmark.'
      }]
    }),
    expected: {
      minEvidenceRefs: 1
    }
  }];
}

function sampleFailure(sample, message, validation, traceId) {
  return {
    id: sample.id,
    title: sample.title,
    status: 'fail',
    traceId,
    validation,
    qualityChecks: [
      check('llm.sample.completed', 'fail', message || 'Sample evaluation failed.')
    ],
    error: {
      message: message || 'Sample evaluation failed.'
    }
  };
}

function outputPreview(output) {
  return {
    summary: output.summary,
    entityInsightCount: (output.entityInsights || []).length,
    opinionInsightCount: (output.opinionInsights || []).length,
    evidenceQuestionCount: (output.evidenceQuestions || []).length,
    limitationCount: (output.limitations || []).length,
    evidenceRefCount: countEvidenceRefs(output)
  };
}

function countEvidenceRefs(output) {
  return []
    .concat(output.entityInsights || [])
    .concat(output.opinionInsights || [])
    .concat(output.evidenceQuestions || [])
    .reduce(function (count, item) {
      return count + (Array.isArray(item.evidenceRefs) ? item.evidenceRefs.length : 0);
    }, 0);
}

function buildNextActions(status, provider) {
  if (status === 'ok') {
    return [{
      key: 'llm.evaluation.ready',
      severity: 'info',
      summary: 'Provider passed semantic contract and quality checks for evaluation samples.',
      commands: [
        'node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id <source-id> --provider ' + provider
      ]
    }];
  }
  return [{
    key: 'llm.evaluation.review',
    severity: status === 'fail' ? 'warning' : 'info',
    summary: 'Review failed or warning evaluation samples before enabling real source insight workers.',
    commands: [
      'node src/presentation/cli/threadtrace.js llm-evaluate --provider ' + provider + ' --json true',
      'node src/presentation/cli/threadtrace.js llm-preflight --provider ' + provider
    ]
  }];
}

function check(key, status, summary) {
  return { key, status, summary };
}

function aggregateStatus(checks) {
  if ((checks || []).some(function (item) { return item.status === 'fail'; })) return 'fail';
  if ((checks || []).some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  runLlmProviderEvaluation,
  buildDefaultEvaluationSamples
};
