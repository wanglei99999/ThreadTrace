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
