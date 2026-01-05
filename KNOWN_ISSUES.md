# WrenchGo - Known Issues & Solutions

## Current Issues

### 1. ✅ FIXED: ID Photo Upload - http_request_queue Constraint Violation
**Error**: `null value in column "url" of relation "http_request_queue" violates not-null constraint`

**Root Cause**: 
- A webhook is configured in the Supabase dashboard on the `profiles` table
- The webhook URL is null or not properly configured
- When profile is updated (ID photo upload), it tries to queue an HTTP request with null URL

**Solution**:
1. ✅ Applied migration `20250204000014_fix_webhook_queue.sql` to clean up null URL entries
2. **ACTION REQUIRED**: Go to Supabase Dashboard → Database → Webhooks
   - Either DELETE the webhook on the `profiles` table
   - Or configure it with a proper URL endpoint

**Temporary Workaround**: The migration cleans up the queue, but the webhook will continue to fail until properly configured or removed.

---

### 2. ⚠️ PENDING: Stripe Setup - Invalid JWT Error
**Error**: `Response status: 401`, `"message": "Invalid JWT"`

**Root Cause**:
- The edge function `stripe-connect-create-account-link` deployed on Supabase is outdated
- Local deployment fails on Windows due to Docker/edge-runtime compatibility issues

**Solution**:
1. ✅ Updated local edge function code with better error handling
2. **ACTION REQUIRED**: Deploy via Supabase Dashboard:
   - Go to Edge Functions → stripe-connect-create-account-link
   - Click "Deploy" and upload the function from `supabase/functions/stripe-connect-create-account-link/`
   - Or deploy from a Linux/Mac machine using: `npx supabase functions deploy stripe-connect-create-account-link`

**Alternative**: The JWT might be expired. Try signing out and signing back in to get a fresh token.

---

### 3. ⚠️ Error Toast Persisting
**Issue**: Error toasts remain visible even after the error is resolved

**Solution**: Need to implement auto-dismiss or manual dismiss functionality for error toasts.

---

## Completed Fixes

### ✅ Schema 'net' Does Not Exist
- **Fixed**: Enabled `pg_net` extension via migration `20250204000013_enable_pg_net.sql`

### ✅ ID Status Type Error
- **Fixed**: Updated TypeScript type to include "none" value

### ✅ Tools & Equipment / Safety Measures Show "0 selected"
- **Status**: This is by design - these are UI-only features without database persistence
- Only `mechanic_skills` has database storage

---

## Deployment Checklist

- [x] Database migrations pushed to production
- [ ] Stripe edge function deployed (requires dashboard or Linux/Mac)
- [ ] Webhook configuration verified/removed in dashboard
- [ ] Test ID photo upload after webhook fix
- [ ] Test Stripe setup after edge function deployment
