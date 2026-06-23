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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
