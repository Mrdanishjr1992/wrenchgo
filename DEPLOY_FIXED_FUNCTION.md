# ✅ FIXED! Deploy This Updated Function

## 🎯 What Was Wrong

The error **"Auth session missing!"** happened because the Edge Function was trying to use the JWT token incorrectly.

**The Fix:**
- Changed from using `SUPABASE_ANON_KEY` with auth header
- Now using `SUPABASE_SERVICE_ROLE_KEY` with `getUser(token)` method
- This is the correct way to verify user tokens in Edge Functions

---

## 🚀 DEPLOY THE FIXED FUNCTION

### **Step 1: Go to Supabase Dashboard**
https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

### **Step 2: Find the Function**
Click on: **`stripe-connect-create-account-link`**

### **Step 3: Edit the Function**
- Click **"Edit"** or three-dot menu (⋮) → **"Edit"**

### **Step 4: Replace the Code**
Copy the entire contents of:
```
supabase/functions/stripe-connect-create-account-link/index.ts
```

Paste it into the editor, replacing all existing code.

### **Step 5: Verify Secrets**
Make sure these secrets are set:
- ✅ `STRIPE_SECRET_KEY` = Your Stripe test secret key (sk_test_...)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = Your service role key
- ✅ `APP_SCHEME` = `wrenchgo`

**To check/add secrets:**
1. Look for "Secrets" or "Environment Variables" section
2. Add any missing secrets
3. The service role key is found at:
   https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/settings/api

### **Step 6: Deploy**
Click **"Deploy"** or **"Save"**

### **Step 7: Wait**
Wait 30-60 seconds for deployment to complete

---

## 🧪 TEST THE FIX

### **Step 1: Restart Your App**
```bash
npx expo start --clear
```

### **Step 2: Try the Button**
1. Open the app
2. Go to **Profile** tab (mechanic account)
3. Scroll to **"Payout Account"** section
4. Click **"SETUP STRIPE ACCOUNT"**

### **Step 3: Check the Result**

**✅ SUCCESS - You should see:**
- App console: `Response status: 200`
- App console: `Response data: { url: "https://connect.stripe.com/...", ... }`
- Browser opens with Stripe onboarding

**❌ FAILURE - If you still see errors:**
- Check the Edge Function logs
- Share the error message with me

---

## 📊 Check the Logs

After testing, check the logs to see what happened:

**Go to:**
https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions/stripe-connect-create-account-link/logs

**You should see:**
```
=== Stripe Connect Account Link Request ===
Auth header present: true
Token extracted, length: 234
Verifying user token...
User result: { user: true, error: null }
User authenticated: abc-123-def-456
Creating new Stripe account for mechanic: abc-123-def-456
Created Stripe account: acct_xxxxx
Creating account link...
Retrieving account data...
Updating mechanic_stripe_accounts...
Success! Returning account link
```

---

## 🔑 Key Changes Made

### **Before (Broken):**
```typescript
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  {
    global: {
      headers: { Authorization: req.headers.get("Authorization")! },
    },
  }
);

const { data: { user } } = await supabaseClient.auth.getUser();
// ❌ This caused "Auth session missing!" error
```

### **After (Fixed):**
```typescript
const token = authHeader.replace("Bearer ", "");

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const { data: { user } } = await supabaseAdmin.auth.getUser(token);
// ✅ This correctly verifies the JWT token
```

---

## 💡 Why This Works

1. **Service Role Key**: Has admin privileges to verify any user's token
2. **getUser(token)**: Explicitly passes the JWT token for verification
3. **No Session Required**: Doesn't rely on session cookies or headers

This is the **standard pattern** for Edge Functions that need to verify user authentication.

---

## 🆘 If It Still Doesn't Work

If you still get errors after deploying:

1. **Check the logs** - They'll show exactly what's failing
2. **Verify secrets** - Make sure `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. **Share the error** - Send me the exact error message and logs

---

## 📚 What's Next

Once this works, you'll be able to:
1. ✅ Complete Stripe onboarding as a mechanic
2. ✅ Test the full payment flow
3. ✅ Verify mechanic earnings
4. ✅ Test promotion codes

---

**Deploy the updated function and test it! This should fix the 401 error.** 🚀
