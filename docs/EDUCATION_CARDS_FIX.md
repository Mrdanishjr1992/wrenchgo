# Education Cards Display Fix

## Issues Found

### 1. **Missing Empty State in education.tsx**
**Problem:** When `educationCards.length === 0`, the page would just show the header text with no cards and no indication why.

**Fix:** Added conditional rendering to show "No education guides available yet" message when the array is empty.

**Location:** `app/(customer)/education.tsx` lines 220-226

### 2. **No Debug Logging**
**Problem:** No way to see if data was actually being loaded from the database.

**Fix:** Added console.log statements to track:
- Number of education cards loaded
- Number of symptoms loaded

**Locations:**
- `app/(customer)/education.tsx` lines 73-74
- `app/(customer)/(tabs)/index.tsx` lines 173-174

## What Was Changed

### education.tsx
```typescript
// Before: Just mapped cards with no empty state
{educationCards.map((eduCard) => { ... })}

// After: Check if empty first
{educationCards.length === 0 ? (
  <View style={[card, { padding: spacing.lg, alignItems: "center" }]}>
    <Text style={{ ...textStyles.muted, textAlign: "center" }}>
      No education guides available yet
    </Text>
  </View>
) : (
  educationCards.map((eduCard) => { ... })
)}
```

### Both Files
Added debug logging:
```typescript
console.log("Education cards loaded:", eduRes.data?.length ?? 0);
console.log("Symptoms loaded:", symptomsRes.data?.length ?? 0);
```

## Database Status

✅ **All data is in the database:**
- 17 Symptoms
- 17 Symptom Mappings
- 7 Education Cards

The data was verified with direct SQL queries and is confirmed to be present.

## How to Test

1. **Restart your Expo app:**
   ```bash
   # Stop the current dev server (Ctrl+C)
   npm start
   ```

2. **Check the console logs:**
   - You should see: "Education cards loaded: 7"
   - You should see: "Symptoms loaded: 17"

3. **Navigate to Education tab:**
   - Switch between "Symptoms" and "Guides" tabs
   - You should see 7 education cards in the "Guides" tab
   - You should see 17 symptoms in the "Symptoms" tab

4. **Check the home page:**
   - Should show 3 education cards in the "What to Know" section
   - Console should show: "Home: Education cards loaded: 7"

## If Still Not Showing

If the cards still don't show after restarting:

1. **Check Supabase connection:**
   ```bash
   npx supabase status
   ```
   Make sure it's running on http://127.0.0.1:54321

2. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'education_cards';
   ```
   Should show: "Anyone can view education_cards"

3. **Test the query directly:**
   Open Supabase Studio (http://127.0.0.1:54323) and run:
   ```sql
   SELECT id, symptom_key, title FROM education_cards ORDER BY order_index;
   ```

4. **Check app console for errors:**
   Look for any error messages in the Expo console or browser console

## Expected Behavior

### Education Page - Guides Tab
Should display 7 cards:
1. Battery keeps dying / hard starts
2. Routine maintenance
3. Brakes feel soft/noisy/unsafe
4. Fluid leaking under the car
5. Car won't start (no cranking)
6. Strange noise while driving
7. Dashboard warning light

### Education Page - Symptoms Tab
Should display 17 symptoms with risk levels and categories

### Home Page - What to Know Section
Should display first 3 education cards with "See All" button

## Files Modified

1. ✅ `app/(customer)/education.tsx` - Added empty state and debug logging
2. ✅ `app/(customer)/(tabs)/index.tsx` - Added debug logging
3. ✅ `supabase/migrations/20250127000005_seed_data.sql` - Already has all 7 education cards

## Next Steps

1. Restart your Expo app
2. Check console logs for data loading
3. Navigate to Education tab
4. Verify all 7 cards are showing
5. If issues persist, check the troubleshooting steps above
