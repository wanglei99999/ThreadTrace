'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApplicationError } = require('../src/application/errors/applicationError');
const { createThreadTraceServer } = require('../src/presentation/http/createServer');

test('http server exposes health, adapters, and context APIs', async function () {
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example')
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const health = await getJson(baseUrl + '/health');
    const home = await fetch(baseUrl + '/');
    const adapters = await getJson(baseUrl + '/adapters');
    const adapterDiagnostics = await getJson(baseUrl + '/api/adapters/diagnostics?now=2026-06-19T10:00:00.000Z');
    const handlers = await getJson(baseUrl + '/api/source-ingest-handlers');
    const connectorCatalog = await getJson(baseUrl + '/api/connectors/catalog?now=2026-06-19T10:00:00.000Z');
    const connectorReadiness = await getJson(baseUrl + '/api/connectors/readiness?now=2026-06-19T10:00:00.000Z');
    const openApi = await getJson(baseUrl + '/openapi.json');
    const context = await postJson(baseUrl + '/api/interpret-text', {
      text: '科技后面看量确认',
      authorId: '150058',
      author: '-阿狼-'
    });

    assert.equal(health.ok, true);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /ThreadTrace/);
    assert.equal(adapters.adapters[0].sourceKey, 'nga');
    assert.equal(adapterDiagnostics.status, 'ok');
    assert.equal(adapterDiagnostics.adapterCount, 1);
    assert.equal(handlers.handlers[0].sourceType, 'saved-html-directory');
    assert.equal(handlers.handlers[0].requiresAdapter, true);
    assert.deepEqual(handlers.handlers[0].locationSchema.required, ['inputDir']);
    assert.equal(connectorCatalog.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.ok(connectorCatalog.sourceTypes.some(function (sourceType) {
      return sourceType.sourceType === 'thread-url';
    }));
    assert.equal(connectorReadiness.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.equal(connectorReadiness.status, 'ok');
    assert.ok(connectorReadiness.connectors.some(function (connector) {
      return connector.sourceType === 'saved-html-directory';
    }));
    assert.equal(openApi.openapi, '3.0.3');
    assert.ok(openApi.paths['/api/interpret-text']);
    assert.ok(openApi.paths['/api/adapters/diagnostics']);
    assert.ok(openApi.paths['/api/connectors/catalog']);
    assert.ok(openApi.paths['/api/connectors/readiness']);
    assert.ok(openApi.paths['/api/runtime/diagnostics']);
    assert.ok(openApi.paths['/api/sources/validate']);
    assert.ok(openApi.paths['/api/operations/trace-context']);
    assert.ok(openApi.paths['/api/thread-json/validate']);
    assert.equal(openApi.components.schemas.ErrorResponse.properties.error.properties.code.example, 'source_run_already_running');
    assert.equal(openApi.components.schemas.ErrorResponse.properties.error.properties.requestId.type, 'string');
    assert.equal(openApi.components.responses.BadRequest.content['application/json'].schema.$ref, '#/components/schemas/ErrorResponse');
    assert.equal(openApi.paths['/api/search'].post.responses[400].$ref, '#/components/responses/BadRequest');
    assert.equal(openApi.paths['/api/sources/{sourceId}/tasks/ingest'].post.responses[404].$ref, '#/components/responses/NotFound');
    assert.equal(openApi.paths['/api/sources/{sourceId}/tasks/ingest'].post.responses[409].$ref, '#/components/responses/Conflict');
    assert.equal(context.reportType, 'new-post-context');
    assert.ok(context.relatedEvidence.length >= 1);
  } finally {
    await close(server);
  }
});

test('http server exposes semantic enrichment API', async function () {
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example')
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const enriched = await postJson(baseUrl + '/api/enrich-directory', {
      forum: 'nga',
      provider: 'mock',
      traceId: 'http-trace'
    });

    assert.equal(enriched.reportType, 'basic-history');
    assert.equal(enriched.semanticInsights.provider, 'mock');
    assert.equal(enriched.semanticInsights.traceId, 'http-trace');
    assert.ok(enriched.semanticInsights.entityInsights.length >= 1);
  } finally {
    await close(server);
  }
});

test('http server runs and lists persisted semantic enrichment reports', async function () {
  const reports = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async runSemanticEnrichmentTask(request) {
        const report = {
          reportType: 'semantic-enrichment',
          baseReportType: request.baseReportType || 'basic-history',
          generatedAt: '2026-06-19T10:00:00.000Z',
          thread: {
            sourceKey: request.sourceKey || 'nga',
            sourceThreadId: request.sourceThreadId,
            title: 'sample'
          },
          semanticInsights: {
            provider: request.provider || 'mock',
            summary: 'semantic summary'
          }
        };
        reports.push(report);
        return {
          task: {
            id: 'semantic-task-1',
            type: 'semantic-enrichment',
            status: 'completed'
          },
          report
        };
      },
      async listAnalysisReports() {
        return reports;
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const result = await postJson(baseUrl + '/api/reports/tasks/semantic-enrichment', {
      sourceKey: 'nga',
      sourceThreadId: '45974302',
      provider: 'mock'
    });
    const listed = await getJson(baseUrl + '/api/reports?sourceKey=nga&sourceThreadId=45974302&reportType=semantic-enrichment');
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(result.task.type, 'semantic-enrichment');
    assert.equal(result.report.reportType, 'semantic-enrichment');
    assert.equal(listed.reports.length, 1);
    assert.ok(openApi.paths['/api/reports']);
    assert.ok(openApi.paths['/api/reports/tasks/semantic-enrichment']);
  } finally {
    await close(server);
  }
});

test('http server exposes operational overview API', async function () {
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async getOperationalOverview(request) {
        return {
          generatedAt: request.now || '2026-06-18T10:00:00.000Z',
          storageMode: 'file',
          sources: { total: 1, enabled: 1, disabled: 0, due: 1, running: 0, failed: 0, dueSources: [] },
          tasks: { total: 2, queued: 0, running: 0, completed: 1, failed: 1 },
          events: { pending: 1, failed: 0, unacknowledged: 1, dueForDelivery: 1 },
          rawPages: { total: 1 },
          recent: { tasks: [], events: [], rawPages: [] }
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const overview = await getJson(baseUrl + '/api/operations/overview?limit=10');

    assert.equal(overview.storageMode, 'file');
    assert.equal(overview.sources.due, 1);
    assert.equal(overview.tasks.failed, 1);
    assert.equal(overview.events.dueForDelivery, 1);
  } finally {
    await close(server);
  }
});

test('http server exposes operational readiness API', async function () {
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async getOperationalReadiness() {
        return {
          generatedAt: '2026-06-18T10:00:00.000Z',
          status: 'fail',
          checks: [
            { key: 'workers.stale', status: 'fail', count: 1, summary: 'Worker runs are stale.' }
          ],
          overview: {
            workers: {
              stale: 1
            }
          }
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const response = await fetch(baseUrl + '/api/operations/readiness?limit=10');
    const readiness = await response.json();
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(response.status, 503);
    assert.equal(readiness.status, 'fail');
    assert.equal(readiness.checks[0].key, 'workers.stale');
    assert.ok(openApi.paths['/api/operations/readiness']);
  } finally {
    await close(server);
  }
});

test('http server exposes runtime diagnostics API', async function () {
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example')
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const diagnostics = await getJson(baseUrl + '/api/runtime/diagnostics?now=2026-06-18T10:00:00.000Z');

    assert.equal(diagnostics.status, 'ok');
    assert.equal(diagnostics.generatedAt, '2026-06-18T10:00:00.000Z');
    assert.equal(diagnostics.configuration.llm.provider, 'mock');
    assert.equal(diagnostics.configuration.llm.apiKeyConfigured, false);
    assert.equal(diagnostics.resources.storageMode, 'file');
    assert.ok(diagnostics.checks.find(function (item) {
      return item.key === 'config.storageMode';
    }));
    assert.ok(diagnostics.checks.find(function (item) {
      return item.key === 'resources.storeDir';
    }));
  } finally {
    await close(server);
  }
});

test('http server exposes deployment checklist API', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-deployment-checklist-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const checklist = await getJson(baseUrl + '/api/deployment/checklist?now=2026-06-19T10:00:00.000Z');
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(checklist.status, 'ok');
    assert.equal(checklist.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.ok(checklist.items.find(function (item) {
      return item.key === 'runtime.configuration';
    }));
    assert.ok(checklist.items.find(function (item) {
      return item.key === 'sources.ingestConfiguration';
    }));
    assert.ok(openApi.paths['/api/deployment/checklist']);
  } finally {
    await close(server);
  }
});

test('http server exposes notification diagnostics API', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-notification-diagnostics-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const diagnostics = await getJson(baseUrl + '/api/notifications/diagnostics?channel=file');
    const response = await fetch(baseUrl + '/api/notifications/diagnostics?channel=webhook');
    const failedDiagnostics = await response.json();
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(diagnostics.channel, 'file');
    assert.equal(diagnostics.checks.find(function (check) {
      return check.key === 'notifications.fileDeliveryDir';
    }).status, 'ok');
    assert.equal(response.status, 503);
    assert.equal(failedDiagnostics.checks.find(function (check) {
      return check.key === 'notifications.webhookUrl';
    }).status, 'fail');
    assert.ok(openApi.paths['/api/notifications/diagnostics']);
  } finally {
    await close(server);
  }
});

test('http server exposes operations runbook API', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-operations-runbook-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const runbook = await getJson(baseUrl + '/api/operations/runbook?now=2026-06-19T10:00:00.000Z');
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(runbook.status, 'ok');
    assert.equal(runbook.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.equal(runbook.actionCount, 0);
    assert.ok(openApi.paths['/api/operations/runbook']);
  } finally {
    await close(server);
  }
});

test('http server handles CORS preflight and validates interpret text input', async function () {
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example')
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const preflight = await fetch(baseUrl + '/api/interpret-text', {
      method: 'OPTIONS',
      headers: {
        'x-request-id': 'preflight-request-1'
      }
    });
    const invalid = await fetch(baseUrl + '/api/interpret-text', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'interpret-request-1'
      },
      body: JSON.stringify({})
    });
    const invalidBody = await invalid.json();
    const missingRoute = await fetch(baseUrl + '/api/missing-route');
    const missingRouteBody = await missingRoute.json();

    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    assert.equal(preflight.headers.get('x-request-id'), 'preflight-request-1');
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.get('x-request-id'), 'interpret-request-1');
    assert.equal(invalidBody.error.code, 'interpret_text_missing_text');
    assert.equal(invalidBody.error.requestId, 'interpret-request-1');
    assert.match(invalidBody.error.message, /requires text/);
    assert.equal(missingRoute.status, 404);
    assert.equal(missingRouteBody.error.code, 'route_not_found');
  } finally {
    await close(server);
  }
});

test('http server maps expected application and request errors', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-errors-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const invalidJson = await fetch(baseUrl + '/api/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: '{'
    });
    const invalidJsonBody = await invalidJson.json();
    const invalidSource = await fetch(baseUrl + '/api/sources', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sourceKey: 'custom',
        sourceType: 'unknown-feed',
        displayName: 'Unknown feed',
        location: {
          endpoint: 'https://example.test/feed'
        }
      })
    });
    const invalidSourceBody = await invalidSource.json();
    const invalidSearch = await fetch(baseUrl + '/api/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const invalidSearchBody = await invalidSearch.json();
    const unknownSourceRun = await fetch(baseUrl + '/api/sources/missing-source/tasks/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const unknownSourceRunBody = await unknownSourceRun.json();
    const unknownSourceCrawl = await fetch(baseUrl + '/api/crawl-page', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sourceId: 'missing-source'
      })
    });
    const unknownSourceCrawlBody = await unknownSourceCrawl.json();

    assert.equal(invalidJson.status, 400);
    assert.equal(invalidJsonBody.error.code, 'invalid_json_body');
    assert.equal(invalidSource.status, 400);
    assert.equal(invalidSourceBody.error.code, 'source_type_unregistered');
    assert.equal(invalidSourceBody.error.details.sourceType, 'unknown-feed');
    assert.equal(invalidSearch.status, 400);
    assert.equal(invalidSearchBody.error.code, 'search_missing_text');
    assert.equal(unknownSourceRun.status, 404);
    assert.equal(unknownSourceRunBody.error.code, 'source_not_found');
    assert.equal(unknownSourceRunBody.error.details.sourceId, 'missing-source');
    assert.equal(unknownSourceCrawl.status, 404);
    assert.equal(unknownSourceCrawlBody.error.code, 'source_not_found');
    assert.equal(unknownSourceCrawlBody.error.details.sourceId, 'missing-source');
  } finally {
    await close(server);
  }
});

test('http server maps source run conflicts to 409', async function () {
  const server = createThreadTraceServer({
    runtime: {
      async runSourceIngestTask() {
        throw createApplicationError('source_run_already_running', 'Tracked source is already running: source-1', {
          statusCode: 409,
          details: {
            sourceId: 'source-1'
          }
        });
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const response = await fetch(baseUrl + '/api/sources/source-1/tasks/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: '{}'
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.error.code, 'source_run_already_running');
    assert.equal(body.error.details.sourceId, 'source-1');
  } finally {
    await close(server);
  }
});

test('http server can run and list ingest tasks', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-task-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const taskResponse = await fetch(baseUrl + '/api/tasks/ingest-directory', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'http-task-request-1',
        'idempotency-key': 'http-task-idem-1'
      },
      body: '{}'
    });
    const taskResult = await taskResponse.json();
    const replayResponse = await fetch(baseUrl + '/api/tasks/ingest-directory', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'http-task-request-2',
        'idempotency-key': 'http-task-idem-1'
      },
      body: '{}'
    });
    const replayResult = await replayResponse.json();
    const tasksResult = await getJson(baseUrl + '/api/tasks');
    const tasksByRequestId = await getJson(baseUrl + '/api/tasks?requestId=http-task-request-1');
    const tasksByIdempotencyKey = await getJson(baseUrl + '/api/tasks?idempotencyKey=http-task-idem-1');
    const traceContext = await getJson(baseUrl + '/api/operations/trace-context?requestId=http-task-request-1');
    const missingTraceQuery = await fetch(baseUrl + '/api/operations/trace-context');
    const missingTraceQueryBody = await missingTraceQuery.json();

    assert.equal(taskResult.task.status, 'completed');
    assert.equal(taskResult.task.output.sourceThreadId, '45974302');
    assert.equal(taskResult.task.input._trace.requestId, 'http-task-request-1');
    assert.equal(taskResult.task.input._trace.idempotencyKey, 'http-task-idem-1');
    assert.equal(replayResponse.status, 200);
    assert.equal(replayResult.task.id, taskResult.task.id);
    assert.equal(replayResult.idempotency.reused, true);
    assert.equal(replayResult.report.thread.sourceThreadId, '45974302');
    assert.equal(tasksResult.tasks.length, 1);
    assert.equal(tasksResult.tasks[0].id, taskResult.task.id);
    assert.equal(tasksResult.tasks[0].input._trace.requestId, 'http-task-request-1');
    assert.equal(tasksByRequestId.tasks.length, 1);
    assert.equal(tasksByRequestId.tasks[0].id, taskResult.task.id);
    assert.equal(tasksByIdempotencyKey.tasks.length, 1);
    assert.equal(tasksByIdempotencyKey.tasks[0].id, taskResult.task.id);
    assert.equal(traceContext.taskCount, 1);
    assert.equal(traceContext.summary.byStatus.completed, 1);
    assert.equal(traceContext.tasks[0].id, taskResult.task.id);
    assert.equal(missingTraceQuery.status, 400);
    assert.equal(missingTraceQueryBody.error.code, 'trace_context_query_required');
  } finally {
    await close(server);
  }
});

test('http server can index and search historical evidence', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-search-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const indexResult = await postJson(baseUrl + '/api/index-directory', {});
    const searchResult = await postJson(baseUrl + '/api/search', {
      text: '科技',
      limit: 5
    });

    assert.equal(indexResult.sourceThreadId, '45974302');
    assert.equal(indexResult.indexedDocumentCount, 20);
    assert.ok(searchResult.results.length >= 1);
    assert.equal(searchResult.results[0].metadata.sourceThreadId, '45974302');
  } finally {
    await close(server);
  }
});

test('http server can register sources and run source ingest tasks', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-source-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const validationResult = await postJson(baseUrl + '/api/sources/validate', {
      forum: 'nga',
      displayName: 'NGA sample archive',
      inputDir: path.resolve(__dirname, '..', 'example'),
      now: '2026-06-19T10:00:00.000Z'
    });
    const registerResponse = await fetch(baseUrl + '/api/sources', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        forum: 'nga',
        displayName: 'NGA sample archive',
        inputDir: path.resolve(__dirname, '..', 'example'),
        intervalMinutes: 60
      })
    });
    const registerResult = await registerResponse.json();
    const sourcesResult = await getJson(baseUrl + '/api/sources');
    const dueResult = await postJson(baseUrl + '/api/sources/tasks/ingest-due', {});
    const skippedDueResult = await postJson(baseUrl + '/api/sources/tasks/ingest-due', {});
    const eventsResult = await getJson(baseUrl + '/api/events');
    const dispatchResult = await postJson(baseUrl + '/api/events/dispatch', {});
    const deliveredEventsResult = await getJson(baseUrl + '/api/events?deliveryStatus=delivered');
    const ackResult = await postJson(baseUrl + '/api/events/' + encodeURIComponent(eventsResult.events[0].id) + '/ack', {
      acknowledgedBy: 'test'
    });
    const openEventsResult = await getJson(baseUrl + '/api/events?acknowledged=false');
    const taskResult = await postJson(baseUrl + '/api/sources/' + encodeURIComponent(registerResult.source.id) + '/tasks/ingest', {});
    const batchResult = await postJson(baseUrl + '/api/sources/tasks/ingest', {});

    assert.equal(validationResult.valid, true);
    assert.equal(validationResult.status, 'ok');
    assert.equal(validationResult.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.equal(validationResult.source.id, registerResult.source.id);
    assert.equal(registerResponse.status, 201);
    assert.equal(sourcesResult.sources.length, 1);
    assert.equal(sourcesResult.sources[0].id, registerResult.source.id);
    assert.equal(dueResult.task.type, 'ingest-due-sources');
    assert.equal(dueResult.dueCount, 1);
    assert.equal(skippedDueResult.dueCount, 0);
    assert.equal(skippedDueResult.skippedCount, 1);
    assert.equal(eventsResult.events.length, 1);
    assert.equal(eventsResult.events[0].type, 'source-changed');
    assert.equal(dispatchResult.dispatchedCount, 1);
    assert.equal(deliveredEventsResult.events.length, 1);
    assert.equal(ackResult.event.acknowledgedBy, 'test');
    assert.equal(openEventsResult.events.length, 0);
    assert.equal(taskResult.sourceId, registerResult.source.id);
    assert.equal(taskResult.task.status, 'completed');
    assert.equal(batchResult.task.status, 'completed');
    assert.equal(batchResult.task.type, 'ingest-enabled-sources');
    assert.equal(batchResult.sourceCount, 1);
    assert.equal(batchResult.completedCount, 1);
    assert.equal(batchResult.failedCount, 0);
  } finally {
    await close(server);
  }
});

test('http server exposes tracked source diagnostics', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-source-diagnostics-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    await postJsonWithStatus(baseUrl + '/api/sources', {
      forum: 'missing-forum',
      displayName: 'Missing forum source',
      inputDir: path.resolve(__dirname, '..', 'example')
    }, 201);
    const response = await fetch(baseUrl + '/api/sources/diagnostics');
    const diagnostics = await response.json();
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(response.status, 503);
    assert.equal(diagnostics.status, 'fail');
    assert.equal(diagnostics.sources[0].status, 'fail');
    assert.equal(diagnostics.sources[0].checks.find(function (check) {
      return check.key === 'source.adapter';
    }).status, 'fail');
    assert.ok(openApi.paths['/api/sources/diagnostics']);
  } finally {
    await close(server);
  }
});

test('http server runs source insight pipeline tasks', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-source-pipeline-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const registerResult = await postJsonWithStatus(baseUrl + '/api/sources', {
      forum: 'nga',
      displayName: 'NGA sample archive',
      inputDir: path.resolve(__dirname, '..', 'example')
    }, 201);
    const result = await postJson(baseUrl + '/api/sources/' + encodeURIComponent(registerResult.source.id) + '/tasks/insight-pipeline', {
      provider: 'mock',
      traceId: 'http-source-pipeline'
    });
    const runs = await getJson(baseUrl + '/api/sources/tasks/insight-pipeline-runs?sourceId=' + encodeURIComponent(registerResult.source.id));
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(result.sourceId, registerResult.source.id);
    assert.equal(result.task.status, 'completed');
    assert.equal(result.task.type, 'source-insight-pipeline');
    assert.equal(result.ingest.task.status, 'completed');
    assert.equal(result.ingest.cursor.sourceThreadId, '45974302');
    assert.equal(result.semantic.status, 'completed');
    assert.equal(result.semantic.traceId, 'http-source-pipeline');
    assert.equal(runs.runs.length, 1);
    assert.equal(runs.runs[0].taskId, result.task.id);
    assert.equal(runs.runs[0].source.displayName, 'NGA sample archive');
    assert.equal(runs.runs[0].semantic.traceId, 'http-source-pipeline');
    assert.ok(openApi.paths['/api/sources/{sourceId}/tasks/insight-pipeline']);
    assert.ok(openApi.paths['/api/sources/tasks/insight-pipeline-runs']);
  } finally {
    await close(server);
  }
});

test('http server runs due source insight pipeline batches', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-due-source-pipeline-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    await postJsonWithStatus(baseUrl + '/api/sources', {
      forum: 'nga',
      displayName: 'NGA sample archive',
      inputDir: path.resolve(__dirname, '..', 'example'),
      intervalMinutes: 60
    }, 201);
    const result = await postJson(baseUrl + '/api/sources/tasks/insight-pipeline-due', {
      provider: 'mock',
      traceId: 'http-due-source-pipeline'
    });
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(result.task.status, 'completed');
    assert.equal(result.task.type, 'source-insight-pipeline-due-sources');
    assert.equal(result.dueCount, 1);
    assert.equal(result.completedCount, 1);
    assert.equal(result.results[0].semantic.status, 'completed');
    assert.ok(openApi.paths['/api/sources/tasks/insight-pipeline-due']);
  } finally {
    await close(server);
  }
});

test('http server exposes raw page crawl, list, and replay APIs', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async fetchThreadPage(request) {
        calls.push(['fetchThreadPage', request]);
        return {
          duplicate: false,
          rawPage: {
            sourceKey: request.forum,
            sourceThreadId: request.sourceThreadId,
            sourceUrl: request.url,
            contentSha1: 'abc123',
            fetchedAt: '2026-06-18T10:00:00.000Z',
            metadata: { status: 200 }
          }
        };
      },
      async listRawThreadPages(request) {
        calls.push(['listRawThreadPages', request]);
        return [{
          sourceKey: request.forum,
          sourceThreadId: '45974302',
          sourceUrl: 'https://example.test/thread',
          contentSha1: 'abc123',
          fetchedAt: '2026-06-18T10:00:00.000Z',
          metadata: { status: 200 }
        }];
      },
      async runRawThreadPageIngestTask(request) {
        calls.push(['runRawThreadPageIngestTask', request]);
        return {
          task: {
            id: 'task-1',
            status: 'completed'
          },
          rawPage: {
            contentSha1: request.contentSha1
          },
          report: {
            thread: {
              sourceThreadId: '45974302'
            }
          }
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const crawlResult = await postJson(baseUrl + '/api/crawl-page', {
      forum: 'nga',
      sourceThreadId: '45974302',
      url: 'https://example.test/thread'
    });
    const pagesResult = await getJson(baseUrl + '/api/raw-pages?forum=nga&limit=5');
    const replayResult = await postJson(baseUrl + '/api/raw-pages/tasks/ingest', {
      forum: 'nga',
      contentSha1: 'abc123'
    });

    assert.equal(crawlResult.rawPage.contentSha1, 'abc123');
    assert.equal(pagesResult.pages.length, 1);
    assert.equal(replayResult.task.status, 'completed');
    assert.deepEqual(calls.map(function (call) { return call[0]; }), [
      'fetchThreadPage',
      'listRawThreadPages',
      'runRawThreadPageIngestTask'
    ]);
  } finally {
    await close(server);
  }
});

function listen(server, port) {
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

function close(server) {
  return new Promise(function (resolve, reject) {
    server.close(function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function getJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.json();
}

async function postJson(url, body) {
  return postJsonWithStatus(url, body, 200);
}

async function postJsonWithStatus(url, body, status) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, status);
  return response.json();
}
