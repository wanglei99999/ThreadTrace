'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { analyzeSavedThreadDirectory } = require('../src/application/use-cases/analyzeSavedThreadDirectory');
const { enrichAnalysisReportWithLlm } = require('../src/application/use-cases/enrichAnalysisReportWithLlm');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { createLlmProvider } = require('../src/infrastructure/llm/llmProviderFactory');
const { createMockLlmProvider } = require('../src/infrastructure/llm/mockLlmProvider');
const { createOpenAiCompatibleLlmProvider } = require('../src/infrastructure/llm/openAiCompatibleLlmProvider');
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
