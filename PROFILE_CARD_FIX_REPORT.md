# Customer Profile Card Reviews Display - Fix Report

## Issue Summary
The customer profile card was failing to display reviews due to a database schema mismatch. The `get_public_profile_card` RPC function was querying review columns that didn't exist in all database environments.

## Root Cause Analysis

### Problem
Migration `0013_update_profile_card.sql` updated the `get_public_profile_card` function to query new review rating columns:
- `professionalism_rating`
- `communication_rating`
- `would_recommend`
- `visibility`

However, these columns are only added in migration `0010_trust_system.sql`. While the migration order is correct (0010 runs before 0013), some database environments may not have had migration 0010 applied, causing the function to fail.

### Affected Components
1. **Database Function**: `get_public_profile_card(uuid)` - Lines 36-53 in migration 0013
2. **Reviews Table**: Missing columns from trust system migration
3. **Frontend**: UserProfileCard component expecting rating data

### Migration Dependencies
```
0001_baseline_schema.sql     → Creates reviews table (basic columns)
0003_functions_triggers.sql  → Creates get_public_profile_card (basic version)
0010_trust_system.sql        → Adds new review columns
0013_update_profile_card.sql → Updates function to use new columns
```

## Solution Implemented

### Migration 0046: Fix Profile Card Reviews Display
Created `supabase/migrations/0046_fix_profile_card_reviews.sql` which:

1. **Ensures Enum Type Exists**
   - Creates `review_visibility` enum if not present
   - Values: 'hidden', 'visible', 'moderated'

2. **Adds Missing Columns (Idempotent)**
   - `professionalism_rating` (int, 1-5 range)
   - `communication_rating` (int, 1-5 range)
   - `would_recommend` (boolean)
   - `visibility` (review_visibility enum)
   - `made_visible_at` (timestamptz)
   - `visibility_reason` (text)
   - `blind_deadline` (timestamptz)

3. **Adds Constraints**
   - Rating range validation (1-5)
   - Null-safe constraints

4. **Updates Function with Fallback Logic**
   - Queries new rating columns with COALESCE for null safety
   - Falls back to `is_hidden` if `visibility` is NULL
   - Handles missing columns gracefully

### Key Improvements
- **Idempotent**: Can be run multiple times safely
- **Backward Compatible**: Works with both old and new schemas
- **Fallback Logic**: `(r.visibility = 'visible' OR (r.visibility IS NULL AND r.is_hidden = false))`
- **Null Safety**: All new columns use COALESCE with default values

## Database Schema Changes

### Reviews Table - New Columns
```sql
professionalism_rating    int                      -- 1-5 rating
communication_rating      int                      -- 1-5 rating
would_recommend          boolean                  -- Recommendation flag
visibility               review_visibility        -- 'hidden'|'visible'|'moderated'
made_visible_at          timestamptz             -- When review became visible
visibility_reason        text                     -- Why visibility changed
blind_deadline           timestamptz             -- Blind review deadline
```

### Function Output - New Fields
```typescript
interface PublicProfileCardRatings {
  overall_avg: number;
  performance_avg: number;
  timing_avg: number;
  cost_avg: number;
  professionalism_avg: number;        // NEW
  communication_avg: number;          // NEW
  review_count: number;
  would_recommend_count: number;      // NEW
  would_recommend_total: number;      // NEW
}
```

## Frontend Compatibility
✅ TypeScript types already defined in `src/types/profile-card.ts`
✅ UserProfileCard component handles new fields
✅ Profile card library caches results properly

## Testing Checklist
- [ ] Run migration 0046 on development database
- [ ] Verify `get_public_profile_card` function returns all fields
- [ ] Test profile card display with existing reviews
- [ ] Test profile card display with no reviews
- [ ] Verify new rating fields display correctly
- [ ] Check backward compatibility with old review data

## Deployment Steps
1. Apply migration: `supabase db push`
2. Verify function updated: `SELECT proname FROM pg_proc WHERE proname = 'get_public_profile_card'`
3. Test RPC call: `SELECT get_public_profile_card('user-id-here')`
4. Clear profile card cache in app (5-minute TTL)
5. Verify reviews display in customer profile cards

## Rollback Plan
If issues occur:
1. The migration is idempotent and safe
2. Function includes fallback logic for missing columns
3. Can revert to migration 0013 version if needed
4. No data loss - only adds columns, doesn't remove

## Files Modified
- ✅ `supabase/migrations/0046_fix_profile_card_reviews.sql` (NEW)

## Files Verified (No Changes Needed)
- ✅ `src/types/profile-card.ts` - Types already correct
- ✅ `src/lib/profile-card.ts` - Library already correct
- ✅ `components/profile/UserProfileCard.tsx` - Component already correct

## Status
🔧 **READY FOR DEPLOYMENT**

The migration is complete and ready to be applied. It will fix the review display issue while maintaining backward compatibility with existing data.
