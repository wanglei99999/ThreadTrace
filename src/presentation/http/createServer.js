'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');
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
    try {
      applyCors(response);
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
        maxBodyBytes: safeOptions.maxBodyBytes || 1024 * 1024
      });
    } catch (error) {
      writeJson(response, 500, {
        error: {
          message: error.message,
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

  if (request.method === 'POST' && url.pathname === '/api/interpret-text') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    if (!body.text) {
      writeJson(response, 400, {
        error: {
          message: 'POST /api/interpret-text requires text.'
        }
      });
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
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, {
      task: result.task,
      report: result.report
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/tasks') {
    const tasks = await context.runtime.listTasks({
      status: url.searchParams.get('status') || undefined,
      type: url.searchParams.get('type') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20
    });
    writeJson(response, 200, {
      tasks
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    const acknowledgedParam = url.searchParams.get('acknowledged');
    const events = await context.runtime.listNotificationEvents({
      type: url.searchParams.get('type') || undefined,
      sourceId: url.searchParams.get('sourceId') || undefined,
      acknowledged: acknowledgedParam === null ? undefined : acknowledgedParam === 'true',
      deliveryStatus: url.searchParams.get('deliveryStatus') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      storeDir: url.searchParams.get('storeDir') || undefined
    });
    writeJson(response, 200, {
      events
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/events/dispatch') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.dispatchNotificationEvents({
      limit: body.limit,
      maxAttempts: body.maxAttempts,
      includeFailed: body.includeFailed,
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

  if (request.method === 'GET' && url.pathname === '/api/sources') {
    const enabledParam = url.searchParams.get('enabled');
    const sources = await context.runtime.listSources({
      forum: url.searchParams.get('forum') || undefined,
      enabled: enabledParam === null ? undefined : enabledParam === 'true',
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50
    });
    writeJson(response, 200, {
      sources
    });
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
      url: body.url,
      location: body.location,
      enabled: body.enabled,
      tags: body.tags,
      schedule: body.schedule,
      intervalMinutes: body.intervalMinutes,
      nextRunAt: body.nextRunAt,
      scheduleEnabled: body.scheduleEnabled,
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, result.created ? 201 : 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/sources/tasks/ingest') {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runEnabledSourcesIngestTasks({
      forum: body.forum,
      limit: body.limit,
      storeDir: body.storeDir || context.storeDir
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
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, result);
    return;
  }

  const sourceIngestMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/tasks\/ingest$/);
  if (request.method === 'POST' && sourceIngestMatch) {
    const body = await readJsonBody(request, context.maxBodyBytes);
    const result = await context.runtime.runSourceIngestTask({
      sourceId: decodeURIComponent(sourceIngestMatch[1]),
      storeDir: body.storeDir || context.storeDir
    });
    writeJson(response, 200, {
      sourceId: decodeURIComponent(sourceIngestMatch[1]),
      task: result.task,
      report: result.report
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
      writeJson(response, 400, {
        error: {
          message: 'POST /api/search requires text.'
        }
      });
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

  writeJson(response, 404, {
    error: {
      message: 'Not found.'
    }
  });
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

function readJsonBody(request, maxBodyBytes) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let totalBytes = 0;
    request.on('data', function (chunk) {
      totalBytes += chunk.length;
      if (totalBytes > maxBodyBytes) {
        reject(new Error('Request body is too large.'));
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
        reject(new Error('Invalid JSON body: ' + error.message));
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

function applyCors(response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
}

module.exports = {
  createThreadTraceServer
};
