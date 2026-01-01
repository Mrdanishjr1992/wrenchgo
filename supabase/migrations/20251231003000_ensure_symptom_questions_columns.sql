-- Ensure symptom_questions has the columns our seed/app expects

alter table public.symptom_questions
  add column if not exists affects_tools boolean not null default false;

alter table public.symptom_questions
  add column if not exists helps_mechanic_with text;

-- Optional: if you want consistent naming long-term
-- (only run these if you actually want to standardize later)
-- NOTE: Do NOT rename columns unless your app is updated too.
-- alter table public.symptom_questions rename column question_text to question_label;
-- alter table public.symptom_questions rename column display_order to order_index;
