'use strict';

const http = require('http');
const path = require('path');
const { getForumAdapter, listForumAdapters } = require('../../infrastructure/forum-adapters/registry');
const { analyzeSavedThreadDirectory } = require('../../application/use-cases/analyzeSavedThreadDirectory');
const { interpretNewPostFromSavedThreadDirectory } = require('../../application/use-cases/interpretNewPostFromSavedThreadDirectory');

function createThreadTraceServer(options) {
  const safeOptions = options || {};
  const defaultInputDir = safeOptions.defaultInputDir || path.resolve(process.cwd(), 'example');

  return http.createServer(async function (request, response) {
    try {
      await routeRequest(request, response, {
        defaultInputDir
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

  if (request.method === 'GET' && url.pathname === '/health') {
    writeJson(response, 200, {
      ok: true,
      service: 'threadtrace'
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/adapters') {
    writeJson(response, 200, {
      adapters: listForumAdapters()
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/analyze-directory') {
    const body = await readJsonBody(request);
    const adapter = getForumAdapter(body.forum || 'nga');
    const result = analyzeSavedThreadDirectory({
      adapter,
      inputDir: body.inputDir || context.defaultInputDir
    });
    writeJson(response, 200, result.report);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/interpret-text') {
    const body = await readJsonBody(request);
    if (!body.text) {
      writeJson(response, 400, {
        error: {
          message: 'POST /api/interpret-text requires text.'
        }
      });
      return;
    }

    const adapter = getForumAdapter(body.forum || 'nga');
    const report = interpretNewPostFromSavedThreadDirectory({
      adapter,
      inputDir: body.inputDir || context.defaultInputDir,
      authorId: body.authorId,
      author: body.author,
      contentText: body.text,
      publishedAt: body.publishedAt
    });
    writeJson(response, 200, report);
    return;
  }

  writeJson(response, 404, {
    error: {
      message: 'Not found.'
    }
  });
}

function readJsonBody(request) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    request.on('data', function (chunk) {
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

module.exports = {
  createThreadTraceServer
};
