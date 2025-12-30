# 🔧 FIX: "Not a valid URL" Error

## 🎯 The Problem

The error **"Not a valid URL"** means the `APP_SCHEME` environment variable is not set in your Edge Function.

Stripe is rejecting the return/refresh URLs because they're malformed.

---

## ✅ SOLUTION: Set APP_SCHEME Environment Variable

### **Step 1: Go to Edge Function Settings**
https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions/stripe-connect-create-account-link

### **Step 2: Find Secrets/Environment Variables**

Look for one of these sections:
- **"Secrets"** tab
- **"Environment Variables"** section
- **"Configuration"** panel
- **"Settings"** → "Secrets"

### **Step 3: Add APP_SCHEME**

**Name:** `APP_SCHEME`  
**Value:** `wrenchgo`

Click **"Add"** or **"Save"**

### **Step 4: Verify Other Secrets**

Make sure these are also set:

| Secret Name | Value |
|------------|-------|
| `STRIPE_SECRET_KEY` | Your Stripe test secret key (sk_test_...) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |
| `APP_SCHEME` | `wrenchgo` |

**Get your keys from:**
- Stripe: https://dashboard.stripe.com/test/apikeys
- Supabase: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/settings/api

### **Step 5: Redeploy (if needed)**

Some Supabase versions require redeployment after adding secrets:
1. Click **"Deploy"** or **"Redeploy"** button
2. Wait 30 seconds

---

## 🔍 How to Find Secrets Section

### **Method 1: Function Details Page**
1. Go to Functions: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions
2. Click on: `stripe-connect-create-account-link`
3. Look for tabs: **[Details] [Logs] [Settings] [Secrets]**
4. Click **"Secrets"** tab

### **Method 2: Settings Tab**
1. Click on the function
2. Click **"Settings"** tab
3. Scroll down to **"Environment Variables"** or **"Secrets"**

### **Method 3: Edit Function**
1. Click **"Edit"** or three-dot menu (⋮) → "Edit"
2. Look for **"Secrets"** or **"Environment Variables"** section
3. Add the secret there

---

## 🧪 Test After Setting

### **Step 1: Wait**
Wait 30-60 seconds for changes to propagate

### **Step 2: Restart App**
```powershell
npx expo start --clear
```

### **Step 3: Try Again**
1. Open app
2. Go to Profile tab
3. Click **"SETUP STRIPE ACCOUNT"**

### **Step 4: Check Logs**
Go to: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions/stripe-connect-create-account-link/logs

You should see:
```
App scheme: wrenchgo
Return URL: wrenchgo://stripe-connect-return
Refresh URL: wrenchgo://stripe-connect-refresh
Creating account link...
Success! Returning account link
```

---

## 📋 What These URLs Do

**Return URL:** `wrenchgo://stripe-connect-return`
- Where Stripe redirects after successful onboarding
- Your app will handle this deep link

**Refresh URL:** `wrenchgo://stripe-connect-refresh`
- Where Stripe redirects if the link expires
- Allows user to restart onboarding

These are **deep links** that open your app.

---

## 🆘 If You Can't Find Secrets Section

### **Alternative: Redeploy with Updated Code**

I've updated the Edge Function with better logging. Redeploy it:

1. **Go to Functions:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions
2. **Click:** `stripe-connect-create-account-link`
3. **Click "Edit"**
4. **Replace code** with updated version from:
   `supabase/functions/stripe-connect-create-account-link/index.ts`
5. **Look for "Secrets" or "Environment Variables" section**
6. **Add:** `APP_SCHEME` = `wrenchgo`
7. **Deploy**

---

## 🔑 Complete Secrets Checklist

Before deploying, verify ALL secrets are set:

- [ ] `STRIPE_SECRET_KEY` = `sk_test_...` (from Stripe dashboard)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJ...` (from Supabase settings)
- [ ] `APP_SCHEME` = `wrenchgo`

**Missing any of these will cause errors!**

---

## 📸 Visual Guide

When you find the Secrets section, it should look like:

```
┌─────────────────────────────────────────────┐
│ Secrets                                     │
├─────────────────────────────────────────────┤
│                                             │
│ Name                    Value               │
│ ─────────────────────────────────────────   │
│ STRIPE_SECRET_KEY       sk_test_...         │
│ SUPABASE_SERVICE_...    eyJ...              │
│ APP_SCHEME              wrenchgo            │
│                                             │
│ [+ Add secret]                              │
│                                             │
└─────────────────────────────────────────────┘
```

Click **"+ Add secret"** to add `APP_SCHEME`.

---

## 🎯 Expected Result

After setting `APP_SCHEME`:

**Console logs:**
```
✅ Response status: 200
✅ Response data: { url: "https://connect.stripe.com/...", ... }
```

**App behavior:**
- Browser opens with Stripe onboarding
- Mechanic can complete onboarding
- Returns to app after completion

---

## 💡 Why This Matters

The `APP_SCHEME` is used to create deep links that:
1. Open your app after Stripe onboarding
2. Pass data back to your app
3. Handle success/failure scenarios

Without it, Stripe can't redirect back to your app.

---

**Set the APP_SCHEME secret and test again!** 🚀
