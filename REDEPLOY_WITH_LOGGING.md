# 🔧 REDEPLOY EDGE FUNCTION WITH LOGGING

I've updated the Edge Function with detailed logging to help debug the 401 error.

---

## ✅ STEP 1: Redeploy the Updated Function

### **Via Supabase Dashboard:**

1. **Go to Edge Functions:**
   https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

2. **Find:** `stripe-connect-create-account-link`

3. **Click the three-dot menu (⋮) → "Edit"** or **"Update"**

4. **Replace the code** with the updated version from:
   `supabase/functions/stripe-connect-create-account-link/index.ts`

5. **CRITICAL: Look for "Verify JWT" checkbox**
   - **MAKE SURE IT'S UNCHECKED**
   - This is your chance to disable it!

6. **Click "Deploy" or "Save"**

---

## 🔍 STEP 2: Check the Logs

After redeploying, try the button again and check the logs:

### **View Logs:**
https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions/stripe-connect-create-account-link/logs

### **What to Look For:**

**If JWT verification is STILL enabled, you'll see:**
```
(No logs appear - request blocked at gateway)
```

**If JWT verification is DISABLED, you'll see:**
```
=== Stripe Connect Account Link Request ===
Method: POST
Headers: { ... }
Auth header present: true
Attempting to get user...
User result: { user: true, error: null }
User authenticated: abc-123-def-456
```

---

## 🎯 The Logs Will Tell Us Exactly What's Wrong

### **Scenario A: No logs appear**
**Problem:** JWT verification is blocking at gateway level
**Solution:** You MUST find and disable JWT verification setting

### **Scenario B: Logs show "No Authorization header provided"**
**Problem:** App isn't sending the token correctly
**Solution:** Check app code (but we already verified it's sending the token)

### **Scenario C: Logs show "Auth error: ..."**
**Problem:** Token is invalid or expired
**Solution:** Check token format and expiration

### **Scenario D: Logs show "User authenticated: ..."**
**Problem:** Function is working! Check for other errors in logs
**Solution:** Continue reading logs to see what failed

---

## 🔄 Alternative: Delete and Recreate

If you can't find the "Edit" option or JWT setting:

### **Step 1: Delete the Function**
1. Go to Functions dashboard
2. Find `stripe-connect-create-account-link`
3. Three-dot menu (⋮) → **Delete**
4. Confirm

### **Step 2: Create New Function**
1. Click **"Create a new function"** or **"New function"**
2. **Name:** `stripe-connect-create-account-link`
3. **LOOK FOR JWT VERIFICATION CHECKBOX**
   - It might be called:
     - "Verify JWT"
     - "Require authentication"
     - "Enable JWT verification"
   - **UNCHECK IT!**
4. **Paste the code** from `supabase/functions/stripe-connect-create-account-link/index.ts`
5. **Add secrets:**
   - `STRIPE_SECRET_KEY` = Your Stripe test secret key (sk_test_...)
   - `SUPABASE_SERVICE_ROLE_KEY` = Your service role key
   - `APP_SCHEME` = `wrenchgo`
6. **Deploy**

---

## 📸 During Creation, Look for This:

When creating/editing the function, you should see something like:

```
┌─────────────────────────────────────┐
│ Create Edge Function                │
├─────────────────────────────────────┤
│                                     │
│ Name: stripe-connect-create-...    │
│                                     │
│ Code: [editor]                      │
│                                     │
│ ☐ Verify JWT                       │  <-- UNCHECK THIS!
│ ☐ Require authentication           │  <-- OR THIS!
│                                     │
│ [Cancel]  [Deploy]                  │
│                                     │
└─────────────────────────────────────┘
```

**MAKE SURE THE CHECKBOX IS UNCHECKED!**

---

## 🧪 Test After Redeploying

1. **Wait 30 seconds** for deployment to complete

2. **Restart your app:**
   ```bash
   npx expo start --clear
   ```

3. **Try the button again**

4. **Check the logs immediately:**
   - Go to Function logs in Supabase
   - You should see the detailed logging output
   - This will tell us exactly what's happening

---

## 💡 Key Point

The updated function now has **detailed logging** that will show us:
- ✅ If the request is reaching the function
- ✅ If the Authorization header is present
- ✅ If the user authentication is working
- ✅ Exactly where it's failing

**Once you redeploy, the logs will reveal the exact issue!**

---

## 🆘 Still Getting 401 with No Logs?

If you redeploy and still get 401 with **no logs appearing**, it means:

**JWT verification is STILL enabled at the gateway level.**

In this case, you need to:
1. Contact Supabase support, OR
2. Check project-level settings, OR
3. Try creating the function via CLI instead of dashboard

---

**Redeploy the function and check the logs - they'll tell us everything!** 🔍
