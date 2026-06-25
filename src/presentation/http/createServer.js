'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { isApplicationError } = require('../../application/errors/applicationError');
const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');
const { renderAuthorIntelligenceMarkdown } = require('../../domain/analysis/authorIntelligenceMarkdownRenderer');
const { createOpenApiSpec } = require('./openApiSpec');

function createThreadTraceServer(options) {
  const safeOptions = options || {};
  const defaultInputDir = safeOptions.defaultInputDir || path.resolve(process.cwd(), 'example');
  const webDir = safeOptions.webDir || path.resolve(__dirname, '..', 'web');
  const storeDir = safeOptions.storeDir || path.resolve(process.cwd(), 'data', 'store');
  const runtime = safeOptions.runtime || createThreadTraceRuntime({
    defaultInputDir,
    storeDir
  });

  return http.createServer(async function (request, response) {
    const requestId = resolveRequestId(request);
    const idempotencyKey = resolveHeaderValue(request, 'idempotency-key');
    try {
      applyCors(response);
      response.setHeader('x-request-id', requestId);
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }

      await routeRequest(request, response, {
        defaultInputDir,
        webDir,
        storeDir,
        runtime,
        requestId,
        idempotencyKey,
        maxBodyBytes: safeOptions.maxBodyBytes || 1024 * 1024
      });
    } catch (error) {
      writeJson(response, httpStatusForError(error), {
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          requestId,
          stack: safeOptions.exposeStack ? error.stack : undefined
        }
      });
    }
  });
}

async function routeRequest(request, response, context) {
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/app.js' || url.pathname === '/styles.css')) {
    await serveStaticAsset(response, context.webDir, url.pathname);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    writeJson(response, 200, {
      ok: true,
      service: 'threadtrace'
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/adapters') {
    writeJson(response, 200, {
      adapters: context.runtime.listAdapters()
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/adapters/diagnostics') {
    const diagnostics = await context.runtime.diagnoseAdapters({
      now: url.searchParams.get('now') || undefined
    });
    writeJson(response, diagnostics.status === 'fail' ? 503 : 200, diagnostics);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/source-ingest-handlers') {
    writeJson(response, 200, {
      handlers: context.runtime.listSourceIngestHandlers()
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/contracts/thread-snapshot-json') {
    writeJson(response, 200, context.runtime.getThreadSnapshotJsonContract());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/contracts/connector-module') {
    writeJson(response, 200, context.runtime.getConnectorModuleContract());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/contracts/context-review-handoff') {
    writeJson(response, 200, context.runtime.getContextReviewHandoffContract());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/contracts/context-review-handoff/validate') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = context.runtime.validateContextReviewHandoff({
      payload: body.handoff || body.payload || body
    });
    writeJson(response, result.valid ? 200 : 400, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/contracts/context-review-result') {
    writeJson(response, 200, context.runtime.getContextReviewResultContract());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/contracts/context-review-result/validate') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = context.runtime.validateContextReviewResult({
      payload: body.result || body.payload || body
    });
    writeJson(response, result.valid ? 200 : 400, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/context-review-results/summarize') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = context.runtime.summarizeContextReviewResult({
      payload: body.result || body.payload || body
    });
    writeJson(response, result.valid ? 200 : 400, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/context-review-results') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.submitContextReviewResult({
      result: body.result || body.payload || body,
      id: body.id,
      sourceId: body.sourceId,
      sourceKey: body.sourceKey || body.forum,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      traceId: body.traceId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, result.valid ? 201 : 400, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/context-review-results/overview') {
    const result = await context.runtime.getContextReviewResultOverview({
      handoffId: url.searchParams.get('handoffId') || undefined,
      status: url.searchParams.get('status') || undefined,
      reviewerId: url.searchParams.get('reviewerId') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/context-review-results/action-plan') {
    const result = await context.runtime.getContextReviewResultActionPlan({
      handoffId: url.searchParams.get('handoffId') || undefined,
      status: url.searchParams.get('status') || undefined,
      reviewerId: url.searchParams.get('reviewerId') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/context-review-results/action-gate') {
    const result = await context.runtime.getContextReviewResultActionGate({
      handoffId: url.searchParams.get('handoffId') || undefined,
      status: url.searchParams.get('status') || undefined,
      reviewerId: url.searchParams.get('reviewerId') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/context-review-results/action-audits') {
    const result = await context.runtime.listContextReviewActionAudits({
      action: url.searchParams.get('action') || undefined,
      taskId: url.searchParams.get('taskId') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/context-review-results/action-audits/overview') {
    const result = await context.runtime.getContextReviewActionAuditOverview({
      action: url.searchParams.get('action') || undefined,
      taskId: url.searchParams.get('taskId') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/context-review-results/action-executions') {
    const result = await context.runtime.listContextReviewActionExecutions({
      action: url.searchParams.get('action') || undefined,
      status: url.searchParams.get('status') || undefined,
      taskId: url.searchParams.get('taskId') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, result.status === 'warn' ? 503 : 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/context-review-results/action-executor/diagnostics') {
    const result = await context.runtime.getContextReviewActionExecutorDiagnostics({
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, result.status === 'fail' ? 503 : 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/context-review-results/action-tasks/apply') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runContextReviewActionTask({
      handoffId: body.handoffId,
      status: body.status,
      reviewerId: body.reviewerId,
      sourceId: body.sourceId,
      sourceKey: body.sourceKey || body.forum,
      execute: body.execute === true || body.dryRun === false,
      limit: body.limit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      traceId: body.traceId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, result.report && result.report.status === 'fail' ? 503 : 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/context-review-results') {
    const result = await context.runtime.listContextReviewResults({
      handoffId: url.searchParams.get('handoffId') || undefined,
      status: url.searchParams.get('status') || undefined,
      reviewerId: url.searchParams.get('reviewerId') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/connectors/catalog') {
    writeJson(response, 200, context.runtime.getSourceConnectorCatalog({
      modulePath: url.searchParams.get('modulePath') || url.searchParams.get('connectorModulePath') || undefined,
      now: url.searchParams.get('now') || undefined
    }));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/connectors/packages/recommended-manifest') {
    writeJson(response, 200, context.runtime.getConnectorPackageRecommendedManifest({
      modulePath: url.searchParams.get('modulePath') || url.searchParams.get('connectorModulePath') || undefined,
      packageName: url.searchParams.get('packageName') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
      now: url.searchParams.get('now') || undefined
    }));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/connectors/source-type-readiness') {
    const enabledParam = url.searchParams.get('enabled');
    const readiness = await context.runtime.getSourceTypeReadiness({
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 200,
      now: url.searchParams.get('now') || undefined,
      modulePath: url.searchParams.get('modulePath') || url.searchParams.get('connectorModulePath') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, readiness.status === 'fail' ? 503 : 200, readiness);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/connectors/readiness') {
    const enabledParam = url.searchParams.get('enabled');
    const readiness = await context.runtime.getConnectorReadiness({
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, readiness.status === 'fail' ? 503 : 200, readiness);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/connectors/modules/validate') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    if (!body.modulePath && !body.path) {
      writeError(response, 400, 'connector_module_path_required', 'POST /api/connectors/modules/validate requires modulePath.');
      return;
    }
    const result = context.runtime.validateConnectorModule({
      modulePath: body.modulePath || body.path,
      now: body.now
    });
    writeJson(response, result.status === 'fail' ? 503 : 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/connectors/rollout-plan') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.getConnectorRolloutPlan({
      id: body.id,
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceType: body.sourceType,
      displayName: body.displayName || body.name,
      modulePath: body.modulePath || body.connectorModulePath,
      inputDir: body.inputDir,
      inputFile: body.inputFile,
      url: body.url,
      startPage: body.startPage,
      pageCount: body.pageCount,
      location: body.location,
      enabled: body.enabled,
      tags: body.tags,
      allowUnknownSourceType: body.allowUnknownSourceType,
      allowRemoteFetch: body.allowRemoteFetch,
      dryRunIngest: body.dryRunIngest || body.includeIngestDryRun,
      schedule: body.schedule,
      intervalMinutes: body.intervalMinutes,
      nextRunAt: body.nextRunAt,
      scheduleEnabled: body.scheduleEnabled,
      limit: body.limit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      runningStaleAfterMs: body.runningStaleAfterMs,
      workerStaleAfterMs: body.workerStaleAfterMs
    });
    writeJson(response, result.status === 'fail' ? 503 : 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/openapi.json') {
    writeJson(response, 200, createOpenApiSpec());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/analyze-directory') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = context.runtime.analyzeDirectory({
      forum: body.forum,
      inputDir: body.inputDir || context.defaultInputDir
    });
    writeJson(response, 200, result.report);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/enrich-directory') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.enrichDirectory({
      forum: body.forum,
      inputDir: body.inputDir || context.defaultInputDir,
      provider: body.provider || 'mock',
      traceId: body.traceId
    });
    writeJson(response, 200, result.report);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/llm/preflight') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runLlmProviderPreflight({
      provider: body.provider,
      traceId: body.traceId,
      input: body.input,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, result.status === 'fail' ? 503 : 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/interpret-text') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    if (!body.text) {
      writeError(response, 400, 'interpret_text_missing_text', 'POST /api/interpret-text requires text.');
      return;
    }

    const report = context.runtime.interpretText({
      forum: body.forum,
      inputDir: body.inputDir || context.defaultInputDir,
      authorId: body.authorId,
      author: body.author,
      text: body.text,
      publishedAt: body.publishedAt
    });
    writeJson(response, 200, report);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/tasks/ingest-directory') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runIngestDirectoryTask({
      forum: body.forum,
      inputDir: body.inputDir || context.defaultInputDir,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, {
      task: result.task,
      report: result.report,
      idempotency: result.idempotency
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/tasks') {
    const tasks = await context.runtime.listTasks({
      status: url.searchParams.get('status') || undefined,
      type: url.searchParams.get('type') || undefined,
      requestId: url.searchParams.get('requestId') || undefined,
      traceId: url.searchParams.get('traceId') || undefined,
      idempotencyKey: url.searchParams.get('idempotencyKey') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20
    });
    writeJson(response, 200, {
      tasks
    });
    return;
  }

  const taskDetailMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (request.method === 'GET' && taskDetailMatch) {
    const result = await context.runtime.getTaskDetail({
      taskId: decodeURIComponent(taskDetailMatch[1]),
      traceLimit: url.searchParams.get('traceLimit') ? Number(url.searchParams.get('traceLimit')) : undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/sources/tasks/insight-pipeline-runs') {
    const result = await context.runtime.listSourceInsightPipelineRuns({
      sourceId: url.searchParams.get('sourceId') || undefined,
      status: url.searchParams.get('status') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20,
      scanLimit: url.searchParams.get('scanLimit') ? Number(url.searchParams.get('scanLimit')) : undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/reports') {
    const reports = await context.runtime.listAnalysisReports({
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      sourceThreadId: url.searchParams.get('sourceThreadId') || undefined,
      reportType: url.searchParams.get('reportType') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, {
      reports
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/intelligence/authors') {
    const dashboard = await context.runtime.getAuthorIntelligenceDashboard(authorIntelligenceRequestFromSearchParams(url.searchParams));
    writeJson(response, 200, dashboard);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/intelligence/authors/markdown') {
    const dashboard = await context.runtime.getAuthorIntelligenceDashboard(authorIntelligenceRequestFromSearchParams(url.searchParams));
    writeText(response, 200, renderAuthorIntelligenceMarkdown(dashboard), 'text/markdown; charset=utf-8');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/intelligence/author-review-queue') {
    const result = await context.runtime.listAuthorReviewQueue(authorReviewQueueRequestFromSearchParams(url.searchParams));
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/intelligence/author-review-queue/sync') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.syncAuthorReviewQueue(Object.assign({}, body, {
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    }));
    writeJson(response, 200, result);
    return;
  }

  const authorReviewStatusMatch = url.pathname.match(/^\/api\/intelligence\/author-review-queue\/([^/]+)\/status$/);
  if (request.method === 'POST' && authorReviewStatusMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.updateAuthorReviewQueueItemStatus({
      itemId: decodeURIComponent(authorReviewStatusMatch[1]),
      status: body.status,
      reviewedBy: body.reviewedBy || body.reviewer,
      note: body.note,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/intelligence/author-review-queue/events') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.synthesizeAuthorReviewQueueNotificationEvents({
      sourceKey: body.sourceKey || body.forum,
      sourceThreadId: body.sourceThreadId,
      status: body.status,
      type: body.type,
      priority: body.priority,
      execute: body.execute === true || body.dryRun === false,
      resolveStale: body.resolveStale,
      limit: body.limit,
      staleLimit: body.staleLimit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/reports/tasks/semantic-enrichment') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    if (!body.sourceThreadId) {
      writeError(response, 400, 'semantic_enrichment_missing_source_thread_id', 'POST /api/reports/tasks/semantic-enrichment requires sourceThreadId.');
      return;
    }
    const result = await context.runtime.runSemanticEnrichmentTask({
      sourceKey: body.sourceKey || body.forum,
      sourceThreadId: body.sourceThreadId,
      baseReportType: body.baseReportType,
      provider: body.provider || 'mock',
      traceId: body.traceId,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, {
      task: result.task,
      report: result.report,
      idempotency: result.idempotency
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/overview') {
    const enabledParam = url.searchParams.get('enabled');
    const overview = await context.runtime.getOperationalOverview({
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, overview);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/source-drilldown') {
    const report = await context.runtime.getSourceOperationsDrilldown({
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      timelineLimit: url.searchParams.get('timelineLimit') ? Number(url.searchParams.get('timelineLimit')) : undefined,
      attentionLimit: url.searchParams.get('attentionLimit') ? Number(url.searchParams.get('attentionLimit')) : undefined,
      taskScanLimit: url.searchParams.get('taskScanLimit') ? Number(url.searchParams.get('taskScanLimit')) : undefined,
      leaseScanLimit: url.searchParams.get('leaseScanLimit') ? Number(url.searchParams.get('leaseScanLimit')) : undefined,
      sourceRunStaleAfterMs: url.searchParams.get('sourceRunStaleAfterMs') ? Number(url.searchParams.get('sourceRunStaleAfterMs')) : undefined,
      sourceFailureRetryBackoffMs: url.searchParams.get('sourceFailureRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureRetryBackoffMs')) : undefined,
      sourceFailureMaxRetryBackoffMs: url.searchParams.get('sourceFailureMaxRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureMaxRetryBackoffMs')) : undefined,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      workerStaleAfterMs: url.searchParams.get('workerStaleAfterMs') ? Number(url.searchParams.get('workerStaleAfterMs')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, report.status === 'fail' ? 503 : 200, report);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/source-type-drilldown') {
    const enabledParam = url.searchParams.get('enabled');
    const report = await context.runtime.getSourceTypeOperationsDrilldown({
      sourceType: url.searchParams.get('sourceType') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      scanLimit: url.searchParams.get('scanLimit') ? Number(url.searchParams.get('scanLimit')) : undefined,
      sourceTypeLimit: url.searchParams.get('sourceTypeLimit') ? Number(url.searchParams.get('sourceTypeLimit')) : undefined,
      attentionLimit: url.searchParams.get('attentionLimit') ? Number(url.searchParams.get('attentionLimit')) : undefined,
      taskLimit: url.searchParams.get('taskLimit') ? Number(url.searchParams.get('taskLimit')) : undefined,
      pipelineLimit: url.searchParams.get('pipelineLimit') ? Number(url.searchParams.get('pipelineLimit')) : undefined,
      eventLimit: url.searchParams.get('eventLimit') ? Number(url.searchParams.get('eventLimit')) : undefined,
      maxAttempts: url.searchParams.get('maxAttempts') ? Number(url.searchParams.get('maxAttempts')) : undefined,
      sourceRunStaleAfterMs: url.searchParams.get('sourceRunStaleAfterMs') ? Number(url.searchParams.get('sourceRunStaleAfterMs')) : undefined,
      sourceFailureRetryBackoffMs: url.searchParams.get('sourceFailureRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureRetryBackoffMs')) : undefined,
      sourceFailureMaxRetryBackoffMs: url.searchParams.get('sourceFailureMaxRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureMaxRetryBackoffMs')) : undefined,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      workerStaleAfterMs: url.searchParams.get('workerStaleAfterMs') ? Number(url.searchParams.get('workerStaleAfterMs')) : undefined,
      modulePath: url.searchParams.get('modulePath') || url.searchParams.get('connectorModulePath') || undefined,
      includeSourceTypeOperations: url.searchParams.get('includeSourceTypeOperations') === 'true',
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, report.status === 'fail' ? 503 : 200, report);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/readiness') {
    const enabledParam = url.searchParams.get('enabled');
    const readiness = await context.runtime.getOperationalReadiness({
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, readiness.status === 'fail' ? 503 : 200, readiness);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/trace-context') {
    const result = await context.runtime.getTaskTraceContext({
      taskId: url.searchParams.get('taskId') || undefined,
      requestId: url.searchParams.get('requestId') || undefined,
      traceId: url.searchParams.get('traceId') || undefined,
      idempotencyKey: url.searchParams.get('idempotencyKey') || undefined,
      status: url.searchParams.get('status') || undefined,
      type: url.searchParams.get('type') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/runbook') {
    const enabledParam = url.searchParams.get('enabled');
    const runbook = await context.runtime.getOperationsRunbook({
      forum: url.searchParams.get('forum') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      pipelineLimit: url.searchParams.get('pipelineLimit') ? Number(url.searchParams.get('pipelineLimit')) : 20,
      eventLimit: url.searchParams.get('eventLimit') ? Number(url.searchParams.get('eventLimit')) : undefined,
      maxAttempts: url.searchParams.get('maxAttempts') ? Number(url.searchParams.get('maxAttempts')) : undefined,
      taskLimit: url.searchParams.get('taskLimit') ? Number(url.searchParams.get('taskLimit')) : undefined,
      sourceRunStaleAfterMs: url.searchParams.get('sourceRunStaleAfterMs') ? Number(url.searchParams.get('sourceRunStaleAfterMs')) : undefined,
      sourceFailureRetryBackoffMs: url.searchParams.get('sourceFailureRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureRetryBackoffMs')) : undefined,
      sourceFailureMaxRetryBackoffMs: url.searchParams.get('sourceFailureMaxRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureMaxRetryBackoffMs')) : undefined,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, runbook.status === 'fail' ? 503 : 200, runbook);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/source-attention') {
    const enabledParam = url.searchParams.get('enabled');
    const report = await context.runtime.getSourceAttentionReport({
      forum: url.searchParams.get('forum') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      attentionLimit: url.searchParams.get('attentionLimit') ? Number(url.searchParams.get('attentionLimit')) : undefined,
      pipelineLimit: url.searchParams.get('pipelineLimit') ? Number(url.searchParams.get('pipelineLimit')) : 20,
      eventLimit: url.searchParams.get('eventLimit') ? Number(url.searchParams.get('eventLimit')) : undefined,
      maxAttempts: url.searchParams.get('maxAttempts') ? Number(url.searchParams.get('maxAttempts')) : undefined,
      taskLimit: url.searchParams.get('taskLimit') ? Number(url.searchParams.get('taskLimit')) : undefined,
      sourceRunStaleAfterMs: url.searchParams.get('sourceRunStaleAfterMs') ? Number(url.searchParams.get('sourceRunStaleAfterMs')) : undefined,
      sourceFailureRetryBackoffMs: url.searchParams.get('sourceFailureRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureRetryBackoffMs')) : undefined,
      sourceFailureMaxRetryBackoffMs: url.searchParams.get('sourceFailureMaxRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureMaxRetryBackoffMs')) : undefined,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, report.status === 'fail' ? 503 : 200, report);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/source-type-operations') {
    const enabledParam = url.searchParams.get('enabled');
    const report = await context.runtime.getSourceTypeOperationsReport({
      forum: url.searchParams.get('forum') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      sourceTypeLimit: url.searchParams.get('sourceTypeLimit') ? Number(url.searchParams.get('sourceTypeLimit')) : undefined,
      attentionLimit: url.searchParams.get('attentionLimit') ? Number(url.searchParams.get('attentionLimit')) : undefined,
      pipelineLimit: url.searchParams.get('pipelineLimit') ? Number(url.searchParams.get('pipelineLimit')) : 20,
      eventLimit: url.searchParams.get('eventLimit') ? Number(url.searchParams.get('eventLimit')) : undefined,
      maxAttempts: url.searchParams.get('maxAttempts') ? Number(url.searchParams.get('maxAttempts')) : undefined,
      taskLimit: url.searchParams.get('taskLimit') ? Number(url.searchParams.get('taskLimit')) : undefined,
      sourceRunStaleAfterMs: url.searchParams.get('sourceRunStaleAfterMs') ? Number(url.searchParams.get('sourceRunStaleAfterMs')) : undefined,
      sourceFailureRetryBackoffMs: url.searchParams.get('sourceFailureRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureRetryBackoffMs')) : undefined,
      sourceFailureMaxRetryBackoffMs: url.searchParams.get('sourceFailureMaxRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureMaxRetryBackoffMs')) : undefined,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      modulePath: url.searchParams.get('modulePath') || url.searchParams.get('connectorModulePath') || undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, report.status === 'fail' ? 503 : 200, report);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/runbook/events') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.synthesizeRunbookNotificationEvents({
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceId: body.sourceId,
      enabled: body.enabled,
      execute: body.execute === true || body.dryRun === false,
      limit: body.limit,
      pipelineLimit: body.pipelineLimit,
      taskLimit: body.taskLimit,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: body.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: body.sourceFailureMaxRetryBackoffMs,
      resolveStale: body.resolveStale,
      staleLimit: body.staleLimit,
      includeRunbook: body.includeRunbook === true,
      now: body.now,
      runningStaleAfterMs: body.runningStaleAfterMs,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/source-attention/events') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.synthesizeSourceAttentionNotificationEvents({
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceId: body.sourceId,
      enabled: body.enabled,
      execute: body.execute === true || body.dryRun === false,
      limit: body.limit,
      attentionLimit: body.attentionLimit,
      staleLimit: body.staleLimit,
      resolveStale: body.resolveStale,
      priorityScoreThreshold: body.priorityScoreThreshold,
      pipelineLimit: body.pipelineLimit,
      eventLimit: body.eventLimit,
      taskLimit: body.taskLimit,
      maxAttempts: body.maxAttempts,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: body.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: body.sourceFailureMaxRetryBackoffMs,
      runningStaleAfterMs: body.runningStaleAfterMs,
      workerStaleAfterMs: body.workerStaleAfterMs,
      includeSourceAttention: body.includeSourceAttention === true,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/source-type-operations/events') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.synthesizeSourceTypeOperationsNotificationEvents({
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceType: body.sourceType,
      enabled: body.enabled,
      execute: body.execute === true || body.dryRun === false,
      limit: body.limit,
      sourceTypeLimit: body.sourceTypeLimit,
      attentionLimit: body.attentionLimit,
      staleLimit: body.staleLimit,
      resolveStale: body.resolveStale,
      priorityScoreThreshold: body.priorityScoreThreshold,
      includeReadinessWarnings: body.includeReadinessWarnings === true,
      pipelineLimit: body.pipelineLimit,
      eventLimit: body.eventLimit,
      taskLimit: body.taskLimit,
      maxAttempts: body.maxAttempts,
      modulePath: body.modulePath || body.connectorModulePath,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: body.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: body.sourceFailureMaxRetryBackoffMs,
      runningStaleAfterMs: body.runningStaleAfterMs,
      workerStaleAfterMs: body.workerStaleAfterMs,
      includeSourceTypeOperations: body.includeSourceTypeOperations === true,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/context-review-results/events') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.synthesizeContextReviewResultNotificationEvents({
      handoffId: body.handoffId,
      status: body.status,
      reviewerId: body.reviewerId,
      sourceId: body.sourceId,
      sourceKey: body.sourceKey || body.forum,
      execute: body.execute === true || body.dryRun === false,
      limit: body.limit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations/worker-topology-plan') {
    const enabledParam = url.searchParams.get('enabled');
    const plan = await context.runtime.getWorkerTopologyPlan({
      forum: url.searchParams.get('forum') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      topology: url.searchParams.get('topology') || undefined,
      sourceTaskMode: url.searchParams.get('sourceTaskMode') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      workerStaleAfterMs: url.searchParams.get('workerStaleAfterMs') ? Number(url.searchParams.get('workerStaleAfterMs')) : undefined
    });
    writeJson(response, plan.status === 'fail' ? 503 : 200, plan);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/rollout-manifest-plan') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const plan = await context.runtime.getRolloutManifestPlan({
      manifest: body.manifest || body,
      limit: body.limit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      runningStaleAfterMs: body.runningStaleAfterMs,
      workerStaleAfterMs: body.workerStaleAfterMs
    });
    writeJson(response, plan.status === 'fail' ? 503 : 200, plan);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/resource-provisioning-plan') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const manifest = body.manifest || (body.source ? body : undefined);
    const plan = await context.runtime.getResourceProvisioningPlan({
      manifest,
      forum: body.forum,
      sourceKey: body.sourceKey,
      enabled: body.enabled,
      limit: body.limit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      runningStaleAfterMs: body.runningStaleAfterMs,
      workerStaleAfterMs: body.workerStaleAfterMs
    });
    writeJson(response, plan.status === 'fail' ? 503 : 200, plan);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/deployment/gate') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const manifest = body.manifest || (body.source ? body : undefined);
    const report = await context.runtime.getDeploymentGateReport({
      manifest,
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceId: body.sourceId,
      enabled: body.enabled,
      limit: body.limit,
      pipelineLimit: body.pipelineLimit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      runningStaleAfterMs: body.runningStaleAfterMs,
      workerStaleAfterMs: body.workerStaleAfterMs
    });
    writeJson(response, report.status === 'fail' ? 503 : 200, report);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/rollout-manifest/apply') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const manifest = body.manifest || (body.source ? body : undefined);
    const result = await context.runtime.runRolloutManifestApplyTask({
      manifest,
      execute: body.execute === true || body.dryRun === false,
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceId: body.sourceId,
      enabled: body.enabled,
      limit: body.limit,
      pipelineLimit: body.pipelineLimit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      runningStaleAfterMs: body.runningStaleAfterMs,
      workerStaleAfterMs: body.workerStaleAfterMs,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, result.report.status === 'fail' ? 503 : 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/runtime/diagnostics') {
    const diagnostics = await context.runtime.getRuntimeDiagnostics({
      now: url.searchParams.get('now') || undefined
    });
    writeJson(response, diagnostics.status === 'fail' ? 503 : 200, diagnostics);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/deployment/checklist') {
    const enabledParam = url.searchParams.get('enabled');
    const checklist = await context.runtime.getDeploymentChecklist({
      forum: url.searchParams.get('forum') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, checklist.status === 'fail' ? 503 : 200, checklist);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/notifications/diagnostics') {
    const diagnostics = await context.runtime.getNotificationDiagnostics({
      channel: url.searchParams.get('channel') || undefined,
      webhookUrl: url.searchParams.get('webhookUrl') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, diagnostics.checks.some(function (check) { return check.status === 'fail'; }) ? 503 : 200, diagnostics);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events/overview') {
    const acknowledgedParam = url.searchParams.get('acknowledged');
    const overview = await context.runtime.getNotificationEventOverview({
      type: url.searchParams.get('type') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      acknowledged: acknowledgedParam === null ? undefined : acknowledgedParam === 'true',
      deliveryStatus: url.searchParams.get('deliveryStatus') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 200,
      maxAttempts: url.searchParams.get('maxAttempts') ? Number(url.searchParams.get('maxAttempts')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, overview);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events/synthesis-policy') {
    const report = await context.runtime.getNotificationSynthesisPolicyReport({
      priorityScoreThreshold: url.searchParams.get('priorityScoreThreshold')
        ? Number(url.searchParams.get('priorityScoreThreshold'))
        : undefined,
      now: url.searchParams.get('now') || undefined
    });
    writeJson(response, 200, report);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    const acknowledgedParam = url.searchParams.get('acknowledged');
    const events = await context.runtime.listNotificationEvents({
      type: url.searchParams.get('type') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      acknowledged: acknowledgedParam === null ? undefined : acknowledgedParam === 'true',
      deliveryStatus: url.searchParams.get('deliveryStatus') || undefined,
      includeArchived: url.searchParams.get('includeArchived') === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, {
      events
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events/action-intents') {
    const result = await context.runtime.listNotificationEventActionIntents({
      eventId: url.searchParams.get('eventId') || undefined,
      actionKey: url.searchParams.get('actionKey') || url.searchParams.get('action') || undefined,
      status: url.searchParams.get('status') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      actor: url.searchParams.get('actor') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events/action-executions') {
    const result = await context.runtime.listNotificationEventActionExecutions({
      eventId: url.searchParams.get('eventId') || undefined,
      actionKey: url.searchParams.get('actionKey') || url.searchParams.get('action') || undefined,
      status: url.searchParams.get('status') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || url.searchParams.get('forum') || undefined,
      actor: url.searchParams.get('actor') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      runningStaleAfterMs: url.searchParams.get('runningStaleAfterMs') ? Number(url.searchParams.get('runningStaleAfterMs')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, result.status === 'warn' ? 503 : 200, result);
    return;
  }

  const eventDetailMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (request.method === 'GET' && eventDetailMatch) {
    const result = await context.runtime.getNotificationEventDetail({
      eventId: decodeURIComponent(eventDetailMatch[1]),
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, result);
    return;
  }

  const eventActionIntentMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/actions\/intent$/);
  if (request.method === 'POST' && eventActionIntentMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.prepareNotificationEventActionIntent({
      eventId: decodeURIComponent(eventActionIntentMatch[1]),
      actionKey: body.actionKey || body.action,
      actor: body.actor,
      requestedBy: body.requestedBy,
      reason: body.reason,
      note: body.note,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, result.status === 'blocked' ? 409 : 200, result);
    return;
  }

  const eventActionExecuteMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/actions\/execute$/);
  if (request.method === 'POST' && eventActionExecuteMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.executeNotificationEventAction({
      eventId: decodeURIComponent(eventActionExecuteMatch[1]),
      actionKey: body.actionKey || body.action,
      actor: body.actor,
      acknowledgedBy: body.acknowledgedBy,
      requestedBy: body.requestedBy,
      reason: body.reason,
      note: body.note,
      execute: body.execute === true,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, result.status === 'blocked' ? 409 : 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/raw-pages') {
    const pages = await context.runtime.listRawThreadPages({
      forum: url.searchParams.get('forum') || undefined,
      sourceThreadId: url.searchParams.get('sourceThreadId') || undefined,
      url: url.searchParams.get('url') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, {
      pages
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/crawl-page') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    if (!body.url && !body.sourceId) {
      writeError(response, 400, 'crawl_page_missing_target', 'POST /api/crawl-page requires url or sourceId.');
      return;
    }
    const result = await context.runtime.fetchThreadPage({
      sourceId: body.sourceId,
      forum: body.forum,
      sourceThreadId: body.sourceThreadId,
      url: body.url,
      page: body.page,
      headers: body.headers,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/raw-pages/tasks/ingest') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    if (!body.contentSha1) {
      writeError(response, 400, 'raw_page_ingest_missing_content_sha1', 'POST /api/raw-pages/tasks/ingest requires contentSha1.');
      return;
    }
    const result = await context.runtime.runRawThreadPageIngestTask({
      forum: body.forum,
      contentSha1: body.contentSha1,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, {
      task: result.task,
      rawPage: result.rawPage,
      report: result.report,
      idempotency: result.idempotency
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/thread-json/validate') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.validateNormalizedThreadJsonFile({
      forum: body.forum,
      sourceKey: body.sourceKey,
      inputFile: body.inputFile,
      now: body.now
    });
    writeJson(response, result.valid ? 200 : 400, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/events/dispatch') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.dispatchNotificationEvents({
      channel: body.channel,
      webhookUrl: body.webhookUrl,
      timeoutMs: body.timeoutMs,
      limit: body.limit,
      maxAttempts: body.maxAttempts,
      sourceId: body.sourceId,
      sourceKey: body.sourceKey || body.forum,
      retryBackoffMs: body.retryBackoffMs,
      maxRetryBackoffMs: body.maxRetryBackoffMs,
      includeFailed: body.includeFailed,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/events/ack') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.acknowledgeNotificationEvents({
      eventIds: body.eventIds,
      type: body.type,
      sourceId: body.sourceId,
      sourceKey: body.sourceKey || body.forum,
      acknowledged: typeof body.acknowledged === 'boolean' ? body.acknowledged : undefined,
      deliveryStatus: body.deliveryStatus,
      limit: body.limit,
      acknowledgedBy: body.acknowledgedBy,
      note: body.note,
      acknowledgedAt: body.acknowledgedAt,
      now: body.now,
      dryRun: body.execute === true ? false : body.dryRun === true,
      execute: body.execute === true,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/events/archive') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.archiveNotificationEvents({
      type: body.type,
      sourceId: body.sourceId,
      sourceKey: body.sourceKey || body.forum,
      deliveryStatuses: body.deliveryStatuses,
      requireAcknowledged: body.requireAcknowledged,
      olderThanDays: body.olderThanDays,
      cutoffAt: body.cutoffAt,
      scanLimit: body.scanLimit,
      archiveLimit: body.archiveLimit,
      limit: body.limit,
      execute: body.execute === true || body.dryRun === false,
      archivedBy: body.archivedBy,
      reason: body.reason,
      batchId: body.batchId,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  const eventAckMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/ack$/);
  if (request.method === 'POST' && eventAckMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.acknowledgeNotificationEvent({
      eventId: decodeURIComponent(eventAckMatch[1]),
      acknowledgedBy: body.acknowledgedBy,
      note: body.note,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/sources/diagnostics') {
    const enabledParam = url.searchParams.get('enabled');
    const diagnostics = await context.runtime.diagnoseSources({
      forum: url.searchParams.get('forum') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, diagnostics.status === 'fail' ? 503 : 200, diagnostics);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/sources/lifecycle') {
    const enabledParam = url.searchParams.get('enabled');
    const report = await context.runtime.getSourceLifecycleReport({
      forum: url.searchParams.get('forum') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      taskLimit: url.searchParams.get('taskLimit') ? Number(url.searchParams.get('taskLimit')) : undefined,
      sourceRunStaleAfterMs: url.searchParams.get('sourceRunStaleAfterMs') ? Number(url.searchParams.get('sourceRunStaleAfterMs')) : undefined,
      sourceFailureRetryBackoffMs: url.searchParams.get('sourceFailureRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureRetryBackoffMs')) : undefined,
      sourceFailureMaxRetryBackoffMs: url.searchParams.get('sourceFailureMaxRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureMaxRetryBackoffMs')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, report);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/sources/schedule') {
    const enabledParam = url.searchParams.get('enabled');
    const report = await context.runtime.getSourceScheduleReport({
      forum: url.searchParams.get('forum') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      collectionStatus: url.searchParams.get('collectionStatus') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
      sourceRunStaleAfterMs: url.searchParams.get('sourceRunStaleAfterMs') ? Number(url.searchParams.get('sourceRunStaleAfterMs')) : undefined,
      sourceFailureRetryBackoffMs: url.searchParams.get('sourceFailureRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureRetryBackoffMs')) : undefined,
      sourceFailureMaxRetryBackoffMs: url.searchParams.get('sourceFailureMaxRetryBackoffMs') ? Number(url.searchParams.get('sourceFailureMaxRetryBackoffMs')) : undefined,
      now: url.searchParams.get('now') || undefined,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, report);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/sources') {
    const enabledParam = url.searchParams.get('enabled');
    const sources = await context.runtime.listSources({
      forum: url.searchParams.get('forum') || undefined,
      sourceKey: url.searchParams.get('sourceKey') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50
    });
    writeJson(response, 200, {
      sources
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/sources/validate') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = context.runtime.validateSourceRegistration({
      id: body.id,
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceType: body.sourceType,
      displayName: body.displayName || body.name,
      inputDir: body.inputDir,
      inputFile: body.inputFile,
      url: body.url,
      startPage: body.startPage,
      pageCount: body.pageCount,
      location: body.location,
      enabled: body.enabled,
      tags: body.tags,
      allowUnknownSourceType: body.allowUnknownSourceType,
      schedule: body.schedule,
      intervalMinutes: body.intervalMinutes,
      nextRunAt: body.nextRunAt,
      scheduleEnabled: body.scheduleEnabled,
      now: body.now
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/sources/onboarding/preflight') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.getSourceOnboardingPreflight({
      manifest: body.manifest,
      id: body.id,
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceType: body.sourceType,
      displayName: body.displayName || body.name,
      modulePath: body.modulePath || body.connectorModulePath,
      inputDir: body.inputDir,
      inputFile: body.inputFile,
      url: body.url,
      startPage: body.startPage,
      pageCount: body.pageCount,
      location: body.location,
      enabled: body.enabled,
      tags: body.tags,
      allowUnknownSourceType: body.allowUnknownSourceType,
      schedule: body.schedule,
      intervalMinutes: body.intervalMinutes,
      nextRunAt: body.nextRunAt,
      scheduleEnabled: body.scheduleEnabled,
      limit: body.limit,
      now: body.now,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, result.status === 'fail' ? 503 : 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/sources/ingest/dry-run') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.dryRunSourceIngest({
      id: body.id,
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceType: body.sourceType,
      displayName: body.displayName || body.name,
      modulePath: body.modulePath || body.connectorModulePath,
      inputDir: body.inputDir,
      inputFile: body.inputFile,
      url: body.url,
      startPage: body.startPage,
      pageCount: body.pageCount,
      location: body.location,
      enabled: body.enabled,
      tags: body.tags,
      allowUnknownSourceType: body.allowUnknownSourceType,
      allowRemoteFetch: body.allowRemoteFetch,
      schedule: body.schedule,
      intervalMinutes: body.intervalMinutes,
      nextRunAt: body.nextRunAt,
      scheduleEnabled: body.scheduleEnabled,
      now: body.now
    });
    writeJson(response, result.status === 'fail' ? 503 : 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/sources') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.registerSource({
      id: body.id,
      forum: body.forum,
      sourceKey: body.sourceKey,
      sourceType: body.sourceType,
      displayName: body.displayName || body.name,
      inputDir: body.inputDir,
      inputFile: body.inputFile,
      url: body.url,
      location: body.location,
      enabled: body.enabled,
      tags: body.tags,
      allowUnknownSourceType: body.allowUnknownSourceType,
      schedule: body.schedule,
      intervalMinutes: body.intervalMinutes,
      nextRunAt: body.nextRunAt,
      scheduleEnabled: body.scheduleEnabled,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, result.created ? 201 : 200, result);
    return;
  }

  const disableSourceMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/disable$/);
  if (request.method === 'POST' && disableSourceMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runDisableSourceTask({
      sourceId: decodeURIComponent(disableSourceMatch[1]),
      execute: body.execute === true || body.dryRun === false,
      force: body.force === true,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs === undefined ? body.staleAfterMs : body.sourceRunStaleAfterMs,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, result);
    return;
  }

  const enableSourceMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/enable$/);
  if (request.method === 'POST' && enableSourceMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runEnableSourceTask({
      sourceId: decodeURIComponent(enableSourceMatch[1]),
      execute: body.execute === true || body.dryRun === false,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, result);
    return;
  }

  const resetSourceFailureMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/failure\/reset$/);
  if (request.method === 'POST' && resetSourceFailureMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runResetSourceFailureTask({
      sourceId: decodeURIComponent(resetSourceFailureMatch[1]),
      execute: body.execute === true || body.dryRun === false,
      retryNow: body.retryNow === true,
      nextRunAt: body.nextRunAt,
      resetBy: body.resetBy || body.acknowledgedBy,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/sources/tasks/ingest') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runEnabledSourcesIngestTasks({
      forum: body.forum,
      limit: body.limit,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/sources/tasks/ingest-due') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runDueSourcesIngestTasks({
      forum: body.forum,
      limit: body.limit,
      now: body.now,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: body.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: body.sourceFailureMaxRetryBackoffMs,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/sources/tasks/insight-pipeline-due') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runDueSourceInsightPipelineTasks({
      forum: body.forum,
      limit: body.limit,
      now: body.now,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: body.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: body.sourceFailureMaxRetryBackoffMs,
      provider: body.provider || 'mock',
      traceId: body.traceId,
      baseReportType: body.baseReportType,
      semanticEnrichmentEnabled: body.semanticEnrichmentEnabled,
      semanticSkipIfUnchanged: body.semanticSkipIfUnchanged,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/demo/source-cycle') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runSourceDemoCycle({
      sourceId: body.sourceId,
      forum: body.forum,
      sourceKey: body.sourceKey,
      limit: body.limit,
      drilldownLimit: body.drilldownLimit,
      now: body.now,
      provider: body.provider || 'mock',
      traceId: body.traceId,
      acknowledgeEvents: body.acknowledgeEvents === true,
      executeAcknowledgement: body.executeAcknowledgement === true || body.ackDryRun === false,
      acknowledgedBy: body.acknowledgedBy,
      acknowledgementNote: body.acknowledgementNote,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      sourceFailureRetryBackoffMs: body.sourceFailureRetryBackoffMs,
      sourceFailureMaxRetryBackoffMs: body.sourceFailureMaxRetryBackoffMs,
      baseReportType: body.baseReportType,
      semanticEnrichmentEnabled: body.semanticEnrichmentEnabled,
      semanticSkipIfUnchanged: body.semanticSkipIfUnchanged,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, result.status === 'fail' ? 503 : 200, result);
    return;
  }

  const sourceIngestMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/tasks\/ingest$/);
  if (request.method === 'POST' && sourceIngestMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runSourceIngestTask({
      sourceId: decodeURIComponent(sourceIngestMatch[1]),
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, {
      sourceId: decodeURIComponent(sourceIngestMatch[1]),
      task: result.task,
      report: result.report
    });
    return;
  }

  const sourcePipelineMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/tasks\/insight-pipeline$/);
  if (request.method === 'POST' && sourcePipelineMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runSourceInsightPipelineTask({
      sourceId: decodeURIComponent(sourcePipelineMatch[1]),
      provider: body.provider || 'mock',
      traceId: body.traceId,
      baseReportType: body.baseReportType,
      semanticEnrichmentEnabled: body.semanticEnrichmentEnabled,
      semanticSkipIfUnchanged: body.semanticSkipIfUnchanged,
      sourceRunStaleAfterMs: body.sourceRunStaleAfterMs,
      now: body.now,
      storeDir: body.storeDir || context.storeDir,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey
    });
    writeJson(response, 200, {
      sourceId: decodeURIComponent(sourcePipelineMatch[1]),
      task: result.task,
      ingest: {
        task: result.ingest.task,
        cursor: result.ingest.cursor,
        cursorDiff: result.ingest.cursorDiff
      },
      semantic: result.semantic
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/index-directory') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.indexDirectory({
      forum: body.forum,
      inputDir: body.inputDir || context.defaultInputDir,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, {
      sourceKey: result.threadSnapshot.sourceKey,
      sourceThreadId: result.threadSnapshot.sourceThreadId,
      title: result.threadSnapshot.title,
      indexedDocumentCount: result.indexedDocumentCount
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/search') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    if (!body.text) {
      writeError(response, 400, 'search_missing_text', 'POST /api/search requires text.');
      return;
    }
    const results = await context.runtime.search({
      text: body.text,
      filter: body.filter,
      limit: body.limit || 10,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, {
      results
    });
    return;
  }

  writeError(response, 404, 'route_not_found', 'Not found.');
}

async function serveStaticAsset(response, webDir, pathname) {
  const assetName = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.join(webDir, assetName);
  const content = await fs.readFile(filePath);
  response.writeHead(200, {
    'content-type': contentTypeFor(assetName),
    'content-length': content.length,
    'cache-control': 'no-store'
  });
  response.end(content);
}

function contentTypeFor(assetName) {
  if (/\.html$/i.test(assetName)) return 'text/html; charset=utf-8';
  if (/\.css$/i.test(assetName)) return 'text/css; charset=utf-8';
  if (/\.js$/i.test(assetName)) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function authorIntelligenceRequestFromSearchParams(searchParams) {
  return {
    sourceKey: searchParams.get('sourceKey') || searchParams.get('forum') || undefined,
    sourceThreadId: searchParams.get('sourceThreadId') || undefined,
    authorId: searchParams.get('authorId') || searchParams.get('sourceAuthorId') || undefined,
    author: searchParams.get('author') || searchParams.get('authorName') || undefined,
    reportType: searchParams.get('reportType') || undefined,
    includeReportRevisions: searchParams.get('includeReportRevisions') === 'true',
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
    authorLimit: searchParams.get('authorLimit') ? Number(searchParams.get('authorLimit')) : undefined,
    entityLimit: searchParams.get('entityLimit') ? Number(searchParams.get('entityLimit')) : undefined,
    timelineLimit: searchParams.get('timelineLimit') ? Number(searchParams.get('timelineLimit')) : undefined,
    evidenceLimit: searchParams.get('evidenceLimit') ? Number(searchParams.get('evidenceLimit')) : undefined,
    gapLimit: searchParams.get('gapLimit') ? Number(searchParams.get('gapLimit')) : undefined,
    reviewQueueLimit: searchParams.get('reviewQueueLimit') ? Number(searchParams.get('reviewQueueLimit')) : undefined,
    now: searchParams.get('now') || undefined,
    storeDir: searchParams.get('storeDir') || undefined
  };
}

function authorReviewQueueRequestFromSearchParams(searchParams) {
  return {
    sourceKey: searchParams.get('sourceKey') || searchParams.get('forum') || undefined,
    sourceThreadId: searchParams.get('sourceThreadId') || undefined,
    status: searchParams.get('status') || undefined,
    type: searchParams.get('type') || undefined,
    priority: searchParams.get('priority') || undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    now: searchParams.get('now') || undefined,
    storeDir: searchParams.get('storeDir') || undefined
  };
}

function readJsonBody(request, maxBodyBytes) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let totalBytes = 0;
    request.on('data', function (chunk) {
      totalBytes += chunk.length;
      if (totalBytes > maxBodyBytes) {
        reject(httpInputError('request_body_too_large', 'Request body is too large.', 413));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', function () {
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(httpInputError('invalid_json_body', 'Invalid JSON body: ' + error.message, 400));
      }
    });
  });
}

function writeJson(response, statusCode, body) {
  const text = JSON.stringify(body, null, 2);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text)
  });
  response.end(text);
}

function writeText(response, statusCode, text, contentType) {
  const body = String(text || '');
  response.writeHead(statusCode, {
    'content-type': contentType || 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  response.end(body);
}

function writeError(response, statusCode, code, message, details) {
  writeJson(response, statusCode, {
    error: {
      message,
      code,
      details,
      requestId: response.getHeader('x-request-id')
    }
  });
}

function resolveRequestId(request) {
  return resolveHeaderValue(request, 'x-request-id') || crypto.randomUUID();
}

function resolveHeaderValue(request, name) {
  const value = request.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

function applyCors(response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type,x-request-id,idempotency-key');
}

function httpInputError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function httpStatusForError(error) {
  if (isApplicationError(error)) return error.statusCode || 500;
  if (error && Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 599) {
    return error.statusCode;
  }
  return 500;
}

module.exports = {
  createThreadTraceServer
};
