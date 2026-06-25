'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { analyzeSavedThreadDirectory } = require('../src/application/use-cases/analyzeSavedThreadDirectory');
const {
  enrichAnalysisReportWithLlm,
  validateSemanticEnrichmentOutput
} = require('../src/application/use-cases/enrichAnalysisReportWithLlm');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { createLlmProvider } = require('../src/infrastructure/llm/llmProviderFactory');
const { createMockLlmProvider } = require('../src/infrastructure/llm/mockLlmProvider');
const { createOpenAiCompatibleLlmProvider } = require('../src/infrastructure/llm/openAiCompatibleLlmProvider');
const {
  buildLlmProviderPreflightFailure,
  runLlmProviderPreflight
} = require('../src/application/use-cases/runLlmProviderPreflight');
const { runLlmProviderEvaluation } = require('../src/application/use-cases/runLlmProviderEvaluation');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('mock LLM provider enriches reports with evidence-grounded insights', async function () {
  const result = analyzeSavedThreadDirectory({
    adapter: getForumAdapter('nga'),
    inputDir: path.resolve(__dirname, '..', 'example')
  });

  const enriched = await enrichAnalysisReportWithLlm({
    report: result.report,
    llmProvider: createMockLlmProvider(),
    traceId: 'test-trace'
  });

  assert.equal(enriched.reportType, 'basic-history');
  assert.equal(enriched.semanticInsights.provider, 'mock');
  assert.equal(enriched.semanticInsights.traceId, 'test-trace');
  assert.match(enriched.semanticInsights.summary, /parsed posts/);
  assert.ok(enriched.semanticInsights.entityInsights.length >= 1);
  assert.ok(enriched.semanticInsights.entityInsights[0].evidenceRefs.length >= 1);
  assert.ok(enriched.semanticInsights.opinionInsights.length >= 1);
  assert.ok(enriched.semanticInsights.limitations.length >= 1);
  assert.equal(enriched.semanticInsights.validation.status, 'ok');
  assert.equal(enriched.semanticInsights.validation.schemaVersion, 'semantic-enrichment.v1');
});

test('semantic enrichment validates structured LLM output before storing insights', async function () {
  const valid = validateSemanticEnrichmentOutput({
    summary: 'ok',
    entityInsights: [],
    opinionInsights: [],
    evidenceQuestions: [],
    limitations: []
  });

  assert.equal(valid.validation.status, 'ok');
  assert.equal(valid.validation.checks.length, 5);

  assert.throws(function () {
    validateSemanticEnrichmentOutput({
      summary: 'missing arrays'
    });
  }, function (error) {
    assert.match(error.message, /Semantic enrichment output validation failed/);
    assert.equal(error.validation.status, 'fail');
    assert.ok(error.validation.checks.some(function (check) {
      return check.key === 'semantic.entityInsights' && check.status === 'fail';
    }));
    return true;
  });
});

test('semantic enrichment rejects invalid provider output with validation evidence', async function () {
  const result = analyzeSavedThreadDirectory({
    adapter: getForumAdapter('nga'),
    inputDir: path.resolve(__dirname, '..', 'example')
  });
  const invalidProvider = {
    async completeStructured() {
      return {
        provider: 'invalid-test',
        output: {
          summary: 123,
          entityInsights: []
        }
      };
    }
  };

  await assert.rejects(async function () {
    await enrichAnalysisReportWithLlm({
      report: result.report,
      llmProvider: invalidProvider,
      traceId: 'invalid-output-test'
    });
  }, function (error) {
    assert.match(error.message, /semantic\.summary expected string got number/);
    assert.equal(error.validation.status, 'fail');
    return true;
  });
});

test('runtime exposes semantic directory enrichment', async function () {
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    llmProvider: createMockLlmProvider()
  });

  const result = await runtime.enrichDirectory({
    forum: 'nga',
    traceId: 'runtime-trace'
  });

  assert.equal(result.threadSnapshot.sourceThreadId, '45974302');
  assert.equal(result.report.semanticInsights.provider, 'mock');
  assert.equal(result.report.semanticInsights.traceId, 'runtime-trace');
  assert.ok(result.report.semanticInsights.usage.inputTokens > 0);
});

test('runtime persists semantic enrichment as a task report', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-semantic-task-'));
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir,
    llmProvider: createMockLlmProvider()
  });
  await runtime.runIngestDirectoryTask({});

  const result = await runtime.runSemanticEnrichmentTask({
    sourceKey: 'nga',
    sourceThreadId: '45974302',
    traceId: 'semantic-task-test'
  });
  const reports = await runtime.listAnalysisReports({
    sourceKey: 'nga',
    sourceThreadId: '45974302',
    reportType: 'semantic-enrichment'
  });
  const tasks = await runtime.listTasks({
    type: 'semantic-enrichment'
  });

  assert.equal(result.task.status, 'completed');
  assert.equal(result.report.reportType, 'semantic-enrichment');
  assert.equal(result.report.baseReportType, 'basic-history');
  assert.equal(result.report.semanticInsights.traceId, 'semantic-task-test');
  assert.equal(reports.length, 1);
  assert.equal(reports[0].semanticInsights.provider, 'mock');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].output.reportType, 'semantic-enrichment');
  assert.equal(tasks[0].output.semanticValidation.status, 'ok');
});

test('openai-compatible LLM provider posts structured requests and parses JSON output', async function () {
  const requests = [];
  const provider = createOpenAiCompatibleLlmProvider({
    baseUrl: 'https://llm.example.test',
    apiKey: 'test-key',
    model: 'test-model',
    fetch: async function (url, request) {
      requests.push({ url, request });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: 'ok',
                  entityInsights: [],
                  opinionInsights: [],
                  evidenceQuestions: [],
                  limitations: []
                })
              }
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5
            }
          };
        }
      };
    }
  });

  const result = await provider.completeStructured({
    task: 'thread-history-semantic-enrichment',
    traceId: 'openai-test',
    input: { thread: { title: 'sample' } },
    schema: { type: 'object' }
  });
  const body = JSON.parse(requests[0].request.body);

  assert.equal(requests[0].url, 'https://llm.example.test/v1/chat/completions');
  assert.equal(requests[0].request.headers.authorization, 'Bearer test-key');
  assert.equal(body.model, 'test-model');
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(result.provider, 'openai-compatible');
  assert.equal(result.output.summary, 'ok');
  assert.equal(result.usage.prompt_tokens, 10);
});

test('LLM provider factory selects openai-compatible from environment', async function () {
  const provider = createLlmProvider({
    env: {
      THREADTRACE_LLM_PROVIDER: 'openai-compatible',
      THREADTRACE_LLM_BASE_URL: 'https://llm.example.test',
      THREADTRACE_LLM_API_KEY: 'test-key',
      THREADTRACE_LLM_MODEL: 'test-model'
    },
    fetch: async function () {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [{
              message: {
                content: '{"summary":"factory","entityInsights":[],"opinionInsights":[],"evidenceQuestions":[],"limitations":[]}'
              }
            }]
          };
        }
      };
    }
  });

  const result = await provider.completeStructured({
    task: 'thread-history-semantic-enrichment',
    input: {}
  });

  assert.equal(result.output.summary, 'factory');
});

test('LLM provider preflight validates the mock provider sample', async function () {
  const report = await runLlmProviderPreflight({
    llmProvider: createMockLlmProvider(),
    providerKey: 'mock',
    now: '2026-06-25T10:00:00.000Z',
    traceId: 'preflight-test'
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.provider, 'mock');
  assert.equal(report.traceId, 'preflight-test');
  assert.equal(report.validation.status, 'ok');
  assert.equal(report.outputPreview.entityInsightCount, 1);
  assert.equal(report.checks.find(function (check) {
    return check.key === 'llm.semantic.validation';
  }).status, 'ok');
});

test('LLM provider evaluation runs quality checks across samples', async function () {
  const report = await runLlmProviderEvaluation({
    llmProvider: createMockLlmProvider(),
    providerKey: 'mock',
    now: '2026-06-25T10:00:00.000Z',
    traceId: 'evaluation-test'
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.provider, 'mock');
  assert.equal(report.sampleCount, 2);
  assert.equal(report.summary.ok, 2);
  assert.ok(report.results.every(function (result) {
    return result.validation.status === 'ok' &&
      result.outputPreview.evidenceRefCount >= 1 &&
      result.qualityChecks.every(function (check) { return check.status === 'ok'; });
  }));
});

test('LLM provider evaluation warns on weak but valid semantic output', async function () {
  const report = await runLlmProviderEvaluation({
    providerKey: 'weak',
    llmProvider: {
      async completeStructured() {
        return {
          provider: 'weak',
          output: {
            summary: '',
            entityInsights: [],
            opinionInsights: [],
            evidenceQuestions: [],
            limitations: []
          }
        };
      }
    },
    samples: [{
      id: 'weak-sample',
      input: { thread: { title: 'weak sample' } },
      expected: { minEvidenceRefs: 1 }
    }],
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(report.status, 'warn');
  assert.equal(report.summary.warn, 1);
  assert.equal(report.results[0].validation.status, 'ok');
  assert.ok(report.results[0].qualityChecks.some(function (check) {
    return check.key === 'llm.output.evidenceRefs.present' && check.status === 'warn';
  }));
});

test('runtime exposes LLM provider preflight', async function () {
  const runtime = createThreadTraceRuntime({
    llmProvider: createMockLlmProvider()
  });

  const report = await runtime.runLlmProviderPreflight({
    provider: 'mock',
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.provider, 'mock');
  assert.equal(report.validation.status, 'ok');
});

test('runtime exposes LLM provider evaluation', async function () {
  const runtime = createThreadTraceRuntime({
    llmProvider: createMockLlmProvider()
  });

  const report = await runtime.runLlmProviderEvaluation({
    provider: 'mock',
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.provider, 'mock');
  assert.equal(report.sampleCount, 2);
});

test('LLM provider preflight reports invalid structured output', async function () {
  const report = await runLlmProviderPreflight({
    providerKey: 'broken',
    llmProvider: {
      async completeStructured() {
        return {
          provider: 'broken',
          output: {
            summary: 'missing required arrays'
          }
        };
      }
    },
    now: '2026-06-25T10:00:00.000Z'
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.validation.status, 'fail');
  assert.match(report.error.message, /Semantic enrichment output validation failed/);
  assert.equal(report.nextActions[0].key, 'llm.preflight.fix');
});

test('LLM provider preflight can report provider creation failures', function () {
  const report = buildLlmProviderPreflightFailure({
    providerKey: 'openai-compatible',
    now: '2026-06-25T10:00:00.000Z',
    error: new Error('missing api key')
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.provider, 'openai-compatible');
  assert.equal(report.checks[0].key, 'llm.provider.created');
  assert.equal(report.checks[0].status, 'fail');
  assert.match(report.error.message, /missing api key/);
});
