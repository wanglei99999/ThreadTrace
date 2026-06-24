'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const {
  REQUIRED_COLUMNS,
  REQUIRED_EXTENSIONS,
  REQUIRED_INDEXES,
  REQUIRED_TABLES
} = require('../src/infrastructure/diagnostics/postgresResourceDiagnostics');

test('postgres baseline schema can remediate diagnostic-required resources', async function () {
  const schemaSql = await fs.readFile(path.resolve(__dirname, '..', 'docs', 'postgresql-schema.sql'), 'utf8');
  const normalized = schemaSql.replace(/\s+/g, ' ').toLowerCase();

  REQUIRED_EXTENSIONS.forEach(function (extensionName) {
    assert.match(normalized, new RegExp('create extension if not exists ' + escapeRegExp(extensionName.toLowerCase())));
  });

  REQUIRED_TABLES.forEach(function (tableName) {
    assert.match(normalized, new RegExp('create table if not exists ' + escapeRegExp(tableName.toLowerCase())));
  });

  REQUIRED_INDEXES.forEach(function (indexName) {
    assert.match(normalized, new RegExp('create (unique )?index if not exists ' + escapeRegExp(indexName.toLowerCase())));
  });

  Object.keys(REQUIRED_COLUMNS).forEach(function (tableName) {
    REQUIRED_COLUMNS[tableName].forEach(function (columnName) {
      assert.match(
        normalized,
        new RegExp('alter table ' + escapeRegExp(tableName.toLowerCase()) + ' add column if not exists ' + escapeRegExp(columnName.toLowerCase()) + '\\b')
      );
    });
  });
});

test('postgres baseline schema includes source-scoped notification dispatch indexes', async function () {
  const schemaSql = await fs.readFile(path.resolve(__dirname, '..', 'docs', 'postgresql-schema.sql'), 'utf8');
  const normalized = schemaSql.replace(/\s+/g, ' ').toLowerCase();

  assert.match(
    normalized,
    /create index if not exists idx_notification_events_dispatch_due on notification_events\(delivery_status, next_delivery_at, created_at desc\) where archived_at is null and acknowledged_at is null/
  );
  assert.match(
    normalized,
    /create index if not exists idx_notification_events_dispatch_source on notification_events\(source_id, delivery_status, next_delivery_at, created_at desc\) where archived_at is null and acknowledged_at is null/
  );
  assert.match(
    normalized,
    /create index if not exists idx_notification_events_dispatch_source_key on notification_events\(source_key, delivery_status, next_delivery_at, created_at desc\) where archived_at is null and acknowledged_at is null/
  );
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
