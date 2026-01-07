# QUICK START GUIDE

## Step 1: Apply Migrations

Run this command in your terminal (from project root):

```powershell
npx supabase db reset --linked
```

When prompted "Do you want to reset the remote database? [y/N]", type `y` and press Enter.

**Expected output:**
```
Resetting remote database...
Applying migration 20250212000001_extensions_enums.sql...
Applying migration 20250212000002_core_tables.sql...
Applying migration 20250212000003_mechanic_symptom_tables.sql...
Applying migration 20250212000004_messaging_media.sql...
Applying migration 20250212000005_payments_stripe.sql...
Applying migration 20250212000006_functions_triggers.sql...
Applying migration 20250212000007_rls_grants.sql...
Applying migration 20250212000008_seed_data.sql...
Finished supabase db reset on branch main.
```

## Step 2: Verify Database

Run these SQL queries in Supabase SQL Editor to verify:

```sql
-- Check symptom data exists
SELECT COUNT(*) FROM public.symptoms;
-- Expected: 15

-- Check media assets exist
SELECT key, public_url FROM public.media_assets ORDER BY key;
-- Expected: 4 rows (logo_video, wrenchgo_ad_1, wrenchgo_ad_2, wrenchgo_ad_3)

-- Check get_mechanic_leads function exists
SELECT proname FROM pg_proc WHERE proname = 'get_mechanic_leads';
-- Expected: get_mechanic_leads

-- Check new columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'preferred_time';
-- Expected: preferred_time

SELECT column_name FROM information_schema.columns
WHERE table_name = 'notifications' AND column_name = 'type';
-- Expected: type
```

## Step 2b: Update Media Asset URLs

The seed data includes placeholder URLs. Update them with your actual project reference:

1. Go to Supabase Dashboard > Settings > API
2. Copy your "Project URL" (e.g., `https://abcdefghijk.supabase.co`)
3. Extract the project reference (e.g., `abcdefghijk`)
4. Open `UPDATE_MEDIA_URLS.sql`
5. Replace `YOUR_PROJECT_REF` with your actual reference
6. Run the SQL in Supabase SQL Editor

**Or run this one-liner** (replace `YOUR_PROJECT_REF`):

```sql
UPDATE public.media_assets
SET public_url = 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/' || path
WHERE public_url LIKE '%YOUR_PROJECT_REF%';
```

## Step 3: Test App

```powershell
npx expo start -c
```

### Test Flows:
1. **Google Sign-In** - Should create profile automatically
2. **Role Selection** - Choose customer or mechanic
3. **Symptoms** - Navigate to job creation, verify 15 symptoms load
4. **Media Assets** - Check home screen for ads
5. **Notifications** - Trigger a notification
6. **Jobs** - Create job with preferred_time
7. **Mechanic Leads** (mechanics only) - View leads screen

### Expected: No Errors

All these errors should be GONE:
- ❌ `permission denied for table profiles`
- ❌ `Could not find function get_mechanic_leads`
- ❌ `column media_assets.public_url does not exist`
- ❌ `column notifications.type does not exist`
- ❌ `column jobs.preferred_time does not exist`
- ❌ `Could not find tables: symptom_mappings`

## Step 4: Storage Setup (Optional)

If you need to upload media (avatars, job photos):

1. Go to Supabase Dashboard > Storage
2. Create bucket named `media`
3. Set as public
4. Add policies (see `STORAGE_SETUP.md`)

## Troubleshooting

### Issue: Migrations fail to apply

**Solution:**
```powershell
# Check if project is linked
npx supabase link --project-ref YOUR_PROJECT_REF

# Try again
npx supabase db reset --linked
```

### Issue: "permission denied" errors persist

**Solution:**
1. Check table ownership in SQL Editor:
```sql
SELECT tablename, tableowner FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';
```
Should be owned by `postgres`.

2. If not, run:
```sql
ALTER TABLE public.profiles OWNER TO postgres;
ALTER TABLE public.mechanic_profiles OWNER TO postgres;
```

### Issue: Symptoms not loading

**Solution:**
```sql
-- Check if seed data exists
SELECT COUNT(*) FROM public.symptoms;

-- If 0, manually run migration 8:
-- Copy contents of supabase/migrations/20250212000008_seed_data.sql
-- Paste into Supabase SQL Editor
-- Run
```

## Success Checklist

- [ ] All 8 migrations applied successfully
- [ ] 15 symptoms exist in database
- [ ] get_mechanic_leads function exists
- [ ] Google sign-in creates profile
- [ ] Role selection works
- [ ] Symptoms load in app
- [ ] No schema cache errors in logs

## Next Steps

Once everything works:

1. Delete backup: `rm -rf supabase/migrations_backup_20250212/`
2. Delete temp files: `rm HOTFIX_*.sql TEMP_*.sql FIX_*.sql`
3. Commit clean migrations to git
4. Deploy to production

## Need Help?

See detailed documentation:
- `MIGRATION_VERIFICATION.md` - Comprehensive verification steps
- `MIGRATION_SUMMARY.md` - What was changed and why
- `STORAGE_SETUP.md` - Storage bucket setup instructions
