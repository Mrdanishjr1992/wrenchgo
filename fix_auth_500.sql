-- Drop and recreate the function with better error handling
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
set search_path = public
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

  insert into public.profiles (id, role, full_name, phone, photo_url, created_at)
  values (
    uid, 
    v_role::public.user_role, 
    nullif(trim(coalesce(full_name, '')), ''), 
    nullif(trim(coalesce(phone, '')), ''), 
    nullif(trim(coalesce(photo_url, '')), ''), 
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

-- Grant execute permission
grant execute on function public.ensure_profile_consistency(text, text, text, text) to authenticated;
