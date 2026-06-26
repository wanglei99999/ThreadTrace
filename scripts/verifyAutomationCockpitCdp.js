'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_APP_URL = 'http://127.0.0.1:3019/#system';
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
        runAction: true,
        screenshotPath: path.join(outputDir, 'automation-cockpit-cdp-desktop.png')
      });
      const mobile = await verifyViewport(client, {
        label: 'mobile',
        url: appUrl,
        width: 390,
        height: 844,
        mobile: true,
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
    }
  } finally {
    if (browser.launched && browser.process) {
      browser.process.kill();
    }
  }
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

async function verifyViewport(client, options) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
    mobile: options.mobile
  });
  await client.send('Page.navigate', { url: options.url });
  await waitForCockpit(client);
  const runbookPreview = options.runAction ? await verifyAutomationRunbookPreview(client) : undefined;
  const actionResult = options.runAction ? await verifyAutomationActionResult(client) : undefined;
  const audit = await evaluateByValue(client, viewportAuditExpression());
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true
  });
  await fs.writeFile(options.screenshotPath, Buffer.from(screenshot.data, 'base64'));
  const stats = await fs.stat(options.screenshotPath);
  assertAudit(options.label, audit);
  return Object.assign({}, audit, {
    runbookPreview,
    actionResult,
    screenshotPath: options.screenshotPath,
    screenshotBytes: stats.size
  });
}

async function waitForCockpit(client) {
  await evaluateByValue(client, [
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
}

function viewportAuditExpression() {
  return [
    '(() => {',
    '  const doc = document.documentElement;',
    "  const hero = document.querySelector('.automation-cockpit-hero');",
    "  const pressure = document.querySelector('.automation-pressure-panel');",
    "  const action = document.querySelector('#automationActionResult');",
    "  const status = document.querySelector('#systemStatus');",
    '  const heroRect = hero ? hero.getBoundingClientRect() : null;',
    '  const statusRect = status ? status.getBoundingClientRect() : null;',
    '  return {',
    '    hash: location.hash,',
    "    title: document.querySelector('#viewTitle')?.textContent || '',",
    '    hasHero: Boolean(hero),',
    '    hasPressure: Boolean(pressure),',
    '    hasActionResult: Boolean(action),',
    "    buttons: Array.from(document.querySelectorAll('.automation-cockpit-hero button')).map((button) => button.textContent.trim()),",
    '    clientWidth: doc.clientWidth,',
    '    scrollWidth: doc.scrollWidth,',
    '    overflowX: doc.scrollWidth > doc.clientWidth + 1,',
    '    heroTop: heroRect ? Math.round(heroRect.top) : null,',
    '    heroHeight: heroRect ? Math.round(heroRect.height) : null,',
    '    statusTop: statusRect ? Math.round(statusRect.top) : null,',
    "    bodyTextIncludesOutbox: document.body.innerText.includes('Notification outbox'),",
    "    bodyTextIncludesAudit: document.body.innerText.includes('Review audit ledger'),",
    "    bodyTextIncludesRunbook: document.body.innerText.includes('Operator runbook'),",
    "    runbookCommandCount: document.querySelectorAll('.automation-runbook-command-row').length,",
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
    "  const button = buttons.find((candidate) => candidate.textContent.trim() === 'LLM readiness');",
    '  if (!button) return false;',
    '  button.click();',
    '  return true;',
    '})()'
  ].join('\n'));
  if (!clicked) {
    throw new Error('Could not click Automation Cockpit LLM readiness button.');
  }
  await waitFor(async function () {
    return evaluateByValue(client, [
      '(() => {',
      "  const result = document.querySelector('#automationActionResult');",
      "  const commandRows = result ? result.querySelectorAll('.automation-action-command-row .lifecycle-command-row') : [];",
      "  const copyButtons = result ? result.querySelectorAll('button[data-action=\"copy-lifecycle-command\"],button[data-action=\"copy-command\"]') : [];",
      '  return Boolean(result && commandRows.length > 0 && copyButtons.length > 0);',
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for Automation Cockpit action commands.');
  return evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const rows = Array.from(result.querySelectorAll('.automation-action-command-row'));",
    "  const commands = Array.from(result.querySelectorAll('.lifecycle-command-row code')).map((item) => item.textContent.trim());",
    '  return {',
    '    hasResult: Boolean(result),',
    '    rowCount: rows.length,',
    '    commandCount: commands.length,',
    '    commands: commands.slice(0, 5),',
    "    hasCopyButtons: Boolean(result.querySelector('button[data-action=\"copy-lifecycle-command\"],button[data-action=\"copy-command\"]'))",
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
      "  return text.includes('Source schedule') && text.includes('dry-run');",
      '})()'
    ].join('\n'));
  }, 30000, 'Timed out waiting for Automation Cockpit runbook schedule preview.');
  return evaluateByValue(client, [
    '(() => {',
    "  const result = document.querySelector('#automationActionResult');",
    "  const text = result ? result.innerText : '';",
    '  return {',
    '    skipped: false,',
    "    hasResult: text.includes('Source schedule'),",
    "    dryRun: text.includes('dry-run'),",
    "    changed: text.includes('Changed')",
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
  const requiredButtons = ['Refresh', 'LLM readiness', 'LLM preflight', 'LLM evaluate', 'Demo cycle'];
  const failures = [];
  if (audit.hash !== '#system') failures.push('expected #system hash');
  if (!audit.hasHero) failures.push('missing automation cockpit hero');
  if (!audit.hasPressure) failures.push('missing notification/audit pressure panel');
  if (!audit.hasActionResult) failures.push('missing automation action result container');
  if (audit.overflowX) failures.push('horizontal overflow: scrollWidth=' + audit.scrollWidth + ', clientWidth=' + audit.clientWidth);
  requiredButtons.forEach(function (button) {
    if (!audit.buttons.includes(button)) failures.push('missing button: ' + button);
  });
  if (!audit.bodyTextIncludesOutbox) failures.push('missing Notification outbox text');
  if (!audit.bodyTextIncludesAudit) failures.push('missing Review audit ledger text');
  if (!audit.bodyTextIncludesRunbook) failures.push('missing Operator runbook text');
  if (audit.runbookCommandCount > 0 && audit.runbookCopyButtonCount < audit.runbookCommandCount) failures.push('runbook commands are missing copy controls');
  if (audit.runbookScheduleCommandCount > 0 && audit.runbookScheduleButtonCount < audit.runbookScheduleCommandCount) failures.push('schedule runbook commands are missing Preview/Apply controls');
  if (audit.heroTop === null || audit.heroTop > audit.clientWidth * 3) failures.push('cockpit appears too late in the page');
  if (failures.length > 0) {
    throw new Error(label + ' Automation Cockpit verification failed: ' + failures.join('; '));
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
