#!/usr/bin/env node
'use strict';

const { loadEnvFile } = require('../../runtime/envFileLoader');
const { createThreadTraceConfig } = require('../../runtime/threadTraceConfig');
const { createThreadTraceServer } = require('./createServer');

loadEnvFile({
  cwd: process.cwd()
});

const config = createThreadTraceConfig({
  env: process.env,
  cwd: process.cwd()
});

const server = createThreadTraceServer({
  defaultInputDir: config.defaultInputDir,
  storeDir: config.storeDir
});

server.listen(config.http.port, config.http.host, function () {
  console.log('ThreadTrace HTTP API listening on http://' + config.http.host + ':' + config.http.port);
  console.log('Default input dir: ' + config.defaultInputDir);
  console.log('Store dir: ' + config.storeDir);
});
