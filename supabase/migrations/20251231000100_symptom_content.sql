-- ===============================
-- Symptom content tables
-- ===============================

create table if not exists public.symptoms (
  key text primary key,
  label text not null,
  icon text not null
);

create table if not exists public.symptom_education (
  symptom_key text primary key references public.symptoms(key) on delete cascade,
  title text not null,
  summary text not null,
  is_it_safe text not null,
  what_we_check text not null,
  how_quotes_work text not null
);

create table if not exists public.symptom_questions (
  id uuid primary key default gen_random_uuid(),
  symptom_key text not null references public.symptoms(key) on delete cascade,
  question_key text not null,
  question_label text not null,
  question_type text not null check (
    question_type in ('single_choice', 'multi_choice', 'yes_no', 'text_input')
  ),
  helps_mechanic_with text,
  affects_quote boolean not null default false,
  affects_safety boolean not null default false,
  affects_tools boolean not null default false,
  order_index integer not null
);

create unique index if not exists symptom_questions_symptom_key_question_key_uq
  on public.symptom_questions(symptom_key, question_key);

create table if not exists public.symptom_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.symptom_questions(id) on delete cascade,
  label text not null,
  order_index integer not null
);

create index if not exists symptom_question_options_question_id_idx
  on public.symptom_question_options(question_id);
