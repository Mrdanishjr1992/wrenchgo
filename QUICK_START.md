# 🚀 Quick Start - Payment System

## ✅ You've Completed Setup!

All Edge Functions are deployed and the payment system is ready to test.

---

## 🧪 Test It Now (5 Minutes)

### 1. Add Test Promotions
```sql
-- Run in Supabase SQL Editor:
-- Copy contents of TEST_PROMOTIONS.sql and run it
```

### 2. Test as Mechanic
- Navigate to: `/(mechanic)/stripe-onboarding`
- Complete Stripe onboarding with test data
- Send a quote for a job

### 3. Test as Customer
- Accept the quote (you'll auto-navigate to payment)
- Try promo code: `NOFEE`
- Use test card: `4242 4242 4242 4242`
- Expiry: `12/34`, CVC: `123`, ZIP: `12345`
- Click "Pay Now"

### 4. Verify Success
- Check `payments` table → status = `paid`
- Check `jobs` table → status = `in_progress`
- Check Stripe Dashboard → payment appears

---

## 📱 Key Screens

| Screen | Path | Purpose |
|--------|------|---------|
| Payment | `/(customer)/payment/[jobId]` | Customer pays for service |
| Earnings | `/(mechanic)/earnings/[jobId]` | Mechanic views payout |
| Onboarding | `/(mechanic)/stripe-onboarding` | Mechanic Stripe setup |

---

## 💰 Pricing

| Item | Amount |
|------|--------|
| Platform Fee (Customer) | $15.00 |
| Commission (Mechanic) | 12% (max $50) |
| Example: $150 service | Customer pays $165, Mechanic gets $132 |

---

## 🎟️ Test Promo Codes

| Code | Effect |
|------|--------|
| `WELCOME10` | 10% off total |
| `SAVE20` | $20 off (min $100) |
| `NOFEE` | Waives $15 platform fee |

---

## 💳 Stripe Test Cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Declined |

---

## 🔗 Quick Links

- **Supabase Dashboard:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt
- **Stripe Dashboard:** https://dashboard.stripe.com/test
- **Edge Functions:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions
- **Webhooks:** https://dashboard.stripe.com/test/webhooks

---

## 📚 Documentation

| File | When to Use |
|------|-------------|
| `TESTING_GUIDE.md` | **Start here** - Complete testing guide |
| `PAYMENT_SYSTEM_COMPLETE.md` | Overview of everything |
| `PAYMENTS_DOCUMENTATION.md` | Technical details |
| `DASHBOARD_DEPLOYMENT_GUIDE.md` | Deploy Edge Functions |

---

## 🐛 Quick Troubleshooting

**Payment fails?**
- Check Edge Function logs in Supabase
- Verify Stripe keys are set

**Promo doesn't work?**
- Run `TEST_PROMOTIONS.sql` first
- Check promotion is active

**Mechanic can't receive payment?**
- Complete Stripe onboarding first

---

## ✅ What's Working

- ✅ Database tables created
- ✅ Edge Functions deployed
- ✅ Stripe webhook configured
- ✅ Payment flow integrated
- ✅ Promo system ready
- ✅ UI screens created

---

## 🎯 Next: Test It!

1. Open `TESTING_GUIDE.md`
2. Follow "Step 2: Test the Complete Flow"
3. Complete a test payment
4. Celebrate! 🎉

**Your payment system is ready to use!** 💰
