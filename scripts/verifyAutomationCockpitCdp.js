'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_APP_URL = 'http://127.0.0.1:3017/#operations';
const DEFAULT_CDP_PORT = 9223;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const appUrl = options.url || process.env.THREADTRACE_WEB_URL || DEFAULT_APP_URL;
  const cdpPort = Number(options.cdpPort || process.env.THREADTRACE_CDP_PORT || DEFAULT_CDP_PORT);
  const outputDir = path.resolve(ROOT_DIR, options.outputDir || process.env.THREADTRACE_WEB_VERIFY_DIR || '.tmp');
  await fs.mkdir(outputDir, { recursive: true });

  await assertHttpOk(appUrl.replace(/#.*$/, '/health'));

  const browser = await ensureBrowser(cdpPort, outputDir, options.chromePath || process.env.CHROME_PATH);
  try {
    await closeExistingThreadTraceTargets(cdpPort, appUrl);
    const target = await createTarget(cdpPort, appUrl);
    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    try {
      await client.send('Page.enable');
      await client.send('Runtime.enable');

      const desktop = await verifyViewport(client, {
        label: 'desktop',
        url: appUrl,
        width: 1440,
        height: 1100,
        mobile: false,
        verifyLoading: true,
        runPreview: true,
        runAction: true,
        screenshotPath: path.join(outputDir, 'automation-cockpit-cdp-desktop.png')
      });
      const mobile = await verifyViewport(client, {
        label: 'mobile',
        url: appUrl,
        width: 390,
        height: 844,
        mobile: true,
        runPreview: true,
        screenshotPath: path.join(outputDir, 'automation-cockpit-cdp-mobile.png')
      });

      const report = {
        ok: true,
        appUrl,
        cdpPort,
        desktop,
        mobile
      };
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } finally {
      await client.close();
      await closeTarget(cdpPort, target.id).catch(function () {});
    }
  } finally {
    if (browser.launched && browser.process) {
      browser.process.kill();
    }
  }
}

async function closeExistingThreadTraceTargets(port, appUrl) {
  const parsedAppUrl = new URL(appUrl);
  const result = await httpRequest('GET', 'http://127.0.0.1:' + port + '/json/list');
  if (result.statusCode < 200 || result.statusCode >= 300) return;
  let targets;
  try {
    targets = JSON.parse(result.body);
  } catch (error) {
    return;
  }
  await Promise.all((targets || []).filter(function (target) {
    if (!target || !target.id || !target.url) return false;
    const parsedTargetUrl = new URL(target.url);
    return parsedTargetUrl.origin === parsedAppUrl.origin && parsedTargetUrl.pathname === parsedAppUrl.pathname;
  }).map(function (target) {
    return closeTarget(port, target.id).catch(function () {});
  }));
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--url') options.url = args[++index];
    else if (arg === '--cdp-port') options.cdpPort = args[++index];
    else if (arg === '--chrome-path') options.chromePath = args[++index];
    else if (arg === '--output-dir') options.outputDir = args[++index];
  }
  return options;
}

async function assertHttpOk(url) {
  const result = await httpRequest('GET', url);
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error('ThreadTrace server is not healthy at ' + url + ' (HTTP ' + result.statusCode + ')');
  }
}

async function ensureBrowser(port, outputDir, chromePath) {
  if (await canReachCdp(port)) return { launched: false };
  const executable = chromePath || findChromeExecutable();
  if (!executable) {
    throw new Error('Chrome executable was not found. Set CHROME_PATH or start Chrome with --remote-debugging-port=' + port + '.');
  }
  const profileDir = path.join(outputDir, 'chrome-cdp-threadtrace-script');
  const child = spawn(executable, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profileDir,
    'about:blank'
  ], {
    stdio: 'ignore',
    detached: false
  });
  await waitFor(async function () {
    return canReachCdp(port);
  }, 10000, 'Timed out waiting for Chrome DevTools on port ' + port + '.');
  return { launched: true, process: child };
}

async function canReachCdp(port) {
  try {
    const result = await httpRequest('GET', 'http://127.0.0.1:' + port + '/json/version');
    return result.statusCode >= 200 && result.statusCode < 300;
  } catch (error) {
    return false;
  }
}

function findChromeExecutable() {
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/microsoft-edge'
        ];
  return candidates.find(function (candidate) {
    return require('fs').existsSync(candidate);
  });
}

async function createTarget(port, url) {
  const result = await httpRequest('PUT', 'http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url));
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error('Could not create Chrome target (HTTP ' + result.statusCode + '): ' + result.body);
  }
  return JSON.parse(result.body);
}

async function closeTarget(port, targetId) {
  if (!targetId) return;
  await httpRequest('GET', 'http://127.0.0.1:' + port + '/json/close/' + encodeURIComponent(targetId));
}

async function verifyViewport(client, options) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
    mobile: options.mobile
  });
  await client.send('Page.navigate', { url: options.url });
  await waitForCockpit(client);
  const historyRestore = options.verifyLoading ? await verifyAutomationActionHistoryRestore(client, options.url) : undefined;
  const refreshLoadingState = options.verifyLoading ? await verifyAutomationRefreshLoadingState(client) : undefined;
  if (options.verifyLoading) await waitForCockpit(client);
  const autoRefreshToggle = await verifyAutomationAutoRefreshToggle(client);
  const refreshDedupe = await verifyAutomationRefreshDedupe(client);
  await waitForCockpit(client);
  const freshnessRefresh = await verifyAutomationFreshnessRefreshAction(client);
  await waitForCockpit(client);
  const loadingState = options.verifyLoading ? await verifyAutomationLoadingState(client) : undefined;
  if (options.verifyLoading) await waitForCockpit(client);
  const runbookPreview = options.runPreview ? await verifyAutomationRunbookPreview(client) : undefined;
  if (options.runPreview || options.runAction) await waitForCockpit(client);
  const actionResult = options.runAction ? await verifyAutomationActionResult(client) : undefined;
  const pressureAction = await verifyAutomationPressureAction(client);
  await waitForScrollIdle(client);
  const attentionFocus = await verifyAutomationAttentionFocus(client);
  const attentionAction = await verifyAutomationAttentionAction(client);
  if (attentionAction && !attentionAction.skipped) await waitForCockpit(client);
  const audit = await evaluateByValue(client, viewportAuditExpression());
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true
  });
  await fs.writeFile(options.screenshotPath, Buffer.from(screenshot.data, 'base64'));
  const stats = await fs.stat(options.screenshotPath);
  const png = await readPngInfo(options.screenshotPath);
  assertAudit(options.label, audit);
  assertRunbookPreview(options.label, runbookPreview, options);
  assertPressureAction(options.label, pressureAction, audit);
  assertAttentionFocus(options.label, attentionFocus, audit);
  assertAttentionAction(options.label, attentionAction, audit);
  assertScreenshot(options.label, png, stats, options, audit);
  assertAutomationAutoRefreshToggle(options.label, autoRefreshToggle);
  assertAutomationRefreshDedupe(options.label, refreshDedupe);
  return Object.assign({}, audit, {
    historyRestore,
    refreshLoadingState,
    autoRefreshToggle,
    refreshDedupe,
    freshnessRefresh,
    loadingState,
    runbookPreview,
    actionResult,
    pressureAction,
    attentionFocus,
    attentionAction,
    screenshotPath: options.screenshotPath,
    screenshotBytes: stats.size,
    screenshotWidth: png.width,
    screenshotHeight: png.height
  });
}

function assertPressureAction(label, pressureAction, audit) {
  if (!audit || audit.pressureActionButtonCount <= 0) return;
  const failures = [];
  if (!pressureAction) failures.push('missing pressure action report');
  else {
    ['outbox', 'ack', 'dispatch', 'audits', 'gate', 'executions', 'executor'].forEach(function (key) {
      const item = pressureAction[key];
      if (!item) failures.push('missing pressure action: ' + key);
      else {
        if (item.skipped) failures.push(key + ' pressure action skipped: ' + item.reason);
        if (!item.clicked) failures.push(key + ' pressure action button was not clicked');
        if (!item.hasResult) failures.push(key + ' pressure action did not render an action result');
        if (!item.hasPanel) failures.push(key + ' pressure action did not render its detail panel');
        if (!item.visible) failures.push(key + ' pressure action result is not visible after click');
        if (key === 'dispatch' && item.dispatchPostCount !== 0) failures.push('dispatch preview issued ' + item.dispatchPostCount + ' dispatch POST request(s)');
        if (key === 'dispatch' && item.overviewGetCount <= 0) failures.push('dispatch preview did not read notification overview');
      }
    });
  }
  if (failures.length > 0) {
    throw new Error(label + ' Automation Cockpit pressure action verification failed: ' + failures.join('; '));
  }
}

function assertAutomationAutoRefreshToggle(label, autoRefreshToggle) {
  if (!autoRefreshToggle || autoRefreshToggle.skipped) {
    throw new Error(label + ' Automation Cockpit auto-refresh toggle verification was skipped.');
  }
  const enabled = autoRefreshToggle.enabled || {};
  const restored = autoRefreshToggle.restored || {};
  const failures = [];
  if (enabled.ariaPressed !== 'true') failures.push('aria-pressed did not become true');
  if (!enabled.ariaLabel || !enabled.ariaLabel.startsWith('自动刷新开，每 60 秒更新。')) failures.push('aria-label did not become On');
  if (enabled.dataEnabled !== 'true') failures.push('data-enabled did not become true');
  if (!enabled.activeClass) failures.push('active class was not applied');
  if (enabled.stored !== 'true') failures.push('localStorage was not set true');
  if (restored.ariaPressed !== 'false') failures.push('aria-pressed did not restore false');
  if (!restored.ariaLabel || !restored.ariaLabel.startsWith('自动刷新关，每 60 秒更新。')) failures.push('aria-label did not restore Off');
  if (restored.dataEnabled !== 'false') failures.push('data-enabled did not restore false');
  if (restored.activeClass) failures.push('active class remained after restore');
  if (restored.stored !== 'false') failures.push('localStorage was not restored false');
  if (failures.length > 0) {
    throw new Error(label + ' Automation Cockpit auto-refresh toggle failed: ' + failures.join('; '));
  }
}

function assertAutomationRefreshDedupe(label, refreshDedupe) {
  if (!refreshDedupe || refreshDedupe.skipped) {
    throw new Error(label + ' Automation Cockpit refresh dedupe verification was skipped.');
  }
  const failures = [];
  if (!refreshDedupe.second || refreshDedupe.second.skipped !== true) failures.push('second refresh did not skip');
  if (!refreshDedupe.second || refreshDedupe.second.reason !== 'automation-readiness-refresh-in-flight') failures.push('second refresh returned the wrong reason');
  if (refreshDedupe.fetchCount !== 1) failures.push('expected one cockpit fetch, saw ' + refreshDedupe.fetchCount);
  if (refreshDedupe.busyAfterStart !== 'true') failures.push('cockpit was not busy during delayed refresh');
  if (refreshDedupe.busyAfterSettle !== 'false') failures.push('cockpit did not settle after delayed refresh');
  if (!refreshDedupe.first || refreshDedupe.first.skipped !== false) failures.push('first refresh did not complete');
  if (failures.length > 0) {
    throw new Error(label + ' Automation Cockpit refresh dedupe failed: ' + failures.join('; '));
  }
}

async function verifyAutomationActionHistoryRestore(client, url) {
  const recordedAt = new Date().toISOString();
  await evaluateByValue(client, [
    '(() => {',
    '  const item = {',
    "    action: 'Restored history',",
    "    status: 'ok',",
    "    mode: 'restore-check',",
    "    changed: '无变化',",
    "    subject: '自动运行概览',",
    "    next: '确认本地动作历史会在刷新后保留。',",
    "    recordedAt: '" + recordedAt + "'",
    '  };',
    "  window.localStorage.setItem('threadtrace.automationCockpit.actionHistory', JSON.stringify([item]));",
    '  return true;',
    '})()'
  ].join('\n'));
  await client.send('Page.reload', { ignoreCache: true });
  await waitForCockpit(client);
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationActionResult');",
      "  const text = result ? result.innerText : '';",
      "  return Boolean(result && text.includes('动作历史') && text.includes('Restored history'));",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for restored Automation Cockpit action history.');
  const restoreReport = await evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const text = result ? result.innerText : '';",
    "  const rows = result ? result.querySelectorAll('.automation-action-history-row') : [];",
    '  return {',
    "    hasHistory: text.includes('动作历史'),",
    "    hasSeed: text.includes('Restored history'),",
    '    rowCount: rows.length',
    '  };',
    '})()'
  ].join('\n'));
  await waitForCockpit(client);
  return restoreReport;
}

function assertRunbookPreview(label, runbookPreview, options) {
  if (!options.runPreview) return;
  const failures = [];
  if (!runbookPreview) failures.push('missing runbook preview report');
  else {
    if (runbookPreview.skipped) failures.push('schedule preview skipped: ' + runbookPreview.reason);
    if (!runbookPreview.hasSummary) failures.push('schedule preview is missing last action summary');
    if (!runbookPreview.hasResult) failures.push('schedule preview result did not render');
    if (!runbookPreview.dryRun) failures.push('schedule preview did not stay in dry-run mode');
    if (!runbookPreview.visible) failures.push('schedule preview result is not visible after click');
  }
  if (failures.length > 0) {
    throw new Error(label + ' Automation Cockpit runbook preview verification failed: ' + failures.join('; '));
  }
}

function assertAttentionFocus(label, attentionFocus, audit) {
  if (!audit || audit.attentionQueueRowCount <= 0) return;
  const failures = [];
  if (!attentionFocus) failures.push('missing attention focus report');
  else {
    if (attentionFocus.skipped) failures.push('attention focus skipped: ' + attentionFocus.reason);
    if (!attentionFocus.clicked) failures.push('attention focus button was not clicked');
    if (!attentionFocus.targetPanel) failures.push('attention focus target panel is missing');
    if (!attentionFocus.visible) failures.push('attention focus target panel is not visible');
  }
  if (failures.length > 0) {
    throw new Error(label + ' Automation Cockpit attention focus verification failed: ' + failures.join('; '));
  }
}

function assertAttentionAction(label, attentionAction, audit) {
  if (!audit || audit.attentionQueueRowCount <= 0 || audit.attentionActionButtonCount <= 0) return;
  const failures = [];
  if (!attentionAction) failures.push('missing attention action report');
  else {
    if (attentionAction.skipped && audit.runbookScheduleButtonCount > 0) failures.push('attention action skipped: ' + attentionAction.reason);
    if (!attentionAction.skipped && !attentionAction.clicked) failures.push('attention action button was not clicked');
    if (!attentionAction.skipped && !attentionAction.hasResult) failures.push('attention action did not render a result');
    if (!attentionAction.skipped && !attentionAction.dryRun) failures.push('attention action did not stay in dry-run mode');
    if (!attentionAction.skipped && !attentionAction.visible) failures.push('attention action result is not visible after click');
  }
  if (failures.length > 0) {
    throw new Error(label + ' Automation Cockpit attention action verification failed: ' + failures.join('; '));
  }
}

async function waitForCockpit(client) {
  const ready = await evaluateByValue(client, [
    'new Promise((resolve) => {',
    '  const started = Date.now();',
    '  const tick = () => {',
    "    const hero = document.querySelector('.automation-cockpit-hero');",
    "    const pressure = document.querySelector('.automation-pressure-panel');",
    '    if ((hero && pressure) || Date.now() - started > 30000) resolve(Boolean(hero && pressure));',
    '    else setTimeout(tick, 250);',
    '  };',
    '  tick();',
    '})'
  ].join('\n'), true);
  if (!ready) {
    const diagnostic = await automationClickDiagnostic(client);
    throw new Error('Timed out waiting for Automation Cockpit to render: ' + JSON.stringify(diagnostic));
  }
}

async function waitForScrollIdle(client) {
  await evaluateByValue(client, [
    'new Promise((resolve) => {',
    '  let lastX = window.scrollX;',
    '  let lastY = window.scrollY;',
    '  let stableTicks = 0;',
    '  const tick = () => {',
    '    const same = window.scrollX === lastX && window.scrollY === lastY;',
    '    stableTicks = same ? stableTicks + 1 : 0;',
    '    lastX = window.scrollX;',
    '    lastY = window.scrollY;',
    '    if (stableTicks >= 4) resolve(true);',
    '    else setTimeout(tick, 100);',
    '  };',
    '  setTimeout(tick, 100);',
    '})'
  ].join('\n'), true);
}

function viewportAuditExpression() {
  return [
    '(() => {',
    '  const doc = document.documentElement;',
    "  const hero = document.querySelector('.automation-cockpit-hero');",
    "  const attention = document.querySelector('.automation-attention-panel');",
    "  const pressure = document.querySelector('.automation-pressure-panel');",
    "  const action = document.querySelector('#automationActionResult');",
    "  const status = document.querySelector('#systemStatus');",
    "  const mojibakeMarkers = ['\\u9352', '\\u55d8', '\\u93c3', '\\u95c3', '\\u7487', '\\u93b7', '\\u9477'];",
    "  const bodyText = document.body.innerText;",
    "  const headlineText = hero ? hero.querySelector('h3')?.textContent || '' : '';",
    '  const heroRect = hero ? hero.getBoundingClientRect() : null;',
    '  const statusRect = status ? status.getBoundingClientRect() : null;',
    '  return {',
    '    hash: location.hash,',
    "    title: document.querySelector('#viewTitle')?.textContent || '',",
    '    hasHero: Boolean(hero),',
    '    hasAttentionQueue: Boolean(attention),',
    '    hasPressure: Boolean(pressure),',
    '    hasActionResult: Boolean(action),',
    "    cockpitBusy: document.querySelector('#automationReadinessResult')?.getAttribute('aria-busy') || 'unset',",
    "    actionBusy: document.querySelector('#automationActionResult')?.getAttribute('aria-busy') || 'unset',",
    "    buttons: Array.from(document.querySelectorAll('.automation-cockpit-hero button')).map((button) => button.textContent.trim()),",
    '    clientWidth: doc.clientWidth,',
    '    scrollWidth: doc.scrollWidth,',
    '    overflowX: doc.scrollWidth > doc.clientWidth + 1,',
    '    heroTop: heroRect ? Math.round(heroRect.top) : null,',
    '    heroHeight: heroRect ? Math.round(heroRect.height) : null,',
    '    statusTop: statusRect ? Math.round(statusRect.top) : null,',
    '    headlineText,',
    "    headlineHasMojibake: mojibakeMarkers.some((marker) => headlineText.includes(marker)),",
    "    bodyTextIncludesOutbox: bodyText.includes('提醒箱'),",
    "    bodyTextIncludesAudit: bodyText.includes('复核审计'),",
    "    bodyTextIncludesRunbook: bodyText.includes('操作清单'),",
    "    bodyTextIncludesAttentionQueue: bodyText.includes('待处理路径'),",
    "    bodyTextIncludesActionable: bodyText.includes('可处理'),",
    "    bodyTextIncludesFreshness: bodyText.includes('快照新鲜度'),",
    "    bodyTextHasMojibake: mojibakeMarkers.some((marker) => bodyText.includes(marker)),",
    "    runbookCommandCount: document.querySelectorAll('.automation-runbook-command-row').length,",
    "    attentionQueueRowCount: document.querySelectorAll('.automation-attention-row').length,",
    "    attentionActionButtonCount: document.querySelectorAll('.automation-attention-panel button[data-action=\"run-automation-attention-action\"]').length,",
    "    pressureActionButtonCount: document.querySelectorAll('.automation-pressure-panel button[data-action=\"run-automation-pressure-action\"]').length,",
    "    freshnessActionButtonCount: document.querySelectorAll('.automation-freshness-panel button[data-action=\"refresh-automation-readiness\"]').length,",
    "    autoRefreshToggleCount: document.querySelectorAll('.automation-cockpit-hero button[data-action=\"toggle-automation-auto-refresh\"]').length,",
    "    runbookCopyButtonCount: document.querySelectorAll('.automation-runbook-panel button[data-action=\"copy-lifecycle-command\"]').length,",
    "    runbookScheduleCommandCount: Array.from(document.querySelectorAll('.automation-runbook-command-row code')).filter((code) => code.textContent.includes('configure-source-schedule')).length,",
    "    runbookScheduleButtonCount: document.querySelectorAll('.automation-runbook-panel button[data-action=\"set-source-schedule\"]').length",
    '  };',
    '})()'
  ].join('\n');
}

async function verifyAutomationActionResult(client) {
  const clicked = await evaluateByValue(client, [
    '(() => {',
    "  const buttons = Array.from(document.querySelectorAll('.automation-cockpit-hero button'));",
    "  const button = buttons.find((candidate) => candidate.textContent.trim() === '助手状态');",
    '  if (!button) return false;',
    '  button.click();',
    '  return true;',
    '})()'
  ].join('\n'));
  if (!clicked) {
    throw new Error('Could not click Automation Cockpit assistant status button.');
  }
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationActionResult');",
      "  const text = result ? result.innerText : '';",
      "  const commandRows = result ? result.querySelectorAll('.automation-action-command-row .lifecycle-command-row') : [];",
      "  const copyButtons = result ? result.querySelectorAll('button[data-action=\"copy-lifecycle-command\"],button[data-action=\"copy-command\"]') : [];",
      "  const historyRows = result ? result.querySelectorAll('.automation-action-history-row') : [];",
      "  return Boolean(result && text.includes('最近动作') && text.includes('动作历史') && text.includes('助手状态') && commandRows.length > 0 && copyButtons.length > 0 && historyRows.length > 0);",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for Automation Cockpit action commands.');
  const report = await evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const text = result ? result.innerText : '';",
    "  const rows = Array.from(result.querySelectorAll('.automation-action-command-row'));",
    "  const commands = Array.from(result.querySelectorAll('.lifecycle-command-row code')).map((item) => item.textContent.trim());",
    "  const historyRows = Array.from(result.querySelectorAll('.automation-action-history-row'));",
    '  let storedHistory = [];',
    "  try { storedHistory = JSON.parse(window.localStorage.getItem('threadtrace.automationCockpit.actionHistory') || '[]'); } catch (error) {}",
    '  return {',
    '    hasResult: Boolean(result),',
    "    hasSummary: text.includes('最近动作'),",
    "    hasHistory: text.includes('动作历史'),",
    "    hasActionLabel: text.includes('助手状态'),",
    '    rowCount: rows.length,',
    '    commandCount: commands.length,',
    '    commands: commands.slice(0, 5),',
    '    historyCount: historyRows.length,',
    '    storedHistoryCount: Array.isArray(storedHistory) ? storedHistory.length : 0,',
    "    hasClearButton: Boolean(result.querySelector('button[data-action=\"clear-automation-action-history\"]')),",
    "    hasCopyButtons: Boolean(result.querySelector('button[data-action=\"copy-lifecycle-command\"],button[data-action=\"copy-command\"]'))",
    '  };',
    '})()'
  ].join('\n'));
  report.clearHistory = await verifyAutomationActionHistoryClear(client);
  if (!report.hasHistory || report.historyCount <= 0 || report.storedHistoryCount <= 0) {
    throw new Error('Automation Cockpit action history did not record the assistant status action.');
  }
  if (!report.clearHistory.clicked || !report.clearHistory.removed || report.clearHistory.storedHistoryCount !== 0) {
    throw new Error('Automation Cockpit action history clear did not reset the local history.');
  }
  return report;
}

async function verifyAutomationActionHistoryClear(client) {
  const clicked = await evaluateByValue(client, [
    '(() => {',
    "  const button = document.querySelector('#automationActionResult button[data-action=\"clear-automation-action-history\"]');",
    '  if (!button) return false;',
    '  button.click();',
    '  return true;',
    '})()'
  ].join('\n'));
  if (!clicked) return { clicked: false, removed: false, storedHistoryCount: null };
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  return !document.querySelector('#automationActionResult .automation-action-history-panel');",
      '})()'
    ].join('\n'));
  }, 10000, 'Timed out waiting for Automation Cockpit action history clear.');
  return evaluateByValue(client, [
    '(() => {',
    '  let storedHistory = [];',
    "  try { storedHistory = JSON.parse(window.localStorage.getItem('threadtrace.automationCockpit.actionHistory') || '[]'); } catch (error) {}",
    '  return {',
    '    clicked: true,',
    "    removed: !document.querySelector('#automationActionResult .automation-action-history-panel'),",
    '    storedHistoryCount: Array.isArray(storedHistory) ? storedHistory.length : 0',
    '  };',
    '})()'
  ].join('\n'));
}

async function verifyAutomationLoadingState(client) {
  await evaluateByValue(client, [
    '(() => {',
    '  const originalFetch = window.fetch.bind(window);',
    '  let releaseFetch;',
    '  const gate = new Promise((resolve) => { releaseFetch = resolve; });',
    '  window.__threadtraceReleaseDelayedFetch = () => {',
    '    releaseFetch();',
    '    window.fetch = originalFetch;',
    '    delete window.__threadtraceReleaseDelayedFetch;',
    '  };',
    '  window.fetch = async function (input, init) {',
    "    const url = typeof input === 'string' ? input : input && input.url || '';",
    "    if (!window.__threadtraceDelayedPreflightFetchUsed && url.includes('/api/llm/preflight')) {",
    '      window.__threadtraceDelayedPreflightFetchUsed = true;',
    '      await gate;',
    '    }',
    '    return originalFetch(input, init);',
    '  };',
    '  return true;',
    '})()'
  ].join('\n'));
  const clicked = await evaluateByValue(client, [
    '(() => {',
    "  const buttons = Array.from(document.querySelectorAll('.automation-cockpit-hero button'));",
    "  const button = buttons.find((candidate) => candidate.textContent.trim() === '助手预检');",
    '  if (!button) return false;',
    '  button.click();',
    '  return true;',
    '})()'
  ].join('\n'));
  if (!clicked) {
    throw new Error('Could not click Automation Cockpit assistant preflight button.');
  }
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationActionResult');",
      "  const text = result ? result.innerText : '';",
      "  return Boolean(result && result.getAttribute('aria-busy') === 'true' && text.includes('正在进行助手预检...'));",
      '})()'
    ].join('\n'));
  }, 10000, 'Timed out waiting for Automation Cockpit loading state.');
  const loading = await evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const text = result ? result.innerText : '';",
    '  return {',
    "    busy: result ? result.getAttribute('aria-busy') : 'missing',",
    "    hasLoadingMessage: text.includes('正在进行助手预检...'),",
    "    hasMojibake: text.includes('\\u9352') || text.includes('\\u55d8'),",
    "    preview: text.slice(0, 120)",
    '  };',
    '})()'
  ].join('\n'));
  if (!loading.hasLoadingMessage || loading.hasMojibake || loading.busy !== 'true') {
    throw new Error('Automation Cockpit loading verification failed: ' + JSON.stringify(loading));
  }
  await evaluateByValue(client, [
    '(() => {',
    '  if (window.__threadtraceReleaseDelayedFetch) window.__threadtraceReleaseDelayedFetch();',
    '  return true;',
    '})()'
  ].join('\n'));
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationActionResult');",
      "  return Boolean(result && result.getAttribute('aria-busy') === 'false');",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for delayed Automation Cockpit action to settle.');
  return loading;
}

async function verifyAutomationRefreshLoadingState(client) {
  await evaluateByValue(client, [
    '(() => {',
    '  const originalFetch = window.fetch.bind(window);',
    '  let releaseFetch;',
    '  const gate = new Promise((resolve) => { releaseFetch = resolve; });',
    '  window.__threadtraceReleaseDelayedCockpitFetch = () => {',
    '    releaseFetch();',
    '    window.fetch = originalFetch;',
    '    delete window.__threadtraceReleaseDelayedCockpitFetch;',
    '  };',
    '  window.fetch = async function (input, init) {',
    "    const url = typeof input === 'string' ? input : input && input.url || '';",
    "    if (!window.__threadtraceDelayedCockpitFetchUsed && url.includes('/api/operations/automation-cockpit')) {",
    '      window.__threadtraceDelayedCockpitFetchUsed = true;',
    '      await gate;',
    '    }',
    '    return originalFetch(input, init);',
    '  };',
    '  return true;',
    '})()'
  ].join('\n'));
  const clicked = await evaluateByValue(client, [
    '(() => {',
    "  const button = document.querySelector('.automation-cockpit-hero button[data-action=\"refresh-automation-readiness\"]');",
    '  if (!button) return false;',
    '  button.click();',
    '  return true;',
    '})()'
  ].join('\n'));
  if (!clicked) {
    const diagnostic = await automationClickDiagnostic(client);
    throw new Error('Could not click Automation Cockpit Refresh button: ' + JSON.stringify(diagnostic));
  }
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationReadinessResult');",
      "  const text = result ? result.innerText : '';",
      "  return Boolean(result && result.getAttribute('aria-busy') === 'true' && text.includes('正在刷新自动运行概览...'));",
      '})()'
    ].join('\n'));
  }, 10000, 'Timed out waiting for Automation Cockpit refresh loading state.');
  const loading = await evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationReadinessResult');",
    "  const text = result ? result.innerText : '';",
    '  return {',
    "    busy: result ? result.getAttribute('aria-busy') : 'missing',",
    "    hasLoadingMessage: text.includes('正在刷新自动运行概览...'),",
    "    hasMojibake: text.includes('\\u9352') || text.includes('\\u55d8'),",
    "    preview: text.slice(0, 120)",
    '  };',
    '})()'
  ].join('\n'));
  if (!loading.hasLoadingMessage || loading.hasMojibake || loading.busy !== 'true') {
    throw new Error('Automation Cockpit refresh loading verification failed: ' + JSON.stringify(loading));
  }
  await evaluateByValue(client, [
    '(() => {',
    '  if (window.__threadtraceReleaseDelayedCockpitFetch) window.__threadtraceReleaseDelayedCockpitFetch();',
    '  return true;',
    '})()'
  ].join('\n'));
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationReadinessResult');",
      "  return Boolean(result && result.getAttribute('aria-busy') === 'false');",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for delayed Automation Cockpit refresh to settle.');
  return loading;
}

async function verifyAutomationRefreshDedupe(client) {
  const setup = await evaluateByValue(client, [
    '(() => {',
    "  if (typeof window.loadAutomationReadiness !== 'function') return { ready: false, reason: 'loadAutomationReadiness is not global' };",
    '  const originalFetch = window.fetch.bind(window);',
    '  let releaseFetch;',
    '  const gate = new Promise((resolve) => { releaseFetch = resolve; });',
    '  window.__threadtraceDedupeFetchCount = 0;',
    '  window.__threadtraceReleaseDedupeFetch = () => {',
    '    releaseFetch();',
    '    window.fetch = originalFetch;',
    '    delete window.__threadtraceReleaseDedupeFetch;',
    '  };',
    '  window.fetch = async function (input, init) {',
    "    const url = typeof input === 'string' ? input : input && input.url || '';",
    "    if (url.includes('/api/operations/automation-cockpit')) {",
    '      window.__threadtraceDedupeFetchCount += 1;',
    '      if (window.__threadtraceDedupeFetchCount === 1) await gate;',
    '    }',
    '    return originalFetch(input, init);',
    '  };',
    '  return { ready: true };',
    '})()'
  ].join('\n'));
  if (!setup || !setup.ready) return { skipped: true, reason: setup && setup.reason || 'dedupe setup failed' };
  await evaluateByValue(client, [
    '(() => {',
    "  window.__threadtraceFirstRefreshPromise = window.loadAutomationReadiness({ source: 'manual-dedupe-test' });",
    '  return true;',
    '})()'
  ].join('\n'));
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationReadinessResult');",
      "  return Boolean(result && result.getAttribute('aria-busy') === 'true');",
      '})()'
    ].join('\n'));
  }, 10000, 'Timed out waiting for delayed Automation Cockpit refresh to become busy.');
  const second = await evaluateByValue(client, "window.loadAutomationReadiness({ source: 'auto' })", true);
  const busyAfterStart = await evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationReadinessResult');",
    "  return result ? result.getAttribute('aria-busy') : 'missing';",
    '})()'
  ].join('\n'));
  await evaluateByValue(client, [
    '(() => {',
    '  if (window.__threadtraceReleaseDedupeFetch) window.__threadtraceReleaseDedupeFetch();',
    '  return true;',
    '})()'
  ].join('\n'));
  const first = await evaluateByValue(client, 'window.__threadtraceFirstRefreshPromise', true);
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationReadinessResult');",
      "  return Boolean(result && result.getAttribute('aria-busy') === 'false');",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for delayed Automation Cockpit refresh to settle after dedupe test.');
  const finished = await evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationReadinessResult');",
    '  return {',
    '    fetchCount: window.__threadtraceDedupeFetchCount || 0,',
    "    busyAfterSettle: result ? result.getAttribute('aria-busy') : 'missing'",
    '  };',
    '})()'
  ].join('\n'));
  await evaluateByValue(client, [
    '(() => {',
    '  delete window.__threadtraceFirstRefreshPromise;',
    '  delete window.__threadtraceDedupeFetchCount;',
    '  return true;',
    '})()'
  ].join('\n'));
  return {
    skipped: false,
    first,
    second,
    fetchCount: finished.fetchCount,
    busyAfterStart,
    busyAfterSettle: finished.busyAfterSettle
  };
}

async function verifyAutomationAutoRefreshToggle(client) {
  await evaluateByValue(client, [
    '(() => {',
    "  try { window.localStorage.setItem('threadtrace.automationCockpit.autoRefresh', 'false'); } catch (error) {}",
    "  const button = document.querySelector('.automation-cockpit-hero button[data-action=\"toggle-automation-auto-refresh\"]');",
    "  if (button && button.getAttribute('aria-pressed') === 'true') button.click();",
    '  return true;',
    '})()'
  ].join('\n'));
  const initial = await readAutomationAutoRefreshToggleState(client);
  if (!initial.exists) return { skipped: true, reason: 'auto refresh toggle missing' };
  await evaluateByValue(client, [
    '(() => {',
    "  const button = document.querySelector('.automation-cockpit-hero button[data-action=\"toggle-automation-auto-refresh\"]');",
    '  if (button) button.click();',
    '  return true;',
    '})()'
  ].join('\n'));
  const enabled = await readAutomationAutoRefreshToggleState(client);
  await evaluateByValue(client, [
    '(() => {',
    "  const button = document.querySelector('.automation-cockpit-hero button[data-action=\"toggle-automation-auto-refresh\"]');",
    "  if (button && button.getAttribute('aria-pressed') === 'true') button.click();",
    '  return true;',
    '})()'
  ].join('\n'));
  const restored = await readAutomationAutoRefreshToggleState(client);
  return {
    skipped: false,
    initial,
    enabled,
    restored
  };
}

async function readAutomationAutoRefreshToggleState(client) {
  return evaluateByValue(client, [
    '(() => {',
    "  const button = document.querySelector('.automation-cockpit-hero button[data-action=\"toggle-automation-auto-refresh\"]');",
    "  let stored = 'unavailable';",
    "  try { stored = window.localStorage.getItem('threadtrace.automationCockpit.autoRefresh'); } catch (error) {}",
    '  return {',
    '    exists: Boolean(button),',
    "    ariaPressed: button ? button.getAttribute('aria-pressed') : 'missing',",
    "    ariaLabel: button ? button.getAttribute('aria-label') : 'missing',",
    "    dataEnabled: button ? button.dataset.enabled : 'missing',",
    "    activeClass: button ? button.classList.contains('is-active') : false,",
    "    text: button ? button.textContent.trim() : '',",
    '    stored',
    '  };',
    '})()'
  ].join('\n'));
}

async function verifyAutomationFreshnessRefreshAction(client) {
  await evaluateByValue(client, [
    '(() => {',
    '  const originalFetch = window.fetch.bind(window);',
    '  let releaseFetch;',
    '  const gate = new Promise((resolve) => { releaseFetch = resolve; });',
    '  window.__threadtraceReleaseDelayedFreshnessFetch = () => {',
    '    releaseFetch();',
    '    window.fetch = originalFetch;',
    '    delete window.__threadtraceReleaseDelayedFreshnessFetch;',
    '  };',
    '  window.fetch = async function (input, init) {',
    "    const url = typeof input === 'string' ? input : input && input.url || '';",
    "    if (!window.__threadtraceDelayedFreshnessFetchUsed && url.includes('/api/operations/automation-cockpit')) {",
    '      window.__threadtraceDelayedFreshnessFetchUsed = true;',
    '      await gate;',
    '    }',
    '    return originalFetch(input, init);',
    '  };',
    '  return true;',
    '})()'
  ].join('\n'));
  const clicked = await evaluateByValue(client, [
    '(() => {',
    "  const button = document.querySelector('.automation-freshness-panel button[data-action=\"refresh-automation-readiness\"]');",
    '  if (!button) return { clicked: false, skipped: true, reason: "no freshness refresh action" };',
    '  button.click();',
    '  return { clicked: true, skipped: false, label: button.textContent.trim() };',
    '})()'
  ].join('\n'));
  if (!clicked || clicked.skipped) return clicked;
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationReadinessResult');",
      "  const text = result ? result.innerText : '';",
      "  return Boolean(result && result.getAttribute('aria-busy') === 'true' && text.includes('正在刷新自动运行概览...'));",
      '})()'
    ].join('\n'));
  }, 10000, 'Timed out waiting for Automation Cockpit freshness refresh loading state.');
  const loading = await evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationReadinessResult');",
    "  const text = result ? result.innerText : '';",
    '  return {',
    '    clicked: true,',
    '    skipped: false,',
    '    label: ' + JSON.stringify(clicked.label) + ',',
    "    busy: result ? result.getAttribute('aria-busy') : 'missing',",
    "    hasLoadingMessage: text.includes('正在刷新自动运行概览...'),",
    "    hasMojibake: text.includes('\\u9352') || text.includes('\\u55d8'),",
    "    preview: text.slice(0, 120)",
    '  };',
    '})()'
  ].join('\n'));
  await evaluateByValue(client, [
    '(() => {',
    '  if (window.__threadtraceReleaseDelayedFreshnessFetch) window.__threadtraceReleaseDelayedFreshnessFetch();',
    '  return true;',
    '})()'
  ].join('\n'));
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationReadinessResult');",
      "  return Boolean(result && result.getAttribute('aria-busy') === 'false' && document.querySelector('.automation-freshness-panel'));",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for Automation Cockpit freshness refresh to settle.');
  return loading;
}

async function automationClickDiagnostic(client) {
  return evaluateByValue(client, [
    '(() => {',
    '  const hero = document.querySelector(\'.automation-cockpit-hero\');',
    '  return {',
    '    href: location.href,',
    '    hash: location.hash,',
    '    readyState: document.readyState,',
    "    title: document.querySelector('#viewTitle')?.textContent || document.title || '',",
    '    hasHero: Boolean(hero),',
    "    heroButtons: hero ? Array.from(hero.querySelectorAll('button')).map((button) => ({ text: button.textContent.trim(), action: button.dataset.action || '' })) : [],",
    "    systemVisible: document.querySelector('#systemView') ? !document.querySelector('#systemView').hidden : null,",
    "    bodyPreview: document.body ? document.body.innerText.slice(0, 500) : ''",
    '  };',
    '})()'
  ].join('\n'));
}

async function verifyAutomationRunbookPreview(client) {
  const clicked = await evaluateByValue(client, [
    '(() => {',
    "  const buttons = Array.from(document.querySelectorAll('.automation-runbook-panel button[data-action=\"set-source-schedule\"][data-execute=\"false\"]'));",
    '  const button = buttons[0];',
    '  if (!button) return false;',
    '  button.click();',
    '  return true;',
    '})()'
  ].join('\n'));
  if (!clicked) {
    return { skipped: true, reason: 'no schedule preview button' };
  }
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationActionResult');",
      "  const text = result ? result.innerText : '';",
      "  const rect = result ? result.getBoundingClientRect() : null;",
      "  const visible = rect ? rect.bottom > 0 && rect.top < window.innerHeight : false;",
      "  return text.includes('最近动作') && text.includes('来源排期') && text.includes('预演') && visible;",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for Automation Cockpit runbook schedule preview: ' + JSON.stringify(await automationActionDiagnostic(client)));
  return evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const text = result ? result.innerText : '';",
    "  const rect = result ? result.getBoundingClientRect() : null;",
    '  return {',
    '    skipped: false,',
    "    hasSummary: text.includes('最近动作'),",
    "    hasResult: text.includes('来源排期'),",
    "    dryRun: text.includes('预演'),",
    "    changed: text.includes('已变化') || text.includes('无变化'),",
    "    resultTop: rect ? Math.round(rect.top) : null,",
    "    resultBottom: rect ? Math.round(rect.bottom) : null,",
    "    visible: rect ? rect.bottom > 0 && rect.top < window.innerHeight : false",
    '  };',
    '})()'
  ].join('\n'));
}

async function automationActionDiagnostic(client) {
  return evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const cockpit = document.querySelector('#automationReadinessResult');",
    "  const previewButtons = Array.from(document.querySelectorAll('.automation-runbook-panel button[data-action=\"set-source-schedule\"][data-execute=\"false\"]'));",
    '  const rect = result ? result.getBoundingClientRect() : null;',
    '  return {',
    '    href: location.href,',
    '    scrollY: window.scrollY,',
    "    actionBusy: result ? result.getAttribute('aria-busy') : 'missing',",
    "    cockpitBusy: cockpit ? cockpit.getAttribute('aria-busy') : 'missing',",
    '    previewButtonCount: previewButtons.length,',
    "    previewButtonLabels: previewButtons.map((button) => button.textContent.trim()).slice(0, 5),",
    '    resultVisible: rect ? rect.bottom > 0 && rect.top < window.innerHeight : false,',
    '    resultTop: rect ? Math.round(rect.top) : null,',
    '    resultBottom: rect ? Math.round(rect.bottom) : null,',
    "    resultText: result ? result.innerText.slice(0, 800) : ''",
    '  };',
    '})()'
  ].join('\n'));
}

async function verifyAutomationPressureAction(client) {
  return {
    outbox: await verifyAutomationPressureActionButton(client, 'outbox-overview', '提醒箱概览', '提醒箱'),
    ack: await verifyAutomationPressureActionButton(client, 'ack-preview', '确认预览', '提醒确认预览'),
    dispatch: await verifyAutomationPressureActionButton(client, 'dispatch-preview', '投递预览', '提醒投递预览'),
    audits: await verifyAutomationPressureActionButton(client, 'audit-overview', '复核审计', '复核审计'),
    gate: await verifyAutomationPressureActionButton(client, 'gate-preview', '门禁预览', '复核动作门禁'),
    executions: await verifyAutomationPressureActionButton(client, 'execution-overview', '复核执行', '复核执行'),
    executor: await verifyAutomationPressureActionButton(client, 'executor-diagnostics', '执行诊断', '复核执行诊断')
  };
}

async function verifyAutomationPressureActionButton(client, actionKey, actionLabel, panelText) {
  if (actionKey === 'dispatch-preview') {
    await installDispatchPreviewFetchMonitor(client);
  }
  const clicked = await evaluateByValue(client, [
    '(() => {',
    '  const button = document.querySelector(\'.automation-pressure-panel button[data-pressure-action="' + actionKey + '"]\');',
    '  if (!button) return { clicked: false, skipped: true, reason: "no ' + actionKey + ' pressure action" };',
    '  const label = button.textContent.trim();',
    '  button.click();',
    '  return { clicked: true, skipped: false, action: button.dataset.pressureAction || "", label };',
    '})()'
  ].join('\n'));
  if (!clicked || clicked.skipped) {
    if (actionKey === 'dispatch-preview') await uninstallDispatchPreviewFetchMonitor(client);
    return clicked;
  }
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationActionResult');",
      "  const text = result ? result.innerText : '';",
      "  const rect = result ? result.getBoundingClientRect() : null;",
      "  const visible = rect ? rect.bottom > 0 && rect.top < window.innerHeight : false;",
      "  return Boolean(result && text.includes('最近动作') && text.includes(" + JSON.stringify(actionLabel) + ") && text.includes(" + JSON.stringify(panelText) + ") && visible);",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for Automation Cockpit pressure action result: ' + actionKey + '.');
  const result = await evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const text = result ? result.innerText : '';",
    "  const rect = result ? result.getBoundingClientRect() : null;",
    '  return {',
    '    clicked: true,',
    '    skipped: false,',
    '    action: ' + JSON.stringify(clicked.action) + ',',
    '    label: ' + JSON.stringify(clicked.label) + ',',
    "    hasResult: text.includes('最近动作') && text.includes(" + JSON.stringify(actionLabel) + "),",
    "    hasPanel: text.includes(" + JSON.stringify(panelText) + "),",
    "    visible: rect ? rect.bottom > 0 && rect.top < window.innerHeight : false",
    '  };',
    '})()'
  ].join('\n'));
  if (actionKey === 'dispatch-preview') {
    const monitor = await uninstallDispatchPreviewFetchMonitor(client);
    return Object.assign({}, result, monitor);
  }
  return result;
}

async function installDispatchPreviewFetchMonitor(client) {
  return evaluateByValue(client, [
    '(() => {',
    '  const originalFetch = window.fetch.bind(window);',
    '  window.__threadtraceDispatchPreviewFetchMonitor = { dispatchPostCount: 0, overviewGetCount: 0 };',
    '  window.fetch = async function (input, init) {',
    "    const url = typeof input === 'string' ? input : input && input.url || '';",
    "    const method = (init && init.method || (input && input.method) || 'GET').toUpperCase();",
    "    if (url.includes('/api/events/dispatch') && method === 'POST') window.__threadtraceDispatchPreviewFetchMonitor.dispatchPostCount += 1;",
    "    if (url.includes('/api/events/overview') && method === 'GET') window.__threadtraceDispatchPreviewFetchMonitor.overviewGetCount += 1;",
    '    return originalFetch(input, init);',
    '  };',
    '  window.__threadtraceRestoreDispatchPreviewFetch = () => {',
    '    window.fetch = originalFetch;',
    '    const report = window.__threadtraceDispatchPreviewFetchMonitor || { dispatchPostCount: 0, overviewGetCount: 0 };',
    '    delete window.__threadtraceDispatchPreviewFetchMonitor;',
    '    delete window.__threadtraceRestoreDispatchPreviewFetch;',
    '    return report;',
    '  };',
    '  return true;',
    '})()'
  ].join('\n'));
}

async function uninstallDispatchPreviewFetchMonitor(client) {
  return evaluateByValue(client, [
    '(() => {',
    '  if (window.__threadtraceRestoreDispatchPreviewFetch) return window.__threadtraceRestoreDispatchPreviewFetch();',
    '  return { dispatchPostCount: -1, overviewGetCount: -1 };',
    '})()'
  ].join('\n'));
}

async function verifyAutomationAttentionFocus(client) {
  const clicked = await evaluateByValue(client, [
    '(() => {',
    "  const button = document.querySelector('.automation-attention-panel button[data-action=\"focus-automation-panel\"]');",
    '  if (!button) return { clicked: false, skipped: true, reason: "no attention focus button" };',
    '  const targetPanel = button.dataset.targetPanel || "";',
    '  button.click();',
    '  return { clicked: true, skipped: false, targetPanel };',
    '})()'
  ].join('\n'));
  if (!clicked || clicked.skipped) return clicked;
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      '  const panelClass = {',
      "    'automation-gates': '.automation-gates-panel',",
      "    'automation-freshness': '.automation-freshness-panel',",
      "    'automation-pressure': '.automation-pressure-panel',",
      "    'automation-runbook': '.automation-runbook-panel'",
      '  }[' + JSON.stringify(clicked.targetPanel) + '];',
      '  const panel = panelClass ? document.querySelector(panelClass) : null;',
      '  const rect = panel ? panel.getBoundingClientRect() : null;',
      '  return Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight);',
      '})()'
    ].join('\n'));
  }, 10000, 'Timed out waiting for Automation Cockpit attention panel focus.');
  return evaluateByValue(client, [
    '(() => {',
    '  const panelClass = {',
    "    'automation-gates': '.automation-gates-panel',",
    "    'automation-freshness': '.automation-freshness-panel',",
    "    'automation-pressure': '.automation-pressure-panel',",
    "    'automation-runbook': '.automation-runbook-panel'",
    '  }[' + JSON.stringify(clicked.targetPanel) + '];',
    '  const panel = panelClass ? document.querySelector(panelClass) : null;',
    '  const rect = panel ? panel.getBoundingClientRect() : null;',
    '  return {',
    '    clicked: true,',
    '    skipped: false,',
    '    targetPanel: ' + JSON.stringify(clicked.targetPanel) + ',',
    '    visible: rect ? rect.bottom > 0 && rect.top < window.innerHeight : false,',
    "    pulsed: panel ? panel.classList.contains('result-focus-pulse') : false",
    '  };',
    '})()'
  ].join('\n'));
}

async function verifyAutomationAttentionAction(client) {
  const clicked = await evaluateByValue(client, [
    '(() => {',
    "  const button = document.querySelector('.automation-attention-panel button[data-attention-action=\"preview-runbook-command\"]');",
    '  if (!button) return { clicked: false, skipped: true, reason: "no preview-runbook-command attention action" };',
    '  const label = button.textContent.trim();',
    '  button.click();',
    '  return { clicked: true, skipped: false, action: button.dataset.attentionAction || "", label };',
    '})()'
  ].join('\n'));
  if (!clicked || clicked.skipped) return clicked;
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationActionResult');",
      "  const text = result ? result.innerText : '';",
      "  const rect = result ? result.getBoundingClientRect() : null;",
      "  const visible = rect ? rect.bottom > 0 && rect.top < window.innerHeight : false;",
      "  return Boolean(result && text.includes('最近动作') && text.includes('来源排期') && text.includes('预演') && visible);",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for Automation Cockpit attention action result.');
  return evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const text = result ? result.innerText : '';",
    "  const rect = result ? result.getBoundingClientRect() : null;",
    '  return {',
    '    clicked: true,',
    '    skipped: false,',
    '    action: ' + JSON.stringify(clicked.action) + ',',
    '    label: ' + JSON.stringify(clicked.label) + ',',
    "    hasResult: text.includes('最近动作') && text.includes('来源排期'),",
    "    dryRun: text.includes('预演'),",
    "    visible: rect ? rect.bottom > 0 && rect.top < window.innerHeight : false",
    '  };',
    '})()'
  ].join('\n'));
}

async function evaluateByValue(client, expression, awaitPromise) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: Boolean(awaitPromise),
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error('Runtime.evaluate failed: ' + JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

function assertAudit(label, audit) {
  const requiredButtons = ['刷新', '助手状态', '助手预检', '质量评估', '试跑闭环'];
  const failures = [];
  if (audit.hash !== '#system') failures.push('expected #system hash');
  if (!audit.hasHero) failures.push('missing automation cockpit hero');
  if (!audit.hasAttentionQueue) failures.push('missing automation attention queue');
  if (!audit.hasPressure) failures.push('missing notification/audit pressure panel');
  if (!audit.hasActionResult) failures.push('missing automation action result container');
  if (audit.cockpitBusy === 'true') failures.push('automation cockpit result is still busy');
  if (audit.actionBusy === 'true') failures.push('automation action result is still busy');
  if (audit.overflowX) failures.push('horizontal overflow: scrollWidth=' + audit.scrollWidth + ', clientWidth=' + audit.clientWidth);
  requiredButtons.forEach(function (button) {
    if (!audit.buttons.includes(button)) failures.push('missing button: ' + button);
  });
  if (!audit.bodyTextIncludesOutbox) failures.push('missing notification outbox text');
  if (!audit.bodyTextIncludesAudit) failures.push('missing review audit text');
  if (!audit.bodyTextIncludesRunbook) failures.push('missing operator runbook text');
  if (!audit.bodyTextIncludesAttentionQueue) failures.push('missing attention queue text');
  if (!audit.bodyTextIncludesActionable) failures.push('missing actionable runbook summary text');
  if (!audit.bodyTextIncludesFreshness) failures.push('missing snapshot freshness text');
  if (!audit.headlineText) failures.push('missing automation cockpit headline text');
  if (audit.headlineHasMojibake) failures.push('automation cockpit headline contains mojibake: ' + audit.headlineText);
  if (audit.bodyTextHasMojibake) failures.push('body text contains mojibake');
  if (audit.attentionQueueRowCount > 0 && audit.attentionActionButtonCount <= 0) failures.push('attention queue is missing safe action controls');
  if (audit.pressureActionButtonCount <= 0) failures.push('pressure panel is missing outbox action controls');
  if (audit.autoRefreshToggleCount !== 1) failures.push('automation cockpit auto-refresh toggle count is ' + audit.autoRefreshToggleCount);
  if (audit.runbookCommandCount > 0 && audit.runbookCopyButtonCount < audit.runbookCommandCount) failures.push('runbook commands are missing copy controls');
  if (audit.runbookScheduleCommandCount > 0 && audit.runbookScheduleButtonCount < audit.runbookScheduleCommandCount) failures.push('schedule runbook commands are missing schedule controls');
  if (audit.heroTop === null || audit.heroTop > audit.clientWidth * 3) failures.push('cockpit appears too late in the page');
  if (failures.length > 0) {
    throw new Error(label + ' Automation Cockpit verification failed: ' + failures.join('; '));
  }
}

async function readPngInfo(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(24);
    await handle.read(buffer, 0, buffer.length, 0);
    const signature = buffer.subarray(0, 8).toString('hex');
    if (signature !== '89504e470d0a1a0a') {
      throw new Error('Screenshot is not a PNG file: ' + filePath);
    }
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  } finally {
    await handle.close();
  }
}

function assertScreenshot(label, png, stats, options, audit) {
  const failures = [];
  const expectedWidth = audit && audit.clientWidth || options.width;
  if (!png || png.width < expectedWidth) failures.push('width=' + (png && png.width) + ', expected at least ' + expectedWidth);
  if (!png || png.height < options.height) failures.push('height=' + (png && png.height) + ', expected at least ' + options.height);
  if (!stats || stats.size < 10000) failures.push('screenshot too small: ' + (stats && stats.size));
  if (failures.length > 0) {
    throw new Error(label + ' screenshot verification failed: ' + failures.join('; '));
  }
}

function httpRequest(method, url) {
  return new Promise(function (resolve, reject) {
    const request = http.request(url, { method }, function (response) {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', function (chunk) { body += chunk; });
      response.on('end', function () {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body
        });
      });
    });
    request.on('error', reject);
    request.end();
  });
}

async function waitFor(check, timeoutMs, message) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise(function (resolve) {
      setTimeout(resolve, 250);
    });
  }
  throw new Error(message);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.nextId = 0;
  }

  static async connect(webSocketUrl) {
    const parsed = new URL(webSocketUrl);
    const socket = net.createConnection({
      host: parsed.hostname,
      port: Number(parsed.port)
    });
    await new Promise(function (resolve, reject) {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    const key = crypto.randomBytes(16).toString('base64');
    const pathWithQuery = parsed.pathname + parsed.search;
    socket.write([
      'GET ' + pathWithQuery + ' HTTP/1.1',
      'Host: ' + parsed.host,
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Key: ' + key,
      'Sec-WebSocket-Version: 13',
      '',
      ''
    ].join('\r\n'));
    const initial = await readUntil(socket, Buffer.from('\r\n\r\n'));
    const headerText = initial.toString('utf8');
    if (!/^HTTP\/1\.1 101/i.test(headerText)) {
      throw new Error('Chrome WebSocket handshake failed: ' + headerText);
    }
    return new CdpClient(socket);
  }

  async send(method, params) {
    const id = ++this.nextId;
    this.writeFrame(JSON.stringify({
      id,
      method,
      params: params || {}
    }));
    while (true) {
      const message = JSON.parse(await this.readFrame());
      if (message.id === id) {
        if (message.error) throw new Error(method + ' failed: ' + JSON.stringify(message.error));
        return message.result || {};
      }
    }
  }

  writeFrame(text) {
    const payload = Buffer.from(text);
    let header;
    if (payload.length < 126) {
      header = Buffer.alloc(2);
      header[1] = 0x80 | payload.length;
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    header[0] = 0x81;
    const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(payload.length);
    for (let index = 0; index < payload.length; index += 1) {
      masked[index] = payload[index] ^ mask[index % 4];
    }
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  async readFrame() {
    while (true) {
      const parsed = this.tryReadFrame();
      if (parsed) return parsed;
      const chunk = await new Promise((resolve, reject) => {
        const onData = function (data) {
          cleanup();
          resolve(data);
        };
        const onError = function (error) {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          this.socket.off('data', onData);
          this.socket.off('error', onError);
        };
        this.socket.once('data', onData);
        this.socket.once('error', onError);
      });
      this.buffer = Buffer.concat([this.buffer, chunk]);
    }
  }

  tryReadFrame() {
    if (this.buffer.length < 2) return undefined;
    const first = this.buffer[0];
    const second = this.buffer[1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (this.buffer.length < offset + 2) return undefined;
      length = this.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (this.buffer.length < offset + 8) return undefined;
      length = Number(this.buffer.readBigUInt64BE(offset));
      offset += 8;
    }
    let mask;
    if (masked) {
      if (this.buffer.length < offset + 4) return undefined;
      mask = this.buffer.slice(offset, offset + 4);
      offset += 4;
    }
    if (this.buffer.length < offset + length) return undefined;
    let payload = this.buffer.slice(offset, offset + length);
    this.buffer = this.buffer.slice(offset + length);
    if (masked) {
      payload = Buffer.from(payload.map(function (byte, index) {
        return byte ^ mask[index % 4];
      }));
    }
    if (opcode === 0x8) throw new Error('Chrome WebSocket closed.');
    if (opcode !== 0x1) return this.tryReadFrame();
    return payload.toString('utf8');
  }

  async close() {
    this.socket.end();
  }
}

function readUntil(socket, delimiter) {
  return new Promise(function (resolve, reject) {
    let buffer = Buffer.alloc(0);
    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.includes(delimiter)) {
        socket.off('data', onData);
        socket.off('error', onError);
        resolve(buffer);
      }
    }
    function onError(error) {
      socket.off('data', onData);
      reject(error);
    }
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

main().catch(function (error) {
  process.stderr.write((error && error.stack) ? error.stack + os.EOL : String(error) + os.EOL);
  process.exitCode = 1;
});
