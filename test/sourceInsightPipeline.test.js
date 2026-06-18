'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createMockLlmProvider } = require('../src/infrastructure/llm/mockLlmProvider');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime runs source insight pipeline and persists semantic report', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-pipeline-'));
  const runtime = createPipelineRuntime(tempDir);
  const registerResult = await registerSampleSource(runtime);

  const result = await runtime.runSourceInsightPipelineTask({
    sourceId: registerResult.source.id,
    traceId: 'pipeline-first-run'
  });
  const reports = await runtime.listAnalysisReports({
    sourceKey: 'nga',
    sourceThreadId: '45974302',
    reportType: 'semantic-enrichment'
  });
  const tasks = await runtime.listTasks({
    type: 'source-insight-pipeline'
  });
  const runHistory = await runtime.listSourceInsightPipelineRuns({
    sourceId: registerResult.source.id
  });

  assert.equal(result.task.status, 'completed');
  assert.equal(result.task.type, 'source-insight-pipeline');
  assert.equal(result.ingest.task.status, 'completed');
  assert.equal(result.ingest.cursor.sourceThreadId, '45974302');
  assert.equal(result.ingest.cursorDiff.changed, true);
  assert.equal(result.semantic.status, 'completed');
  assert.equal(result.semantic.reportType, 'semantic-enrichment');
  assert.equal(result.semantic.traceId, 'pipeline-first-run');
  assert.equal(reports.length, 1);
  assert.equal(reports[0].semanticInsights.traceId, 'pipeline-first-run');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].output.ingestTaskId, result.ingest.task.id);
  assert.equal(tasks[0].output.semantic.status, 'completed');
  assert.equal(runHistory.runs.length, 1);
  assert.equal(runHistory.runs[0].taskId, result.task.id);
  assert.equal(runHistory.runs[0].source.displayName, 'NGA sample archive');
  assert.equal(runHistory.runs[0].cursorDiff.newPostCount, 20);
  assert.equal(runHistory.runs[0].semantic.traceId, 'pipeline-first-run');
});

test('runtime skips pipeline semantic enrichment when source cursor is unchanged', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-pipeline-skip-'));
  const runtime = createPipelineRuntime(tempDir);
  const registerResult = await registerSampleSource(runtime);

  await runtime.runSourceInsightPipelineTask({
    sourceId: registerResult.source.id,
    traceId: 'pipeline-initial'
  });
  const result = await runtime.runSourceInsightPipelineTask({
    sourceId: registerResult.source.id,
    traceId: 'pipeline-unchanged'
  });
  const reports = await runtime.listAnalysisReports({
    sourceKey: 'nga',
    sourceThreadId: '45974302',
    reportType: 'semantic-enrichment'
  });

  assert.equal(result.task.status, 'completed');
  assert.equal(result.ingest.cursorDiff.changed, false);
  assert.equal(result.ingest.cursorDiff.newPostCount, 0);
  assert.equal(result.semantic.status, 'skipped');
  assert.equal(result.semantic.reason, 'unchanged');
  assert.equal(reports.length, 1);
});

test('runtime can disable pipeline semantic enrichment explicitly', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-pipeline-disabled-'));
  const runtime = createPipelineRuntime(tempDir);
  const registerResult = await registerSampleSource(runtime);

  const result = await runtime.runSourceInsightPipelineTask({
    sourceId: registerResult.source.id,
    semanticEnrichmentEnabled: false
  });
  const reports = await runtime.listAnalysisReports({
    sourceKey: 'nga',
    sourceThreadId: '45974302',
    reportType: 'semantic-enrichment'
  });

  assert.equal(result.task.status, 'completed');
  assert.equal(result.ingest.cursorDiff.changed, true);
  assert.equal(result.semantic.status, 'skipped');
  assert.equal(result.semantic.reason, 'disabled');
  assert.equal(reports.length, 0);
});

test('runtime runs insight pipelines for due sources', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-pipeline-due-'));
  const runtime = createPipelineRuntime(tempDir);
  await registerSampleSource(runtime);

  const result = await runtime.runDueSourceInsightPipelineTasks({
    traceId: 'pipeline-due-run'
  });
  const reports = await runtime.listAnalysisReports({
    sourceKey: 'nga',
    sourceThreadId: '45974302',
    reportType: 'semantic-enrichment'
  });

  assert.equal(result.task.status, 'completed');
  assert.equal(result.task.type, 'source-insight-pipeline-due-sources');
  assert.equal(result.sourceCount, 1);
  assert.equal(result.dueCount, 1);
  assert.equal(result.completedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.results[0].task.type, 'source-insight-pipeline');
  assert.equal(result.results[0].semantic.status, 'completed');
  assert.equal(result.task.output.results[0].semantic.status, 'completed');
  assert.equal(reports.length, 1);
});

function createPipelineRuntime(storeDir) {
  return createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir,
    llmProvider: createMockLlmProvider()
  });
}

function registerSampleSource(runtime) {
  return runtime.registerSource({
    forum: 'nga',
    displayName: 'NGA sample archive',
    inputDir: path.resolve(__dirname, '..', 'example'),
    intervalMinutes: 60
  });
}
