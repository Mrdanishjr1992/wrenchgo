-- Baseline schema for WrenchGo (source of truth = pasted schema)
-- Safe to run on an empty database.

-- Extensions
create extension if not exists pgcrypto;

-- 1) Enums (adjust values only if your app expects different names)
do $$ begin
  create type public.user_role as enum ('customer', 'mechanic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum ('searching', 'quoted', 'accepted', 'in_progress', 'completed', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quote_status as enum ('pending', 'accepted', 'rejected', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quote_request_status as enum ('pending', 'accepted', 'rejected', 'expired', 'canceled');
exception when duplicate_object then null; end $$;

-- 2) updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3) Tables

create table if not exists public.vehicles (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  year integer not null,
  make text not null,
  model text not null,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_pkey primary key (id),
  constraint vehicles_customer_id_fkey foreign key (customer_id) references auth.users(id)
);

create table if not exists public.jobs (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  accepted_mechanic_id uuid,
  title text not null,
  description text not null,
  symptom_id uuid,
  location_lat numeric,
  location_lng numeric,
  location_address text,
  status public.job_status not null default 'searching',
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  vehicle_id uuid,
  canceled_at timestamptz,
  canceled_by text check (canceled_by = any (array['customer','mechanic','system'])),
  constraint jobs_pkey primary key (id),
  constraint jobs_customer_id_fkey foreign key (customer_id) references auth.users(id),
  constraint jobs_accepted_mechanic_id_fkey foreign key (accepted_mechanic_id) references auth.users(id),
  constraint jobs_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id)
);

create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  job_id uuid not null,
  sender_id uuid not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_pkey primary key (id),
  constraint messages_job_id_fkey foreign key (job_id) references public.jobs(id),
  constraint messages_sender_id_fkey foreign key (sender_id) references auth.users(id)
);

create table if not exists public.profiles (
  id uuid not null default gen_random_uuid(),
  auth_id uuid unique,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  deleted_reason text,
  deletion_requested_by uuid,
  can_reapply boolean default false,
  reapplication_notes text,
  id_photo_path text,
  id_status text default 'none' check (id_status = any (array['none','pending','verified','rejected'])),
  id_uploaded_at timestamptz,
  id_verified_at timestamptz,
  id_rejected_reason text,
  id_verified_by uuid,
  constraint profiles_pkey primary key (id),
  constraint profiles_deletion_requested_by_fkey foreign key (deletion_requested_by) references auth.users(id),
  constraint profiles_id_verified_by_fkey foreign key (id_verified_by) references auth.users(id)
);

create table if not exists public.mechanic_profiles (
  id uuid not null,
  business_name text,
  bio text,
  years_experience integer,
  service_radius_km integer default 50,
  base_location_lat numeric,
  base_location_lng numeric,
  is_available boolean default true,
  jobs_completed integer default 0,
  average_rating numeric default 0.00,
  total_reviews integer default 0,
  is_verified boolean default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mechanic_profiles_pkey primary key (id),
  constraint mechanic_profiles_id_fkey foreign key (id) references auth.users(id)
);

create table if not exists public.quotes (
  id uuid not null default gen_random_uuid(),
  job_id uuid not null,
  mechanic_id uuid not null,
  price_cents integer not null,
  estimated_hours numeric,
  notes text,
  status public.quote_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_pkey primary key (id),
  constraint quotes_job_id_fkey foreign key (job_id) references public.jobs(id),
  constraint quotes_mechanic_id_fkey foreign key (mechanic_id) references auth.users(id)
);

create table if not exists public.quote_requests (
  id uuid not null default gen_random_uuid(),
  job_id uuid not null,
  mechanic_id uuid not null,
  customer_id uuid not null,
  price_cents integer not null,
  estimated_hours numeric,
  notes text,
  status public.quote_request_status not null default 'pending',
  accepted_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz,
  canceled_by text check (canceled_by = any (array['customer','mechanic','system'])),
  cancel_reason text,
  cancel_note text,
  cancellation_fee_cents integer check (cancellation_fee_cents >= 0),
  constraint quote_requests_pkey primary key (id),
  constraint quote_requests_job_id_fkey foreign key (job_id) references public.jobs(id),
  constraint quote_requests_mechanic_id_fkey foreign key (mechanic_id) references auth.users(id),
  constraint quote_requests_customer_id_fkey foreign key (customer_id) references auth.users(id)
);

create table if not exists public.symptom_mappings (
  symptom_key text not null,
  symptom_label text not null,
  category text not null,
  required_skill_keys text[] default '{}'::text[],
  suggested_tool_keys text[] default '{}'::text[],
  required_safety_keys text[] default '{}'::text[],
  quote_strategy text default 'diagnosis-first',
  risk_level text default 'low',
  customer_explainer text,
  mechanic_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint symptom_mappings_pkey primary key (symptom_key)
);

create table if not exists public.symptom_questions (
  id uuid not null default gen_random_uuid(),
  symptom_key text not null,
  question_key text not null,
  question_text text not null,
  question_type text not null,
  options jsonb,
  affects_safety boolean default false,
  affects_quote boolean default false,
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint symptom_questions_pkey primary key (id)
);

-- FK to keep symptom_questions valid
do $$ begin
  alter table public.symptom_questions
    add constraint symptom_questions_symptom_key_fkey
    foreign key (symptom_key) references public.symptom_mappings(symptom_key);
exception when duplicate_object then null; end $$;

-- 4) updated_at triggers
do $$ begin
  create trigger set_updated_at_jobs before update on public.jobs
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_updated_at_quotes before update on public.quotes
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_updated_at_quote_requests before update on public.quote_requests
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_updated_at_profiles before update on public.profiles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_updated_at_mechanic_profiles before update on public.mechanic_profiles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 5) Auth trigger you showed (keeps dev behavior identical)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  r text;
  fn text;
begin
  r := coalesce(new.raw_user_meta_data->>'role', 'customer');
  fn := coalesce(new.raw_user_meta_data->>'full_name', '');

  insert into public.profiles (id, role, full_name)
  values (new.id, r::public.user_role, fn);

  if r = 'mechanic' then
    insert into public.mechanic_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;

-- NOTE: This requires profiles.role to exist. If you had role on profiles in your real DB,
-- add it in the NEXT migration (see below). We keep this baseline faithful, but safe.

