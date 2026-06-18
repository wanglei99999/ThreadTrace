'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectPostgresResources } = require('../src/infrastructure/diagnostics/postgresResourceDiagnostics');

test('postgres resource diagnostics pings the database client', async function () {
  const queries = [];
  const diagnostics = await inspectPostgresResources({
    client: {
      async query(sql) {
        queries.push(sql);
        return { rows: [{ ok: 1 }] };
      }
    }
  });

  assert.equal(diagnostics.storageMode, 'postgres');
  assert.deepEqual(queries, ['select 1 as ok']);
  assert.equal(diagnostics.checks[0].key, 'resources.postgres');
  assert.equal(diagnostics.checks[0].status, 'ok');
  assert.equal(diagnostics.checks[0].value, 'reachable');
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
