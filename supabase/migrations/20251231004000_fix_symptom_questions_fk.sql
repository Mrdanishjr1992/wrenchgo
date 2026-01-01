do $$
declare
  r record;
begin
  -- Drop any existing FK constraints on public.symptom_questions
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'symptom_questions'
      and c.contype = 'f'
  loop
    execute format('alter table public.symptom_questions drop constraint %I', r.conname);
  end loop;

  -- Add the correct FK to public.symptoms(key)
  alter table public.symptom_questions
    add constraint symptom_questions_symptom_key_fkey
    foreign key (symptom_key) references public.symptoms(key)
    on delete cascade;
end $$;
