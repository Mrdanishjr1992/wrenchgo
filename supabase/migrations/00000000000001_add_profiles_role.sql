alter table public.profiles
  add column if not exists role public.user_role not null default 'customer';
