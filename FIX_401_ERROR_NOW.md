# 🔴 URGENT FIX: 401 Unauthorized Error

## The Problem
You're getting a **401 error** because JWT verification is enabled on the Edge Function.

---

## ✅ SOLUTION: Disable JWT Verification

### **Step-by-Step Instructions:**

#### 1. Open Supabase Dashboard
Go to: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

#### 2. Find the Function
- You'll see a list of Edge Functions
- Look for: **`stripe-connect-create-account-link`**
- Click on it

#### 3. Look for Settings/Configuration
You should see one of these options:

**Option A: "Verify JWT" Toggle**
- Look for a toggle/checkbox labeled "Verify JWT" or "JWT Verification"
- **Turn it OFF** (uncheck/disable)
- Click "Save" or "Update"

**Option B: Function Configuration Tab**
- Click on "Settings" or "Configuration" tab
- Find "JWT Verification" setting
- **Disable it**
- Save changes

**Option C: If you see "Edit Function" button**
- Click "Edit Function"
- Look for JWT verification setting in the editor
- Disable it
- Deploy/Save

#### 4. Verify the Change
After disabling:
- The function should show "JWT Verification: Disabled" or similar
- You might need to wait 10-30 seconds for changes to take effect

---

## 🔄 Alternative: Redeploy Without JWT Verification

If you can't find the toggle, you may need to redeploy the function.

### Via Supabase Dashboard:

1. **Go to Functions:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

2. **Click "Create a new function"** or find the existing function

3. **When deploying, make sure:**
   - JWT Verification is **DISABLED** or **UNCHECKED**
   - Or look for "Require authentication" and **UNCHECK** it

---

## 🧪 Test After Disabling

1. **Wait 30 seconds** for changes to propagate

2. **Restart your app:**
   ```bash
   # Stop the current Expo server (Ctrl+C)
   npx expo start --clear
   ```

3. **Try again:**
   - Login as mechanic
   - Go to Profile → Payout Account
   - Click "SETUP STRIPE ACCOUNT"

4. **Check console logs:**
   - Should now show: `Response status: 200` ✅
   - Instead of: `Response status: 401` ❌

---

## 📸 What to Look For

In the Supabase Dashboard, you're looking for something like:

```
Function: stripe-connect-create-account-link

Settings:
  ☐ Verify JWT          <-- This should be UNCHECKED
  ☐ Require Auth        <-- Or this should be UNCHECKED
```

---

## 🆘 Still Getting 401?

### Check These:

1. **Did you save the changes?**
   - Make sure you clicked "Save" or "Update"

2. **Did you wait 30 seconds?**
   - Changes can take a moment to propagate

3. **Did you restart the app?**
   - Stop Expo server and restart with `--clear` flag

4. **Check the function logs:**
   - Go to: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions/stripe-connect-create-account-link/logs
   - Look for recent 401 errors
   - They should show why it's failing

---

## 🎯 Quick Summary

**The fix is simple:**
1. Go to Supabase Dashboard → Functions
2. Click `stripe-connect-create-account-link`
3. Find "Verify JWT" or "Require Auth" setting
4. **DISABLE IT** (uncheck)
5. Save
6. Wait 30 seconds
7. Restart app and test

---

## 📞 Need More Help?

If you can't find the JWT verification setting:

1. **Take a screenshot** of the function settings page
2. **Share it** so I can see exactly what options are available
3. Or **describe what you see** in the function settings

The setting MUST be there somewhere - it's how the function is configured to verify authentication.

---

**Once you disable JWT verification, the 401 error will be fixed!** ✅
