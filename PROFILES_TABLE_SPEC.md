# Profiles Table Structure

## Required Columns (Trigger Touches These)

| Column       | Type         | Nullable | Default | Notes                          |
|--------------|--------------|----------|---------|--------------------------------|
| `id`         | UUID         | NOT NULL | -       | Primary key, references auth.users(id) |
| `role`       | TEXT         | NOT NULL | 'customer' | "customer" or "mechanic" only |
| `created_at` | TIMESTAMPTZ  | NOT NULL | NOW()   | Set by trigger                 |
| `updated_at` | TIMESTAMPTZ  | NOT NULL | NOW()   | Set by trigger                 |

## Optional Columns (Trigger NEVER Touches)

These exist for app logic but are NOT set by the trigger:

| Column           | Type    | Nullable | Notes                              |
|------------------|---------|----------|------------------------------------|
| `full_name`      | TEXT    | YES      | User's display name                |
| `phone`          | TEXT    | YES      | Phone number                       |
| `avatar_url`     | TEXT    | YES      | Profile picture URL                |
| `email`          | TEXT    | YES      | Cached from auth.users.email       |
| `is_active`      | BOOLEAN | YES      | Account status                     |
| `metadata`       | JSONB   | YES      | Flexible additional data           |

## Trigger Behavior

**The trigger ONLY sets:**
- `id` (from `NEW.id`)
- `role` (from `NEW.raw_user_meta_data->>'role'` or default `'customer'`)
- `created_at` (NOW())
- `updated_at` (NOW())

**The trigger NEVER sets:**
- Any other columns
- No email copying
- No metadata parsing (except role)
- No conditional logic based on role

## SQL to Verify Structure

```sql
-- Check profiles table exists with correct structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check role column is TEXT (not enum)
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'role';
-- Expected: data_type = 'text', NOT 'USER-DEFINED'
```

## Migration to Fix Role Column (If Needed)

If `role` is currently an enum, run this:

```sql
-- Convert role from enum to TEXT
ALTER TABLE public.profiles 
  ALTER COLUMN role TYPE TEXT;

-- Add check constraint for valid roles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('customer', 'mechanic'));

-- Set default
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'customer';
```
