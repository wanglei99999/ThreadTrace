'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  inspectPostgresResources,
  REQUIRED_TABLES,
  REQUIRED_INDEXES
} = require('../src/infrastructure/diagnostics/postgresResourceDiagnostics');

test('postgres resource diagnostics pings the database client', async function () {
  const queries = [];
  const diagnostics = await inspectPostgresResources({
    client: {
      async query(sql, params) {
        queries.push(sql);
        if (/information_schema\.tables/.test(sql)) {
          assert.deepEqual(params, ['public', REQUIRED_TABLES]);
          return {
            rows: REQUIRED_TABLES.map(function (tableName) {
              return { table_name: tableName };
            })
          };
        }
        if (/pg_indexes/.test(sql)) {
          assert.deepEqual(params, ['public', REQUIRED_INDEXES]);
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

  assert.equal(diagnostics.storageMode, 'postgres');
  assert.deepEqual(queries, [
    'select 1 as ok',
    'select table_name from information_schema.tables where table_schema = $1 and table_name = any($2)',
    'select indexname from pg_indexes where schemaname = $1 and indexname = any($2)'
  ]);
  assert.equal(diagnostics.checks[0].key, 'resources.postgres');
  assert.equal(diagnostics.checks[0].status, 'ok');
  assert.equal(diagnostics.checks[0].value, 'reachable');
  assert.equal(diagnostics.checks[1].key, 'resources.postgresSchema');
  assert.equal(diagnostics.checks[1].status, 'ok');
  assert.equal(diagnostics.checks[2].key, 'resources.postgresIndexes');
  assert.equal(diagnostics.checks[2].status, 'ok');
});

test('postgres resource diagnostics fails when required tables are missing', async function () {
  const diagnostics = await inspectPostgresResources({
    client: {
      async query(sql) {
        if (/information_schema\.tables/.test(sql)) {
          return {
            rows: [{ table_name: 'tracked_sources' }]
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

  assert.equal(diagnostics.storageMode, 'postgres');
  assert.equal(diagnostics.checks[0].status, 'ok');
  assert.equal(diagnostics.checks[1].key, 'resources.postgresSchema');
  assert.equal(diagnostics.checks[1].status, 'fail');
  assert.match(diagnostics.checks[1].value, /thread_snapshots/);
});

test('postgres resource diagnostics fails when required indexes are missing', async function () {
  const diagnostics = await inspectPostgresResources({
    client: {
      async query(sql) {
        if (/information_schema\.tables/.test(sql)) {
          return {
            rows: REQUIRED_TABLES.map(function (tableName) {
              return { table_name: tableName };
            })
          };
        }
        if (/pg_indexes/.test(sql)) {
          return {
            rows: [{ indexname: 'idx_task_records_status' }]
          };
        }
        return { rows: [{ ok: 1 }] };
      }
    }
  });

  assert.equal(diagnostics.storageMode, 'postgres');
  assert.equal(diagnostics.checks[0].status, 'ok');
  assert.equal(diagnostics.checks[1].status, 'ok');
  assert.equal(diagnostics.checks[2].key, 'resources.postgresIndexes');
  assert.equal(diagnostics.checks[2].status, 'fail');
  assert.match(diagnostics.checks[2].value, /idx_task_records_trace_request/);
});

test('postgres resource diagnostics fails when ping fails', async function () {
  const diagnostics = await inspectPostgresResources({
    client: {
      async query() {
        throw new Error('connection refused');
      }
    }
  });

  assert.equal(diagnostics.storageMode, 'postgres');
  assert.equal(diagnostics.checks[0].key, 'resources.postgres');
  assert.equal(diagnostics.checks[0].status, 'fail');
  assert.equal(diagnostics.checks[0].value, 'connection refused');
});
