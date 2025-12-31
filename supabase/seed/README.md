# Supabase Seed Data

## Files
- `data.json` - Seed data for symptom_mappings and symptom_questions
- `seed-data.js` - Node.js upsert script with validation

## Setup
```bash
npm install @supabase/supabase-js
```

## Run
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
node supabase/seed/seed-data.js
```

## Features
- Validates all fields and enums
- Normalizes data (trim, lowercase keys, dedupe arrays)
- Upserts (safe to re-run)
- Logs warnings for invalid rows
- Idempotent
