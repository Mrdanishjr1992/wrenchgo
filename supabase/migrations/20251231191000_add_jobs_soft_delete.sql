-- Add soft-delete fields to jobs (needed by add_job_location_privacy index)
alter table public.jobs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

-- Optional FK (safe to omit if you want):
-- alter table public.jobs
--   add constraint jobs_deleted_by_fkey
--   foreign key (deleted_by) references auth.users(id);

create index if not exists idx_jobs_deleted_at
  on public.jobs(deleted_at);

-- Recreate the index that failed (only if it doesn't exist yet)
create index if not exists idx_jobs_public_location
  on public.jobs(public_latitude, public_longitude)
  where deleted_at is null;
