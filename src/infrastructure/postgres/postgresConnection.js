'use strict';

const { createPostgresConfig } = require('./postgresConfig');

function createPostgresPool(options) {
  const config = createPostgresConfig(options);
  let pg;
  try {
    pg = require('pg');
  } catch (error) {
    throw new Error('PostgreSQL storage requires the "pg" package. Install it with npm install pg or pass a postgresClient with query(sql, params).');
  }

  if (!config.connectionString && !config.host) {
    throw new Error('PostgreSQL storage requires THREADTRACE_DATABASE_URL, DATABASE_URL, or THREADTRACE_POSTGRES_HOST.');
  }

  return new pg.Pool(removeUndefined(config));
}

function assertPostgresClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('PostgreSQL repositories require a client with query(sql, params).');
  }
  return client;
}

function removeUndefined(input) {
  const output = {};
  Object.keys(input).forEach(function (key) {
    if (input[key] !== undefined) output[key] = input[key];
  });
  return output;
}

module.exports = {
  createPostgresPool,
  assertPostgresClient
};
