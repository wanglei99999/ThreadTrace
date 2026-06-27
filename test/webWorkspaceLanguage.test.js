const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertAbsent(content, snippets) {
  for (const snippet of snippets) {
    assert.equal(content.includes(snippet), false, `Expected workspace copy to avoid: ${snippet}`);
  }
}

test('system workspace chrome uses approachable labels instead of developer console copy', function () {
  const html = readProjectFile('src/presentation/web/index.html');
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(html, [
    'data-title="Tracked source"',
    'data-label="Source"',
    '>Source ops<',
    '>Demo cycle<',
    'data-label="Automation"',
    '>Automation readiness<',
    'data-label="LLM"',
    '>LLM readiness<',
    '>LLM preflight<',
    '>LLM evaluate<',
    'data-label="Events"',
    'data-title="Thread URL"',
    'data-title="Connector preflight"',
    '<span>Operations</span>',
    '<span>Events</span>',
    'data-title="Event triage"',
    '<span>Source key</span>',
    '<span>Source ID</span>',
    '>Preview ack<',
    '>Ack execute<',
    'data-title="Human decision"',
    '<span>Context review result JSON</span>',
    'data-title="Source rehearsal"',
    '<span>Source type</span>',
    '<span>Source mode</span>',
    'data-title="Resource map"',
    '<span>Resource manifest JSON</span>',
    'data-label="Resource"',
    '>Resource plan<'
  ]);

  assertAbsent(app, [
    '<span class="system-runtime-label">Runtime pulse</span>',
    "systemRuntimeSignal('Sources'",
    "systemRuntimeSignal('Tasks'",
    "systemRuntimeSignal('Events'",
    "systemRuntimeSignal('Workers'",
    "systemRuntimeMini('Runbook'",
    "systemRuntimeMini('Deploy'",
    "systemRuntimeMini('Sources config'",
    '<span>System surface</span>',
    '<span class="automation-cockpit-label">Automation cockpit</span>',
    "panel('Attention queue'",
    "panel('Snapshot freshness'",
    "panel('Notification and audit pressure'",
    "panel('Automation gates'",
    "panel('Operator runbook'",
    "panel('Worker commands'",
    "panel('Next actions'",
    "automationCockpitSignal('Ready'",
    "automationCockpitSignal('Sources'",
    "automationCockpitSignal('Due now'",
    "automationCockpitSignal('Queue'",
    "automationCockpitSignal('Runnable'",
    '<span>Run path</span>',
    '<span>Evidence loop</span>'
  ]);
});

test('event and source result surfaces avoid console-style action copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "panel('Event detail'",
    "panel('Action readiness'",
    "panel('Event actions'",
    "panel('Event payload'",
    "panel('Notification synthesis policy'",
    "panel('Notification event archive'",
    "panel('Raw pages fetched'",
    "panel('Tracked sources'",
    "panel('Cockpit action plan'",
    "panel('Review action plan'",
    "panel('Review action apply task'",
    "panel('Source hotspots'",
    'Create notification events from',
    'Reset this source failure state',
    'Configure this source schedule',
    '<strong>Runbook alerts</strong>',
    'alertable=',
    'threshold=70',
    '>Acknowledge</button>',
    '>Create alerts</button>',
    '>Dry-run</button>',
    '>Execute</button>',
    '>Ops</button>',
    '>Health</button>',
    '>Detail</button>',
    '>Task</button>',
    '>Run</button>',
    '>Insight</button>',
    '>Preview</button>',
    '>Runbook check</button>',
    '<span>Standby</span>',
    '<span>Quiet</span>',
    'No notification events match this filter.',
    'No evidence signals yet.',
    'No tags yet.',
    'No tracked sources yet.',
    'No source diagnostics.',
    'Working...',
    'Checking event archive policy...'
  ]);
});

test('author intelligence surfaces avoid review-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "panel('Source review pressure'",
    "panel('Review queue'",
    'Review author signals and sync the open queue.',
    '<span class="author-intel-label">Author radar</span>',
    '>Sync queue</button>',
    '>Open queue</button>',
    '<span>Focus authors</span>',
    '<span>Review pressure</span>',
    'No author signals yet.',
    'No source review pressure',
    'No author review queue yet.',
    'No durable queue items',
    'No author intelligence yet.',
    'No focus entities yet.',
    'No opinion timeline yet.',
    'No evidence gaps.',
    'No high-signal evidence yet.',
    '>Confirm</button>',
    '>Ignore</button>',
    'Author queue alert synthesis',
    'Event preview',
    '>Back to queue</button>',
    '>Run check again</button>',
    "sourceKey ? 'source=' + sourceKey : undefined",
    "ref.sourceThreadId ? 'thread=' + ref.sourceThreadId : undefined",
    "item.sourceThreadId || ref.sourceThreadId ? 'thread=' + (item.sourceThreadId || ref.sourceThreadId) : undefined",
    "thread.sourceThreadId ? 'thread=' + thread.sourceThreadId : undefined",
    "'opinions=' + (item.opinionCount || 0)",
    "'优先级=' + formatAuthorCountSummary(summary.byPriority)",
    "topPressure.sourceKey ? '主要来源=' + topPressure.sourceKey : undefined",
    "'类型=' + formatAuthorCountSummary(summary.byType)",
    "'来源=' + formatAuthorCountSummary(sourceCounts)"
  ]);
});

test('source onboarding and rollout controls avoid deployment-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    '>Preflight manifest</button>',
    '>Run rollout checks</button>',
    '>Use template</button>',
    '>Preflight template</button>',
    '>Use package</button>',
    '>Load manifest</button>',
    '>Apply dry-run</button>',
    '>Rollback check</button>',
    '>Rollback disable</button>',
    '>Copy</button>',
    '>Schedule check</button>',
    '>Schedule now</button>',
    '>Enable check</button>',
    '>Disable check</button>',
    '>Reset check</button>',
    '>Retry now</button>',
    '>Run due</button>',
    '>Run insights</button>',
    '>Enable</button>',
    '>Disable</button>',
    "panel('Recommended manifest loaded'",
    "panel('Source onboarding recipe'",
    "panel('Adapter guidance'",
    "panel('Location fields'",
    "panel('Recommended flow'",
    "panel('Rollout manifest template'",
    "panel('Connector package'",
    "panel('Connector packages'",
    "panel('Connector module errors'",
    "panel('Rollout readiness'",
    "panel('Readiness checks'",
    "panel('Readiness next actions'",
    "panel('Rollout manifest apply'",
    "panel('Apply steps'",
    "panel('Rollback plan'",
    "panel('Apply actions'",
    "(manifest.source && manifest.source.sourceKey || 'unknown') + ' | ' + (manifest.source && manifest.source.sourceType || 'unknown')",
    "return (error.modulePath || 'unknown-module') + ' | ' + (error.message || 'load failed');",
    "connectorPackage.packageVersion ? 'version=' + connectorPackage.packageVersion : undefined",
    "connectorPackage.packageType ? 'type=' + connectorPackage.packageType : undefined",
    "packageSourceType.kind ? 'kind=' + packageSourceType.kind : undefined",
    "item.packageVersion ? 'version=' + item.packageVersion : undefined",
    "item.packageType ? 'type=' + item.packageType : undefined",
    "'categories=' + item.categories.join(',')",
    "'sourceTypes=' + item.declaredSourceTypes.join(',')",
    "'recommendedManifest=' + item.rollout.recommendedManifest",
    "'recommendedManifest=none'",
    "return 'category:' + category;",
    "source.sourceType || 'unknown'",
    "(source.sourceKey || source.forum || 'unknown') + ' / ' + (source.sourceType || 'unknown')",
    "connector.modulePath || source.modulePath || 'not provided'",
    "'actions=' + actionCount",
    "return check.status + ' | ' + check.key + ' | ' + check.title + ' | ' + detail;",
    'Select a registered source type.',
    '<span class="source-work-scope">collection</span>',
    '<strong>Due collection</strong>',
    'ready to run',
    'queue clear',
    'No connector package metadata loaded.',
    'No location fields',
    'No recommended flow',
    'uncategorized'
  ]);
});

test('history and context reports avoid evidence-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    '<span class="history-report-kicker">Evidence report</span>',
    "historyFact('Posts'",
    "historyFact('Authors'",
    "historyFact('Pages'",
    "historyFact('Reliability'",
    '<span>Primary author</span>',
    '<span class="context-verdict-label">Context verdict</span>',
    "contextVerdictSignal('Matches'",
    "contextVerdictSignal('Review'",
    "contextVerdictSignal('Tasks'",
    "contextVerdictSignal('Floors'",
    '<span>Next action</span>',
    'Inspect matched evidence and decide whether to create review work.',
    'No high priority review tasks',
    'high priority review tasks',
    'No matching evidence yet.',
    'unknown author',
    '<small>score '
  ]);
});

test('task path and review result surfaces avoid trace-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "label || 'Trace'",
    "label || 'Detail'",
    "renderTaskDetailButtonControl(task, 'Batch task')",
    "renderTaskTraceButtonControl(task, 'Batch trace')",
    "renderTaskDetailButtonControl(task, 'Task')",
    "renderTaskTraceButtonControl(task, 'Trace')",
    "panel('Task detail'",
    "panel('Task actions'",
    "panel('Task payload'",
    "panel('Task trace context'",
    "panel('Correlated tasks'",
    "panel('Idempotency'",
    "summaryTile('Trace tasks'",
    "summaryTile('Duplicate risk'",
    "metric('Task ID'",
    "metric('Source scope'",
    "metric('Trace request'",
    "metric('Trace id'",
    "metric('Idempotency'",
    "metric('By status'",
    "metric('By type'",
    "return task.status + ' · ' + task.type",
    "(task.status || 'unknown') + ' | ' + (task.type || 'task')",
    "summaryTile('状态', task.status || 'unknown'",
    "summaryTile('类型', task.type || 'unknown'",
    "(task.status || 'unknown') + ' · ' + (task.type || 'task')",
    "statusBadge(task.status || 'unknown'",
    'No recommended task actions.',
    'No correlated tasks.',
    'created=',
    'updated=',
    'request=',
    'trace=',
    'idempotency=',
    "panel('Review result rejected'",
    "panel('Review result stored'",
    "panel('Review result overview'",
    "panel('Review alert synthesis'",
    "summaryTile('Reviews'",
    "summaryTile('Warnings'",
    "summaryTile('Critical'",
    "summaryTile('Remaining tasks'",
    "summaryTile('Merge candidates'",
    "metric('Record'",
    "metric('Handoff'",
    "metric('Severity'",
    "metric('Remaining tasks'",
    "metric('Review results'",
    'No review attention needed.',
    'No submitted review results.',
    'No merge candidates.',
    'No blocked tasks.',
    'No review gates.',
    'No apply steps.',
    'No diagnostic checks.',
    'No review action audits.',
    'No review action executions.',
    "executable.canCloseTasks ? 'yes' : 'no'",
    "executable.canMergeContext ? 'yes' : 'no'",
    "executable.requiresHumanReview ? 'yes' : 'no'",
    "risk.level || 'unknown'",
    "plan.recommendedNextAction || 'none'",
    "gateReport.status || 'unknown'",
    "gateReport.generatedAt || 'unknown'",
    "gateReport.recommendedNextAction || 'none'",
    "overview.latestGeneratedAt || 'none'",
    "overview.recommendedNextAction || 'none'",
    "metric('来源', compactCountMap(overview.bySourceKey))",
    "return action.severity + ' | ' + action.key + ' | ' + action.summary;",
    "item.status + ' · ' + (item.recordId || '未知记录') + ' · ' + (event.id || '暂无提醒') + ' · ' + (event.severity || 'unknown')",
    "candidate.confidence === undefined ? undefined : 'confidence=' + candidate.confidence",
    "task.confidence === undefined ? undefined : 'confidence=' + task.confidence",
    "candidate.taskId || 'unknown-task'",
    "task.taskId || 'unknown-task'",
    "gate.key || 'unknown-gate'",
    "step.key || 'unknown-step'",
    "check.key || 'unknown-check'",
    "return key + '=' + value;",
    'reviewer=',
    'remaining=',
    'merge='
  ]);
});

test('source run result surfaces avoid operations-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "panel('Source batch run'",
    "panel('Due source batch run'",
    "panel('Due source insight batch run'",
    "summaryTile('Evidence'",
    "summaryTile('Replayable'",
    "summaryTile('Timeline'",
    "summaryTile('Backoff'",
    "item.taskId ? 'task='",
    "'changed=' + item.changed",
    "'new=' + item.newPostCount",
    "'semantic=' + item.semanticStatus",
    "'retry=' + item.retryAt",
    'No source operation results.',
    'unknown-source',
    'Unknown source',
    'Skipped source',
    "item.scheduleReason ? 'reason='",
    "'reason=' + (item.reason",
    "item.nextRunAt ? 'next='",
    "item.retryAt ? 'retry='",
    "item.backoffMs ? 'backoff='",
    'No follow-up commands.',
    "'evidence=' + action.evidenceSummary",
    "'details=' + details",
    "const runLabel = runState.status || 'never-run';",
    "schedule.intervalMinutes ? ' · every ' + schedule.intervalMinutes + 'm' : ''",
    "cursor.postCount !== undefined ? ' · posts ' + cursor.postCount + ' / #' + cursor.lastFloor : ''",
    "diagnostics ? ' · config ' + diagnostics.status : ''",
    "source.id + ' · ' + source.sourceType + ' · ' + runLabel",
    "source.sourceType || source.sourceKey || 'source'",
    "authorMetaChip('代号', source.sourceKey || 'none'",
    "authorMetaChip('配置', diagnostics ? diagnostics.status : 'unknown'",
    "authorMetaChip('间隔', schedule.intervalMinutes ? schedule.intervalMinutes + 'm' : 'none'",
    "authorMetaChip('楼层', cursor.postCount !== undefined ? cursor.postCount + ' / #' + cursor.lastFloor : 'none'",
    "authorMetaChip('新增', cursorDiff.newPostCount !== undefined ? '+' + cursorDiff.newPostCount : 'none'",
    "summaryTile('Status', closure.status",
    "summaryTile('Ready', closure.readyForDailyUse",
    "summaryTile('Score', String(summary.readinessScore",
    "summaryTile('Done', String(summary.completed",
    "summaryTile('Missing', String((summary.missingStepKeys",
    "metric('Next'",
    "'next=' + step.nextAction",
    "return [safeScope.sourceId, safeScope.sourceKey].filter(Boolean).join(' / ') || 'all sources'"
  ]);
});

test('runtime and action summaries avoid backend shorthand', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "'服务=' +",
    "'存储=' +",
    "'来源模式=' +",
    "'更新=' +",
    "'作者复核=' + authorReviewQueueStatusSummary",
    "'复核动作=' + reviewActionStatusSummary",
    "'提醒动作=' + eventActionStatusSummary",
    "' · 模式=' +",
    "' · mock=' +",
    "'状态=' + (demo.closureStatus",
    "'未读=' + pressure.openEvents",
    "'审计=' + pressure.auditCount",
    "'状态=' + (actionExecutions.status",
    "'数量=' + pressure.executionCount",
    "'score ' + (attention.priorityScore || 0)",
    "'signals ' + (attention.signalCount || 0)",
    "sourceHealth.schedule ? ((sourceHealth.schedule.due ? 'due' : 'skip')",
    "'total ' + (tasks.total || 0)",
    "'open ' + (events.unacknowledged || 0)",
    "'audits ' + (reviewActions.auditCount || 0)",
    "'executions ' + (eventActions.count || 0)",
    "'open ' + (authorQueue.openCount || 0)",
    "audit.sourceKey ? 'source='",
    "audit.sourceId ? 'sourceId='",
    "request.taskId ? 'task='",
    "execution.sourceKey ? 'source='",
    "execution.sourceId ? 'sourceId='",
    "execution.taskId ? 'task='",
    "execution.requestHash ? 'hash='",
    "execution.attemptCount ? 'attempts='",
    "execution.runningAgeMs === undefined ? undefined : 'ageMs='",
    "statusBadge(execution.staleRunning ? 'stale running'",
    "'最早未读=' +",
    "'未读来源=' + compactCountMap",
    "metric('下次投递', safeOverview.nextDeliveryAt || 'none')",
    "'不改动=' +",
    "'可变更=' +",
    "'audits ' + (summary.auditCount || 0)",
    "'executions ' + (executions.count || 0)",
    "'running ' + (executions.running || 0)",
    "'failed ' + (executions.failed || 0)",
    "'sources ' + compactCountMap",
    "'latest ' + (summary.latestGeneratedAt || executions.latestUpdatedAt || 'none')",
    "'stale ' + (executions.staleRunning || 0)",
    "if (entries.length === 0) return 'none';"
  ]);
});

test('automation runbook schedule preview avoids deployment-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');
  const cdpProbe = readProjectFile('scripts/verifyAutomationCockpitCdp.js');

  assertAbsent(app, [
    "renderAutomationActionResult('Source schedule'",
    "mode: update.dryRun ? 'Preview only' : 'Apply'",
    "changed: update.changed ? 'Changed' : 'No change'",
    "next: schedule.nextRunAt || 'next run unchanged'",
    "execute ? 'Applying source schedule...' : 'Previewing source schedule...'",
    "const label = safeIntent.execute ? 'Apply' : 'Preview'",
    "No safe runbook preview is available right now.",
    "No remediation plan returned.",
    "summaryTile('Status', remediation.status",
    "summaryTile('Actions'",
    "summaryTile('Manual'",
    "summaryTile('Safe'",
    "remediation.safeToAutoApply ? 'yes' : 'no'"
  ]);

  assertAbsent(cdpProbe, [
    "text.includes('Source schedule')",
    "text.includes('dry-run')",
    "Preview/Apply controls"
  ]);
});

test('automation readiness and freshness panels avoid worker-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "panel('Operations readiness'",
    "summaryTile('Status', readiness",
    "summaryTile('Fail'",
    "summaryTile('Warn'",
    "summaryTile('OK'",
    'No readiness checks need attention.',
    "value.sourceKey ? 'source='",
    "value.sourceId ? 'sourceId='",
    "value.count === undefined ? undefined : 'count='",
    "value.failed === undefined ? undefined : 'failed='",
    "value.staleRunning === undefined ? undefined : 'stale='",
    "value.bySourceKey ? 'bySource='",
    "panel('Worker lease shards'",
    "panel('Worker run sources'",
    "summaryTile('Active'",
    "summaryTile('Expired'",
    "summaryTile('Scoped'",
    "summaryTile('Global'",
    "summaryTile('Running'",
    "summaryTile('Stale'",
    "metric('Worker types'",
    "metric('Active source ids'",
    "metric('Expired source ids'",
    "metric('Active source keys'",
    "metric('Expired source keys'",
    "metric('Runs by source ids'",
    "metric('Runs by source keys'",
    "metric('Running source ids'",
    "metric('Stale source ids'",
    "metric('Stale source keys'",
    "'active ' + (safeLeases.active || 0)",
    "'expired ' + (safeLeases.expired || 0)",
    "'scoped ' + (safeLeases.sourceScoped || 0)",
    "'global ' + (safeLeases.unscoped || 0)",
    "'running ' + (safeWorkers.running || 0)",
    "'stale ' + (safeWorkers.stale || 0)",
    "'failed ' + (safeWorkers.failed || 0)",
    "run.status || 'unknown-status'",
    "run.workerType || 'unknown-worker'",
    "'sourceId=' + scope.sourceId",
    "'sourceKey=' + scope.sourceKey",
    "lease.expired ? 'expired' : 'active'",
    "lease.workerType || 'unknown-worker'",
    "lease.ownerId || 'unknown-owner'",
    "lease.leaseKey || 'unknown-lease'",
    "summaryTile('Status', safeFreshness.status",
    "summaryTile('Inputs'",
    "summaryTile('Missing'",
    "summaryTile('Span'",
    "summaryTile('Config'",
    "summaryTile('Preflight'",
    "summaryTile('Evaluation'",
    "summaryTile('Samples'",
    "metric('Provider'",
    "metric('Mode'",
    "' samples=' + evidence.sampleCount",
    'No worker commands available.',
    "worker.workerType || worker.key || 'worker'",
    "'interval=' + worker.intervalMs + 'ms'",
    "summaryTile('Status', safeRunbook.status",
    "summaryTile('Commands'",
    "summaryTile('Actionable'",
    "summaryTile('Apply'",
    "summaryTile('Sections'",
    "summaryTile('Next'",
    'No operator runbook returned.',
    "'commands=' +",
    "section.title || section.key || 'Runbook section'",
    "statusBadge(section.status || 'unknown'",
    '<strong>Snapshot window</strong>',
    "'oldest=' +",
    "' | newest=' +",
    "'missing=' + missingSources.join",
    'all expected inputs reported generatedAt',
    "source.key || 'input'",
    "source.generatedAt || 'missing'"
  ]);
});

test('deployment and resource panels avoid rollout-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "panel('Source ingest dry-run'",
    "metric('Status', result.status)",
    "metric('Dry run'",
    "metric('Source'",
    "metric('Thread'",
    "metric('Posts'",
    "panel('Isolated writes'",
    "metric('Snapshots'",
    "metric('Reports'",
    "metric('Tasks'",
    "metric('Raw pages'",
    "panel('Connector rollout plan'",
    "metric('Module'",
    "metric('Steps'",
    "panel('Rollout steps'",
    "panel('Ingest dry-run'",
    "panel('Connector contract summary'",
    "panel('Connector contract failures'",
    "panel('Worker topology plan'",
    "metric('Topology'",
    "metric('Storage'",
    "metric('Scope'",
    "panel('Workers'",
    "panel('Topology checks'",
    "panel('Rollout manifest plan'",
    "metric('Manifest'",
    "panel('Manifest steps'",
    "panel('Connector rollout'",
    "panel('Worker topology'",
    "panel('Manifest actions'",
    "panel('Resource provisioning plan'",
    "panel('Resources'",
    "panel('Resource actions'",
    "panel('Deployment gate'",
    "panel('Gate results'",
    "panel('Gate actions'",
    "' env=' +",
    "' evidence=' +",
    "' drift=' +",
    "' details=' +",
    "'required' : 'optional'",
    "'duplicate adapters: '",
    "'duplicate handlers: '",
    "' missing: '"
  ]);
});

test('source schedule and attention panels avoid operations-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    'No due sources.',
    'No retry-waiting sources.',
    'No unscheduled or disabled sources.',
    'No skipped sources.',
    'No operator queue items.',
    'Review source operations before automation.',
    "item.title || item.id || 'Queue item'",
    "|| 'operator queue'",
    "authorMetaChip('priority'",
    "authorMetaChip('signals'",
    "authorMetaChip('runnable'",
    "authorMetaChip('scope'",
    "item.runnable ? 'yes' : 'no'",
    "signal.label || 'attention'",
    'Review this source.',
    '<span class="source-work-scope">attention</span>',
    "(attention.severity || 'info') + ' · 来源关注'",
    'Review this source attention item.',
    "'生命周期=' +",
    "'排期=' +",
    "'操作=' +",
    "'启用=' +",
    "status + ': ' + byStatus[status]",
    "schedule.collectionStatus.join(',')",
    "statusBadge(runnable ? 'due' : 'skip'"
  ]);
});

test('source type readiness panels avoid connector-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "summaryTile('Enabled'",
    'No registered source types.',
    '<span class="source-work-scope">connector</span>',
    "sourceType.sourceType || 'unknown'",
    "'no compatible sources'",
    "'compatible=' + compatible",
    "sourceType.description || 'Connector readiness profile.'",
    "authorMetaChip('sources'",
    "authorMetaChip('enabled'",
    "authorMetaChip('checks'",
    "(check.status || 'unknown') + ' | ' + (check.key || 'check')",
    "statusBadge(sourceType.status || 'unknown'",
    "action.severity + ' | ' + action.summary",
    "return 'unknown | ' + sourceType.sourceType + ' | sources='",
    "' | enabled=' + sourceType.enabledSourceCount"
  ]);
});

test('source cockpit action plan avoids executor-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    'No cockpit actions are available.',
    "action.mode || 'manual'",
    "action.key || 'unknown'",
    "api.method && api.path ? api.method + ' ' + api.path : undefined",
    "action.destructive ? 'destructive' : undefined",
    "action.confirmationRequired ? 'confirmation' : undefined",
    "action.label || action.key || 'Action'",
    "statusBadge(action.mode || 'manual'"
  ]);
});

test('notification event detail avoids action-gate console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "summaryTile('状态', event.deliveryStatus || 'pending'",
    "summaryTile('级别', event.severity || 'unknown'",
    "summaryTile('类型', event.type || 'unknown'",
    "metric('提醒 ID', event.id || 'none')",
    "metric('创建时间', event.createdAt || 'unknown')",
    "metric('下次投递', event.nextDeliveryAt || 'none')",
    "summaryTile('状态', readiness.status || 'unknown'",
    "(gate.status || 'unknown') + ' · ' + (gate.key || 'gate')",
    "statusBadge(gate.status || 'unknown'",
    "(action.severity || 'info') + ' · ' + (action.key || 'event.action')",
    "statusBadge(action.severity || 'info'"
  ]);
});

test('source type notification result avoids event-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "metric('状态', result.status || 'unknown')",
    "metric('模式', result.dryRun ? 'dry-run' : 'execute')",
    "metric('准备度提醒', result.includeReadinessWarnings ? 'included' : 'ignored')",
    "return item.status + ' · ' + sourceType",
    "(event.severity || '未知') + reason"
  ]);
});

test('notification inbox rows avoid event-backend copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "overview.status || 'unknown'",
    "return (event.deliveryStatus || 'failed') + ' | ' + event.type + ' | ' + event.id + ' | attempts='",
    "return (event.deliveryStatus || 'delivered') + ' | ' + event.type + ' | ' + event.id + ' | reviewable'",
    "event.type || 'notification'",
    "authorMetaChip('级别', event.severity || 'unknown'",
    "authorMetaChip('投递', event.deliveryStatus || 'pending'",
    "event.deliveryStatus || 'unknown'",
    "item.type || 'unknown-type'",
    "item.staleResolution ? 'stale-resolution' : 'no-stale-resolution'",
    "item.reopensAutoResolved ? 'reopen-auto-resolved' : 'no-reopen'",
    "rules ? 'rules=' + rules : undefined",
    "rule.key + ' | ' + rule.summary",
    "'未读=' + (hotspot.openCount || 0)",
    "'失败=' + (hotspot.failedCount || 0)",
    "'到期=' + (hotspot.dueForDeliveryCount || 0)",
    "'耗尽=' + (hotspot.retryExhaustedCount || 0)",
    "hotspot.oldestUnacknowledgedAt ? '最早='"
  ]);
});

test('notification batch results avoid archive-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "return item.status + ' | ' + item.eventId",
    "item.reason ? ' | ' + item.reason",
    "metric('归档线', result.cutoffAt || 'none')",
    "metric('批次', result.batchId || 'none')",
    "return (item.status || 'candidate') + ' | ' + (item.eventId || item.id) + ' | '",
    "(item.event && item.event.sourceKey) || 'unknown'",
    "metric('下一步', result.recommendedNextAction || 'none')"
  ]);
});

test('raw page evidence avoids storage-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "metric('SHA1', result.rawPage.contentSha1)",
    "metric('URL', result.rawPage.sourceUrl)",
    "'页=' + item.page",
    "rawPage.contentSha1 ? 'sha1=' + rawPage.contentSha1 : undefined",
    "page.sourceThreadId || 'unknown-thread'",
    "page.contentSha1,",
    "meta.status ? 'HTTP ' + meta.status : ''",
    "panel('原始页证据'",
    "panel('原始页已抓取'",
    "panel('原始页回放完成'"
  ]);
});

test('source diagnostics avoid status-pipe copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "return check.key + '=' + check.status;",
    "return source.status + ' | ' + source.displayName",
    "failed ? ' | ' + failed : ''"
  ]);
});

test('llm evaluation samples avoid metric-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "result.status || 'unknown'",
    "result.id || 'sample'",
    "result.validation ? 'validation=' + result.validation.status : 'validation=not-run'",
    "'refs=' + (preview.evidenceRefCount || 0)",
    "'entities=' + (preview.entityInsightCount || 0)",
    "'opinions=' + (preview.opinionInsightCount || 0)",
    "parts.push('input=' + usage.inputTokens)",
    "parts.push('output=' + usage.outputTokens)",
    "parts.push('prompt=' + usage.prompt_tokens)",
    "parts.push('completion=' + usage.completion_tokens)",
    "parts.push('total=' + usage.total_tokens)",
    "return parts.length ? parts.join(' | ') : 'none'"
  ]);
});

test('llm readiness and preflight panels avoid provider-console copy', function () {
  const app = readProjectFile('src/presentation/web/app.js');

  assertAbsent(app, [
    "summaryTile('状态', profile.status || 'unknown'",
    "summaryTile('模式', profile.mode || 'configuration')",
    "summaryTile('提供方', profile.provider || 'unknown'",
    "readiness.realProviderCandidate ? 'yes' : 'no'",
    "readiness.preflightPassed ? 'ok' : 'not run'",
    "readiness.evaluationPassed ? 'ok' : 'not run'",
    "metric('API key', configuration.apiKeyConfigured ? 'configured' : 'not configured')",
    "metric('Base URL', configuration.baseUrlConfigured ? 'configured' : 'default')",
    "return check.status + ' | ' + check.area + ' | ' + check.key + ' | ' + check.summary;",
    "summaryTile('状态', report.status || 'unknown'",
    "summaryTile('验证', validation.status || 'not-run'",
    "summaryTile('Schema', report.schemaVersion || 'unknown'",
    "metric('Trace', report.traceId || 'none')",
    "metric('输出', preview.summary || 'none')",
    "return check.status + ' | ' + check.key + ' | ' + check.summary;"
  ]);
});
