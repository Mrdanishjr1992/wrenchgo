# 🔴 CRITICAL: How to Disable JWT Verification in Supabase

## The 401 Error Explained

Your Edge Function is returning "Unauthorized" because Supabase is blocking the request **before** it even reaches your function code.

---

## ✅ EXACT STEPS TO FIX

### **Step 1: Go to Edge Functions**
https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

### **Step 2: Click on the Function**
Click on: **`stripe-connect-create-account-link`**

### **Step 3: Look for These Specific Locations**

#### **Location A: Function Details Page**
After clicking the function, you should see:

```
┌─────────────────────────────────────────────┐
│ stripe-connect-create-account-link          │
├─────────────────────────────────────────────┤
│                                             │
│ [Details] [Logs] [Settings] [Invocations]  │  <-- Click "Settings"
│                                             │
└─────────────────────────────────────────────┘
```

Click **"Settings"** tab, then look for:
- **"Verify JWT"** toggle
- **"Require authentication"** checkbox
- **"JWT Verification"** option

**DISABLE/UNCHECK IT**

---

#### **Location B: Three-Dot Menu**
Look for a three-dot menu (⋮) next to the function name:

```
stripe-connect-create-account-link  [⋮]
                                     │
                                     ├─ Edit
                                     ├─ Settings  <-- Click this
                                     ├─ Delete
                                     └─ ...
```

Click **"Settings"**, then disable JWT verification.

---

#### **Location C: Edit Function**
If you see an **"Edit"** button:

1. Click **"Edit"**
2. Look for a checkbox or toggle near the top that says:
   - "Verify JWT"
   - "Require authentication"
   - "Enable JWT verification"
3. **UNCHECK IT**
4. Click **"Save"** or **"Deploy"**

---

#### **Location D: Function Configuration Panel**
On the right side of the screen, look for a panel with:

```
┌─────────────────────────┐
│ Configuration           │
├─────────────────────────┤
│ Name: stripe-connect... │
│ Region: us-east-1       │
│                         │
│ Authentication          │
│ ☑ Verify JWT           │  <-- UNCHECK THIS
│                         │
└─────────────────────────┘
```

---

## 🔍 What You're Looking For

The setting might be called:
- ✅ "Verify JWT"
- ✅ "JWT Verification"
- ✅ "Require authentication"
- ✅ "Require JWT token"
- ✅ "Enable authentication"

**Whatever it's called, you need to DISABLE/UNCHECK it.**

---

## 🆘 If You STILL Can't Find It

### Try This: Check Project Settings

1. Go to: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/settings/api

2. Look for **"Edge Functions"** section

3. Check if there's a global setting like:
   - "Require JWT for all functions"
   - "Default JWT verification"

4. If found, **DISABLE IT**

---

## 🔄 Alternative: Redeploy the Function

If you absolutely cannot find the JWT setting, let's redeploy:

### **Step 1: Delete the Function**
1. Go to Functions dashboard
2. Find `stripe-connect-create-account-link`
3. Click three-dot menu (⋮) → **Delete**
4. Confirm deletion

### **Step 2: Create New Function**
1. Click **"Create a new function"**
2. Name: `stripe-connect-create-account-link`
3. **IMPORTANT:** Look for "Verify JWT" checkbox during creation
4. **MAKE SURE IT'S UNCHECKED**
5. Paste the code from `supabase/functions/stripe-connect-create-account-link/index.ts`
6. Add secrets:
   - `STRIPE_SECRET_KEY` = Your Stripe test secret key
   - `SUPABASE_SERVICE_ROLE_KEY` = Your service role key
   - `APP_SCHEME` = `wrenchgo`
7. Deploy

---

## 📸 Send Me Screenshots

If you're still stuck, take screenshots of:

1. **The function details page** (after clicking the function)
2. **Any tabs you see** (Details, Settings, Logs, etc.)
3. **The three-dot menu options** (if you see one)
4. **The function creation/edit screen** (if you can access it)

This will help me pinpoint exactly where the setting is.

---

## 🎯 Why This Matters

The JWT verification setting is **blocking your request at the gateway level** before it even reaches your function code. That's why you're getting 401.

Once disabled:
- ✅ Your request will reach the function
- ✅ The function will verify the user using `supabaseClient.auth.getUser()`
- ✅ Everything will work!

---

## ⚡ Quick Test After Disabling

1. **Wait 30-60 seconds** for changes to propagate
2. **Restart your app:** `npx expo start --clear`
3. **Try the button again**
4. **Check logs** - should show `Response status: 200`

---

**The setting MUST exist - every Supabase Edge Function has this configuration!** 🔧

Let me know what you see in the dashboard and I'll help you find it!
