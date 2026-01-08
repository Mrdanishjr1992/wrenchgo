# Promo System Operator Playbook

## Quick Reference - SQL Commands for Supabase Dashboard

### 1. DISABLE A PROMO IMMEDIATELY
```sql
UPDATE promotions SET active = false, updated_at = now() WHERE code = 'PROMO_CODE';
```

### 2. PAUSE REDEMPTION TEMPORARILY (with user message)
```sql
UPDATE promotions 
SET redemption_paused = true, 
    pause_reason = 'This promotion is temporarily unavailable due to high demand.',
    updated_at = now() 
WHERE code = 'PROMO_CODE';
```

### 3. RESUME REDEMPTION
```sql
UPDATE promotions 
SET redemption_paused = false, 
    pause_reason = null,
    updated_at = now() 
WHERE code = 'PROMO_CODE';
```

### 4. UPDATE TERMS TEXT (no app update needed)
```sql
UPDATE promotions 
SET terms_text = 'New terms: Valid for first-time customers only. Max $50 discount.',
    terms_updated_at = now(),
    updated_at = now() 
WHERE code = 'PROMO_CODE';
```

### 5. SUNSET A PROMO (existing users honored, new users blocked)
```sql
UPDATE promotions 
SET sunset_at = now(),
    sunset_reason = 'This promotion is no longer available for new users.',
    updated_at = now() 
WHERE code = 'PROMO_CODE';
```

### 6. SET FINANCIAL CAP (budget limit)
```sql
UPDATE promotions 
SET max_total_discount_cents = 100000,  -- $1000 total budget
    updated_at = now() 
WHERE code = 'PROMO_CODE';
```

### 7. CHECK FINANCIAL EXPOSURE
```sql
SELECT code, 
       current_total_discount_cents / 100.0 as spent_dollars,
       max_total_discount_cents / 100.0 as budget_dollars,
       current_redemptions,
       max_redemptions
FROM promotions 
WHERE active = true 
ORDER BY current_total_discount_cents DESC;
```

### 8. RESPOND TO ABUSE - Block specific user
```sql
-- Check user's redemption history
SELECT pr.*, p.code 
FROM promotion_redemptions pr 
JOIN promotions p ON p.id = pr.promotion_id 
WHERE pr.user_id = 'USER_UUID' 
ORDER BY pr.created_at DESC;

-- If abuse detected, you can:
-- 1. Reduce per-user limit
UPDATE promotions SET max_redemptions_per_user = 1 WHERE code = 'PROMO_CODE';

-- 2. Or add user to a blocklist (requires custom table)
```

### 9. PAUSE NEW GRANTS (for referral credits)
```sql
UPDATE promotions 
SET grant_paused = true,
    grant_pause_reason = 'Referral program temporarily paused.',
    updated_at = now() 
WHERE code = 'REFERRAL';
```

### 10. CREATE NEW PROMO
```sql
INSERT INTO promotions (
  code, type, description, percent_off, amount_cents,
  minimum_amount_cents, start_date, end_date,
  max_redemptions, max_redemptions_per_user,
  max_total_discount_cents, max_discount_cents,
  applies_to, user_segment, terms_text, active
) VALUES (
  'SUMMER25',                    -- code
  'percent_discount',            -- type: percent_discount, fixed_discount, waive_platform_fee
  '25% off platform fee',        -- description
  25,                            -- percent_off (for percent_discount)
  null,                          -- amount_cents (for fixed_discount)
  5000,                          -- minimum_amount_cents ($50 minimum)
  now(),                         -- start_date
  '2025-08-31 23:59:59+00',     -- end_date
  1000,                          -- max_redemptions (global)
  1,                             -- max_redemptions_per_user
  50000,                         -- max_total_discount_cents ($500 budget)
  2500,                          -- max_discount_cents ($25 cap per use)
  'platform_fee',                -- applies_to: platform_fee, quote_amount, both
  'all',                         -- user_segment: all, new_users, returning_users, mechanics, customers
  'Valid through August 2025. Max $25 discount per order.',
  true
);
```

### 11. UPDATE PLATFORM PRICING
```sql
-- Change platform fee percentage
UPDATE platform_pricing 
SET value_percent = 12.5, updated_at = now() 
WHERE key = 'platform_fee_percent';

-- Change min/max fees
UPDATE platform_pricing SET value_cents = 750 WHERE key = 'min_platform_fee_cents';
UPDATE platform_pricing SET value_cents = 15000 WHERE key = 'max_platform_fee_cents';
```

---

## Promo Math Rules

### Discount Types
| Type | Behavior | Example |
|------|----------|---------|
| `percent_discount` | % off eligible amount | 25% off = $25 on $100 |
| `fixed_discount` | Fixed $ off (capped at eligible) | $10 off |
| `waive_platform_fee` | 100% of platform fee waived | Fee = $0 |

### Applies To
| Value | Eligible Amount |
|-------|-----------------|
| `platform_fee` | Only platform fee |
| `quote_amount` | Only mechanic quote |
| `both` | Quote + platform fee |

### Caps Applied (in order)
1. `max_discount_cents` - per-redemption cap
2. Remaining budget (`max_total_discount_cents - current_total_discount_cents`)
3. Eligible amount (can't discount more than the amount)

### Rounding
- All calculations use `FLOOR()` - always round down
- Ensures we never over-discount

### Failure Modes
- Invalid code → "This promo code is not valid."
- Expired → "This promotion has expired."
- Paused → Custom `pause_reason` or default message
- Budget exhausted → "This promotion has reached its budget limit."
- User limit → "You have already used this promotion..."

---

## Safety Guarantees

### Race Condition Prevention
- `FOR UPDATE` lock on promo row during application
- Idempotency key prevents double-spend
- Counters updated atomically in same transaction

### Abuse Prevention
- Per-user redemption limits
- Global redemption limits
- Financial caps
- User segment restrictions
- Sunset mechanism for controlled wind-down

### Scaling
- Indexed queries on active promos
- Read-only validation (no locks)
- Atomic application (minimal lock time)
- Idempotency enables safe retries
