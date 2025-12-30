# 🚀 DEPLOY: Fixed Stripe Connect Functions

## 🎯 What Changed

Stripe **requires HTTPS URLs** for return/refresh URLs, not deep links like `wrenchgo://`.

**Solution:**
- Created 2 new Edge Functions that act as web redirects
- These functions receive the HTTPS callback from Stripe
- Then redirect to your app via deep links

---

## 📦 NEW EDGE FUNCTIONS TO DEPLOY

You need to deploy **3 Edge Functions** total:

### **1. stripe-connect-create-account-link** (Updated)
- **Location:** `supabase/functions/stripe-connect-create-account-link/index.ts`
- **Purpose:** Creates Stripe Connect accounts and onboarding links
- **Secrets needed:**
  - `STRIPE_SECRET_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL` (auto-set by Supabase)

### **2. stripe-connect-return** (New)
- **Location:** `supabase/functions/stripe-connect-return/index.ts`
- **Purpose:** Handles successful Stripe onboarding completion
- **Secrets needed:**
  - `APP_SCHEME` = `wrenchgo`

### **3. stripe-connect-refresh** (New)
- **Location:** `supabase/functions/stripe-connect-refresh/index.ts`
- **Purpose:** Handles expired onboarding links
- **Secrets needed:**
  - `APP_SCHEME` = `wrenchgo`

---

## ✅ DEPLOYMENT STEPS

### **Step 1: Update stripe-connect-create-account-link**

1. **Go to:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

2. **Click on:** `stripe-connect-create-account-link`

3. **Click "Edit"** or three-dot menu (⋮) → "Edit"

4. **Replace the code** with contents from:
   ```
   supabase/functions/stripe-connect-create-account-link/index.ts
   ```

5. **Verify secrets are set:**
   - `STRIPE_SECRET_KEY` = Your Stripe test key (sk_test_...)
   - `SUPABASE_SERVICE_ROLE_KEY` = Your service role key
   - `SUPABASE_URL` = Should be auto-set

6. **Deploy**

---

### **Step 2: Create stripe-connect-return**

1. **Go to:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

2. **Click "Create a new function"** or **"New function"**

3. **Name:** `stripe-connect-return`

4. **Paste the code** from:
   ```
   supabase/functions/stripe-connect-return/index.ts
   ```

5. **Add secret:**
   - **Name:** `APP_SCHEME`
   - **Value:** `wrenchgo`

6. **IMPORTANT:** Make sure **"Verify JWT"** is **UNCHECKED**
   - This function needs to be publicly accessible

7. **Deploy**

---

### **Step 3: Create stripe-connect-refresh**

1. **Go to:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

2. **Click "Create a new function"** or **"New function"**

3. **Name:** `stripe-connect-refresh`

4. **Paste the code** from:
   ```
   supabase/functions/stripe-connect-refresh/index.ts
   ```

5. **Add secret:**
   - **Name:** `APP_SCHEME`
   - **Value:** `wrenchgo`

6. **IMPORTANT:** Make sure **"Verify JWT"** is **UNCHECKED**
   - This function needs to be publicly accessible

7. **Deploy**

---

## 🔍 VERIFY DEPLOYMENT

After deploying all 3 functions, verify they exist:

**Go to:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

**You should see:**
- ✅ `stripe-connect-create-account-link`
- ✅ `stripe-connect-return`
- ✅ `stripe-connect-refresh`

---

## 🧪 TEST THE FLOW

### **Step 1: Restart Your App**
```powershell
npx expo start --clear
```

### **Step 2: Try Stripe Onboarding**
1. Open app
2. Go to **Profile** tab (mechanic account)
3. Click **"SETUP STRIPE ACCOUNT"**

### **Step 3: Expected Flow**

**✅ Success Flow:**
1. App calls `stripe-connect-create-account-link`
2. Browser opens with Stripe onboarding
3. Complete Stripe onboarding
4. Stripe redirects to: `https://your-project.supabase.co/functions/v1/stripe-connect-return`
5. That function shows a nice page and redirects to: `wrenchgo://stripe-connect-return`
6. App opens and handles the deep link

**Console logs should show:**
```
✅ Response status: 200
✅ Response data: { url: "https://connect.stripe.com/...", ... }
```

---

## 🎨 What Users Will See

### **After Completing Onboarding:**
Users will see a beautiful page with:
- ✓ Setup Complete!
- "Returning to WrenchGo..."
- Automatic redirect to app
- Manual "Open WrenchGo" button as fallback

### **If Link Expires:**
Users will see:
- ⟳ Session Expired
- "Returning to WrenchGo to restart setup..."
- Automatic redirect to app

---

## 🔑 SECRETS CHECKLIST

Before testing, verify all secrets are set:

### **stripe-connect-create-account-link:**
- [ ] `STRIPE_SECRET_KEY` = `sk_test_...`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJ...`
- [ ] `SUPABASE_URL` = Auto-set (should be there)

### **stripe-connect-return:**
- [ ] `APP_SCHEME` = `wrenchgo`
- [ ] JWT Verification = **DISABLED**

### **stripe-connect-refresh:**
- [ ] `APP_SCHEME` = `wrenchgo`
- [ ] JWT Verification = **DISABLED**

---

## 🆘 TROUBLESHOOTING

### **Error: "Not a valid URL"**
- Make sure you deployed the **updated** `stripe-connect-create-account-link`
- Check that `SUPABASE_URL` is set correctly

### **Error: "Function not found"**
- Make sure you created `stripe-connect-return` and `stripe-connect-refresh`
- Check function names are exactly correct (no typos)

### **Browser opens but doesn't redirect to app**
- Check that `APP_SCHEME` is set to `wrenchgo` in both new functions
- Make sure deep linking is configured in your app (should already be done)

### **Still getting 401 errors**
- Make sure JWT verification is **DISABLED** on the two new functions
- They need to be publicly accessible

---

## 📊 CHECK THE LOGS

After testing, check logs for each function:

**stripe-connect-create-account-link:**
https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions/stripe-connect-create-account-link/logs

Should show:
```
Return URL: https://...supabase.co/functions/v1/stripe-connect-return
Refresh URL: https://...supabase.co/functions/v1/stripe-connect-refresh
Creating account link...
Success! Returning account link
```

**stripe-connect-return:**
https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions/stripe-connect-return/logs

Should show:
```
=== Stripe Connect Return ===
URL: https://...
Query params: { ... }
Redirecting to app: wrenchgo://stripe-connect-return?...
```

---

## 🎯 SUMMARY

**What you're deploying:**
1. **Updated** function that uses HTTPS URLs
2. **New** return handler that redirects to app
3. **New** refresh handler that redirects to app

**Why this works:**
- Stripe accepts HTTPS URLs ✅
- Your Edge Functions redirect to deep links ✅
- App receives the callback ✅

---

## 📚 FILES TO DEPLOY

Copy code from these files:

1. `supabase/functions/stripe-connect-create-account-link/index.ts`
2. `supabase/functions/stripe-connect-return/index.ts`
3. `supabase/functions/stripe-connect-refresh/index.ts`

---

**Deploy all 3 functions and test! This will fix the URL validation error.** 🚀
