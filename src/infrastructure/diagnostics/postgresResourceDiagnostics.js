'use strict';

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
    return {
      storageMode: 'postgres',
      checks: [
        check('resources.postgres', 'ok', 'reachable', 'PostgreSQL responded to a lightweight ping.')
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
  inspectPostgresResources
};
