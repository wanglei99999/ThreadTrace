'use strict';

const REQUIRED_TABLES = [
  'tracked_sources',
  'thread_snapshots',
  'analysis_reports',
  'task_records',
  'notification_events',
  'raw_thread_pages',
  'worker_runs',
  'worker_leases'
];

async function inspectPostgresResources(options) {
  const safeOptions = options || {};
  const client = safeOptions.client;

  if (safeOptions.error) {
    return {
      storageMode: 'postgres',
      checks: [
        check('resources.postgres', 'fail', errorMessage(safeOptions.error), 'PostgreSQL client could not be created.')
      ]
    };
  }

  if (!client || typeof client.query !== 'function') {
    return {
      storageMode: 'postgres',
      checks: [
        check('resources.postgres', 'fail', 'missing-client', 'PostgreSQL diagnostics require a client with query(sql, params).')
      ]
    };
  }

  try {
    await client.query('select 1 as ok');
    const schemaCheck = await inspectSchema(client);
    return {
      storageMode: 'postgres',
      checks: [
        check('resources.postgres', 'ok', 'reachable', 'PostgreSQL responded to a lightweight ping.'),
        schemaCheck
      ]
    };
  } catch (error) {
    return {
      storageMode: 'postgres',
      checks: [
        check('resources.postgres', 'fail', errorMessage(error), 'PostgreSQL ping failed.')
      ]
    };
  }
}

async function inspectSchema(client) {
  try {
    const result = await client.query(
      'select table_name from information_schema.tables where table_schema = $1 and table_name = any($2)',
      ['public', REQUIRED_TABLES]
    );
    const existing = new Set((result.rows || []).map(function (row) {
      return row.table_name;
    }));
    const missing = REQUIRED_TABLES.filter(function (tableName) {
      return !existing.has(tableName);
    });
    if (missing.length > 0) {
      return check('resources.postgresSchema', 'fail', missing.join(','), 'PostgreSQL schema is missing required ThreadTrace tables.');
    }
    return check('resources.postgresSchema', 'ok', REQUIRED_TABLES.length, 'PostgreSQL schema contains required ThreadTrace tables.');
  } catch (error) {
    return check('resources.postgresSchema', 'fail', errorMessage(error), 'PostgreSQL schema check failed.');
  }
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

module.exports = {
  inspectPostgresResources,
  REQUIRED_TABLES
};
