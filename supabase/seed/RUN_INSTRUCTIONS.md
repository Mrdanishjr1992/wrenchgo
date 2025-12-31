# Supabase Seed Script - Run Instructions

## Get Your Service Role Key
1. Go to https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/settings/api
2. Copy the `service_role` key (NOT the anon key)

## Run the Seed Script

### PowerShell (Windows):
```powershell
$env:SUPABASE_URL="https://kkpkpybqbtmcvriqrmrt.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
node supabase/seed/seed-data.js
```

### Bash (Mac/Linux):
```bash
export SUPABASE_URL="https://kkpkpybqbtmcvriqrmrt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
node supabase/seed/seed-data.js
```

## What It Does
- Validates all 156 symptom_mappings and 400+ symptom_questions
- Normalizes data (trim, lowercase keys, dedupe arrays)
- Upserts to Supabase (safe to re-run)
- Logs warnings for any invalid rows
- Skips duplicates automatically

## Status
✓ @supabase/supabase-js installed
✓ data.json validated (quote_strategy fixed)
✓ Script ready to run

⚠️ Waiting for SUPABASE_SERVICE_ROLE_KEY
