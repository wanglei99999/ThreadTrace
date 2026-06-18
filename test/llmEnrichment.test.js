'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { analyzeSavedThreadDirectory } = require('../src/application/use-cases/analyzeSavedThreadDirectory');
const { enrichAnalysisReportWithLlm } = require('../src/application/use-cases/enrichAnalysisReportWithLlm');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { createMockLlmProvider } = require('../src/infrastructure/llm/mockLlmProvider');
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
