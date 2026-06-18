'use strict';

function createPostgresConfig(options) {
  const safeOptions = options || {};
  const env = safeOptions.env || process.env;
  const sslMode = safeOptions.sslMode || env.THREADTRACE_POSTGRES_SSL || env.PGSSLMODE;

  return {
    connectionString: safeOptions.connectionString || env.THREADTRACE_DATABASE_URL || env.DATABASE_URL,
    host: safeOptions.host || env.THREADTRACE_POSTGRES_HOST || env.PGHOST,
    port: safeOptions.port ? Number(safeOptions.port) : numberOrUndefined(env.THREADTRACE_POSTGRES_PORT || env.PGPORT),
    database: safeOptions.database || env.THREADTRACE_POSTGRES_DATABASE || env.PGDATABASE,
    user: safeOptions.user || env.THREADTRACE_POSTGRES_USER || env.PGUSER,
    password: safeOptions.password || env.THREADTRACE_POSTGRES_PASSWORD || env.PGPASSWORD,
    max: safeOptions.max ? Number(safeOptions.max) : numberOrUndefined(env.THREADTRACE_POSTGRES_POOL_MAX),
    idleTimeoutMillis: safeOptions.idleTimeoutMillis ? Number(safeOptions.idleTimeoutMillis) : numberOrUndefined(env.THREADTRACE_POSTGRES_IDLE_TIMEOUT_MS),
    connectionTimeoutMillis: safeOptions.connectionTimeoutMillis ? Number(safeOptions.connectionTimeoutMillis) : numberOrUndefined(env.THREADTRACE_POSTGRES_CONNECTION_TIMEOUT_MS),
    ssl: normalizeSsl(sslMode, safeOptions.ssl)
  };
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

function normalizeSsl(sslMode, explicitSsl) {
  if (explicitSsl !== undefined) return explicitSsl;
  if (!sslMode || sslMode === 'disable') return undefined;
  if (sslMode === 'require') {
    return {
      rejectUnauthorized: false
    };
  }
  return true;
}

module.exports = {
  createPostgresConfig
};
