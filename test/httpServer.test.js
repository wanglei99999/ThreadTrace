'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
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
    assert.equal(openApi.openapi, '3.0.3');
    assert.ok(openApi.paths['/api/interpret-text']);
    assert.equal(context.reportType, 'new-post-context');
    assert.ok(context.relatedEvidence.length >= 1);
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
      method: 'OPTIONS'
    });
    const invalid = await fetch(baseUrl + '/api/interpret-text', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const invalidBody = await invalid.json();

    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    assert.equal(invalid.status, 400);
    assert.match(invalidBody.error.message, /requires text/);
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
    const taskResult = await postJson(baseUrl + '/api/tasks/ingest-directory', {});
    const tasksResult = await getJson(baseUrl + '/api/tasks');

    assert.equal(taskResult.task.status, 'completed');
    assert.equal(taskResult.task.output.sourceThreadId, '45974302');
    assert.equal(tasksResult.tasks.length, 1);
    assert.equal(tasksResult.tasks[0].id, taskResult.task.id);
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
    const registerResponse = await fetch(baseUrl + '/api/sources', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        forum: 'nga',
        displayName: 'NGA sample archive',
        inputDir: path.resolve(__dirname, '..', 'example')
      })
    });
    const registerResult = await registerResponse.json();
    const sourcesResult = await getJson(baseUrl + '/api/sources');
    const taskResult = await postJson(baseUrl + '/api/sources/' + encodeURIComponent(registerResult.source.id) + '/tasks/ingest', {});

    assert.equal(registerResponse.status, 201);
    assert.equal(sourcesResult.sources.length, 1);
    assert.equal(sourcesResult.sources[0].id, registerResult.source.id);
    assert.equal(taskResult.sourceId, registerResult.source.id);
    assert.equal(taskResult.task.status, 'completed');
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
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 200);
  return response.json();
}
