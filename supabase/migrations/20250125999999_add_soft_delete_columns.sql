-- Soft delete columns needed by multiple later migrations (deleted_at IS NULL)

-- JOBS
alter table public.jobs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists idx_jobs_deleted_at on public.jobs(deleted_at);

-- MESSAGES (if any of your SQL references messages.deleted_at)
alter table public.messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists idx_messages_deleted_at on public.messages(deleted_at);

-- QUOTES / QUOTE_REQUESTS (only if referenced)
alter table public.quotes
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

alter table public.quote_requests
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;
