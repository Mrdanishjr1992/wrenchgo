alter table public.symptom_questions
  add column if not exists question_label text;

-- If your table currently has "question" (common), copy values over once:
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='symptom_questions'
      and column_name='question'
  ) then
    update public.symptom_questions
    set question_label = coalesce(question_label, question);
  end if;
end $$;
