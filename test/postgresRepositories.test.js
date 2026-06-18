'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');
const { createPostgresConfig } = require('../src/infrastructure/postgres/postgresConfig');
const { createPostgresNotificationEventRepository } = require('../src/infrastructure/postgres/postgresNotificationEventRepository');
const { createPostgresSourceRepository } = require('../src/infrastructure/postgres/postgresSourceRepository');
const { createPostgresWorkerRunRepository } = require('../src/infrastructure/postgres/postgresWorkerRunRepository');

test('postgres config reads ThreadTrace environment names', function () {
  const config = createPostgresConfig({
    env: {
      THREADTRACE_DATABASE_URL: 'postgres://user:pass@localhost:5432/threadtrace',
      THREADTRACE_POSTGRES_POOL_MAX: '12',
      THREADTRACE_POSTGRES_SSL: 'require'
    }
  });

  assert.equal(config.connectionString, 'postgres://user:pass@localhost:5432/threadtrace');
  assert.equal(config.max, 12);
  assert.deepEqual(config.ssl, {
    rejectUnauthorized: false
  });
});

test('postgres source repository maps rows and writes upserts', async function () {
  const queries = [];
  const repository = createPostgresSourceRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.startsWith('select * from tracked_sources')) {
          return {
            rows: [
              {
                id: 'source-1',
                source_key: 'nga',
                source_type: 'saved-html-directory',
                display_name: 'NGA archive',
                location: { inputDir: 'example' },
                enabled: true,
                tags: ['sample'],
                schedule: { intervalMinutes: 60 },
                cursor: { postCount: 20 },
                run_state: { status: 'completed', failureCount: 0 },
                created_at: new Date('2026-06-18T10:00:00.000Z'),
                updated_at: new Date('2026-06-18T10:01:00.000Z')
              }
            ]
          };
        }
        return { rows: [] };
      }
    }
  });

  await repository.saveSource({
    id: 'source-1',
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'NGA archive',
    location: { inputDir: 'example' },
    enabled: true,
    tags: ['sample'],
    createdAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z'
  });
  const sources = await repository.listSources({
    sourceKey: 'nga',
    enabled: true,
    limit: 5
  });

  assert.match(queries[0].sql, /insert into tracked_sources/);
  assert.match(queries[1].sql, /source_key = \$1/);
  assert.match(queries[1].sql, /enabled = \$2/);
  assert.deepEqual(queries[1].params, ['nga', true, 5]);
  assert.equal(sources[0].id, 'source-1');
  assert.equal(sources[0].createdAt, '2026-06-18T10:00:00.000Z');
  assert.equal(sources[0].cursor.postCount, 20);
});

test('postgres notification repository queries due outbox events', async function () {
  const queries = [];
  const repository = createPostgresNotificationEventRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        return {
          rows: [
            {
              id: '4a9b6325-5b0d-4a7f-b6fb-e3f870ebf872',
              type: 'source-changed',
              severity: 'info',
              source_id: 'source-1',
              source_key: 'nga',
              task_id: null,
              title: 'NGA archive',
              summary: 'changed',
              payload: { cursorDiff: { newPostCount: 1 } },
              delivery_status: 'failed',
              delivery_attempts: 1,
              delivery_result: null,
              last_delivery_error: { message: 'timeout' },
              last_delivery_attempt_at: new Date('2026-06-18T10:00:00.000Z'),
              last_delivered_at: null,
              next_delivery_at: new Date('2026-06-18T10:01:00.000Z'),
              acknowledged_at: null,
              acknowledged_by: null,
              acknowledgement_note: null,
              created_at: new Date('2026-06-18T09:59:00.000Z')
            }
          ]
        };
      }
    }
  });

  const events = await repository.listEvents({
    deliveryStatus: 'failed',
    dueBefore: '2026-06-18T10:02:00.000Z',
    acknowledged: false,
    limit: 10
  });

  assert.match(queries[0].sql, /next_delivery_at is null or next_delivery_at <= \$2/);
  assert.match(queries[0].sql, /acknowledged_at is null/);
  assert.deepEqual(queries[0].params, ['failed', '2026-06-18T10:02:00.000Z', 10]);
  assert.equal(events[0].deliveryStatus, 'failed');
  assert.equal(events[0].nextDeliveryAt, '2026-06-18T10:01:00.000Z');
  assert.equal(events[0].lastDeliveryError.message, 'timeout');
});

test('postgres worker run repository maps rows and filters runs', async function () {
  const queries = [];
  const repository = createPostgresWorkerRunRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.startsWith('select * from worker_runs')) {
          return {
            rows: [
              {
                id: '7d0b0bb6-0f1d-4bfe-a7e9-0d58a6ea79f0',
                worker_type: 'operations',
                worker_id: 'worker-a',
                status: 'running',
                input: { limit: 5 },
                progress: { step: 'overview' },
                output: null,
                error: null,
                started_at: new Date('2026-06-18T10:00:00.000Z'),
                updated_at: new Date('2026-06-18T10:01:00.000Z'),
                heartbeat_at: new Date('2026-06-18T10:01:00.000Z'),
                finished_at: null
              }
            ]
          };
        }
        return { rows: [] };
      }
    }
  });

  await repository.saveWorkerRun({
    id: '7d0b0bb6-0f1d-4bfe-a7e9-0d58a6ea79f0',
    workerType: 'operations',
    workerId: 'worker-a',
    status: 'running',
    input: { limit: 5 },
    progress: { step: 'overview' },
    startedAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:01:00.000Z',
    heartbeatAt: '2026-06-18T10:01:00.000Z'
  });
  const runs = await repository.listWorkerRuns({
    workerType: 'operations',
    status: 'running',
    limit: 10
  });

  assert.match(queries[0].sql, /insert into worker_runs/);
  assert.match(queries[1].sql, /worker_type = \$1/);
  assert.match(queries[1].sql, /status = \$2/);
  assert.deepEqual(queries[1].params, ['operations', 'running', 10]);
  assert.equal(runs[0].workerType, 'operations');
  assert.equal(runs[0].progress.step, 'overview');
  assert.equal(runs[0].heartbeatAt, '2026-06-18T10:01:00.000Z');
});

test('runtime can compose postgres repositories with an injected client', async function () {
  const runtime = createThreadTraceRuntime({
    storageMode: 'postgres',
    postgresClient: {
      async query(sql) {
        assert.match(sql, /select \* from tracked_sources/);
        return {
          rows: [
            {
              id: 'source-1',
              source_key: 'nga',
              source_type: 'saved-html-directory',
              display_name: 'NGA archive',
              location: { inputDir: 'example' },
              enabled: true,
              tags: [],
              schedule: null,
              cursor: null,
              run_state: { status: 'never-run', failureCount: 0 },
              created_at: '2026-06-18T10:00:00.000Z',
              updated_at: '2026-06-18T10:00:00.000Z'
            }
          ]
        };
      }
    }
  });

  const sources = await runtime.listSources({});

  assert.equal(runtime.defaults.storageMode, 'postgres');
  assert.equal(sources.length, 1);
  assert.equal(sources[0].sourceKey, 'nga');
});
