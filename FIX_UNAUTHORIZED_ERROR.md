# 🔧 Fix: Unauthorized Error

## Problem
The Edge Function is returning "Unauthorized" when you click the button.

## Cause
The Edge Function was deployed **with JWT verification enabled**, but it needs to accept requests from authenticated users.

---

## ✅ Solution: Redeploy with Correct Settings

### Option 1: Via Supabase Dashboard (Recommended)

1. **Go to Edge Functions:**
   - https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

2. **Find `stripe-connect-create-account-link`:**
   - Click on it

3. **Check "Verify JWT" setting:**
   - If it's **enabled** (checked), that's the issue
   - **Disable it** (uncheck)
   - Click "Save"

4. **Test again:**
   - Go back to your app
   - Try clicking "SETUP STRIPE ACCOUNT" again

---

### Option 2: Check Function Configuration

The function should have these settings:

**In Supabase Dashboard → Functions → stripe-connect-create-account-link:**

- ✅ **Verify JWT:** DISABLED (unchecked)
- ✅ **Import Map:** Not required (function has direct imports)

**Why?** The function uses the Authorization header to get the user, but doesn't need JWT verification at the edge level.

---

## 🧪 Test the Fix

After disabling JWT verification:

1. **Restart your app** (if needed)
2. **Login as mechanic**
3. **Go to Profile → Payout Account**
4. **Click "SETUP STRIPE ACCOUNT"**
5. **Should open Stripe onboarding page** ✅

---

## 🐛 Still Getting Error?

### Check Edge Function Logs:

1. Go to: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions/stripe-connect-create-account-link/logs

2. Look for recent errors

3. Common issues:
   - **"STRIPE_SECRET_KEY not set"** → Add secret in Function settings
   - **"SUPABASE_URL not set"** → Should be auto-set, check secrets
   - **"SUPABASE_ANON_KEY not set"** → Should be auto-set, check secrets

### Verify Secrets are Set:

In Function settings, make sure these are set:

- ✅ `STRIPE_SECRET_KEY` = Your Stripe test secret key (sk_test_...)
- ✅ `SUPABASE_URL` = Auto-set by Supabase
- ✅ `SUPABASE_ANON_KEY` = Auto-set by Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = Your service role key
- ✅ `APP_SCHEME` = `wrenchgo` (or your app scheme)

---

## 📝 Alternative: Test with Direct API Call

To verify the function works, test it directly:

```bash
curl -X POST \
  https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-connect-create-account-link \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Replace `YOUR_USER_JWT_TOKEN` with your actual JWT token (you can get it from the app's session).

If this works, the issue is in the app's request. If it fails, the issue is in the Edge Function.

---

## 🎯 Quick Fix Summary

1. Go to Supabase Dashboard → Functions
2. Click `stripe-connect-create-account-link`
3. **Disable "Verify JWT"**
4. Save
5. Test again

**This should fix the unauthorized error!** ✅
