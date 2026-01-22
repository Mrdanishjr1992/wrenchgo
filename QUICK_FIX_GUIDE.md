# Quick Fix Guide - Customer Profile Card Reviews

## Problem
Customer profile cards not displaying reviews due to missing database columns.

## Solution
Apply migration `0046_fix_profile_card_reviews.sql`

## Apply the Fix

### Option 1: Using Supabase CLI (Recommended)
```bash
# Push the new migration to your database
supabase db push

# Verify the migration was applied
supabase db diff
```

### Option 2: Manual SQL Execution
Run the SQL file directly in Supabase Dashboard:
1. Go to SQL Editor in Supabase Dashboard
2. Open `supabase/migrations/0046_fix_profile_card_reviews.sql`
3. Execute the migration

### Option 3: Using npx
```bash
# If you don't have Supabase CLI installed globally
npx supabase db push
```

## Verify the Fix

### 1. Check Function Exists
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'get_public_profile_card';
```

### 2. Check Columns Added
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reviews' 
  AND column_name IN (
    'professionalism_rating',
    'communication_rating', 
    'would_recommend',
    'visibility'
  );
```

### 3. Test the Function
```sql
-- Replace 'user-id-here' with an actual user ID
SELECT get_public_profile_card('user-id-here');
```

### 4. Test in App
- Open any customer profile card
- Verify reviews are displayed
- Check that rating averages show correctly
- Confirm no console errors

## What This Fix Does

✅ Adds missing review rating columns to database
✅ Updates `get_public_profile_card` function to query new fields
✅ Maintains backward compatibility with existing data
✅ Includes fallback logic for partial migrations
✅ Safe to run multiple times (idempotent)

## Expected Results

After applying the fix, profile cards will display:
- Overall rating average
- Performance rating average
- Timing rating average
- Cost rating average
- **Professionalism rating average** (NEW)
- **Communication rating average** (NEW)
- Review count
- **Would recommend count** (NEW)

## Troubleshooting

### Error: "column does not exist"
- The migration hasn't been applied yet
- Run `supabase db push` to apply it

### Error: "type review_visibility does not exist"
- Migration 0010 wasn't applied
- The fix includes creating this type

### Reviews still not showing
- Clear app cache (profile cards cache for 5 minutes)
- Force refresh the profile card
- Check that reviews exist in database with `visibility = 'visible'`

### Function returns null
- User doesn't exist or is deleted
- Check `profiles` table for the user

## Need Help?
See `PROFILE_CARD_FIX_REPORT.md` for detailed analysis and technical details.
