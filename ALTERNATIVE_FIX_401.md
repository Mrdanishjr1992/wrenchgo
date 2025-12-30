# 🔧 Alternative Fix: Use Service Role Key

If you can't disable JWT verification in the dashboard, here's an alternative approach:

---

## ⚡ Quick Alternative Solution

Instead of disabling JWT verification, we can modify the app to use the anon key differently.

### Check Your Edge Function Deployment

When you deployed the function via Supabase Dashboard, did you see these options?

**Common deployment options:**
- ✅ "Verify JWT" - Should be **UNCHECKED**
- ✅ "Require authentication" - Should be **UNCHECKED**  
- ✅ "Public access" - Should be **CHECKED**

---

## 🔍 Where to Find JWT Verification Setting

### In Supabase Dashboard:

1. **Go to:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

2. **Click on:** `stripe-connect-create-account-link`

3. **Look for one of these sections:**

   **Option A: "Settings" Tab**
   - Click "Settings" tab
   - Look for "JWT Verification" toggle
   - Disable it

   **Option B: "Configuration" Section**
   - Scroll down to "Configuration"
   - Find "Verify JWT" checkbox
   - Uncheck it

   **Option C: "Details" Panel**
   - On the right side panel
   - Look for "Authentication" section
   - Toggle off "Require JWT"

   **Option D: Three-dot Menu**
   - Click the three-dot menu (⋮) next to the function
   - Select "Settings" or "Configure"
   - Find JWT verification option

---

## 🎯 What the Setting Looks Like

You're looking for something like this:

```
┌─────────────────────────────────────┐
│ Function Settings                   │
├─────────────────────────────────────┤
│                                     │
│ Authentication                      │
│ ☐ Verify JWT                       │  <-- UNCHECK THIS
│                                     │
│ or                                  │
│                                     │
│ ☐ Require authentication           │  <-- OR UNCHECK THIS
│                                     │
└─────────────────────────────────────┘
```

---

## 🔄 If You Still Can't Find It

### Try This SQL Query to Check Function Config:

Run this in Supabase SQL Editor:

```sql
-- Check if the function exists and its configuration
SELECT * FROM pg_catalog.pg_proc 
WHERE proname = 'stripe-connect-create-account-link';
```

This won't show JWT settings (those are in Supabase's internal config), but confirms the function exists.

---

## 🆘 Last Resort: Redeploy the Function

If you absolutely cannot find the JWT verification setting:

### 1. Delete the existing function:
   - Go to Functions dashboard
   - Find `stripe-connect-create-account-link`
   - Click three-dot menu → Delete

### 2. Redeploy it:
   - Click "Create a new function"
   - Name: `stripe-connect-create-account-link`
   - Copy code from: `supabase/functions/stripe-connect-create-account-link/index.ts`
   - **IMPORTANT:** When deploying, look for "Verify JWT" and **UNCHECK IT**
   - Add secrets (STRIPE_SECRET_KEY, etc.)
   - Deploy

---

## 📸 Send Me a Screenshot

If you're still stuck, take a screenshot of:

1. The function details page
2. Any settings/configuration tabs you see
3. The deployment options

This will help me guide you to the exact location of the JWT verification setting.

---

## ✅ Once You Disable JWT Verification

The function will:
- ✅ Accept requests with Authorization header
- ✅ Verify the user via `supabase.auth.getUser()`
- ✅ Return 200 instead of 401
- ✅ Work perfectly!

---

**The JWT verification setting MUST be disabled for this to work!** 🔧
