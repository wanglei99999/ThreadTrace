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
    '>Run check again</button>'
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
