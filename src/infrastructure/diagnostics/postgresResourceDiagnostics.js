'use strict';

const REQUIRED_TABLES = [
  'tracked_sources',
  'thread_snapshots',
  'analysis_reports',
  'context_review_action_executions',
  'context_review_results',
  'author_review_queue_items',
  'task_records',
  'notification_events',
  'raw_thread_pages',
  'worker_runs',
  'worker_leases'
];

const REQUIRED_EXTENSIONS = [
  'pg_trgm'
];

const REQUIRED_INDEXES = [
  'idx_tracked_sources_source_key',
  'idx_tracked_sources_enabled',
  'idx_tracked_sources_run_state_status',
  'idx_tracked_sources_cursor_thread',
  'idx_thread_snapshots_captured_at',
  'idx_thread_snapshots_title_trgm',
  'idx_analysis_reports_thread',
  'idx_analysis_reports_type_time',
  'idx_context_review_action_executions_action_status',
  'idx_context_review_action_executions_task',
  'idx_context_review_action_executions_updated',
  'idx_context_review_results_handoff',
  'idx_context_review_results_status_time',
  'idx_context_review_results_reviewer',
  'idx_author_review_queue_status',
  'idx_author_review_queue_source',
  'idx_author_review_queue_type_priority',
  'idx_task_records_status',
  'idx_task_records_type_created',
  'idx_task_records_trace_request',
  'idx_task_records_trace_id',
  'idx_task_records_trace_idempotency',
  'idx_notification_events_created',
  'idx_notification_events_delivery_status',
  'idx_notification_events_due',
  'idx_notification_events_ack',
  'idx_notification_events_source',
  'idx_notification_events_source_key',
  'idx_notification_events_archive',
  'idx_retrieval_documents_thread',
  'idx_retrieval_documents_author',
  'idx_retrieval_documents_text_trgm',
  'idx_raw_thread_pages_hash',
  'idx_raw_thread_pages_thread',
  'idx_worker_runs_type_started',
  'idx_worker_runs_status_heartbeat',
  'idx_worker_leases_type',
  'idx_worker_leases_expires'
];

const REQUIRED_COLUMNS = {
  notification_events: [
    'source_key',
    'archived_at',
    'archived_by',
    'archive_reason',
    'archive_batch_id'
  ]
};

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
    const extensionCheck = await inspectExtensions(client);
    const schemaCheck = await inspectSchema(client);
    const columnCheck = await inspectColumns(client);
    const indexCheck = await inspectIndexes(client);
    return {
      storageMode: 'postgres',
      checks: [
        check('resources.postgres', 'ok', 'reachable', 'PostgreSQL responded to a lightweight ping.'),
        extensionCheck,
        schemaCheck,
        columnCheck,
        indexCheck
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

async function inspectExtensions(client) {
  try {
    const result = await client.query(
      'select extname from pg_extension where extname = any($1)',
      [REQUIRED_EXTENSIONS]
    );
    const existing = new Set((result.rows || []).map(function (row) {
      return row.extname;
    }));
    const missing = REQUIRED_EXTENSIONS.filter(function (extensionName) {
      return !existing.has(extensionName);
    });
    if (missing.length > 0) {
      return check('resources.postgresExtensions', 'fail', missing.join(','), 'PostgreSQL cluster is missing required ThreadTrace extensions.');
    }
    return check('resources.postgresExtensions', 'ok', REQUIRED_EXTENSIONS.length, 'PostgreSQL cluster contains required ThreadTrace extensions.');
  } catch (error) {
    return check('resources.postgresExtensions', 'fail', errorMessage(error), 'PostgreSQL extension check failed.');
  }
}

async function inspectColumns(client) {
  try {
    const result = await client.query(
      'select table_name, column_name from information_schema.columns where table_schema = $1 and table_name = any($2) and column_name = any($3)',
      ['public', Object.keys(REQUIRED_COLUMNS), requiredColumnNames()]
    );
    const existing = new Set((result.rows || []).map(function (row) {
      return row.table_name + '.' + row.column_name;
    }));
    const missing = requiredColumnKeys().filter(function (columnKey) {
      return !existing.has(columnKey);
    });
    if (missing.length > 0) {
      return check('resources.postgresColumns', 'fail', missing.join(','), 'PostgreSQL schema is missing required ThreadTrace columns.');
    }
    return check('resources.postgresColumns', 'ok', requiredColumnKeys().length, 'PostgreSQL schema contains required ThreadTrace columns.');
  } catch (error) {
    return check('resources.postgresColumns', 'fail', errorMessage(error), 'PostgreSQL column check failed.');
  }
}

async function inspectIndexes(client) {
  try {
    const result = await client.query(
      'select indexname from pg_indexes where schemaname = $1 and indexname = any($2)',
      ['public', REQUIRED_INDEXES]
    );
    const existing = new Set((result.rows || []).map(function (row) {
      return row.indexname;
    }));
    const missing = REQUIRED_INDEXES.filter(function (indexName) {
      return !existing.has(indexName);
    });
    if (missing.length > 0) {
      return check('resources.postgresIndexes', 'fail', missing.join(','), 'PostgreSQL schema is missing required ThreadTrace indexes.');
    }
    return check('resources.postgresIndexes', 'ok', REQUIRED_INDEXES.length, 'PostgreSQL schema contains required ThreadTrace indexes.');
  } catch (error) {
    return check('resources.postgresIndexes', 'fail', errorMessage(error), 'PostgreSQL index check failed.');
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

function requiredColumnKeys() {
  return Object.keys(REQUIRED_COLUMNS).flatMap(function (tableName) {
    return REQUIRED_COLUMNS[tableName].map(function (columnName) {
      return tableName + '.' + columnName;
    });
  });
}

function requiredColumnNames() {
  return Array.from(new Set(Object.keys(REQUIRED_COLUMNS).flatMap(function (tableName) {
    return REQUIRED_COLUMNS[tableName];
  })));
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
  REQUIRED_EXTENSIONS,
  REQUIRED_TABLES,
  REQUIRED_INDEXES,
  REQUIRED_COLUMNS
};
