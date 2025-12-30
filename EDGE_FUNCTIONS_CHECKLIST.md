# 📋 COMPLETE EDGE FUNCTIONS CHECKLIST

## 🎯 Edge Functions for Payment System

Here are **ALL** the Edge Functions you need to deploy for the complete payment system:

---

## ✅ REQUIRED FOR PAYMENTS (5 Functions)

### **1. create-payment-intent** ⭐ CRITICAL
- **Location:** `supabase/functions/create-payment-intent/index.ts`
- **Purpose:** Creates Stripe payment intents for job payments
- **Features:**
  - Validates customer and mechanic
  - Applies promotion codes
  - Calculates payment breakdown
  - Creates payment record in database
  - Handles Stripe Connect transfers
- **Secrets needed:**
  - `STRIPE_SECRET_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL`
- **JWT Verification:** ✅ ENABLED (requires auth)

---

### **2. stripe-webhook** ⭐ CRITICAL
- **Location:** `supabase/functions/stripe-webhook/index.ts`
- **Purpose:** Handles Stripe webhook events
- **Features:**
  - Updates payment status when payment succeeds/fails
  - Updates job status to "in_progress" on successful payment
  - Handles refunds and disputes
  - Logs all webhook events
- **Secrets needed:**
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL`
- **JWT Verification:** ❌ DISABLED (Stripe calls this directly)

---

### **3. validate-promotion** ⭐ REQUIRED
- **Location:** `supabase/functions/validate-promotion/index.ts`
- **Purpose:** Validates promotion codes before payment
- **Features:**
  - Checks if code exists and is active
  - Validates date range
  - Checks redemption limits
  - Calculates discount amount
- **Secrets needed:**
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL`
- **JWT Verification:** ✅ ENABLED (requires auth)

---

### **4. stripe-connect-create-account-link** ⭐ CRITICAL
- **Location:** `supabase/functions/stripe-connect-create-account-link/index.ts`
- **Purpose:** Creates Stripe Connect accounts for mechanics
- **Features:**
  - Creates Express Connect accounts
  - Generates onboarding links
  - Stores account info in database
- **Secrets needed:**
  - `STRIPE_SECRET_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL`
- **JWT Verification:** ✅ ENABLED (requires auth)

---

### **5. stripe-connect-return** ⭐ CRITICAL
- **Location:** `supabase/functions/stripe-connect-return/index.ts`
- **Purpose:** Handles successful Stripe onboarding completion
- **Features:**
  - Receives HTTPS callback from Stripe
  - Shows success page
  - Redirects to app via deep link
- **Secrets needed:**
  - `APP_SCHEME` = `wrenchgo`
- **JWT Verification:** ❌ DISABLED (Stripe redirects here)

---

## 🔄 OPTIONAL BUT RECOMMENDED (2 Functions)

### **6. stripe-connect-refresh**
- **Location:** `supabase/functions/stripe-connect-refresh/index.ts`
- **Purpose:** Handles expired Stripe onboarding links
- **Features:**
  - Receives HTTPS callback from Stripe
  - Shows refresh page
  - Redirects to app to restart onboarding
- **Secrets needed:**
  - `APP_SCHEME` = `wrenchgo`
- **JWT Verification:** ❌ DISABLED (Stripe redirects here)

---

### **7. stripe-connect-refresh-status**
- **Location:** `supabase/functions/stripe-connect-refresh-status/index.ts`
- **Purpose:** Manually refresh mechanic Stripe account status
- **Features:**
  - Fetches latest account data from Stripe
  - Updates database with current status
  - Returns updated account info
- **Secrets needed:**
  - `STRIPE_SECRET_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL`
- **JWT Verification:** ✅ ENABLED (requires auth)

---

## 🚫 NOT NEEDED FOR PAYMENTS (3 Functions)

### **8. delete-account**
- **Purpose:** Handles user account deletion
- **Not related to payments**

### **9. verify-id-photo**
- **Purpose:** ID verification for mechanics
- **Not related to payments**

### **10. verify-id-photo-simple**
- **Purpose:** Simplified ID verification
- **Not related to payments**

---

## 📊 DEPLOYMENT PRIORITY

### **🔴 MUST DEPLOY (Critical for payments to work):**
1. ✅ `create-payment-intent`
2. ✅ `stripe-webhook`
3. ✅ `stripe-connect-create-account-link`
4. ✅ `stripe-connect-return`

### **🟡 SHOULD DEPLOY (Recommended):**
5. ✅ `validate-promotion`
6. ✅ `stripe-connect-refresh`
7. ✅ `stripe-connect-refresh-status`

### **⚪ OPTIONAL (Not payment-related):**
- `delete-account`
- `verify-id-photo`
- `verify-id-photo-simple`

---

## 🔑 SECRETS SUMMARY

### **All Functions Need:**
- `SUPABASE_URL` (auto-set by Supabase)

### **Most Functions Need:**
- `SUPABASE_SERVICE_ROLE_KEY` (from Supabase settings)
- `STRIPE_SECRET_KEY` (from Stripe dashboard)

### **Webhook Function Needs:**
- `STRIPE_WEBHOOK_SECRET` (from Stripe webhook settings)

### **Redirect Functions Need:**
- `APP_SCHEME` = `wrenchgo`

---

## 🎯 QUICK DEPLOYMENT CHECKLIST

Use this checklist when deploying:

### **Payment Processing:**
- [ ] `create-payment-intent` - JWT: ✅ ON
- [ ] `stripe-webhook` - JWT: ❌ OFF

### **Stripe Connect (Mechanic Onboarding):**
- [ ] `stripe-connect-create-account-link` - JWT: ✅ ON
- [ ] `stripe-connect-return` - JWT: ❌ OFF
- [ ] `stripe-connect-refresh` - JWT: ❌ OFF
- [ ] `stripe-connect-refresh-status` - JWT: ✅ ON

### **Promotions:**
- [ ] `validate-promotion` - JWT: ✅ ON

---

## 📖 DETAILED DEPLOYMENT GUIDES

- **Stripe Connect Functions:** See `DEPLOY_ALL_FUNCTIONS.md`
- **Payment Functions:** See `PAYMENT_SYSTEM_COMPLETE.md`
- **Testing Guide:** See `TESTING_GUIDE.md`

---

## 🔍 HOW TO CHECK WHAT'S DEPLOYED

**Go to:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

**You should see all 7 payment-related functions listed.**

---

## 💡 FUNCTION RELATIONSHIPS

```
Customer Payment Flow:
1. validate-promotion (optional) → Validates promo code
2. create-payment-intent → Creates payment
3. stripe-webhook → Confirms payment success

Mechanic Onboarding Flow:
1. stripe-connect-create-account-link → Starts onboarding
2. stripe-connect-return → Handles completion
3. stripe-connect-refresh → Handles expiration
4. stripe-connect-refresh-status → Manual status check
```

---

## 🆘 TROUBLESHOOTING

### **Payment not working?**
- Check: `create-payment-intent` and `stripe-webhook` are deployed
- Verify: Stripe webhook is configured and pointing to your function

### **Mechanic onboarding not working?**
- Check: All 3 Stripe Connect functions are deployed
- Verify: JWT is disabled on `stripe-connect-return` and `stripe-connect-refresh`

### **Promotion codes not working?**
- Check: `validate-promotion` is deployed
- Verify: Promotions exist in database

---

## 🎯 MINIMUM VIABLE DEPLOYMENT

If you want to test quickly, deploy these **4 functions first**:

1. `create-payment-intent`
2. `stripe-webhook`
3. `stripe-connect-create-account-link`
4. `stripe-connect-return`

Then add the others as needed.

---

**Deploy all 7 payment-related functions for the complete system!** 🚀
