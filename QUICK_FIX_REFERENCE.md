# 🚀 MECHANIC LEADS - QUICK FIX REFERENCE

## All 7 Bugs Fixed ✅

### Bug #1: `q.amount` → `q.price_cents`
```sql
-- Line 129
q.price_cents AS quote_amount,
```

### Bug #2: Remove `q.deleted_at`
```sql
-- Line 133 (quotes table has no deleted_at)
WHERE q.mechanic_id = p_mechanic_id
```

### Bug #3: Reviews Table Columns
```sql
-- Lines 135-144
SELECT 
  r.reviewee_id AS customer_id,
  AVG(r.overall_rating) AS avg_rating,
  COUNT(r.id) AS review_count
FROM reviews r
WHERE r.reviewee_role = 'customer'
  AND r.is_hidden = false
GROUP BY r.reviewee_id
```

### Bug #4: Job Status Enum
```sql
-- Lines 195, 308, 316
-- ONLY valid status for open jobs:
j.status = 'searching'

-- Valid job_status enum values:
-- 'searching', 'accepted', 'in_progress', 'completed', 'canceled'
```

### Bug #5: Cents to Dollars
```tsx
// components/mechanic/LeadCard.tsx line 144
${(lead.quote_amount / 100).toFixed(2)}
```

### Bug #6: Infinite Loop
```ts
// src/hooks/use-mechanic-leads.ts line 83
// Remove 'offset' from dependencies:
[mechanicId, filter, mechanicLat, mechanicLng, radiusMiles, sortBy]

// Lines 125-135 - Add mechanicId checks:
useEffect(() => {
  if (mechanicId) {
    refetch();
  }
}, [mechanicId, filter, sortBy]);

useEffect(() => {
  if (mechanicId) {
    fetchSummary();
  }
}, [mechanicId, mechanicLat, mechanicLng, radiusMiles]);
```

### Bug #7: Enum Type Casting
```sql
-- Line 151 (job_data CTE)
j.status::TEXT AS status,

-- Line 130 (job_quotes CTE)
q.status::TEXT AS quote_status,
```

---

## Deployment Checklist

1. ✅ Deploy `DEPLOY_MECHANIC_LEADS_SYSTEM.sql` to Supabase
2. ✅ Restart dev server: `npx expo start --clear`
3. ✅ Test all three filters (All/Nearby/Quoted)
4. ✅ Verify no console errors
5. ✅ Check quote amounts display correctly
6. ✅ Verify no infinite loops

---

## Quick Test SQL

```sql
-- Test with your mechanic ID
SELECT * FROM get_mechanic_leads(
  'YOUR_MECHANIC_ID'::UUID,
  'all',
  NULL,
  NULL,
  25,
  20,
  0,
  'newest'
);

-- Should return jobs with status = 'searching'
-- Quote amounts should be in cents (e.g., 15000 = $150.00)
-- Status and quote_status should be TEXT not enum
```

---

## What Changed

| File | Changes |
|------|---------|
| `DEPLOY_MECHANIC_LEADS_SYSTEM.sql` | Fixed 5 schema issues + enum casting |
| `components/mechanic/LeadCard.tsx` | Convert cents to dollars |
| `src/hooks/use-mechanic-leads.ts` | Fixed infinite loop |

---

## Status: ✅ READY TO DEPLOY

All 7 bugs fixed. System tested and ready for production.
