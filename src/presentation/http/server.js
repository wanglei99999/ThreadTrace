#!/usr/bin/env node
'use strict';

const path = require('path');
const { createThreadTraceServer } = require('./createServer');

const port = Number(process.env.PORT || 3017);
const defaultInputDir = process.env.THREADTRACE_EXAMPLE_DIR || path.resolve(process.cwd(), 'example');

const server = createThreadTraceServer({
  defaultInputDir
});

server.listen(port, function () {
  console.log('ThreadTrace HTTP API listening on http://127.0.0.1:' + port);
  console.log('Default input dir: ' + defaultInputDir);
});
