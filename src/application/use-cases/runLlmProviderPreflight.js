'use strict';

const {
  semanticEnrichmentSchema,
  validateSemanticEnrichmentOutput
} = require('./enrichAnalysisReportWithLlm');

async function runLlmProviderPreflight(options) {
  const safeOptions = options || {};
  const provider = safeOptions.llmProvider;
  const providerKey = safeOptions.providerKey || 'mock';
  const generatedAt = safeOptions.now || new Date().toISOString();
  const traceId = safeOptions.traceId || ['llm-preflight', providerKey, generatedAt].join(':');
  const checks = [
    check('llm.provider.created', provider && typeof provider.completeStructured === 'function' ? 'ok' : 'fail', 'LLM provider instance is available.')
  ];

  if (!provider || typeof provider.completeStructured !== 'function') {
    return buildPreflightReport({
      generatedAt,
      provider: providerKey,
      traceId,
      checks,
      error: 'LlmProvider must implement completeStructured(request).'
    });
  }

  try {
    const response = await provider.completeStructured({
      task: 'thread-history-semantic-enrichment',
      traceId,
      schema: semanticEnrichmentSchema(),
      input: safeOptions.input || buildDefaultPreflightInput()
    });
    checks.push(check('llm.provider.call', 'ok', 'Provider returned a structured response.'));
    const validated = validateSemanticEnrichmentOutput(response.output);
    checks.push(check('llm.semantic.validation', 'ok', 'Provider output matched the semantic enrichment contract.'));
    return buildPreflightReport({
      generatedAt,
      provider: response.provider || providerKey,
      traceId,
      checks,
      validation: validated.validation,
      usage: response.usage,
      outputPreview: {
        summary: validated.summary,
        entityInsightCount: validated.entityInsights.length,
        opinionInsightCount: validated.opinionInsights.length,
        evidenceQuestionCount: validated.evidenceQuestions.length,
        limitationCount: validated.limitations.length
      }
    });
  } catch (error) {
    checks.push(check('llm.provider.call', error.validation ? 'ok' : 'fail', error.validation ? 'Provider returned output for validation.' : error.message));
    checks.push(check('llm.semantic.validation', 'fail', error.validation ? 'Provider output failed semantic enrichment validation.' : 'Provider call did not produce valid semantic output.'));
    return buildPreflightReport({
      generatedAt,
      provider: providerKey,
      traceId,
      checks,
      validation: error.validation,
      error: error.message
    });
  }
}

function buildLlmProviderPreflightFailure(options) {
  const safeOptions = options || {};
  const generatedAt = safeOptions.now || new Date().toISOString();
  const provider = safeOptions.providerKey || safeOptions.provider || 'unknown';
  return buildPreflightReport({
    generatedAt,
    provider,
    traceId: safeOptions.traceId || ['llm-preflight', provider, generatedAt].join(':'),
    checks: [
      check('llm.provider.created', 'fail', safeOptions.error && safeOptions.error.message || 'LLM provider could not be created.'),
      check('llm.semantic.validation', 'fail', 'Semantic validation was not run because provider creation failed.')
    ],
    error: safeOptions.error && safeOptions.error.message || String(safeOptions.error || 'LLM provider could not be created.')
  });
}

function buildPreflightReport(options) {
  const checks = options.checks || [];
  const status = aggregateStatus(checks);
  return {
    generatedAt: options.generatedAt,
    status,
    provider: options.provider,
    traceId: options.traceId,
    task: 'thread-history-semantic-enrichment',
    schemaVersion: 'semantic-enrichment.v1',
    checks,
    validation: options.validation,
    usage: options.usage,
    outputPreview: options.outputPreview,
    error: options.error ? {
      message: options.error
    } : undefined,
    nextActions: buildNextActions(status, options.provider)
  };
}

function buildDefaultPreflightInput() {
  return {
    thread: {
      sourceKey: 'preflight',
      sourceThreadId: 'llm-preflight-sample',
      title: 'LLM provider preflight sample',
      parsedPostCount: 2
    },
    primaryAuthor: {
      authorId: 'preflight-author',
      displayName: 'Preflight Author'
    },
    topEntities: [{
      displayName: 'ThreadTrace',
      type: 'project',
      mentions: [{
        floor: 1,
        sourcePostId: 'preflight-1',
        evidenceText: 'ThreadTrace should validate model output before storing semantic reports.'
      }]
    }],
    topOpinions: [{
      floor: 2,
      sourcePostId: 'preflight-2',
      author: 'Preflight Author',
      attitude: 'supportive',
      confidence: 'medium',
      scope: 'semantic validation',
      evidence: {
        text: 'Structured validation makes provider integration safer.'
      }
    }],
    highSignalEvidence: [{
      floor: 1,
      sourcePostId: 'preflight-1',
      excerpt: 'Return a concise JSON semantic summary with evidence references.'
    }],
    relations: []
  };
}

function buildNextActions(status, provider) {
  if (status === 'ok') {
    return [{
      key: 'llm.preflight.ready',
      severity: 'info',
      summary: 'Provider can return valid semantic enrichment JSON for the preflight sample.',
      commands: [
        'node src/presentation/cli/threadtrace.js run-semantic-enrichment-task --source-thread-id <thread-id> --provider ' + provider
      ]
    }];
  }
  return [{
    key: 'llm.preflight.fix',
    severity: 'warning',
    summary: 'Fix provider configuration or output contract before enabling real semantic enrichment.',
    commands: [
      'node src/presentation/cli/threadtrace.js runtime-diagnostics',
      'node src/presentation/cli/threadtrace.js llm-preflight --provider ' + provider
    ],
    env: [
      'THREADTRACE_LLM_PROVIDER',
      'THREADTRACE_LLM_BASE_URL',
      'THREADTRACE_LLM_MODEL',
      'THREADTRACE_LLM_API_KEY'
    ]
  }];
}

function check(key, status, summary) {
  return {
    key,
    status,
    summary
  };
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  runLlmProviderPreflight,
  buildLlmProviderPreflightFailure,
  buildDefaultPreflightInput
};
