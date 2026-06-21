'use strict';

const REQUIRED_TABLES = [
  'tracked_sources',
  'thread_snapshots',
  'analysis_reports',
  'context_review_action_executions',
  'context_review_results',
  'task_records',
  'notification_events',
  'raw_thread_pages',
  'worker_runs',
  'worker_leases'
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
    const indexCheck = await inspectIndexes(client);
    return {
      storageMode: 'postgres',
      checks: [
        check('resources.postgres', 'ok', 'reachable', 'PostgreSQL responded to a lightweight ping.'),
        schemaCheck,
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
  REQUIRED_TABLES,
  REQUIRED_INDEXES
};
