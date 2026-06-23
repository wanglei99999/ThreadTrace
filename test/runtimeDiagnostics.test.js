'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getRuntimeDiagnostics } = require('../src/application/use-cases/getRuntimeDiagnostics');
const { createThreadTraceConfig } = require('../src/runtime/threadTraceConfig');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');
const {
  REQUIRED_COLUMNS,
  REQUIRED_EXTENSIONS,
  REQUIRED_INDEXES,
  REQUIRED_TABLES
} = require('../src/infrastructure/diagnostics/postgresResourceDiagnostics');

const REQUIRED_COLUMN_TABLES = Object.keys(REQUIRED_COLUMNS);
const REQUIRED_COLUMN_NAMES = Array.from(new Set(Object.values(REQUIRED_COLUMNS).flat()));

test('runtime diagnostics redacts sensitive LLM configuration', async function () {
  const config = createThreadTraceConfig({
    env: {
      THREADTRACE_LLM_PROVIDER: 'openai-compatible',
      THREADTRACE_LLM_API_KEY: 'secret-key',
      THREADTRACE_LLM_MODEL: 'model-a',
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    },
    cwd: process.cwd()
  });

  const diagnostics = await getRuntimeDiagnostics({
    config,
    now: '2026-06-18T10:00:00.000Z'
  });

  assert.equal(diagnostics.status, 'ok');
  assert.equal(diagnostics.generatedAt, '2026-06-18T10:00:00.000Z');
  assert.equal(diagnostics.configuration.llm.provider, 'openai-compatible');
  assert.equal(diagnostics.configuration.llm.apiKeyConfigured, true);
  assert.equal(diagnostics.configuration.workers.sourceFailureRetryBackoffMs, 60000);
  assert.equal(diagnostics.configuration.workers.sourceFailureMaxRetryBackoffMs, 3600000);
  assert.equal(diagnostics.configuration.reviewActions.executor, 'file-audit');
  assert.equal(diagnostics.configuration.connectors.moduleCount, 0);
  assert.equal(JSON.stringify(diagnostics), JSON.stringify(diagnostics).replace('secret-key', ''));
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'config.llm.apiKey';
  }).status, 'ok');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'config.reviewActions.executor';
  }).value, 'file-audit');
});

test('runtime diagnostics warns when remote LLM provider is incomplete', async function () {
  const config = createThreadTraceConfig({
    env: {
      THREADTRACE_LLM_PROVIDER: 'openai-compatible'
    },
    cwd: process.cwd()
  });

  const diagnostics = await getRuntimeDiagnostics({
    config
  });

  assert.equal(diagnostics.status, 'warn');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'config.llm.apiKey';
  }).status, 'warn');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'config.llm.model';
  }).status, 'warn');
});

test('runtime diagnostics includes resource checks', async function () {
  const config = createThreadTraceConfig({
    env: {},
    cwd: process.cwd()
  });
  const diagnostics = await getRuntimeDiagnostics({
    config,
    inspectResources: async function () {
      return {
        storageMode: 'file',
        checks: [
          {
            key: 'resources.storeDir',
            status: 'ok',
            value: config.storeDir,
            summary: 'Store directory is writable.'
          }
        ]
      };
    }
  });

  assert.equal(diagnostics.resources.storageMode, 'file');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.storeDir';
  }).status, 'ok');
});

test('runtime diagnostics pings injected PostgreSQL client', async function () {
  const queries = [];
  const runtime = createThreadTraceRuntime({
    storageMode: 'postgres',
    postgresClient: {
      async query(sql) {
        queries.push(sql);
        if (/information_schema\.tables/.test(sql)) {
          return {
            rows: REQUIRED_TABLES.map(function (tableName) {
              return { table_name: tableName };
            })
          };
        }
        if (/pg_extension/.test(sql)) {
          return {
            rows: requiredExtensionRows()
          };
        }
        if (/information_schema\.columns/.test(sql)) {
          return {
            rows: requiredColumnRows()
          };
        }
        if (/pg_indexes/.test(sql)) {
          return {
            rows: REQUIRED_INDEXES.map(function (indexName) {
              return { indexname: indexName };
            })
          };
        }
        return { rows: [{ ok: 1 }] };
      }
    }
  });

  const diagnostics = await runtime.getRuntimeDiagnostics({
    now: '2026-06-18T10:00:00.000Z'
  });

  assert.equal(diagnostics.status, 'ok');
  assert.equal(diagnostics.resources.storageMode, 'postgres');
  assert.deepEqual(queries, [
    'select 1 as ok',
    'select extname from pg_extension where extname = any($1)',
    'select table_name from information_schema.tables where table_schema = $1 and table_name = any($2)',
    'select table_name, column_name from information_schema.columns where table_schema = $1 and table_name = any($2) and column_name = any($3)',
    'select indexname from pg_indexes where schemaname = $1 and indexname = any($2)'
  ]);
  assert.deepEqual(REQUIRED_COLUMN_TABLES, ['notification_events']);
  assert.ok(REQUIRED_COLUMN_NAMES.includes('archived_at'));
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.postgres';
  }).status, 'ok');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.postgresExtensions';
  }).status, 'ok');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.postgresSchema';
  }).status, 'ok');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.postgresColumns';
  }).status, 'ok');
  assert.equal(diagnostics.checks.find(function (item) {
    return item.key === 'resources.postgresIndexes';
  }).status, 'ok');
});

function requiredColumnRows() {
  return Object.keys(REQUIRED_COLUMNS).flatMap(function (tableName) {
    return REQUIRED_COLUMNS[tableName].map(function (columnName) {
      return {
        table_name: tableName,
        column_name: columnName
      };
    });
  });
}

function requiredExtensionRows() {
  return REQUIRED_EXTENSIONS.map(function (extensionName) {
    return {
      extname: extensionName
    };
  });
}
