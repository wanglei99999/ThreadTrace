'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApplicationError } = require('../src/application/errors/applicationError');
const { createThreadTraceServer } = require('../src/presentation/http/createServer');
const { createThreadTraceConfig } = require('../src/runtime/threadTraceConfig');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');
const { makeWorkspaceTempDir } = require('./helpers/workspaceTempDir');

test('http server exposes health, adapters, and context APIs', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-core-'));
  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: path.join(tempDir, 'store')
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const health = await getJson(baseUrl + '/health');
    const home = await fetch(baseUrl + '/');
    const webApp = await fetch(baseUrl + '/app.js');
    const adapters = await getJson(baseUrl + '/adapters');
    const adapterDiagnostics = await getJson(baseUrl + '/api/adapters/diagnostics?now=2026-06-19T10:00:00.000Z');
    const handlers = await getJson(baseUrl + '/api/source-ingest-handlers');
    const connectorCatalog = await getJson(baseUrl + '/api/connectors/catalog?now=2026-06-19T10:00:00.000Z');
    const sourceTypeReadiness = await getJson(baseUrl + '/api/connectors/source-type-readiness?now=2026-06-19T10:00:00.000Z');
    const sourceTypeOperations = await getJson(baseUrl + '/api/operations/source-type-operations?now=2026-06-19T10:00:00.000Z');
    const connectorReadiness = await getJson(baseUrl + '/api/connectors/readiness?now=2026-06-19T10:00:00.000Z');
    const openApi = await getJson(baseUrl + '/openapi.json');
    const notificationSynthesisPolicy = await getJson(baseUrl + '/api/events/synthesis-policy?priorityScoreThreshold=85&now=2026-06-25T10:00:00.000Z');
    const connectorRolloutPlan = await postJson(baseUrl + '/api/connectors/rollout-plan', {
      now: '2026-06-19T10:00:00.000Z'
    });
    const rolloutManifestPlan = await postJson(baseUrl + '/api/operations/rollout-manifest-plan', {
      version: '1.0',
      name: 'http-rollout',
      source: {
        sourceKey: 'nga',
        sourceType: 'saved-html-directory',
        displayName: 'NGA sample archive',
        inputDir: path.resolve(__dirname, '..', 'example')
      },
      ingest: {
        dryRun: true
      },
      workers: {
        topology: 'operations-worker',
        sourceTaskMode: 'ingest'
      },
      now: '2026-06-19T10:00:00.000Z'
    });
    const resourceProvisioningPlan = await postJson(baseUrl + '/api/operations/resource-provisioning-plan', {
      version: '1.0',
      name: 'http-resource-rollout',
      source: {
        sourceKey: 'nga',
        sourceType: 'saved-html-directory',
        displayName: 'NGA sample archive',
        inputDir: path.resolve(__dirname, '..', 'example')
      },
      ingest: {
        dryRun: true
      },
      workers: {
        topology: 'operations-worker',
        sourceTaskMode: 'ingest'
      },
      now: '2026-06-19T10:00:00.000Z'
    });
    const deploymentGate = await postJson(baseUrl + '/api/deployment/gate', {
      version: '1.0',
      name: 'http-gate-rollout',
      source: {
        sourceKey: 'nga',
        sourceType: 'saved-html-directory',
        displayName: 'NGA sample archive',
        inputDir: path.resolve(__dirname, '..', 'example')
      },
      ingest: {
        dryRun: true
      },
      workers: {
        topology: 'operations-worker',
        sourceTaskMode: 'ingest'
      },
      now: '2026-06-19T10:00:00.000Z'
    });
    const rolloutApply = await postJson(baseUrl + '/api/operations/rollout-manifest/apply', {
      version: '1.0',
      name: 'http-apply-rollout',
      source: {
        sourceKey: 'nga',
        sourceType: 'saved-html-directory',
        displayName: 'NGA apply archive',
        inputDir: path.resolve(__dirname, '..', 'example')
      },
      ingest: {
        dryRun: true
      },
      workers: {
        topology: 'operations-worker',
        sourceTaskMode: 'ingest'
      },
      now: '2026-06-19T10:00:00.000Z'
    });
    const sourceOnboardingPreflight = await postJson(baseUrl + '/api/sources/onboarding/preflight', {
      forum: 'nga',
      sourceType: 'saved-html-directory',
      inputDir: path.resolve(__dirname, '..', 'example'),
      now: '2026-06-19T10:00:00.000Z'
    });
    const context = await postJson(baseUrl + '/api/interpret-text', {
      text: '科技后面看量确认',
      authorId: '150058',
      author: '-阿狼-'
    });

    assert.equal(health.ok, true);
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    const webAppJs = await webApp.text();
    assert.match(homeHtml, /ThreadTrace/);
    assert.match(homeHtml, /sourceOnboardingForm/);
    assert.match(homeHtml, /sourceOnboardingRecipe/);
    assert.match(homeHtml, /onboardingResult/);
    assert.match(webAppJs, /rolloutManifestDraft/);
    assert.match(webAppJs, /onboardingRecipeManifestDraft/);
    assert.match(webAppJs, /sourceTypeReadiness/);
    assert.match(webAppJs, /sourceTypeOperations/);
    assert.match(webAppJs, /renderSourceOnboardingRecipe/);
    assert.match(webAppJs, /renderSourceTypeReadiness/);
    assert.match(webAppJs, /renderSourceTypeOperations/);
    assert.match(webAppJs, /load-rollout-manifest-draft/);
    assert.match(webAppJs, /load-onboarding-recipe-manifest/);
    assert.match(homeHtml, /modulePath/);
    assert.match(homeHtml, /locationJson/);
    assert.match(homeHtml, /connectorModuleValidationForm/);
    assert.match(homeHtml, /connectorModuleResult/);
    assert.match(homeHtml, /sourceDryRunForm/);
    assert.match(homeHtml, /connectorRolloutForm/);
    assert.match(homeHtml, /workerTopologyForm/);
    assert.match(homeHtml, /workerTopologyForm[\s\S]*name="sourceKey"/);
    assert.match(homeHtml, /workerTopologyForm[\s\S]*name="sourceId"/);
    assert.match(homeHtml, /rolloutManifestForm/);
    assert.match(homeHtml, /resourceProvisioningForm/);
    assert.match(homeHtml, /deploymentGateForm/);
    assert.match(homeHtml, /rolloutApplyForm/);
    assert.match(homeHtml, /sourceDryRunResult/);
    assert.match(homeHtml, /connectorRolloutResult/);
    assert.match(homeHtml, /workerTopologyResult/);
    assert.match(homeHtml, /rolloutManifestResult/);
    assert.match(homeHtml, /resourceProvisioningResult/);
    assert.match(homeHtml, /deploymentGateResult/);
    assert.match(homeHtml, /rolloutApplyResult/);
    assert.match(homeHtml, /runbookResult/);
    assert.match(homeHtml, /eventFilterForm/);
    assert.match(homeHtml, /name="sourceId"/);
    assert.match(homeHtml, /contextReviewResultForm/);
    assert.match(homeHtml, /contextReviewResultOverview/);
    assert.match(homeHtml, /contextReviewResultResult/);
    assert.match(homeHtml, /refreshReviewActionPlanButton/);
    assert.match(homeHtml, /refreshReviewActionGateButton/);
    assert.match(homeHtml, /runReviewActionApplyButton/);
    assert.match(homeHtml, /synthesizeReviewResultEventsButton/);
    assert.match(homeHtml, /createReviewResultEventsButton/);
    assert.match(homeHtml, /refreshReviewActionExecutionsButton/);
    assert.match(homeHtml, /deliveryStatus/);
    assert.match(homeHtml, /refreshSourceOperationsButton/);
    assert.match(homeHtml, /sourceOperationsResult/);
    assert.match(homeHtml, /sourceOperationActionResult/);
    assert.match(homeHtml, /author-review-queue/);
    assert.match(homeHtml, /source-attention/);
    assert.match(webAppJs, /set-source-enabled/);
    assert.match(webAppJs, /Disable check/);
    assert.match(webAppJs, /run-source-pipeline/);
    assert.match(webAppJs, /reset-source-failure/);
    assert.match(webAppJs, /failure\/reset/);
    assert.match(webAppJs, /renderScheduleSourceControls/);
    assert.match(webAppJs, /renderSourceOperationResultRows/);
    assert.match(webAppJs, /Due source batch run/);
    assert.match(webAppJs, /Source attention/);
    assert.match(webAppJs, /buildSourceAttention/);
    assert.match(webAppJs, /renderSourceAttentionRows/);
    assert.match(webAppJs, /operations\/source-attention/);
    assert.match(webAppJs, /operations\/source-type-operations/);
    assert.match(webAppJs, /operations\/source-type-drilldown/);
    assert.match(webAppJs, /operations\/source-type-operations\/events/);
    assert.match(webAppJs, /synthesize-runbook-events/);
    assert.match(webAppJs, /synthesize-source-type-operations-events/);
    assert.match(webAppJs, /load-source-type-drilldown/);
    assert.match(webAppJs, /synthesize-author-review-queue-events/);
    assert.match(webAppJs, /operations\/runbook\/events/);
    assert.match(webAppJs, /operations\/readiness/);
    assert.match(webAppJs, /renderOperationsReadiness/);
    assert.match(webAppJs, /appendOptionalQuery\(query, 'sourceKey'/);
    assert.match(webAppJs, /Worker lease shards/);
    assert.match(webAppJs, /workerLeaseStatusSummary/);
    assert.match(webAppJs, /intelligence\/author-review-queue\/events/);
    assert.match(webAppJs, /Create alerts/);
    assert.match(webAppJs, /buildEventQuery/);
    assert.match(webAppJs, /buildEventDispatchRequest/);
    assert.match(webAppJs, /formatEventSourceScope/);
    assert.match(webAppJs, /sourceId/);
    assert.match(webAppJs, /api\/events\/overview/);
    assert.match(webAppJs, /api\/events\/synthesis-policy/);
    assert.match(webAppJs, /renderNotificationEventOverview/);
    assert.match(webAppJs, /renderNotificationSynthesisPolicy/);
    assert.match(webAppJs, /Notification synthesis policy/);
    assert.match(webAppJs, /renderNotificationSourceHotspots/);
    assert.match(webAppJs, /renderEventSourceDrilldownButton/);
    assert.match(webAppJs, /event-summary-strip/);
    assert.equal(notificationSynthesisPolicy.status, 'ok');
    assert.equal(notificationSynthesisPolicy.defaults.sourceAttentionPriorityScoreThreshold, 85);
    assert.ok(notificationSynthesisPolicy.eventTypes.find(function (item) {
      return item.type === 'source-attention';
    }));
    assert.match(webAppJs, /formatOpinionChainSummary/);
    assert.match(webAppJs, /renderPrimaryAuthorProfile/);
    assert.match(webAppJs, /renderEvidenceReliability/);
    assert.match(webAppJs, /formatImplicitReferenceSummary/);
    assert.match(webAppJs, /formatContextChainMatch/);
    assert.match(webAppJs, /formatContextReviewTask/);
    assert.match(webAppJs, /renderContextReviewHandoff/);
    assert.match(webAppJs, /renderContextMatchSummary/);
    assert.match(webAppJs, /renderInterpretationSummary/);
    assert.match(webAppJs, /loadContextReviewResults/);
    assert.match(webAppJs, /loadContextReviewResultActionPlan/);
    assert.match(webAppJs, /loadContextReviewResultActionGate/);
    assert.match(webAppJs, /loadContextReviewActionAudits/);
    assert.match(webAppJs, /loadContextReviewActionExecutions/);
    assert.match(webAppJs, /loadContextReviewActionExecutorDiagnostics/);
    assert.match(webAppJs, /runContextReviewActionApply/);
    assert.match(webAppJs, /renderContextReviewResultOverview/);
    assert.match(webAppJs, /renderContextReviewResultActionPlan/);
    assert.match(webAppJs, /renderContextReviewResultActionGate/);
    assert.match(webAppJs, /renderContextReviewActionAuditPanel/);
    assert.match(webAppJs, /renderContextReviewActionExecutionPanel/);
    assert.match(webAppJs, /renderContextReviewActionExecutorDiagnostics/);
    assert.match(webAppJs, /renderContextReviewActionApplyResult/);
    assert.match(webAppJs, /synthesizeReviewResultEvents/);
    assert.match(webAppJs, /attention-worthy review results/);
    assert.match(webAppJs, /renderContextReviewResultEventSynthesis/);
    assert.match(webAppJs, /renderAuthorReviewQueueEventSynthesis/);
    assert.match(webAppJs, /renderSourceOperationsDrilldown/);
    assert.match(webAppJs, /api\/context-review-results/);
    assert.ok(openApi.paths['/api/events/dispatch'].post.requestBody.content['application/json'].schema.properties.sourceId);
    assert.ok(openApi.paths['/api/events/dispatch'].post.requestBody.content['application/json'].schema.properties.sourceKey);
    assert.equal(openApi.paths['/api/operations/overview'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/OperationalOverview');
    assert.equal(openApi.components.schemas.OperationalOverview.properties.workers.properties.leases.$ref, '#/components/schemas/WorkerLeaseSummary');
    assert.equal(openApi.components.schemas.OperationalOverview.properties.workers.properties.latestRun.$ref, '#/components/schemas/WorkerRun');
    assert.equal(openApi.components.schemas.OperationalOverview.properties.workers.properties.staleRuns.items.$ref, '#/components/schemas/WorkerRun');
    assert.equal(openApi.components.schemas.OperationalOverview.properties.authorReviewQueue.$ref, '#/components/schemas/AuthorReviewQueueSummary');
    assert.equal(openApi.components.schemas.OperationalOverview.properties.recent.properties.authorReviewQueue.items.$ref, '#/components/schemas/AuthorReviewQueueItem');
    assert.equal(openApi.components.schemas.AuthorReviewQueueSummary.properties.sourceHotspots.items.$ref, '#/components/schemas/AuthorReviewQueueSourceHotspot');
    assert.equal(openApi.components.schemas.AuthorReviewQueueSummary.properties.openBySourceKey.additionalProperties.type, 'number');
    assert.equal(openApi.components.schemas.AuthorReviewQueueSummary.properties.highPriorityOpenBySourceKey.additionalProperties.type, 'number');
    assert.equal(openApi.components.schemas.AuthorReviewQueueSourceHotspot.properties.sourceThreadIds.items.type, 'string');
    assert.equal(openApi.components.schemas.OperationalOverview.properties.recent.properties.workerRuns.items.$ref, '#/components/schemas/WorkerRun');
    assert.equal(openApi.components.schemas.WorkerRun.properties.scope.$ref, '#/components/schemas/SourceScope');
    assert.equal(openApi.components.schemas.WorkerRun.properties.scoped.type, 'boolean');
    assert.equal(openApi.paths['/api/operations/source-drilldown'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceOperationsDrilldown');
    assert.equal(openApi.paths['/api/operations/source-drilldown'].get.responses[503].content['application/json'].schema.$ref, '#/components/schemas/SourceOperationsDrilldown');
    assert.ok(openApi.paths['/api/operations/source-drilldown'].get.parameters.find(function (parameter) {
      return parameter.name === 'attentionLimit';
    }));
    assert.equal(openApi.paths['/api/operations/source-type-drilldown'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceTypeOperationsDrilldown');
    assert.equal(openApi.paths['/api/operations/source-type-drilldown'].get.responses[503].content['application/json'].schema.$ref, '#/components/schemas/SourceTypeOperationsDrilldown');
    assert.ok(openApi.paths['/api/operations/source-type-drilldown'].get.parameters.find(function (parameter) {
      return parameter.name === 'sourceType' && parameter.required === true;
    }));
    assert.equal(openApi.paths['/api/operations/source-attention'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceAttentionReport');
    assert.equal(openApi.paths['/api/operations/source-attention'].get.responses[503].content['application/json'].schema.$ref, '#/components/schemas/SourceAttentionReport');
    assert.equal(openApi.paths['/api/operations/source-type-operations'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceTypeOperationsReport');
    assert.equal(openApi.paths['/api/operations/source-type-operations'].get.responses[503].content['application/json'].schema.$ref, '#/components/schemas/SourceTypeOperationsReport');
    assert.equal(openApi.paths['/api/operations/source-attention/events'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceAttentionNotificationEventSynthesisResult');
    assert.equal(openApi.paths['/api/operations/source-type-operations/events'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceTypeOperationsNotificationEventSynthesisResult');
    assert.equal(openApi.paths['/api/events/synthesis-policy'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/NotificationSynthesisPolicyReport');
    assert.equal(openApi.components.schemas.NotificationSynthesisPolicyReport.properties.eventTypes.items.$ref, '#/components/schemas/NotificationSynthesisPolicyEventType');
    assert.equal(openApi.components.schemas.NotificationSynthesisPolicyEventType.properties.alertRules.items.$ref, '#/components/schemas/NotificationSynthesisPolicyRule');
    assert.equal(openApi.components.schemas.SourceAttentionReport.properties.sources.items.$ref, '#/components/schemas/SourceAttentionItem');
    assert.equal(openApi.components.schemas.SourceAttentionItem.properties.signals.items.$ref, '#/components/schemas/SourceAttentionSignal');
    assert.equal(openApi.components.schemas.SourceAttentionItem.properties.attentionRank.type, 'number');
    assert.equal(openApi.components.schemas.SourceAttentionItem.properties.priorityScore.type, 'number');
    assert.equal(openApi.components.schemas.SourceAttentionItem.properties.recommendedCommand.type, 'string');
    assert.equal(openApi.components.schemas.SourceAttentionSummary.properties.actionable.type, 'number');
    assert.equal(openApi.components.schemas.SourceAttentionSummary.properties.highestPriorityScore.type, 'number');
    assert.equal(openApi.components.schemas.SourceAttentionSummary.properties.bySignal.additionalProperties.type, 'number');
    assert.equal(openApi.components.schemas.SourceTypeOperationsReport.properties.sourceTypes.items.$ref, '#/components/schemas/SourceTypeOperationsItem');
    assert.equal(openApi.components.schemas.SourceTypeOperationsReport.properties.summary.$ref, '#/components/schemas/SourceTypeOperationsSummary');
    assert.equal(openApi.components.schemas.SourceTypeOperationsSummary.properties.actionableSourceCount.type, 'number');
    assert.equal(openApi.components.schemas.SourceAttentionNotificationEventSynthesisResult.properties.results.items.$ref, '#/components/schemas/SourceAttentionNotificationEventSynthesisItem');
    assert.equal(openApi.components.schemas.SourceAttentionNotificationEventSynthesisItem.properties.event.$ref, '#/components/schemas/NotificationEvent');
    assert.ok(openApi.components.schemas.NotificationEvent.properties.type.enum.includes('source-attention'));
    assert.equal(openApi.components.schemas.SourceTypeOperationsNotificationEventSynthesisResult.properties.results.items.$ref, '#/components/schemas/SourceTypeOperationsNotificationEventSynthesisItem');
    assert.equal(openApi.components.schemas.SourceTypeOperationsNotificationEventSynthesisItem.properties.event.$ref, '#/components/schemas/NotificationEvent');
    assert.ok(openApi.components.schemas.NotificationEvent.properties.type.enum.includes('source-type-operations'));
    assert.equal(openApi.components.schemas.SourceOperationsDrilldown.properties.scope.$ref, '#/components/schemas/SourceScope');
    assert.equal(openApi.components.schemas.SourceOperationsDrilldown.properties.attention.properties.signals.items.$ref, '#/components/schemas/SourceAttentionSignal');
    assert.equal(openApi.components.schemas.SourceOperationsDrilldown.properties.attention.properties.reportSummary.$ref, '#/components/schemas/SourceAttentionSummary');
    assert.equal(openApi.components.schemas.SourceOperationsDrilldown.properties.recent.properties.workerRuns.items.$ref, '#/components/schemas/WorkerRun');
    assert.equal(openApi.components.schemas.SourceOperationsDrilldown.properties.health.properties.authorReviewQueue.$ref, '#/components/schemas/AuthorReviewQueueSummary');
    assert.equal(openApi.components.schemas.SourceOperationsDrilldown.properties.recent.properties.authorReviewQueue.items.$ref, '#/components/schemas/AuthorReviewQueueItem');
    assert.equal(openApi.paths['/api/intelligence/author-review-queue'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/AuthorReviewQueueListResult');
    assert.equal(openApi.components.schemas.AuthorReviewQueueListResult.properties.summary.$ref, '#/components/schemas/AuthorReviewQueueSummary');
    assert.equal(openApi.components.schemas.AuthorReviewQueueListResult.properties.items.items.$ref, '#/components/schemas/AuthorReviewQueueItem');
    assert.equal(openApi.components.schemas.WorkerLease.properties.scope.$ref, '#/components/schemas/SourceScope');
    assert.equal(openApi.components.schemas.WorkerLeaseSummary.properties.sourceScoped.type, 'number');
    assert.equal(adapters.adapters[0].sourceKey, 'nga');
    assert.equal(adapterDiagnostics.status, 'ok');
    assert.equal(adapterDiagnostics.adapterCount, 1);
    assert.equal(handlers.handlers[0].sourceType, 'saved-html-directory');
    assert.equal(handlers.handlers[0].requiresAdapter, true);
    assert.deepEqual(handlers.handlers[0].locationSchema.required, ['inputDir']);
    const threadSnapshotContract = await getJson(baseUrl + '/api/contracts/thread-snapshot-json');
    const connectorModuleContract = await getJson(baseUrl + '/api/contracts/connector-module');
    const contextReviewHandoffContract = await getJson(baseUrl + '/api/contracts/context-review-handoff');
    const contextReviewResultContract = await getJson(baseUrl + '/api/contracts/context-review-result');
    const validContextReviewHandoff = await postJson(baseUrl + '/api/contracts/context-review-handoff/validate', {
      handoff: contextReviewHandoffContract.example
    });
    const invalidContextReviewHandoff = await postJsonWithStatus(baseUrl + '/api/contracts/context-review-handoff/validate', {
      handoff: {
        version: '1.0.0',
        status: 'bad-status',
        openTasks: []
      }
    }, 400);
    const validContextReviewResult = await postJson(baseUrl + '/api/contracts/context-review-result/validate', {
      result: contextReviewResultContract.example
    });
    const contextReviewResultSummary = await postJson(baseUrl + '/api/context-review-results/summarize', {
      result: contextReviewResultContract.example
    });
    const submittedContextReviewResult = await postJsonWithStatus(baseUrl + '/api/context-review-results', {
      id: 'http-review-result-1',
      result: contextReviewResultContract.example,
      now: '2026-06-21T10:00:00.000Z'
    }, 201);
    const listedContextReviewResults = await getJson(baseUrl + '/api/context-review-results?sourceKey=nga&handoffId=' + encodeURIComponent(contextReviewResultContract.example.handoffId));
    const contextReviewResultOverview = await getJson(baseUrl + '/api/context-review-results/overview?sourceKey=nga&now=2026-06-21T11:00:00.000Z');
    const contextReviewResultActionPlan = await getJson(baseUrl + '/api/context-review-results/action-plan?sourceKey=nga&now=2026-06-21T11:00:00.000Z');
    const contextReviewResultActionGate = await getJson(baseUrl + '/api/context-review-results/action-gate?sourceKey=nga&now=2026-06-21T11:00:00.000Z');
    const contextReviewActionApply = await postJson(baseUrl + '/api/context-review-results/action-tasks/apply', {
      sourceKey: 'nga',
      now: '2026-06-21T11:00:00.000Z'
    });
    const contextReviewActionAuditOverview = await getJson(baseUrl + '/api/context-review-results/action-audits/overview?now=2026-06-21T11:10:00.000Z');
    const contextReviewActionAudits = await getJson(baseUrl + '/api/context-review-results/action-audits?now=2026-06-21T11:10:00.000Z');
    const contextReviewActionExecutorDiagnostics = await getJson(baseUrl + '/api/context-review-results/action-executor/diagnostics?now=2026-06-21T11:10:00.000Z');
    const contextReviewResultEventDryRun = await postJson(baseUrl + '/api/context-review-results/events', {
      sourceKey: 'nga',
      now: '2026-06-21T11:05:00.000Z'
    });
    const contextReviewResultEventExecute = await postJson(baseUrl + '/api/context-review-results/events', {
      execute: true,
      sourceKey: 'nga',
      now: '2026-06-21T11:05:00.000Z'
    });
    const contextReviewResultEvents = await getJson(baseUrl + '/api/events?type=context-review-result');
    const eventOverview = await getJson(baseUrl + '/api/events/overview?type=context-review-result&now=2026-06-21T11:06:00.000Z');
    const invalidContextReviewResult = await postJsonWithStatus(baseUrl + '/api/contracts/context-review-result/validate', {
      result: {
        version: '1.0.0',
        handoffVersion: '1.0.0',
        status: 'bad-status',
        decisions: []
      }
    }, 400);
    assert.equal(connectorCatalog.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.ok(connectorCatalog.sourceTypes.some(function (sourceType) {
      return sourceType.sourceType === 'thread-url';
    }));
    assert.ok(connectorCatalog.sourceTypes.some(function (sourceType) {
      return sourceType.sourceType === 'thread-url' &&
        sourceType.onboardingRecipe &&
        sourceType.onboardingRecipe.recommendedFlow.some(function (step) {
          return step.key === 'preflight' && step.api === 'POST /api/sources/onboarding/preflight';
        });
    }));
    assert.equal(sourceTypeReadiness.summary.sourceTypeCount, 3);
    assert.equal(sourceTypeReadiness.summary.warnSourceTypeCount, 3);
    assert.equal(sourceTypeReadiness.sourceTypes.find(function (sourceType) {
      return sourceType.sourceType === 'saved-html-directory';
    }).status, 'warn');
    assert.equal(sourceTypeOperations.summary.sourceTypeCount, 3);
    assert.equal(sourceTypeOperations.summary.warnSourceTypeCount, 3);
    assert.equal(sourceTypeOperations.sourceTypes.find(function (sourceType) {
      return sourceType.sourceType === 'saved-html-directory';
    }).readiness.status, 'warn');
    assert.equal(connectorReadiness.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.equal(connectorReadiness.status, 'ok');
    assert.ok(connectorReadiness.connectors.some(function (connector) {
      return connector.sourceType === 'saved-html-directory';
    }));
    assert.equal(connectorRolloutPlan.status, 'warn');
    assert.ok(connectorRolloutPlan.steps.some(function (step) {
      return step.key === 'connectorModule.validation';
    }));
    assert.equal(rolloutManifestPlan.status, 'warn');
    assert.equal(rolloutManifestPlan.sourceKey, 'nga');
    assert.equal(rolloutManifestPlan.connectorRolloutPlan.sourceIngestDryRun.status, 'ok');
    assert.equal(rolloutManifestPlan.workerTopologyPlan.topology, 'operations-worker');
    assert.equal(resourceProvisioningPlan.status, 'warn');
    assert.equal(resourceProvisioningPlan.environment.manifestName, 'http-resource-rollout');
    assert.ok(resourceProvisioningPlan.resources.some(function (resource) {
      return resource.key === 'storage.file';
    }));
    assert.equal(deploymentGate.status, 'warn');
    assert.ok(deploymentGate.gates.some(function (gate) {
      return gate.key === 'rollout.manifest';
    }));
    assert.equal(deploymentGate.gates.find(function (gate) {
      return gate.key === 'deployment.checklist';
    }).status, 'warn');
    assert.equal(deploymentGate.resourceProvisioningPlan.status, 'warn');
    assert.equal(rolloutApply.task.type, 'rollout-manifest-apply');
    assert.equal(rolloutApply.report.status, 'warn');
    assert.equal(rolloutApply.report.dryRun, true);
    assert.equal(rolloutApply.report.applied, false);
    assert.equal(sourceOnboardingPreflight.status, 'ok');
    assert.equal(sourceOnboardingPreflight.rolloutManifestDraft.source.sourceKey, 'nga');
    assert.equal(sourceOnboardingPreflight.rolloutManifestDraft.source.inputDir, path.resolve(__dirname, '..', 'example'));
    assert.equal(sourceOnboardingPreflight.rolloutManifestDraft.ingest.dryRun, true);
    assert.equal(sourceOnboardingPreflight.sourceType, 'saved-html-directory');
    assert.ok(sourceOnboardingPreflight.steps.some(function (step) {
      return step.key === 'source.registrationDraft';
    }));
    assert.equal(threadSnapshotContract.version, '1.0.0');
    assert.deepEqual(threadSnapshotContract.schema.required, ['sourceKey', 'sourceThreadId', 'title', 'posts']);
    assert.equal(connectorModuleContract.version, '1.0.0');
    assert.ok(connectorModuleContract.sdk.helpers.includes('defineSourceIngestHandler(options)'));
    assert.ok(connectorModuleContract.sdk.helpers.includes('defineNormalizedThreadJsonHandler(options)'));
    assert.ok(connectorModuleContract.sourceIngestHandler.required.includes('sourceType'));
    assert.equal(contextReviewHandoffContract.version, '1.0.0');
    assert.ok(contextReviewHandoffContract.schema.required.includes('openTasks'));
    assert.ok(contextReviewHandoffContract.downstreamHooks.llmReview);
    assert.equal(validContextReviewHandoff.valid, true);
    assert.equal(invalidContextReviewHandoff.valid, false);
    assert.equal(contextReviewResultContract.version, '1.0.0');
    assert.ok(contextReviewResultContract.schema.required.includes('decisions'));
    assert.ok(contextReviewResultContract.downstreamHooks.taskClosure);
    assert.equal(validContextReviewResult.valid, true);
    assert.equal(invalidContextReviewResult.valid, false);
    assert.equal(contextReviewResultSummary.valid, true);
    assert.equal(contextReviewResultSummary.summary.notification.severity, 'warning');
    assert.equal(contextReviewResultSummary.summary.taskClosure.closeTaskIds.length, 1);
    assert.equal(submittedContextReviewResult.status, 'stored');
    assert.equal(submittedContextReviewResult.record.id, 'http-review-result-1');
    assert.equal(submittedContextReviewResult.record.sourceKey, 'nga');
    assert.equal(submittedContextReviewResult.record.summary.notification.severity, 'warning');
    assert.equal(listedContextReviewResults.count, 1);
    assert.equal(listedContextReviewResults.reviewResults[0].id, 'http-review-result-1');
    assert.equal(contextReviewResultOverview.generatedAt, '2026-06-21T11:00:00.000Z');
    assert.equal(contextReviewResultOverview.count, 1);
    assert.equal(contextReviewResultOverview.bySeverity.warning, 1);
    assert.equal(contextReviewResultOverview.remainingTaskCount, 1);
    assert.equal(contextReviewResultActionPlan.generatedAt, '2026-06-21T11:00:00.000Z');
    assert.equal(contextReviewResultActionPlan.count, 1);
    assert.deepEqual(contextReviewResultActionPlan.closeTaskIds, contextReviewResultContract.example.resolvedTasks);
    assert.deepEqual(contextReviewResultActionPlan.keepOpenTaskIds, contextReviewResultContract.example.remainingTasks);
    assert.equal(contextReviewResultActionPlan.mergeCandidates.length, 1);
    assert.equal(contextReviewResultActionPlan.blockedTasks.length, 1);
    assert.equal(contextReviewResultActionGate.generatedAt, '2026-06-21T11:00:00.000Z');
    assert.equal(contextReviewResultActionGate.status, 'warn');
    assert.equal(contextReviewResultActionGate.executable.canCloseTasks, true);
    assert.equal(contextReviewResultActionGate.executable.canMergeContext, true);
    assert.ok(contextReviewResultActionGate.gates.some(function (gate) {
      return gate.key === 'reviewResults.blockers' && gate.status === 'warn';
    }));
    assert.equal(contextReviewActionApply.task.type, 'context-review-action-apply');
    assert.equal(contextReviewActionApply.task.status, 'completed');
    assert.equal(contextReviewActionApply.report.dryRun, true);
    assert.equal(contextReviewActionApply.report.applied, false);
    assert.equal(contextReviewActionApply.report.closeTaskCount, 1);
    assert.equal(contextReviewActionAuditOverview.status, 'warn');
    assert.equal(contextReviewActionAuditOverview.count, 0);
    assert.equal(contextReviewActionAudits.count, 0);
    assert.equal(contextReviewActionExecutorDiagnostics.status, 'warn');
    assert.equal(contextReviewActionExecutorDiagnostics.ready, false);
    assert.equal(contextReviewActionExecutorDiagnostics.mode, 'none');
    assert.equal(contextReviewResultEventDryRun.dryRun, true);
    assert.equal(contextReviewResultEventDryRun.createdCount, 1);
    assert.equal(contextReviewResultEventExecute.executed, true);
    assert.equal(contextReviewResultEventExecute.createdCount, 1);
    assert.equal(contextReviewResultEvents.events.length, 1);
    assert.equal(contextReviewResultEvents.events[0].type, 'context-review-result');
    assert.equal(contextReviewResultEvents.events[0].sourceKey, 'nga');
    assert.equal(contextReviewResultEvents.events[0].payload.sourceKey, 'nga');
    assert.equal(eventOverview.eventCount, 1);
    assert.equal(eventOverview.byType['context-review-result'], 1);
    assert.equal(eventOverview.byOpenSourceKey.nga, 1);
    assert.equal(eventOverview.sourceHotspots[0].sourceKey, 'nga');
    assert.equal(eventOverview.sourceHotspots[0].openCount, 1);
    assert.equal(eventOverview.generatedAt, '2026-06-21T11:06:00.000Z');
    assert.equal(openApi.openapi, '3.0.3');
    assert.ok(openApi.paths['/api/interpret-text']);
    assert.match(openApi.paths['/api/interpret-text'].post.responses[200].description, /contextReviewHandoff/);
    assert.ok(openApi.paths['/api/adapters/diagnostics']);
    assert.ok(openApi.paths['/api/contracts/thread-snapshot-json']);
    assert.ok(openApi.paths['/api/contracts/connector-module']);
    assert.ok(openApi.paths['/api/contracts/context-review-handoff']);
    assert.ok(openApi.paths['/api/contracts/context-review-handoff/validate']);
    assert.ok(openApi.paths['/api/contracts/context-review-result']);
    assert.ok(openApi.paths['/api/contracts/context-review-result/validate']);
    assert.ok(openApi.paths['/api/context-review-results/summarize']);
    assert.ok(openApi.paths['/api/context-review-results']);
    assert.ok(openApi.paths['/api/context-review-results/overview']);
    assert.ok(openApi.paths['/api/context-review-results/action-plan']);
    assert.ok(openApi.paths['/api/context-review-results/action-gate']);
    assert.equal(openApi.paths['/api/context-review-results/action-plan'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/ContextReviewActionPlan');
    assert.equal(openApi.paths['/api/context-review-results/action-gate'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/ContextReviewActionGate');
    assert.equal(openApi.components.schemas.ContextReviewActionPlan.properties.sourceScope.$ref, '#/components/schemas/ContextReviewActionSourceScope');
    assert.equal(openApi.components.schemas.ContextReviewActionPlan.properties.records.items.$ref, '#/components/schemas/ContextReviewActionPlanRecord');
    assert.equal(openApi.components.schemas.ContextReviewActionPlan.properties.mergeCandidates.items.$ref, '#/components/schemas/ContextReviewMergeCandidate');
    assert.equal(openApi.components.schemas.ContextReviewActionGate.properties.gates.items.$ref, '#/components/schemas/ContextReviewActionGateItem');
    assert.equal(openApi.components.schemas.ContextReviewActionGate.properties.executable.$ref, '#/components/schemas/ContextReviewActionGateExecutable');
    assert.equal(openApi.components.schemas.ContextReviewActionGate.properties.actionPlan.$ref, '#/components/schemas/ContextReviewActionPlan');
    assert.ok(openApi.paths['/api/context-review-results/action-tasks/apply']);
    assert.ok(openApi.paths['/api/context-review-results/action-audits']);
    assert.ok(openApi.paths['/api/context-review-results/action-audits/overview']);
    assert.ok(openApi.paths['/api/context-review-results/action-executor/diagnostics']);
    assert.ok(openApi.paths['/api/context-review-results/events']);
    assert.ok(openApi.paths['/api/events/overview']);
    assert.equal(openApi.paths['/api/events'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/NotificationEventListResult');
    assert.equal(openApi.paths['/api/events/overview'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/NotificationEventOverview');
    assert.equal(openApi.paths['/api/events/dispatch'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/NotificationEventDispatchResult');
    assert.equal(openApi.paths['/api/events/ack'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/NotificationEventAckResult');
    assert.equal(openApi.paths['/api/events/{eventId}/ack'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/NotificationEventAckSingleResult');
    assert.equal(openApi.paths['/api/events/archive'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/NotificationEventArchiveResult');
    assert.equal(openApi.components.schemas.NotificationEventListResult.properties.events.items.$ref, '#/components/schemas/NotificationEvent');
    assert.equal(openApi.components.schemas.NotificationEvent.properties.lastDeliveryError.type, 'object');
    assert.equal(openApi.components.schemas.NotificationEventDispatchResult.properties.results.items.$ref, '#/components/schemas/NotificationEventDispatchItem');
    assert.equal(openApi.components.schemas.NotificationEventDispatchItem.properties.event.$ref, '#/components/schemas/NotificationEvent');
    assert.equal(openApi.components.schemas.NotificationEventAckResult.properties.results.items.$ref, '#/components/schemas/NotificationEventAckItem');
    assert.equal(openApi.components.schemas.NotificationEventAckItem.properties.event.$ref, '#/components/schemas/NotificationEventSummary');
    assert.equal(openApi.components.schemas.NotificationEventAckSingleResult.properties.event.$ref, '#/components/schemas/NotificationEvent');
    assert.equal(openApi.components.schemas.NotificationEventArchiveResult.properties.candidates.items.$ref, '#/components/schemas/NotificationEventSummary');
    assert.equal(openApi.components.schemas.NotificationEventArchiveResult.properties.results.items.$ref, '#/components/schemas/NotificationEventArchiveItem');
    assert.equal(openApi.components.schemas.NotificationEventArchiveItem.properties.event.$ref, '#/components/schemas/NotificationEventSummary');
    assert.equal(openApi.components.schemas.NotificationEventOverview.properties.sourceHotspots.items.$ref, '#/components/schemas/NotificationEventSourceHotspot');
    assert.equal(openApi.components.schemas.NotificationEventOverview.properties.attention.$ref, '#/components/schemas/NotificationEventAttention');
    assert.equal(openApi.components.schemas.NotificationEventAttention.properties.failedEvents.items.$ref, '#/components/schemas/NotificationEventSummary');
    assert.equal(openApi.components.schemas.NotificationEventSourceHotspot.properties.retryExhaustedCount.type, 'number');
    assert.ok(openApi.paths['/api/connectors/catalog']);
    assert.equal(openApi.paths['/api/connectors/catalog'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceConnectorCatalog');
    assert.equal(openApi.components.schemas.SourceConnectorCatalog.properties.sourceTypes.items.$ref, '#/components/schemas/SourceConnectorCatalogSourceType');
    assert.equal(openApi.components.schemas.SourceConnectorCatalogSourceType.properties.onboardingRecipe.$ref, '#/components/schemas/SourceOnboardingRecipe');
    assert.equal(openApi.components.schemas.SourceOnboardingRecipe.properties.recommendedFlow.items.$ref, '#/components/schemas/SourceOnboardingRecipeFlowStep');
    assert.ok(openApi.paths['/api/connectors/source-type-readiness']);
    assert.equal(openApi.paths['/api/connectors/source-type-readiness'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceTypeReadinessReport');
    assert.equal(openApi.components.schemas.SourceTypeReadinessReport.properties.sourceTypes.items.$ref, '#/components/schemas/SourceTypeReadinessItem');
    assert.ok(openApi.paths['/api/connectors/readiness']);
    assert.ok(openApi.paths['/api/connectors/modules/validate']);
    assert.ok(openApi.paths['/api/connectors/rollout-plan']);
    assert.equal(openApi.paths['/api/connectors/rollout-plan'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/ConnectorRolloutPlan');
    assert.equal(openApi.paths['/api/connectors/rollout-plan'].post.responses[503].content['application/json'].schema.$ref, '#/components/schemas/ConnectorRolloutPlan');
    assert.equal(openApi.components.schemas.ConnectorRolloutPlan.properties.steps.items.$ref, '#/components/schemas/OperationsPlanStep');
    assert.equal(openApi.components.schemas.ConnectorRolloutPlan.properties.nextActions.items.$ref, '#/components/schemas/OperationsPlanAction');
    assert.equal(openApi.components.schemas.ConnectorRolloutPlan.properties.sourceOnboardingPreflight.$ref, '#/components/schemas/SourceOnboardingPreflight');
    assert.ok(openApi.paths['/api/operations/rollout-manifest-plan']);
    assert.ok(openApi.paths['/api/operations/resource-provisioning-plan']);
    assert.ok(openApi.paths['/api/deployment/gate']);
    assert.equal(openApi.paths['/api/operations/rollout-manifest-plan'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/RolloutManifestPlan');
    assert.equal(openApi.paths['/api/operations/rollout-manifest-plan'].post.responses[503].content['application/json'].schema.$ref, '#/components/schemas/RolloutManifestPlan');
    assert.equal(openApi.paths['/api/operations/resource-provisioning-plan'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/ResourceProvisioningPlan');
    assert.equal(openApi.paths['/api/operations/resource-provisioning-plan'].post.responses[503].content['application/json'].schema.$ref, '#/components/schemas/ResourceProvisioningPlan');
    assert.equal(openApi.paths['/api/deployment/gate'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/DeploymentGateReport');
    assert.equal(openApi.paths['/api/deployment/gate'].post.responses[503].content['application/json'].schema.$ref, '#/components/schemas/DeploymentGateReport');
    assert.equal(openApi.components.schemas.RolloutManifestPlan.properties.steps.items.$ref, '#/components/schemas/OperationsPlanStep');
    assert.equal(openApi.components.schemas.RolloutManifestPlan.properties.nextActions.items.$ref, '#/components/schemas/OperationsPlanAction');
    assert.equal(openApi.components.schemas.RolloutManifestPlan.properties.connectorRolloutPlan.$ref, '#/components/schemas/ConnectorRolloutPlan');
    assert.equal(openApi.components.schemas.ResourceProvisioningPlan.properties.environment.$ref, '#/components/schemas/ResourceProvisioningEnvironment');
    assert.equal(openApi.components.schemas.ResourceProvisioningPlan.properties.resources.items.$ref, '#/components/schemas/ResourceProvisioningItem');
    assert.equal(openApi.components.schemas.ResourceProvisioningItem.properties.schemaDrift.$ref, '#/components/schemas/PostgresSchemaDrift');
    assert.equal(openApi.components.schemas.DeploymentGateReport.properties.gates.items.$ref, '#/components/schemas/DeploymentGateItem');
    assert.equal(openApi.components.schemas.DeploymentGateReport.properties.resourceProvisioningPlan.$ref, '#/components/schemas/ResourceProvisioningPlan');
    assert.ok(openApi.paths['/api/operations/rollout-manifest/apply']);
    assert.equal(openApi.paths['/api/operations/rollout-manifest/apply'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/RolloutManifestApplyResult');
    assert.equal(openApi.paths['/api/operations/rollout-manifest/apply'].post.responses[503].content['application/json'].schema.$ref, '#/components/schemas/RolloutManifestApplyResult');
    assert.equal(openApi.components.schemas.RolloutManifestApplyResult.properties.task.$ref, '#/components/schemas/TaskRecord');
    assert.equal(openApi.components.schemas.RolloutManifestApplyResult.properties.report.$ref, '#/components/schemas/RolloutManifestApplyReport');
    assert.equal(openApi.components.schemas.RolloutManifestApplyReport.properties.rollbackPlan.$ref, '#/components/schemas/RolloutManifestRollbackPlan');
    assert.equal(openApi.components.schemas.RolloutManifestApplyReport.properties.deploymentGate.$ref, '#/components/schemas/DeploymentGateReport');
    assert.ok(openApi.paths['/api/operations/runbook/events']);
    assert.ok(openApi.paths['/api/sources/{sourceId}/disable']);
    assert.ok(openApi.paths['/api/sources/{sourceId}/enable']);
    assert.ok(openApi.paths['/api/sources/{sourceId}/failure/reset']);
    assert.ok(openApi.paths['/api/sources/lifecycle']);
    assert.ok(openApi.paths['/api/sources/schedule']);
    assert.equal(openApi.paths['/api/sources/lifecycle'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceLifecycleReport');
    assert.equal(openApi.paths['/api/sources/schedule'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceScheduleReport');
    assert.equal(openApi.components.schemas.SourceLifecycleReport.properties.summary.$ref, '#/components/schemas/SourceLifecycleSummary');
    assert.equal(openApi.components.schemas.SourceLifecycleReport.properties.blockedDisables.items.$ref, '#/components/schemas/SourceLifecycleBlockedDisable');
    assert.equal(openApi.components.schemas.SourceLifecycleReport.properties.sources.items.$ref, '#/components/schemas/SourceLifecycleItem');
    assert.equal(openApi.components.schemas.SourceLifecycleReport.properties.recentLifecycleTasks.items.$ref, '#/components/schemas/SourceLifecycleTask');
    assert.equal(openApi.components.schemas.SourceLifecycleItem.properties.runState.$ref, '#/components/schemas/SourceRunState');
    assert.equal(openApi.components.schemas.SourceLifecycleItem.properties.disableGuard.$ref, '#/components/schemas/SourceDisableGuard');
    assert.equal(openApi.components.schemas.SourceLifecycleItem.properties.failureRetry.$ref, '#/components/schemas/SourceFailureRetryPlan');
    assert.equal(openApi.components.schemas.SourceScheduleReport.properties.summary.$ref, '#/components/schemas/SourceScheduleSummary');
    assert.equal(openApi.components.schemas.SourceScheduleReport.properties.dueSources.items.$ref, '#/components/schemas/SourceScheduleItem');
    assert.equal(openApi.components.schemas.SourceScheduleReport.properties.skippedSources.items.$ref, '#/components/schemas/SourceScheduleItem');
    assert.equal(openApi.components.schemas.SourceScheduleItem.properties.schedule.$ref, '#/components/schemas/SourceScheduleConfig');
    assert.equal(openApi.components.schemas.SourceScheduleItem.properties.runState.$ref, '#/components/schemas/SourceRunState');
    assert.equal(openApi.components.schemas.SourceScheduleItem.properties.decision.$ref, '#/components/schemas/SourceScheduleDecision');
    assert.equal(openApi.paths['/api/sources'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/TrackedSourceListResult');
    assert.equal(openApi.paths['/api/sources'].post.responses[201].content['application/json'].schema.$ref, '#/components/schemas/TrackedSourceRegistrationResult');
    assert.equal(openApi.paths['/api/sources'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/TrackedSourceRegistrationResult');
    assert.equal(openApi.paths['/api/sources/validate'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/TrackedSourceValidationResult');
    assert.equal(openApi.components.schemas.TrackedSourceListResult.properties.sources.items.$ref, '#/components/schemas/TrackedSource');
    assert.equal(openApi.components.schemas.TrackedSourceRegistrationResult.properties.source.$ref, '#/components/schemas/TrackedSource');
    assert.equal(openApi.components.schemas.TrackedSource.properties.runState.$ref, '#/components/schemas/SourceRunState');
    assert.equal(openApi.components.schemas.TrackedSource.properties.schedule.$ref, '#/components/schemas/SourceScheduleConfig');
    assert.equal(openApi.components.schemas.TrackedSourceValidationResult.properties.source.$ref, '#/components/schemas/TrackedSource');
    assert.equal(openApi.components.schemas.TrackedSourceValidationResult.properties.checks.items.$ref, '#/components/schemas/SourceDiagnosticCheck');
    assert.equal(openApi.components.schemas.TrackedSourceValidationResult.properties.nextActions.items.$ref, '#/components/schemas/SourceDiagnosticAction');
    assert.equal(openApi.components.schemas.TrackedSourceValidationResult.properties.error.$ref, '#/components/schemas/TrackedSourceValidationError');
    assert.ok(openApi.paths['/api/sources/onboarding/preflight']);
    assert.equal(openApi.paths['/api/sources/onboarding/preflight'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceOnboardingPreflight');
    assert.equal(openApi.paths['/api/sources/onboarding/preflight'].post.responses[503].content['application/json'].schema.$ref, '#/components/schemas/SourceOnboardingPreflight');
    assert.equal(openApi.components.schemas.SourceOnboardingPreflight.properties.steps.items.$ref, '#/components/schemas/SourceOnboardingPreflightStep');
    assert.equal(openApi.components.schemas.SourceOnboardingPreflight.properties.nextActions.items.$ref, '#/components/schemas/SourceOnboardingPreflightAction');
    assert.equal(openApi.components.schemas.SourceOnboardingPreflight.properties.catalog.$ref, '#/components/schemas/SourceOnboardingCatalogSummary');
    assert.equal(openApi.components.schemas.SourceOnboardingPreflight.properties.rolloutManifestDraft.$ref, '#/components/schemas/SourceRolloutManifestDraft');
    assert.equal(openApi.components.schemas.SourceRolloutManifestDraft.properties.ingest.properties.dryRun.type, 'boolean');
    assert.ok(openApi.paths['/api/runtime/diagnostics']);
    assert.ok(openApi.paths['/api/sources/validate']);
    assert.ok(openApi.paths['/api/operations/trace-context']);
    assert.ok(openApi.paths['/api/thread-json/validate']);
    assert.equal(openApi.components.schemas.ErrorResponse.properties.error.properties.code.example, 'source_run_already_running');
    assert.equal(openApi.components.schemas.ErrorResponse.properties.error.properties.requestId.type, 'string');
    assert.equal(openApi.components.responses.BadRequest.content['application/json'].schema.$ref, '#/components/schemas/ErrorResponse');
    assert.equal(openApi.paths['/api/search'].post.responses[400].$ref, '#/components/responses/BadRequest');
    assert.equal(openApi.paths['/api/sources/{sourceId}/disable'].post.responses[409].$ref, '#/components/responses/Conflict');
    assert.equal(openApi.paths['/api/sources/{sourceId}/disable'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceLifecycleMutationTaskResult');
    assert.equal(openApi.paths['/api/sources/{sourceId}/enable'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceLifecycleMutationTaskResult');
    assert.equal(openApi.paths['/api/sources/{sourceId}/failure/reset'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceFailureResetTaskResult');
    assert.equal(openApi.paths['/api/sources/{sourceId}/failure/reset'].post.requestBody.content['application/json'].schema.properties.retryNow.example, true);
    assert.equal(openApi.components.schemas.SourceLifecycleMutationTaskResult.properties.task.$ref, '#/components/schemas/TaskRecord');
    assert.equal(openApi.components.schemas.SourceLifecycleMutationTaskResult.properties.result.$ref, '#/components/schemas/SourceLifecycleMutationResult');
    assert.equal(openApi.components.schemas.SourceLifecycleMutationResult.properties.guard.$ref, '#/components/schemas/SourceLifecycleMutationGuard');
    assert.equal(openApi.components.schemas.SourceLifecycleMutationResult.properties.sourceBefore.$ref, '#/components/schemas/SourceMutationSourceSummary');
    assert.equal(openApi.components.schemas.SourceFailureResetTaskResult.properties.task.$ref, '#/components/schemas/TaskRecord');
    assert.equal(openApi.components.schemas.SourceFailureResetTaskResult.properties.result.$ref, '#/components/schemas/SourceFailureResetResult');
    assert.equal(openApi.components.schemas.SourceFailureResetResult.properties.sourceAfter.$ref, '#/components/schemas/SourceFailureResetSourceSummary');
    assert.equal(openApi.paths['/api/sources/{sourceId}/tasks/ingest'].post.responses[404].$ref, '#/components/responses/NotFound');
    assert.equal(openApi.paths['/api/sources/{sourceId}/tasks/ingest'].post.responses[409].$ref, '#/components/responses/Conflict');
    assert.equal(openApi.paths['/api/sources/{sourceId}/tasks/ingest'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceIngestTaskResult');
    assert.equal(openApi.paths['/api/sources/{sourceId}/tasks/insight-pipeline'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceInsightPipelineTaskResult');
    assert.equal(openApi.paths['/api/sources/tasks/ingest'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceIngestBatchTaskResult');
    assert.equal(openApi.paths['/api/sources/tasks/ingest-due'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceDueIngestBatchTaskResult');
    assert.equal(openApi.paths['/api/sources/tasks/insight-pipeline-due'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceDueInsightPipelineBatchTaskResult');
    assert.equal(openApi.components.schemas.SourceIngestTaskResult.properties.task.$ref, '#/components/schemas/TaskRecord');
    assert.equal(openApi.components.schemas.SourceInsightPipelineTaskResult.properties.ingest.$ref, '#/components/schemas/SourceInsightPipelineIngestResult');
    assert.equal(openApi.components.schemas.SourceInsightPipelineTaskResult.properties.semantic.$ref, '#/components/schemas/SourceInsightPipelineSemanticResult');
    assert.equal(openApi.components.schemas.SourceIngestBatchTaskResult.properties.results.items.$ref, '#/components/schemas/SourceBatchTaskItem');
    assert.equal(openApi.components.schemas.SourceDueIngestBatchTaskResult.properties.skipped.items.$ref, '#/components/schemas/SourceDueBatchSkippedItem');
    assert.equal(openApi.components.schemas.SourceDueInsightPipelineBatchTaskResult.properties.results.items.$ref, '#/components/schemas/SourceBatchTaskItem');
    assert.equal(openApi.components.schemas.SourceBatchTaskItem.properties.source.$ref, '#/components/schemas/TrackedSource');
    assert.equal(openApi.components.schemas.SourceBatchTaskItem.properties.cursorDiff.$ref, '#/components/schemas/SourceCursorDiff');
    assert.equal(openApi.paths['/api/sources/tasks/ingest-due'].post.requestBody.content['application/json'].schema.properties.sourceFailureRetryBackoffMs.example, 60000);
    assert.equal(openApi.paths['/api/operations/runbook/events'].post.requestBody.content['application/json'].schema.properties.execute.example, false);
    assert.ok(openApi.paths['/api/sources/lifecycle'].get.parameters.some(function (parameter) {
      return parameter.name === 'sourceFailureRetryBackoffMs';
    }));
    assert.equal(context.reportType, 'new-post-context');
    assert.equal(context.interpretationSummary.status, 'matched');
    assert.equal(context.interpretationSummary.evidenceLevel, 'explicit');
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

test('http server lists file-audit review action executor records', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-review-audits-'));
  const storeDir = path.join(tempDir, 'store');
  const config = createThreadTraceConfig({
    cwd: path.resolve(__dirname, '..'),
    env: {
      THREADTRACE_STORE_DIR: storeDir,
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    }
  });
  const runtime = createThreadTraceRuntime({
    config
  });
  const server = createThreadTraceServer({
    runtime,
    storeDir
  });
  await listen(server, 0);
  const baseUrl = 'http://127.0.0.1:' + server.address().port;

  try {
    const contract = await getJson(baseUrl + '/api/contracts/context-review-result');
    await postJsonWithStatus(baseUrl + '/api/context-review-results', {
      id: 'http-review-audit-result-1',
      result: contract.example,
      now: '2026-06-21T10:00:00.000Z'
    }, 201);
    const apply = await postJson(baseUrl + '/api/context-review-results/action-tasks/apply', {
      execute: true,
      now: '2026-06-21T11:00:00.000Z'
    });
    const diagnostics = await getJson(baseUrl + '/api/context-review-results/action-executor/diagnostics?limit=10');
    const overview = await getJson(baseUrl + '/api/context-review-results/action-audits/overview?limit=10');
    const sourceOverview = await getJson(baseUrl + '/api/context-review-results/action-audits/overview?sourceKey=nga&limit=10');
    const audits = await getJson(baseUrl + '/api/context-review-results/action-audits?limit=10');
    const sourceAudits = await getJson(baseUrl + '/api/context-review-results/action-audits?sourceKey=nga&limit=10');
    const closureAudits = await getJson(baseUrl + '/api/context-review-results/action-audits?action=tasks.closure');
    const executions = await getJson(baseUrl + '/api/context-review-results/action-executions?limit=10');
    const closureExecutions = await getJson(baseUrl + '/api/context-review-results/action-executions?action=tasks.closure&status=completed&sourceKey=nga');
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(apply.report.executed, true);
    assert.equal(apply.report.executorResults.taskClosure.adapter, 'file-audit');
    assert.equal(apply.report.executorResults.taskClosure.executionLedger.replayed, false);
    assert.equal(diagnostics.status, 'ok');
    assert.equal(diagnostics.mode, 'file-audit');
    assert.equal(diagnostics.ready, true);
    assert.equal(diagnostics.audit.count, 2);
    assert.equal(overview.status, 'ok');
    assert.equal(overview.count, 2);
    assert.equal(overview.taskCount, 1);
    assert.equal(overview.bySourceKey.nga, 2);
    assert.equal(overview.plannedClosureCount, 1);
    assert.equal(overview.plannedMergeCandidateCount, 1);
    assert.equal(sourceOverview.sourceKey, 'nga');
    assert.equal(sourceOverview.query.sourceKey, 'nga');
    assert.equal(sourceOverview.count, 2);
    assert.equal(audits.count, 2);
    assert.equal(sourceAudits.sourceKey, 'nga');
    assert.equal(sourceAudits.count, 2);
    assert.equal(sourceAudits.audits[0].sourceKey, 'nga');
    assert.equal(closureAudits.count, 1);
    assert.equal(closureAudits.audits[0].sourceKey, 'nga');
    assert.equal(closureAudits.audits[0].request.taskId, apply.task.id);
    assert.equal(executions.status, 'ok');
    assert.equal(executions.count, 2);
    assert.equal(closureExecutions.count, 1);
    assert.equal(closureExecutions.sourceKey, 'nga');
    assert.equal(closureExecutions.executions[0].taskId, apply.task.id);
    assert.equal(closureExecutions.executions[0].sourceKey, 'nga');
    assert.ok(openApi.paths['/api/context-review-results/action-executions']);
    assert.equal(openApi.paths['/api/context-review-results/action-audits'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/ContextReviewActionAuditListResult');
    assert.equal(openApi.paths['/api/context-review-results/action-audits/overview'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/ContextReviewActionAuditOverview');
    assert.equal(openApi.paths['/api/context-review-results/action-executions'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/ContextReviewActionExecutionListResult');
    assert.equal(openApi.components.schemas.ContextReviewActionAuditListResult.properties.audits.items.$ref, '#/components/schemas/ContextReviewActionAuditRecord');
    assert.equal(openApi.components.schemas.ContextReviewActionAuditOverview.properties.recentAudits.items.$ref, '#/components/schemas/ContextReviewActionAuditRecord');
    assert.equal(openApi.components.schemas.ContextReviewActionExecutionListResult.properties.executions.items.$ref, '#/components/schemas/ContextReviewActionExecutionRecord');
    assert.equal(openApi.components.schemas.ContextReviewActionExecutionRecord.properties.staleRunning.type, 'boolean');
    assert.ok(openApi.paths['/api/context-review-results/action-audits'].get.parameters.find(function (parameter) {
      return parameter.name === 'sourceKey';
    }));
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
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async getOperationalOverview(request) {
        calls.push(request);
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
    const overview = await getJson(baseUrl + '/api/operations/overview?sourceKey=nga&sourceId=source-1&sourceType=saved-html-directory&enabled=true&limit=10');
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(overview.storageMode, 'file');
    assert.equal(calls[0].sourceKey, 'nga');
    assert.equal(calls[0].sourceId, 'source-1');
    assert.equal(calls[0].sourceType, 'saved-html-directory');
    assert.equal(calls[0].enabled, true);
    assert.equal(calls[0].limit, 10);
    assert.equal(overview.sources.due, 1);
    assert.equal(overview.tasks.failed, 1);
    assert.equal(overview.events.dueForDelivery, 1);
    assert.ok(openApi.paths['/api/operations/overview'].get.parameters.find(function (parameter) {
      return parameter.name === 'sourceType';
    }));
    assert.ok(openApi.paths['/api/operations/overview'].get.parameters.find(function (parameter) {
      return parameter.name === 'enabled';
    }));
  } finally {
    await close(server);
  }
});

test('http server exposes source operations drilldown API', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async getSourceOperationsDrilldown(request) {
        calls.push(request);
        return {
          generatedAt: request.now || '2026-06-18T10:00:00.000Z',
          status: 'warn',
          storageMode: 'file',
          scope: {
            sourceId: request.sourceId,
            sourceKey: request.sourceKey
          },
          sourceFound: true,
          source: {
            id: request.sourceId,
            sourceKey: request.sourceKey,
            displayName: 'NGA sample'
          },
          health: {
            source: { status: 'completed' },
            tasks: { failed: 1 },
            events: { failed: 1 },
            workers: {
              runs: { stale: 0 },
              leases: { expired: 0 }
            },
            authorReviewQueue: { openCount: 0 },
            reviewActions: { auditCount: 0, executions: { failed: 0 } }
          },
          attention: {
            status: 'warn',
            found: true,
            attentionRank: 1,
            priorityScore: 92,
            severity: 'warning',
            signalCount: 2,
            recommendedNextAction: 'run-source-insight-pipeline',
            recommendedCommand: 'node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id source-1',
            signals: [
              { severity: 'warning', label: 'runbook' }
            ]
          },
          nextActions: [
            { key: 'sourceAttention.priority', severity: 'warning' },
            { key: 'tasks.failed', severity: 'warning' }
          ],
          recent: {
            tasks: [],
            events: [],
            workerRuns: [],
            workerLeases: []
          }
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const report = await getJson(baseUrl + '/api/operations/source-drilldown?sourceKey=nga&sourceId=source-1&limit=10&attentionLimit=5&taskScanLimit=20&leaseScanLimit=30&sourceFailureRetryBackoffMs=60000');

    assert.equal(report.status, 'warn');
    assert.equal(report.scope.sourceId, 'source-1');
    assert.equal(report.scope.sourceKey, 'nga');
    assert.equal(report.attention.priorityScore, 92);
    assert.equal(report.nextActions[0].key, 'sourceAttention.priority');
    assert.equal(calls[0].sourceKey, 'nga');
    assert.equal(calls[0].sourceId, 'source-1');
    assert.equal(calls[0].limit, 10);
    assert.equal(calls[0].attentionLimit, 5);
    assert.equal(calls[0].taskScanLimit, 20);
    assert.equal(calls[0].leaseScanLimit, 30);
    assert.equal(calls[0].sourceFailureRetryBackoffMs, 60000);
  } finally {
    await close(server);
  }
});

test('http server exposes source attention API', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async getSourceAttentionReport(request) {
        calls.push(request);
        return {
          generatedAt: request.now || '2026-06-25T10:00:00.000Z',
          status: 'warn',
          windowLimit: request.attentionLimit || request.limit,
          summary: {
            total: 1,
            critical: 0,
            warning: 1,
            info: 0,
            muted: 0,
            runnable: 0,
            actionable: 1,
            highestPriorityScore: 84,
            bySignal: {
              'retry wait': 1
            },
            bySourceKey: {
              nga: 1
            }
          },
          sources: [
            {
              key: 'sourceId:source-1',
              source: {
                id: request.sourceId,
                sourceKey: request.sourceKey,
                displayName: 'NGA sample'
              },
              severity: 'warning',
              attentionRank: 1,
              priorityScore: 84,
              signalCount: 1,
              runnable: false,
              signals: [
                { severity: 'warning', label: 'retry wait' }
              ],
              commands: [],
              recommendedNextAction: 'wait-for-failure-backoff',
              recommendedCommand: 'node src/presentation/cli/threadtrace.js source-lifecycle-report'
            }
          ]
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const report = await getJson(baseUrl + '/api/operations/source-attention?sourceKey=nga&sourceId=source-1&limit=10&attentionLimit=5&sourceFailureRetryBackoffMs=60000');

    assert.equal(report.status, 'warn');
    assert.equal(report.summary.actionable, 1);
    assert.equal(report.summary.highestPriorityScore, 84);
    assert.equal(report.summary.bySignal['retry wait'], 1);
    assert.equal(report.sources[0].source.id, 'source-1');
    assert.equal(report.sources[0].attentionRank, 1);
    assert.equal(report.sources[0].priorityScore, 84);
    assert.match(report.sources[0].recommendedCommand, /source-lifecycle-report/);
    assert.equal(calls[0].sourceKey, 'nga');
    assert.equal(calls[0].sourceId, 'source-1');
    assert.equal(calls[0].limit, 10);
    assert.equal(calls[0].attentionLimit, 5);
    assert.equal(calls[0].sourceFailureRetryBackoffMs, 60000);
  } finally {
    await close(server);
  }
});

test('http server synthesizes source attention notification events', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async synthesizeSourceAttentionNotificationEvents(request) {
        calls.push(request);
        return {
          generatedAt: request.now || '2026-06-25T10:00:00.000Z',
          status: 'ok',
          dryRun: request.execute !== true,
          executed: request.execute === true,
          sourceCount: 1,
          actionCount: 1,
          eventCount: 1,
          createdCount: request.execute === true ? 1 : 0,
          updatedCount: 0,
          resolvedCount: 0,
          reopenedCount: 0,
          skippedCount: 0,
          priorityScoreThreshold: request.priorityScoreThreshold,
          results: [
            {
              status: 'created',
              attentionKey: 'sourceId:source-1',
              event: {
                id: 'source-attention-1',
                type: 'source-attention',
                severity: 'warning',
                sourceId: request.sourceId,
                sourceKey: request.sourceKey
              }
            }
          ]
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const result = await postJson(baseUrl + '/api/operations/source-attention/events', {
      sourceKey: 'nga',
      sourceId: 'source-1',
      execute: true,
      priorityScoreThreshold: 80,
      attentionLimit: 5,
      limit: 10,
      resolveStale: true,
      now: '2026-06-25T10:00:00.000Z'
    });

    assert.equal(result.executed, true);
    assert.equal(result.results[0].event.type, 'source-attention');
    assert.equal(calls[0].sourceKey, 'nga');
    assert.equal(calls[0].sourceId, 'source-1');
    assert.equal(calls[0].execute, true);
    assert.equal(calls[0].priorityScoreThreshold, 80);
    assert.equal(calls[0].attentionLimit, 5);
    assert.equal(calls[0].limit, 10);
    assert.equal(calls[0].resolveStale, true);
  } finally {
    await close(server);
  }
});

test('http server synthesizes source type operations notification events', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async synthesizeSourceTypeOperationsNotificationEvents(request) {
        calls.push(request);
        return {
          generatedAt: request.now || '2026-06-25T10:00:00.000Z',
          status: 'ok',
          dryRun: request.execute !== true,
          executed: request.execute === true,
          sourceTypeCount: 1,
          actionCount: 1,
          eventCount: 1,
          createdCount: request.execute === true ? 1 : 0,
          updatedCount: 0,
          resolvedCount: 0,
          reopenedCount: 0,
          skippedCount: 0,
          priorityScoreThreshold: request.priorityScoreThreshold,
          includeReadinessWarnings: request.includeReadinessWarnings,
          results: [
            {
              status: 'created',
              sourceType: request.sourceType,
              event: {
                id: 'source-type-operations-1',
                type: 'source-type-operations',
                severity: 'warning',
                payload: {
                  sourceType: request.sourceType
                }
              }
            }
          ]
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const result = await postJson(baseUrl + '/api/operations/source-type-operations/events', {
      sourceType: 'thread-url',
      execute: true,
      priorityScoreThreshold: 80,
      includeReadinessWarnings: true,
      attentionLimit: 5,
      sourceTypeLimit: 3,
      limit: 10,
      resolveStale: true,
      now: '2026-06-25T10:00:00.000Z'
    });

    assert.equal(result.executed, true);
    assert.equal(result.results[0].event.type, 'source-type-operations');
    assert.equal(calls[0].sourceType, 'thread-url');
    assert.equal(calls[0].execute, true);
    assert.equal(calls[0].priorityScoreThreshold, 80);
    assert.equal(calls[0].includeReadinessWarnings, true);
    assert.equal(calls[0].attentionLimit, 5);
    assert.equal(calls[0].sourceTypeLimit, 3);
    assert.equal(calls[0].limit, 10);
    assert.equal(calls[0].resolveStale, true);
  } finally {
    await close(server);
  }
});

test('http server exposes source type operations drilldown API', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async getSourceTypeOperationsDrilldown(request) {
        calls.push(request);
        return {
          generatedAt: request.now || '2026-06-25T10:00:00.000Z',
          status: 'warn',
          sourceType: request.sourceType,
          sourceKey: request.sourceKey,
          sourceFound: true,
          scope: {
            sourceType: request.sourceType,
            sourceIds: ['source-1'],
            sourceKeys: ['nga']
          },
          health: {
            sources: { total: 1, enabled: 1, due: 1, running: 0, failed: 0 },
            tasks: { total: 0, failed: 0 },
            events: { total: 1, unacknowledged: 1, pending: 1, failed: 0, dueForDelivery: 1 },
            workers: { runs: { total: 0, stale: 0 }, leases: { total: 0, expired: 0 } },
            operations: { found: true, status: 'warn' }
          },
          nextActions: [
            { key: 'sourceType.operations', severity: 'warning', summary: 'Inspect source type operations.' }
          ],
          recent: {
            sources: [],
            tasks: [],
            events: [],
            workerRuns: [],
            workerLeases: []
          }
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const result = await getJson(baseUrl + '/api/operations/source-type-drilldown?sourceType=saved-html-directory&sourceKey=nga&enabled=true&limit=10&scanLimit=200&includeSourceTypeOperations=true&now=2026-06-25T10:00:00.000Z');

    assert.equal(result.sourceType, 'saved-html-directory');
    assert.equal(result.health.sources.total, 1);
    assert.equal(calls[0].sourceType, 'saved-html-directory');
    assert.equal(calls[0].sourceKey, 'nga');
    assert.equal(calls[0].enabled, true);
    assert.equal(calls[0].limit, 10);
    assert.equal(calls[0].scanLimit, 200);
    assert.equal(calls[0].includeSourceTypeOperations, true);
  } finally {
    await close(server);
  }
});

test('http server exposes operational readiness API', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      listAdapters() {
        return [{ sourceKey: 'nga', displayName: 'NGA' }];
      },
      async getOperationalReadiness(request) {
        calls.push(request);
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
    const response = await fetch(baseUrl + '/api/operations/readiness?sourceKey=nga&sourceId=source-1&sourceType=saved-html-directory&enabled=true&limit=10');
    const readiness = await response.json();
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(response.status, 503);
    assert.equal(calls[0].sourceKey, 'nga');
    assert.equal(calls[0].sourceId, 'source-1');
    assert.equal(calls[0].sourceType, 'saved-html-directory');
    assert.equal(calls[0].enabled, true);
    assert.equal(calls[0].limit, 10);
    assert.equal(readiness.status, 'fail');
    assert.equal(readiness.checks[0].key, 'workers.stale');
    assert.ok(openApi.paths['/api/operations/readiness']);
    assert.ok(openApi.paths['/api/operations/readiness'].get.parameters.find(function (parameter) {
      return parameter.name === 'sourceKey';
    }));
    assert.ok(openApi.paths['/api/operations/readiness'].get.parameters.find(function (parameter) {
      return parameter.name === 'sourceType';
    }));
    assert.ok(openApi.paths['/api/operations/readiness'].get.parameters.find(function (parameter) {
      return parameter.name === 'enabled';
    }));
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
    const checklist = await getJson(baseUrl + '/api/deployment/checklist?sourceType=saved-html-directory&enabled=true&now=2026-06-19T10:00:00.000Z');
    const topologyPlan = await getJson(baseUrl + '/api/operations/worker-topology-plan?now=2026-06-19T10:00:00.000Z');
    const scopedTopologyPlan = await getJson(baseUrl + '/api/operations/worker-topology-plan?topology=split-workers&sourceKey=nga&sourceId=source-1&now=2026-06-19T10:00:00.000Z');
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(checklist.status, 'warn');
    assert.equal(checklist.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.ok(checklist.items.find(function (item) {
      return item.key === 'runtime.configuration';
    }));
    assert.ok(checklist.items.find(function (item) {
      return item.key === 'sources.ingestConfiguration';
    }));
    assert.equal(checklist.items.find(function (item) {
      return item.key === 'sources.ingestConfiguration';
    }).evidence.sourceType, 'saved-html-directory');
    assert.equal(checklist.items.find(function (item) {
      return item.key === 'reviewActions.executor';
    }).status, 'warn');
    assert.equal(topologyPlan.status, 'warn');
    assert.equal(topologyPlan.topology, 'operations-worker');
    assert.equal(topologyPlan.workers[0].workerType, 'operations');
    assert.equal(scopedTopologyPlan.sourceKey, 'nga');
    assert.equal(scopedTopologyPlan.sourceId, 'source-1');
    assert.equal(scopedTopologyPlan.workers[0].leaseKey, 'worker:due-source:source-id:source-1');
    assert.equal(scopedTopologyPlan.workers[1].leaseKey, 'worker:notification-event:source-id:source-1');
    assert.match(scopedTopologyPlan.workers[0].command, /--source-key nga/);
    assert.match(scopedTopologyPlan.workers[0].command, /--source-id source-1/);
    assert.ok(openApi.paths['/api/deployment/checklist']);
    assert.ok(openApi.paths['/api/deployment/checklist'].get.parameters.find(function (parameter) {
      return parameter.name === 'sourceType';
    }));
    assert.ok(openApi.paths['/api/deployment/checklist'].get.parameters.find(function (parameter) {
      return parameter.name === 'enabled';
    }));
    assert.ok(openApi.paths['/api/operations/worker-topology-plan']);
    assert.ok(openApi.paths['/api/operations/worker-topology-plan'].get.parameters.find(function (parameter) {
      return parameter.name === 'sourceId';
    }));
    assert.equal(openApi.paths['/api/operations/worker-topology-plan'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/WorkerTopologyPlan');
    assert.equal(openApi.paths['/api/operations/worker-topology-plan'].get.responses[503].content['application/json'].schema.$ref, '#/components/schemas/WorkerTopologyPlan');
    assert.equal(openApi.components.schemas.WorkerTopologyWorker.properties.scope.$ref, '#/components/schemas/SourceScope');
    assert.equal(openApi.components.schemas.WorkerTopologyWorker.properties.leaseKey.example, 'worker:due-source:source-id:tracked-source-nga-001');
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

    assert.equal(runbook.status, 'warn');
    assert.equal(runbook.generatedAt, '2026-06-19T10:00:00.000Z');
    assert.equal(runbook.actionCount, 1);
    assert.equal(runbook.actions[0].key, 'checklist.reviewActions.executor');
    assert.equal(runbook.actions[0].recommendedCommand, 'node src/presentation/cli/threadtrace.js review-action-executor-diagnostics');
    assert.equal(runbook.sourceLifecycleReport.summary.total, 0);
    assert.ok(openApi.paths['/api/operations/runbook']);
    assert.equal(openApi.paths['/api/operations/runbook'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/OperationsRunbook');
    assert.equal(openApi.paths['/api/operations/runbook'].get.responses[503].content['application/json'].schema.$ref, '#/components/schemas/OperationsRunbook');
    assert.equal(openApi.components.schemas.OperationsRunbook.properties.actions.items.$ref, '#/components/schemas/RunbookAction');
    assert.equal(openApi.components.schemas.RunbookAction.properties.relatedCommands.items.type, 'string');
    assert.equal(openApi.components.schemas.RunbookAction.properties.evidence.additionalProperties, true);
    assert.ok(openApi.paths['/api/operations/runbook'].get.parameters.some(function (parameter) {
      return parameter.name === 'sourceFailureRetryBackoffMs';
    }));
  } finally {
    await close(server);
  }
});

test('http server synthesizes runbook notification events', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      async synthesizeRunbookNotificationEvents(request) {
        calls.push(request);
        return {
          status: 'ok',
          dryRun: !request.execute,
          executed: request.execute,
          actionCount: 1,
          eventCount: 1,
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          results: [
            {
              status: 'created',
              actionKey: 'checklist.sources',
              event: {
                id: 'runbook-action-1',
                type: 'runbook-action',
                severity: 'critical'
              }
            }
          ]
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const result = await postJson(baseUrl + '/api/operations/runbook/events', {
      execute: true,
      sourceKey: 'forum-a',
      sourceId: 'source-a',
      resolveStale: false,
      staleLimit: 7,
      limit: 25,
      now: '2026-06-19T10:00:00.000Z'
    });
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].execute, true);
    assert.equal(calls[0].sourceKey, 'forum-a');
    assert.equal(calls[0].sourceId, 'source-a');
    assert.equal(calls[0].resolveStale, false);
    assert.equal(calls[0].staleLimit, 7);
    assert.equal(calls[0].limit, 25);
    assert.equal(calls[0].now, '2026-06-19T10:00:00.000Z');
    assert.equal(result.executed, true);
    assert.equal(result.results[0].event.type, 'runbook-action');
    assert.equal(openApi.paths['/api/operations/runbook/events'].post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/RunbookNotificationEventSynthesisResult');
    assert.equal(openApi.components.schemas.RunbookNotificationEventSynthesisResult.properties.results.items.$ref, '#/components/schemas/RunbookNotificationEventSynthesisItem');
    assert.equal(openApi.components.schemas.RunbookNotificationEventSynthesisResult.properties.runbook.$ref, '#/components/schemas/OperationsRunbook');
    assert.equal(openApi.components.schemas.RunbookNotificationEventSynthesisItem.properties.event.$ref, '#/components/schemas/NotificationEvent');
    assert.equal(openApi.components.schemas.NotificationEvent.properties.type.enum.includes('runbook-action'), true);
    assert.equal(openApi.components.schemas.NotificationEvent.properties.sourceKey.example, 'nga');
  } finally {
    await close(server);
  }
});

test('http server validates connector module files', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-http-connector-module-validation-');
  const goodModulePath = path.join(tempDir, 'goodConnector.cjs');
  const brokenModulePath = path.join(tempDir, 'brokenConnector.cjs');
  await fs.writeFile(goodModulePath, [
    "'use strict';",
    "module.exports = {",
    "  sourceIngestHandlers: [{",
    "    sourceType: 'http-external-feed',",
    "    requiresAdapter: false,",
    "    description: 'HTTP external feed.',",
    "    locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "    async run() { throw new Error('not used in this test'); }",
    "  }]",
    "};",
    ""
  ].join('\n'), 'utf8');
  await fs.writeFile(brokenModulePath, [
    "'use strict';",
    "throw new Error('http validation boom');",
    ""
  ].join('\n'), 'utf8');

  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example')
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const good = await postJson(baseUrl + '/api/connectors/modules/validate', {
      modulePath: goodModulePath,
      now: '2026-06-19T10:00:00.000Z'
    });
    const broken = await postJsonWithStatus(baseUrl + '/api/connectors/modules/validate', {
      modulePath: brokenModulePath,
      now: '2026-06-19T10:00:00.000Z'
    }, 503);
    const missingPath = await postJsonWithStatus(baseUrl + '/api/connectors/modules/validate', {
      now: '2026-06-19T10:00:00.000Z'
    }, 400);

    assert.equal(good.valid, true);
    assert.equal(good.modules[0].sourceIngestHandlers[0], 'http-external-feed');
    assert.equal(broken.valid, false);
    assert.match(broken.errors[0].message, /http validation boom/);
    assert.equal(missingPath.error.code, 'connector_module_path_required');
  } finally {
    await close(server);
  }
});

test('http server source onboarding preflight can simulate connector modules', async function () {
  const tempDir = await makeWorkspaceTempDir('threadtrace-http-source-onboarding-module-');
  const modulePath = path.join(tempDir, 'externalConnector.cjs');
  await fs.writeFile(modulePath, [
    "'use strict';",
    "module.exports = {",
    "  sourceIngestHandlers: [{",
    "    sourceType: 'http-onboarding-feed',",
    "    requiresAdapter: false,",
    "    description: 'HTTP onboarding feed.',",
    "    locationSchema: { required: ['feedUrl'], properties: { feedUrl: { type: 'string' } } },",
    "    async run() { throw new Error('not used in this test'); }",
    "  }]",
    "};",
    ""
  ].join('\n'), 'utf8');

  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example')
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const preflight = await postJson(baseUrl + '/api/sources/onboarding/preflight', {
      sourceKey: 'external',
      sourceType: 'http-onboarding-feed',
      modulePath,
      location: {
        feedUrl: 'https://example.test/feed'
      },
      now: '2026-06-19T10:00:00.000Z'
    });

    assert.equal(preflight.status, 'ok');
    assert.equal(preflight.connectorModuleValidation.valid, true);
    assert.equal(preflight.sourceValidation.valid, true);
    assert.equal(preflight.catalog.sourceType.sourceType, 'http-onboarding-feed');
    assert.equal(preflight.rolloutManifestDraft.source.location.feedUrl, 'https://example.test/feed');
    assert.equal(preflight.rolloutManifestDraft.connector.modulePath, path.resolve(modulePath));
  } finally {
    await close(server);
  }
});

test('http server previews source ingest dry-runs without durable writes', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-http-source-dry-run-'));
  const inputFile = path.join(tempDir, 'thread.json');
  await fs.writeFile(inputFile, JSON.stringify({
    sourceKey: 'external',
    sourceThreadId: 'http-dry-run-thread',
    title: 'HTTP dry-run thread',
    posts: []
  }, null, 2) + '\n', 'utf8');

  const server = createThreadTraceServer({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: path.join(tempDir, 'store')
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const preview = await postJson(baseUrl + '/api/sources/ingest/dry-run', {
      sourceKey: 'external',
      sourceType: 'normalized-thread-json',
      inputFile,
      now: '2026-06-19T10:00:00.000Z'
    });
    const reports = await getJson(baseUrl + '/api/reports?sourceKey=external&sourceThreadId=http-dry-run-thread');
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(preview.status, 'ok');
    assert.equal(preview.dryRun, true);
    assert.equal(preview.thread.sourceThreadId, 'http-dry-run-thread');
    assert.equal(preview.repositoryWrites.reports, 1);
    assert.equal(reports.reports.length, 0);
    assert.ok(openApi.paths['/api/sources/ingest/dry-run']);
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

test('http server maps source disable conflicts to 409', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      async runDisableSourceTask(request) {
        calls.push(request);
        throw createApplicationError('source_disable_running', 'Tracked source is currently running: source-1', {
          statusCode: 409,
          details: {
            sourceId: 'source-1',
            staleAfterMs: request.sourceRunStaleAfterMs,
            forced: request.force
          }
        });
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const response = await fetch(baseUrl + '/api/sources/source-1/disable', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        execute: true,
        force: false,
        sourceRunStaleAfterMs: 1234
      })
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].execute, true);
    assert.equal(calls[0].force, false);
    assert.equal(calls[0].sourceRunStaleAfterMs, 1234);
    assert.equal(body.error.code, 'source_disable_running');
    assert.equal(body.error.details.sourceId, 'source-1');
    assert.equal(body.error.details.staleAfterMs, 1234);
  } finally {
    await close(server);
  }
});

test('http server runs source failure reset task endpoint', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      async runResetSourceFailureTask(request) {
        calls.push(request);
        return {
          task: {
            id: 'reset-task-1',
            type: 'reset-tracked-source-failure',
            status: 'completed'
          },
          result: {
            status: 'ok',
            dryRun: false,
            executed: true,
            changed: true,
            reason: 'failure-reset-and-requeued',
            retryNow: true,
            sourceAfter: {
              id: request.sourceId,
              runState: {
                status: 'completed',
                failureCount: 0
              }
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
    const response = await fetch(baseUrl + '/api/sources/source-1/failure/reset', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'reset-http-request-1',
        'idempotency-key': 'reset-http-idem-1'
      },
      body: JSON.stringify({
        execute: true,
        retryNow: true,
        resetBy: 'web',
        now: '2026-06-19T10:00:00.000Z'
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sourceId, 'source-1');
    assert.equal(calls[0].execute, true);
    assert.equal(calls[0].retryNow, true);
    assert.equal(calls[0].resetBy, 'web');
    assert.equal(calls[0].requestId, 'reset-http-request-1');
    assert.equal(calls[0].idempotencyKey, 'reset-http-idem-1');
    assert.equal(body.task.type, 'reset-tracked-source-failure');
    assert.equal(body.result.reason, 'failure-reset-and-requeued');
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
    const disableDryRun = await postJson(baseUrl + '/api/sources/' + encodeURIComponent(registerResult.source.id) + '/disable', {
      execute: false,
      now: '2026-06-19T10:00:00.000Z'
    });
    const enableDryRun = await postJson(baseUrl + '/api/sources/' + encodeURIComponent(registerResult.source.id) + '/enable', {
      execute: false,
      now: '2026-06-19T10:00:00.000Z'
    });
    const lifecycle = await getJson(baseUrl + '/api/sources/lifecycle?now=2026-06-19T10:00:00.000Z');
    const schedule = await getJson(baseUrl + '/api/sources/schedule?now=2026-06-19T10:00:00.000Z');
    const sourcesAfterDisableDryRun = await getJson(baseUrl + '/api/sources');
    const dueResult = await postJson(baseUrl + '/api/sources/tasks/ingest-due', {});
    const skippedDueResult = await postJson(baseUrl + '/api/sources/tasks/ingest-due', {});
    const eventsResult = await getJson(baseUrl + '/api/events');
    const sourceKeyEventsResult = await getJson(baseUrl + '/api/events?sourceKey=nga');
    const dispatchResult = await postJson(baseUrl + '/api/events/dispatch', {
      sourceId: registerResult.source.id,
      sourceKey: 'nga'
    });
    const deliveredEventsResult = await getJson(baseUrl + '/api/events?deliveryStatus=delivered');
    const batchAckPreview = await postJson(baseUrl + '/api/events/ack', {
      sourceKey: 'nga',
      deliveryStatus: 'delivered',
      acknowledgedBy: 'batch-preview',
      dryRun: true,
      limit: 5
    });
    const openDeliveredAfterPreview = await getJson(baseUrl + '/api/events?deliveryStatus=delivered&acknowledged=false');
    const batchAckResult = await postJson(baseUrl + '/api/events/ack', {
      sourceKey: 'nga',
      deliveryStatus: 'delivered',
      acknowledgedBy: 'batch-test',
      limit: 5
    });
    const ackResult = await postJson(baseUrl + '/api/events/' + encodeURIComponent(eventsResult.events[0].id) + '/ack', {
      acknowledgedBy: 'test'
    });
    const archivePreview = await postJson(baseUrl + '/api/events/archive', {
      sourceKey: 'nga',
      cutoffAt: '2999-01-01T00:00:00.000Z',
      execute: false,
      limit: 5
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
    assert.equal(disableDryRun.task.type, 'disable-tracked-source');
    assert.equal(disableDryRun.result.dryRun, true);
    assert.equal(enableDryRun.task.type, 'enable-tracked-source');
    assert.equal(enableDryRun.result.dryRun, true);
    assert.equal(lifecycle.summary.total, 1);
    assert.equal(lifecycle.summary.disableBlocked, 0);
    assert.equal(lifecycle.summary.failureRetryWaiting, 0);
    assert.equal(lifecycle.sources[0].id, registerResult.source.id);
    assert.equal(lifecycle.sources[0].disableGuard.canDisable, true);
    assert.equal(schedule.summary.total, 1);
    assert.equal(schedule.sources[0].id, registerResult.source.id);
    assert.equal(schedule.sources[0].decision.reason, 'never-finished');
    assert.equal(sourcesAfterDisableDryRun.sources[0].enabled, true);
    assert.equal(dueResult.task.type, 'ingest-due-sources');
    assert.equal(dueResult.dueCount, 1);
    assert.equal(skippedDueResult.dueCount, 0);
    assert.equal(skippedDueResult.skippedCount, 1);
    assert.equal(eventsResult.events.length, 1);
    assert.equal(sourceKeyEventsResult.events.length, 1);
    assert.equal(eventsResult.events[0].type, 'source-changed');
    assert.equal(dispatchResult.dispatchedCount, 1);
    assert.equal(deliveredEventsResult.events.length, 1);
    assert.equal(batchAckPreview.status, 'preview');
    assert.equal(batchAckPreview.dryRun, true);
    assert.equal(batchAckPreview.candidateCount, 1);
    assert.equal(batchAckPreview.acknowledgedCount, 0);
    assert.equal(openDeliveredAfterPreview.events.length, 1);
    assert.equal(batchAckResult.acknowledgedCount, 1);
    assert.equal(batchAckResult.skippedCount, 0);
    assert.equal(ackResult.event.acknowledgedBy, 'batch-test');
    assert.equal(archivePreview.dryRun, true);
    assert.equal(archivePreview.candidateCount, 1);
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
    const response = await fetch(baseUrl + '/api/sources/diagnostics?sourceType=saved-html-directory');
    const diagnostics = await response.json();
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(response.status, 503);
    assert.equal(diagnostics.sourceType, 'saved-html-directory');
    assert.equal(diagnostics.status, 'fail');
    assert.equal(diagnostics.sources[0].status, 'fail');
    assert.equal(diagnostics.sources[0].checks.find(function (check) {
      return check.key === 'source.adapter';
    }).status, 'fail');
    assert.ok(openApi.paths['/api/sources/diagnostics']);
    assert.equal(openApi.paths['/api/sources/diagnostics'].get.responses[200].content['application/json'].schema.$ref, '#/components/schemas/SourceDiagnostics');
    assert.equal(openApi.paths['/api/sources/diagnostics'].get.responses[503].content['application/json'].schema.$ref, '#/components/schemas/SourceDiagnostics');
    assert.equal(openApi.components.schemas.SourceDiagnostics.properties.sources.items.$ref, '#/components/schemas/SourceDiagnosticItem');
    assert.equal(openApi.components.schemas.SourceDiagnostics.properties.nextActions.items.$ref, '#/components/schemas/SourceDiagnosticAction');
    assert.equal(openApi.components.schemas.SourceDiagnosticItem.properties.checks.items.$ref, '#/components/schemas/SourceDiagnosticCheck');
    assert.equal(openApi.components.schemas.SourceDiagnosticAction.properties.evidence.$ref, '#/components/schemas/SourceDiagnosticActionEvidence');
    assert.equal(openApi.components.schemas.SourceDiagnosticAction.properties.commands.items.type, 'string');
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

test('http server exposes author intelligence dashboard endpoint', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      async getAuthorIntelligenceDashboard(request) {
        calls.push(request);
        return {
          generatedAt: request.now,
          status: 'ok',
          reportCount: 1,
          summary: {
            threadCount: 1,
            authorCount: 1,
            focusEntityCount: 1,
            opinionCount: 1,
            evidenceGapCount: 0,
            highSignalEvidenceCount: 1,
            reviewQueueCount: 1
          },
          authors: [
            {
              author: {
                sourceAuthorId: request.authorId,
                displayName: 'Alice'
              },
              postCount: 2,
              opinionCount: 1,
              threadCount: 1
            }
          ],
          focusEntities: [],
          opinionTimeline: [],
          evidenceGaps: [],
          evidence: [],
          reviewQueue: [
            {
              key: 'opinion:1',
              type: 'high-confidence-opinion',
              priority: 'medium',
              score: 80,
              title: 'Validate high-confidence opinion from Alice',
              refs: []
            }
          ],
          threads: [],
          recommendedNextAction: 'Use top authors, focus entities, and opinion timeline as the next review queue.'
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const dashboard = await getJson(baseUrl + '/api/intelligence/authors?sourceKey=forum-a&sourceThreadId=thread-1&authorId=author-1&includeReportRevisions=true&limit=9&timelineLimit=4&reviewQueueLimit=3&now=2026-06-22T10:00:00.000Z');
    const markdown = await getText(baseUrl + '/api/intelligence/authors/markdown?sourceKey=forum-a&sourceThreadId=thread-1&authorId=author-1&includeReportRevisions=true&limit=9&timelineLimit=4&reviewQueueLimit=3&now=2026-06-22T10:00:00.000Z', 'text/markdown');
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(calls.length, 2);
    assert.equal(calls[0].sourceKey, 'forum-a');
    assert.equal(calls[0].sourceThreadId, 'thread-1');
    assert.equal(calls[0].authorId, 'author-1');
    assert.equal(calls[0].includeReportRevisions, true);
    assert.equal(calls[0].limit, 9);
    assert.equal(calls[0].timelineLimit, 4);
    assert.equal(calls[0].reviewQueueLimit, 3);
    assert.equal(dashboard.status, 'ok');
    assert.equal(dashboard.authors[0].author.sourceAuthorId, 'author-1');
    assert.equal(dashboard.reviewQueue[0].type, 'high-confidence-opinion');
    assert.match(markdown, /# Author Intelligence Review Package/);
    assert.match(markdown, /Validate high-confidence opinion from Alice/);
    assert.ok(openApi.paths['/api/intelligence/authors']);
    assert.ok(openApi.paths['/api/intelligence/authors/markdown']);
  } finally {
    await close(server);
  }
});

test('http server exposes durable author review queue APIs', async function () {
  const calls = [];
  const server = createThreadTraceServer({
    runtime: {
      async syncAuthorReviewQueue(request) {
        calls.push({ method: 'sync', request });
        return sampleAuthorReviewQueueResult({
          createdCount: 1,
          updatedCount: 0
        });
      },
      async listAuthorReviewQueue(request) {
        calls.push({ method: 'list', request });
        return sampleAuthorReviewQueueResult({});
      },
      async updateAuthorReviewQueueItemStatus(request) {
        calls.push({ method: 'status', request });
        const result = sampleAuthorReviewQueueResult({});
        return {
          generatedAt: request.now,
          status: 'ok',
          item: Object.assign({}, result.items[0], {
            status: request.status
          }),
          recommendedNextAction: 'Continue working the remaining open author intelligence review queue items.'
        };
      },
      async synthesizeAuthorReviewQueueNotificationEvents(request) {
        calls.push({ method: 'events', request });
        return {
          generatedAt: request.now,
          status: 'ok',
          dryRun: request.execute !== true,
          executed: request.execute === true,
          itemCount: 1,
          actionCount: 1,
          eventCount: 1,
          createdCount: 1,
          updatedCount: 0,
          resolvedCount: 0,
          reopenedCount: 0,
          skippedCount: 0,
          results: [
            {
              status: 'created',
              itemId: 'author-review:test',
              event: {
                id: 'author-review-queue:test',
                type: 'author-review-queue',
                severity: 'info',
                sourceKey: 'forum-a',
                payload: {
                  itemId: 'author-review:test'
                }
              }
            }
          ],
          recommendedNextAction: 'Dispatch pending notification events.'
        };
      }
    }
  });
  await listen(server, 0);
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    const sync = await postJson(baseUrl + '/api/intelligence/author-review-queue/sync', {
      sourceKey: 'forum-a',
      reviewQueueLimit: 3,
      now: '2026-06-23T10:00:00.000Z'
    });
    const list = await getJson(baseUrl + '/api/intelligence/author-review-queue?sourceKey=forum-a&status=open&type=high-confidence-opinion&priority=medium&limit=5');
    const status = await postJson(baseUrl + '/api/intelligence/author-review-queue/' + encodeURIComponent('author-review:test') + '/status', {
      status: 'confirmed',
      reviewedBy: 'operator',
      note: 'checked'
    });
    const events = await postJson(baseUrl + '/api/intelligence/author-review-queue/events', {
      sourceKey: 'forum-a',
      status: 'open',
      execute: true,
      resolveStale: true,
      staleLimit: 7,
      now: '2026-06-23T10:05:00.000Z'
    });
    const openApi = await getJson(baseUrl + '/openapi.json');

    assert.equal(sync.createdCount, 1);
    assert.equal(list.items[0].id, 'author-review:test');
    assert.equal(status.item.status, 'confirmed');
    assert.equal(events.executed, true);
    assert.equal(events.results[0].event.type, 'author-review-queue');
    assert.deepEqual(calls.map(function (call) { return call.method; }), ['sync', 'list', 'status', 'events']);
    assert.equal(calls[0].request.sourceKey, 'forum-a');
    assert.equal(calls[0].request.reviewQueueLimit, 3);
    assert.equal(calls[1].request.status, 'open');
    assert.equal(calls[1].request.priority, 'medium');
    assert.equal(calls[2].request.itemId, 'author-review:test');
    assert.equal(calls[2].request.reviewedBy, 'operator');
    assert.equal(calls[3].request.sourceKey, 'forum-a');
    assert.equal(calls[3].request.execute, true);
    assert.equal(calls[3].request.resolveStale, true);
    assert.equal(calls[3].request.staleLimit, 7);
    assert.ok(openApi.paths['/api/intelligence/author-review-queue']);
    assert.ok(openApi.paths['/api/intelligence/author-review-queue/sync']);
    assert.ok(openApi.paths['/api/intelligence/author-review-queue/{itemId}/status']);
    assert.ok(openApi.paths['/api/intelligence/author-review-queue/events']);
  } finally {
    await close(server);
  }
});

function sampleAuthorReviewQueueResult(overrides) {
  const safeOverrides = overrides || {};
  const item = {
    id: 'author-review:test',
    status: 'open',
    type: 'high-confidence-opinion',
    priority: 'medium',
    score: 78,
    title: 'Validate high-confidence opinion from Alice',
    sourceKey: 'forum-a',
    sourceThreadId: 'thread-1',
    floor: 3,
    seenCount: 1,
    refs: [
      {
        sourceKey: 'forum-a',
        sourceThreadId: 'thread-1',
        floor: 3
      }
    ]
  };
  return Object.assign({
    generatedAt: '2026-06-23T10:00:00.000Z',
    status: 'ok',
    itemCount: 1,
    createdCount: 0,
    updatedCount: 0,
    summary: {
      byStatus: { open: 1 },
      byPriority: { medium: 1 },
      byType: { 'high-confidence-opinion': 1 },
      openCount: 1
    },
    items: [item],
    recommendedNextAction: 'Review open author intelligence queue items.'
  }, safeOverrides);
}

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

async function getText(url, contentTypePrefix) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type').startsWith(contentTypePrefix), true);
  return response.text();
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
