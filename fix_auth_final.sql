-- Fix the handle_updated_at function to work properly
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

-- Ensure the trigger exists on profiles
drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Drop any broken auth triggers
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

-- Recreate the signup trigger with proper error handling
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_role text;
  v_full_name text;
begin
  v_full_name := nullif(trim(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), '');
  
  if lower(coalesce(NEW.raw_user_meta_data->>'role','')) = 'mechanic' then
    v_role := 'mechanic';
  else
    v_role := 'customer';
  end if;

  insert into public.profiles (id, role, full_name, created_at, updated_at)
  values (NEW.id, v_role::public.user_role, v_full_name, now(), now())
  on conflict (id) do update
    set role = coalesce(public.profiles.role, excluded.role),
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  if v_role = 'mechanic' then
    insert into public.mechanic_profiles (user_id) 
    values (NEW.id)
    on conflict (user_id) do nothing;
  end if;
  
  return NEW;
exception
  when others then
    raise log 'handle_new_user error: % %', SQLERRM, SQLSTATE;
    return NEW;
end;
$$;

-- Recreate trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Drop and recreate the RPC function
drop function if exists public.ensure_profile_consistency(text, text, text, text);

create or replace function public.ensure_profile_consistency(
  role_hint text default null, 
  full_name text default null, 
  phone text default null, 
  photo_url text default null
)
returns json
language plpgsql
security definer
as $$
declare
  uid uuid;
  v_role text;
  v_result json;
begin
  uid := auth.uid();
  
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if lower(coalesce(role_hint,'')) = 'mechanic' then
    v_role := 'mechanic';
  elsif lower(coalesce(role_hint,'')) = 'customer' then
    v_role := 'customer';
  else
    v_role := 'customer';
  end if;

  insert into public.profiles (id, role, full_name, phone, photo_url, created_at, updated_at)
  values (
    uid, 
    v_role::public.user_role, 
    nullif(trim(coalesce(full_name, '')), ''), 
    nullif(trim(coalesce(phone, '')), ''), 
    nullif(trim(coalesce(photo_url, '')), ''), 
    now(),
    now()
  )
  on conflict (id) do update
    set 
      role = coalesce(public.profiles.role, excluded.role),
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      phone = coalesce(public.profiles.phone, excluded.phone),
      photo_url = coalesce(public.profiles.photo_url, excluded.photo_url),
      updated_at = now();

  if v_role = 'mechanic' then
    insert into public.mechanic_profiles (user_id) 
    values (uid)
    on conflict (user_id) do nothing;
  end if;

  select json_build_object(
    'id', p.id,
    'role', p.role,
    'full_name', p.full_name,
    'phone', p.phone,
    'photo_url', p.photo_url,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) into v_result
  from public.profiles p
  where p.id = uid;

  return v_result;
end;
$$;

-- Grant permissions
grant execute on function public.ensure_profile_consistency(text, text, text, text) to authenticated;
grant execute on function public.handle_updated_at() to authenticated;

-- Fix any existing users without profiles
insert into public.profiles (id, role, full_name, created_at, updated_at)
select 
  u.id,
  'customer'::public.user_role,
  nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), ''),
  coalesce(u.created_at, now()),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Fix null roles
update public.profiles
set role = 'customer'::public.user_role, updated_at = now()
where role is null;

-- Ensure mechanic_profiles exist for mechanics
insert into public.mechanic_profiles (user_id)
select p.id
from public.profiles p
where p.role = 'mechanic'
on conflict (user_id) do nothing;

-- Set role column constraints
alter table public.profiles alter column role set default 'customer'::public.user_role;
alter table public.profiles alter column role set not null;
