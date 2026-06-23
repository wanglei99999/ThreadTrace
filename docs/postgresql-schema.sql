-- ThreadTrace PostgreSQL baseline schema.
-- This schema mirrors the current application ports while keeping JSONB
-- payloads for model evolution and multi-forum adapters.

create extension if not exists pg_trgm;

create table if not exists tracked_sources (
  id text primary key,
  source_key text not null,
  source_type text not null,
  display_name text not null,
  location jsonb not null,
  enabled boolean not null default true,
  tags jsonb not null default '[]'::jsonb,
  schedule jsonb,
  cursor jsonb,
  run_state jsonb not null default '{"status":"never-run","failureCount":0}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_tracked_sources_source_key on tracked_sources(source_key);
create index if not exists idx_tracked_sources_enabled on tracked_sources(enabled);
create index if not exists idx_tracked_sources_run_state_status on tracked_sources((run_state ->> 'status'));
create index if not exists idx_tracked_sources_cursor_thread on tracked_sources((cursor ->> 'sourceThreadId'));

create table if not exists thread_snapshots (
  source_key text not null,
  source_thread_id text not null,
  title text not null,
  url text,
  post_count integer not null default 0,
  last_floor integer,
  last_post_id text,
  captured_at timestamptz not null default now(),
  snapshot jsonb not null,
  primary key (source_key, source_thread_id)
);

create index if not exists idx_thread_snapshots_captured_at on thread_snapshots(captured_at desc);
create index if not exists idx_thread_snapshots_title_trgm on thread_snapshots using gin (title gin_trgm_ops);

create table if not exists analysis_reports (
  id bigserial primary key,
  source_key text not null,
  source_thread_id text not null,
  report_type text not null,
  generated_at timestamptz not null,
  report jsonb not null
);

create index if not exists idx_analysis_reports_thread on analysis_reports(source_key, source_thread_id);
create index if not exists idx_analysis_reports_type_time on analysis_reports(report_type, generated_at desc);

create table if not exists context_review_results (
  id text primary key,
  status text not null,
  handoff_id text,
  handoff_version text,
  reviewer_id text,
  submitted_at timestamptz not null,
  record jsonb not null
);

create index if not exists idx_context_review_results_handoff on context_review_results(handoff_id);
create index if not exists idx_context_review_results_status_time on context_review_results(status, submitted_at desc);
create index if not exists idx_context_review_results_reviewer on context_review_results(reviewer_id);

create table if not exists context_review_action_executions (
  execution_key text primary key,
  action text not null,
  status text not null,
  task_id text,
  request_hash text not null,
  request jsonb not null default '{}'::jsonb,
  result jsonb,
  error jsonb,
  attempt_count integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  failed_at timestamptz
);

create index if not exists idx_context_review_action_executions_action_status on context_review_action_executions(action, status);
create index if not exists idx_context_review_action_executions_task on context_review_action_executions(task_id);
create index if not exists idx_context_review_action_executions_updated on context_review_action_executions(updated_at desc);

create table if not exists author_review_queue_items (
  id text primary key,
  status text not null,
  source_key text,
  source_thread_id text,
  type text not null,
  priority text not null,
  score numeric not null default 0,
  title text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null,
  record jsonb not null
);

create index if not exists idx_author_review_queue_status on author_review_queue_items(status, updated_at desc);
create index if not exists idx_author_review_queue_source on author_review_queue_items(source_key, source_thread_id);
create index if not exists idx_author_review_queue_type_priority on author_review_queue_items(type, priority);

create table if not exists task_records (
  id uuid primary key,
  type text not null,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_task_records_status on task_records(status);
create index if not exists idx_task_records_type_created on task_records(type, created_at desc);
create index if not exists idx_task_records_trace_request on task_records((input -> '_trace' ->> 'requestId'));
create index if not exists idx_task_records_trace_id on task_records((input -> '_trace' ->> 'traceId'));
create index if not exists idx_task_records_trace_idempotency on task_records((input -> '_trace' ->> 'idempotencyKey'));

create table if not exists notification_events (
  id uuid primary key,
  type text not null,
  severity text not null,
  source_id text,
  source_key text,
  task_id uuid,
  title text,
  summary text not null,
  payload jsonb not null,
  delivery_status text not null default 'pending',
  delivery_attempts integer not null default 0,
  delivery_result jsonb,
  last_delivery_error jsonb,
  last_delivery_attempt_at timestamptz,
  last_delivered_at timestamptz,
  next_delivery_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by text,
  acknowledgement_note text,
  archived_at timestamptz,
  archived_by text,
  archive_reason text,
  archive_batch_id text,
  created_at timestamptz not null
);

-- Keep the baseline script safe to re-run against databases created before
-- source scoping or archive retention columns were introduced.
alter table notification_events add column if not exists source_key text;
alter table notification_events add column if not exists archived_at timestamptz;
alter table notification_events add column if not exists archived_by text;
alter table notification_events add column if not exists archive_reason text;
alter table notification_events add column if not exists archive_batch_id text;

create index if not exists idx_notification_events_created on notification_events(created_at desc);
create index if not exists idx_notification_events_delivery_status on notification_events(delivery_status);
create index if not exists idx_notification_events_due on notification_events(delivery_status, next_delivery_at);
create index if not exists idx_notification_events_ack on notification_events(acknowledged_at);
create index if not exists idx_notification_events_source on notification_events(source_id);
create index if not exists idx_notification_events_source_key on notification_events(source_key);
create index if not exists idx_notification_events_archive on notification_events(archived_at);

create table if not exists retrieval_documents (
  id text primary key,
  source_key text,
  source_thread_id text,
  source_post_id text,
  floor integer,
  author_id text,
  author text,
  text text not null,
  metadata jsonb not null default '{}'::jsonb,
  indexed_at timestamptz not null
);

create index if not exists idx_retrieval_documents_thread on retrieval_documents(source_key, source_thread_id);
create index if not exists idx_retrieval_documents_author on retrieval_documents(author_id);
create index if not exists idx_retrieval_documents_text_trgm on retrieval_documents using gin (text gin_trgm_ops);

create table if not exists raw_thread_pages (
  id bigserial primary key,
  source_key text not null,
  source_thread_id text,
  source_url text,
  page_number integer,
  content_encoding text,
  content_sha1 text not null,
  content_text text not null,
  fetched_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists idx_raw_thread_pages_hash on raw_thread_pages(source_key, content_sha1);
create index if not exists idx_raw_thread_pages_thread on raw_thread_pages(source_key, source_thread_id, page_number);

create table if not exists worker_runs (
  id uuid primary key,
  worker_type text not null,
  worker_id text not null,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  started_at timestamptz not null,
  updated_at timestamptz not null,
  heartbeat_at timestamptz not null,
  finished_at timestamptz
);

create index if not exists idx_worker_runs_type_started on worker_runs(worker_type, started_at desc);
create index if not exists idx_worker_runs_status_heartbeat on worker_runs(status, heartbeat_at desc);

create table if not exists worker_leases (
  lease_key text primary key,
  worker_type text not null,
  owner_id text not null,
  acquired_at timestamptz not null,
  updated_at timestamptz not null,
  expires_at timestamptz not null
);

create index if not exists idx_worker_leases_type on worker_leases(worker_type);
create index if not exists idx_worker_leases_expires on worker_leases(expires_at);
