# 🔄 SUPABASE ACCOUNT SWITCH GUIDE

## 📋 CURRENT PROJECT DETAILS (BACKUP THIS INFO)

**Current Project:**
- **Project Ref:** `kkpkpybqbtmcvriqrmrt`
- **URL:** `https://kkpkpybqbtmcvriqrmrt.supabase.co`
- **Anon Key:** `sb_publishable_vxO0iiikifg7EH-rVaNgMQ_xZgb_uwb` (partial)

**Date of Switch:** [1/2/2026]
**Reason:** [switch to main account]

---

## ⚠️ CRITICAL: BEFORE YOU START

### What You Need:
1. ✅ Access to NEW Supabase account/project
2. ✅ NEW project credentials (URL, anon key, service role key)
3. ✅ Backup of current project (if you need the data)
4. ✅ 30-60 minutes of uninterrupted time

### What Will Happen:
- ❌ Current project will be UNLINKED (but NOT deleted)
- ✅ New project will be linked
- ✅ All migrations will be deployed to new project
- ✅ App will connect to new project
- ⚠️ **Data from old project will NOT be transferred automatically**

---

## 🎯 DECISION POINT: DO YOU NEED OLD DATA?

### Option A: Fresh Start (No Data Transfer)
**Choose if:**
- Starting completely fresh
- Old project was just for testing
- Don't need any existing data

**Steps:** Follow this guide as-is

### Option B: Migrate Data from Old Project
**Choose if:**
- Need to preserve user accounts
- Have production data to migrate
- Want to continue from where you left off

**Steps:** 
1. First backup old project data (see Step 1)
2. Follow this guide to switch
3. Then restore data to new project (see Step 7)

---

## 📝 STEP-BY-STEP GUIDE

---

## STEP 1: BACKUP CURRENT PROJECT (OPTIONAL BUT RECOMMENDED)

### 1.1 Login to Current Supabase Account

```powershell
# Login to your CURRENT Supabase account
supabase login
```

### 1.2 Link to Current Project (if not already linked)

```powershell
# Check if already linked
supabase projects list

# If not linked, link to current project
supabase link --project-ref kkpkpybqbtmcvriqrmrt
```

### 1.3 Backup Database Schema and Data

```powershell
# Backup schema only
supabase db dump -f "backup_old_project_schema_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Backup data only (if you need it)
supabase db dump --data-only -f "backup_old_project_data_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Or backup everything (schema + data)
supabase db dump -f "backup_old_project_full_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
```

**Expected output:**
```
Dumping schemas from remote database...
Dumping data from remote database...
Saved database dump to backup_old_project_full_20250127_123456.sql
```

### 1.4 Backup Edge Functions (if any)

```powershell
# Edge functions are already in supabase/functions/
# Just make sure they're committed to git
git status
git add supabase/functions/
git commit -m "Backup edge functions before account switch"
```

### 1.5 Document Current Project Settings

Save this information somewhere safe:

```
OLD PROJECT DETAILS:
- Project Ref: kkpkpybqbtmcvriqrmrt
- Project URL: https://kkpkpybqbtmcvriqrmrt.supabase.co
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrcGtweWJxYnRtY3ZyaXFybXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxODcwOTMsImV4cCI6MjA4MTc2MzA5M30.CXOjTHzYBV-KcZeu4Zh8sy1WZkFDUUc0CGZ34TNEv-8`
- Service Role Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrcGtweWJxYnRtY3ZyaXFybXJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE4NzA5MywiZXhwIjoyMDgxNzYzMDkzfQ.dI-jQ2bm_-7EBcnYUSHmSoQOlT_5KkHEYA6NOOnc1r0`
- Any custom domain settings
- Any third-party integrations (Stripe, etc.)
```

---

## STEP 2: GET NEW PROJECT CREDENTIALS

### 2.1 Create New Project (if not already created)

1. Go to https://supabase.com/dashboard
2. Login to your NEW account
3. Click "New Project"
4. Fill in:
   - **Name:** WrenchGoApp (or your preferred name)
   - **Database Password:** []
   - **Region:** Choose closest to your users
   - **Pricing Plan:** micro

### 2.2 Get New Project Credentials

Once project is created:

1. Go to **Settings → API**
2. Copy and save:
   - **Project URL:** `https://komsqqxqirvfgforixxq.supabase.co`
   - **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbXNxcXhxaXJ2Zmdmb3JpeHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTc0NDMsImV4cCI6MjA4Mjg3MzQ0M30.V9XbSCp5UNj_rHdyQ0-tYuwaRjmnz7x6y_QzORFKVJs`
   - **Service Role Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbXNxcXhxaXJ2Zmdmb3JpeHhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzI5NzQ0MywiZXhwIjoyMDgyODczNDQzfQ.vTqny2Z2ijORkbdXN3OLGRJLtbpstaBjw4VOOSvhg3c` 

3. Go to **Settings → Database**
4. Copy and save:
   - **Database Password:** [DHrHhuWxTLH6acid]
   - **Connection String:** (optional, for direct DB access)

**Save these in a secure location!**

---

## STEP 3: UNLINK CURRENT PROJECT

### 3.1 Check Current Link Status

```powershell
supabase status
```

If it shows a linked project, proceed to unlink.

### 3.2 Stop Local Supabase (if running)

```powershell
supabase stop
```

### 3.3 Unlink Current Project

```powershell
supabase unlink
```

**Expected output:**
```
Unlinked project.
```

### 3.4 Verify Unlinked

```powershell
supabase status
```

**Expected output:**
```
Error: Cannot find project ref. Have you run supabase init?
```

This is normal - it means you're unlinked.

---

## STEP 4: LINK TO NEW PROJECT

### 4.1 Login to New Supabase Account

```powershell
# Logout from old account
supabase logout

# Login to NEW account
supabase login
```

This will open a browser. Login with your NEW Supabase account credentials.

### 4.2 List Available Projects

```powershell
supabase projects list
```

**Expected output:**
```
┌─────────────────────┬──────────────────┬───────────────┐
│ NAME                │ PROJECT REF      │ REGION        │
├─────────────────────┼──────────────────┼───────────────┤
│ WrenchGoApp         │ [new-ref]        │ us-east-1     │
└─────────────────────┴──────────────────┴───────────────┘
```

### 4.3 Link to New Project

```powershell
# Replace [new-project-ref] with your actual new project ref
supabase link --project-ref `kkesntulcjvpjigxympm`
```

**Example:**
```powershell
supabase link --project-ref  `komsqqxqirvfgforixxq`
```

**Expected output:**
```
Enter your database password (or leave blank to skip):
```

Enter the database password you set when creating the new project.

**Expected output:**
```
Linked to project [new-project-ref]
```

### 4.4 Verify Link

```powershell
supabase status
```

**Expected output:**
```
supabase local development setup is running.
API URL: http://localhost:54321
...
Linked to project: [new-project-ref]
```

---

## STEP 5: UPDATE ENVIRONMENT VARIABLES

### 5.1 Update .env File

Edit `.env` file with NEW project credentials:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://komsqqxqirvfgforixxq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbXNxcXhxaXJ2Zmdmb3JpeHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTc0NDMsImV4cCI6MjA4Mjg3MzQ0M30.V9XbSCp5UNj_rHdyQ0-tYuwaRjmnz7x6y_QzORFKVJs

# Keep your other variables unchanged
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=963117461446-6kp1d7uli8072vb1fmn9ia2d7vm8vm7u.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=963117461446-ocs016rvk7ajhkkmiv0nhfsnkf7pqtut.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID= 
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SjRw5CbI6iTk3mehc0OEXJuNjTBEL46pUVByK2RpKn0v3K6F4M9N7ESO9o739Cq84kMeTWUffJv9yboAGNZDwHd00Z00FSBFk
```

### 5.2 Update .env.local (if exists)

If you have `supabase/.env.local` for Edge Functions:

```bash
# Update with new project credentials if needed
PROJECT_B_URL=https://[new-project-ref].supabase.co
PROJECT_B_SERVICE_ROLE_KEY=[new-service-role-key]
```

### 5.3 Verify No Old Credentials Remain

```powershell
# Search for old project ref in all files
Get-ChildItem -Recurse -File | Select-String "kkpkpybqbtmcvriqrmrt" | Select-Object Path, LineNumber, Line
```

If any files still reference the old project, update them.

---

## STEP 6: DEPLOY MIGRATIONS TO NEW PROJECT

### 6.1 Review Your Migrations

```powershell
ls supabase/migrations/
```

You should see your migration files (e.g., `20250127000001_baseline_schema.sql`, etc.)

### 6.2 Push Migrations to New Project

```powershell
supabase db push
```

**Expected output:**
```
Applying migration 20250127000001_baseline_schema.sql...
Applying migration 20250127000002_rls_policies.sql...
Applying migration 20250127000003_functions_triggers.sql...
Applying migration 20250127000004_indexes_performance.sql...
Applying migration 20250127000005_seed_data.sql...
Applying migration 20250127000006_project_b_integration.sql...
Finished supabase db push.
```

### 6.3 Verify Schema

```powershell
# Check tables were created
supabase db remote exec "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

**Expected output:**
```
profiles
mechanics
customers
quotes
reviews
skills
tools
safety_measures
... (all your tables)
```

---

## STEP 7: DEPLOY EDGE FUNCTIONS (if any)

### 7.1 List Edge Functions

```powershell
ls supabase/functions/
```

### 7.2 Deploy All Edge Functions

```powershell
# Deploy all functions
Get-ChildItem supabase/functions -Directory | ForEach-Object {
    Write-Host "Deploying $($_.Name)..."
    supabase functions deploy $_.Name
}
```

**Or deploy individually:**
```powershell
supabase functions deploy project-b-proxy
supabase functions deploy [other-function-name]
```

### 7.3 Set Edge Function Secrets (if needed)

```powershell
# Example: Set secrets for project-b-proxy
supabase secrets set PROJECT_B_URL=https://your-project-b.supabase.co
supabase secrets set PROJECT_B_SERVICE_ROLE_KEY=your-key
```

---

## STEP 8: MIGRATE DATA (OPTIONAL - If you backed up data)

### 8.1 Restore Data from Backup

```powershell
# If you backed up data in Step 1.3
supabase db remote exec < backup_old_project_data_20250127_123456.sql
```

**⚠️ WARNING:** This will insert data into your new project. Make sure:
- Schema is already deployed (Step 6)
- No conflicting data exists
- UUIDs don't conflict

### 8.2 Verify Data Restored

```powershell
# Check row counts
supabase db remote exec "SELECT 'profiles' as table_name, COUNT(*) FROM profiles
UNION ALL SELECT 'mechanics', COUNT(*) FROM mechanics
UNION ALL SELECT 'customers', COUNT(*) FROM customers;"
```

---

## STEP 9: TEST LOCAL DEVELOPMENT

### 9.1 Start Local Supabase

```powershell
supabase start
```

**Expected output:**
```
Started supabase local development setup.
API URL: http://localhost:54321
...
```

### 9.2 Test Local Database

```powershell
# Check local tables
supabase db remote exec "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

### 9.3 Test App Connection

```powershell
# Start your app
npm start
```

Try to:
- Sign up a new user
- Login
- Perform basic operations
- Verify data is going to NEW project

---

## STEP 10: VERIFY PRODUCTION

### 10.1 Check Supabase Dashboard

1. Go to NEW project dashboard
2. Navigate to **Table Editor**
3. Verify tables exist
4. Check data (if you migrated any)

### 10.2 Check RLS Policies

1. Go to **Authentication → Policies**
2. Verify all RLS policies are in place

### 10.3 Check Edge Functions

1. Go to **Edge Functions**
2. Verify all functions are deployed
3. Check logs for any errors

### 10.4 Test App in Production

1. Build and deploy your app (if needed)
2. Test all critical flows:
   - User signup/login
   - Profile creation
   - Role selection
   - Quote creation
   - Reviews
   - Any other critical features

---

## ✅ SUCCESS CHECKLIST

After completing all steps, verify:

- [ ] Old project unlinked
- [ ] New project linked (`supabase status` shows new project ref)
- [ ] `.env` file updated with new credentials
- [ ] All migrations deployed successfully
- [ ] All tables exist in new project
- [ ] RLS policies are active
- [ ] Edge Functions deployed (if any)
- [ ] Secrets configured (if any)
- [ ] Data migrated (if needed)
- [ ] Local development works (`supabase start`)
- [ ] App connects to new project
- [ ] User signup/login works
- [ ] All critical features work
- [ ] No references to old project ref in code

---

## 🔄 ROLLBACK PLAN (If Something Goes Wrong)

If you need to rollback to old project:

```powershell
# 1. Unlink new project
supabase unlink

# 2. Logout from new account
supabase logout

# 3. Login to old account
supabase login

# 4. Link to old project
supabase link --project-ref kkpkpybqbtmcvriqrmrt

# 5. Restore .env file
# (Use git to restore or manually update)

# 6. Restart local development
supabase start
```

---

## 📊 COMPARISON: OLD vs NEW

| Item | Old Project | New Project |
|------|-------------|-------------|
| **Project Ref** | `kkpkpybqbtmcvriqrmrt` | `[new-ref]` |
| **URL** | `https://kkpkpybqbtmcvriqrmrt.supabase.co` | `https://[new-ref].supabase.co` |
| **Account** | [Old account email] | [New account email] |
| **Region** | [Old region] | [New region] |
| **Plan** | [Old plan] | [New plan] |

---

## 🆘 TROUBLESHOOTING

### Issue: "Cannot find project ref"

**Solution:**
```powershell
supabase link --project-ref [your-new-project-ref]
```

### Issue: "Migration failed"

**Solution:**
1. Check migration file syntax
2. Run migrations one by one to identify problematic migration
3. Check Supabase Dashboard → Database → Logs for errors

### Issue: "Edge Function deployment failed"

**Solution:**
1. Check function code for errors
2. Verify secrets are set
3. Check function logs in Dashboard

### Issue: "App can't connect to new project"

**Solution:**
1. Verify `.env` file has correct credentials
2. Restart Expo dev server
3. Clear app cache
4. Check Supabase Dashboard → API → URL and keys

### Issue: "RLS policies blocking access"

**Solution:**
1. Check RLS policies in Dashboard
2. Verify user authentication is working
3. Check policy conditions match your use case

---

## 📚 ADDITIONAL RESOURCES

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase Project Management](https://supabase.com/docs/guides/platform/project-management)

---

## 📝 NOTES

- Keep backup files safe for at least 30 days
- Document any custom configurations from old project
- Update any external services pointing to old project (webhooks, etc.)
- Update any documentation with new project details
- Notify team members of the switch

---

**Last Updated:** 2025-01-27
**Version:** 1.0
