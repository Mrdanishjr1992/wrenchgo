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
  affects_quote boolean default false,
  affects_safety boolean default false,
  affects_tools boolean default false,
  order_index integer not null
);

create table if not exists public.symptom_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.symptom_questions(id) on delete cascade,
  label text not null,
  order_index integer not null
);
