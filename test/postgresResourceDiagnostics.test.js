'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  inspectPostgresResources,
  REQUIRED_COLUMNS,
  REQUIRED_EXTENSIONS,
  REQUIRED_TABLES,
  REQUIRED_INDEXES
} = require('../src/infrastructure/diagnostics/postgresResourceDiagnostics');

const REQUIRED_COLUMN_TABLES = Object.keys(REQUIRED_COLUMNS);
const REQUIRED_COLUMN_NAMES = Array.from(new Set(Object.values(REQUIRED_COLUMNS).flat()));

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
        if (/pg_extension/.test(sql)) {
          assert.deepEqual(params, [REQUIRED_EXTENSIONS]);
          return {
            rows: requiredExtensionRows()
          };
        }
        if (/information_schema\.columns/.test(sql)) {
          assert.deepEqual(params, ['public', REQUIRED_COLUMN_TABLES, REQUIRED_COLUMN_NAMES]);
          return {
            rows: requiredColumnRows()
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
    'select extname from pg_extension where extname = any($1)',
    'select table_name from information_schema.tables where table_schema = $1 and table_name = any($2)',
    'select table_name, column_name from information_schema.columns where table_schema = $1 and table_name = any($2) and column_name = any($3)',
    'select indexname from pg_indexes where schemaname = $1 and indexname = any($2)'
  ]);
  assert.equal(diagnostics.checks[0].key, 'resources.postgres');
  assert.equal(diagnostics.checks[0].status, 'ok');
  assert.equal(diagnostics.checks[0].value, 'reachable');
  assert.equal(diagnostics.checks[1].key, 'resources.postgresExtensions');
  assert.equal(diagnostics.checks[1].status, 'ok');
  assert.equal(diagnostics.checks[2].key, 'resources.postgresSchema');
  assert.equal(diagnostics.checks[2].status, 'ok');
  assert.equal(diagnostics.checks[3].key, 'resources.postgresColumns');
  assert.equal(diagnostics.checks[3].status, 'ok');
  assert.equal(diagnostics.checks[4].key, 'resources.postgresIndexes');
  assert.equal(diagnostics.checks[4].status, 'ok');
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
        if (/pg_extension/.test(sql)) {
          return {
            rows: requiredExtensionRows()
          };
        }
        if (/pg_indexes/.test(sql)) {
          return {
            rows: REQUIRED_INDEXES.map(function (indexName) {
              return { indexname: indexName };
            })
          };
        }
        if (/information_schema\.columns/.test(sql)) {
          return {
            rows: requiredColumnRows()
          };
        }
        return { rows: [{ ok: 1 }] };
      }
    }
  });

  assert.equal(diagnostics.storageMode, 'postgres');
  assert.equal(diagnostics.checks[0].status, 'ok');
  assert.equal(diagnostics.checks[1].status, 'ok');
  assert.equal(diagnostics.checks[2].key, 'resources.postgresSchema');
  assert.equal(diagnostics.checks[2].status, 'fail');
  assert.match(diagnostics.checks[2].value, /thread_snapshots/);
});

test('postgres resource diagnostics fails when required extensions are missing', async function () {
  const diagnostics = await inspectPostgresResources({
    client: {
      async query(sql) {
        if (/pg_extension/.test(sql)) {
          return {
            rows: []
          };
        }
        if (/information_schema\.tables/.test(sql)) {
          return {
            rows: REQUIRED_TABLES.map(function (tableName) {
              return { table_name: tableName };
            })
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

  assert.equal(diagnostics.storageMode, 'postgres');
  assert.equal(diagnostics.checks[0].status, 'ok');
  assert.equal(diagnostics.checks[1].key, 'resources.postgresExtensions');
  assert.equal(diagnostics.checks[1].status, 'fail');
  assert.match(diagnostics.checks[1].value, /pg_trgm/);
});

test('postgres resource diagnostics fails when required columns are missing', async function () {
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
        if (/pg_extension/.test(sql)) {
          return {
            rows: requiredExtensionRows()
          };
        }
        if (/information_schema\.columns/.test(sql)) {
          return {
            rows: [{ table_name: 'notification_events', column_name: 'source_key' }]
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
  assert.equal(diagnostics.checks[1].status, 'ok');
  assert.equal(diagnostics.checks[2].status, 'ok');
  assert.equal(diagnostics.checks[3].key, 'resources.postgresColumns');
  assert.equal(diagnostics.checks[3].status, 'fail');
  assert.match(diagnostics.checks[3].value, /notification_events\.archived_at/);
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
  assert.equal(diagnostics.checks[2].status, 'ok');
  assert.equal(diagnostics.checks[3].status, 'ok');
  assert.equal(diagnostics.checks[4].key, 'resources.postgresIndexes');
  assert.equal(diagnostics.checks[4].status, 'fail');
  assert.match(diagnostics.checks[4].value, /idx_notification_events_source_key/);
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
