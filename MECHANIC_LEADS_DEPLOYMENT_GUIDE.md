# MECHANIC LEADS SYSTEM - DEPLOYMENT & TESTING GUIDE

## 📋 Overview
This guide covers the complete deployment and testing of the improved Mechanic Leads system with proper filtering, distance calculation, and enhanced UX.

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Deploy Database Changes
Run the SQL deployment file in your Supabase SQL Editor:

```bash
# In Supabase Dashboard > SQL Editor
# Copy and paste the contents of DEPLOY_MECHANIC_LEADS_SYSTEM.sql
# Execute the script
```

**What this does:**
- Adds location fields to `jobs` and `profiles` tables
- Creates performance indexes for fast queries
- Creates `get_mechanic_leads()` RPC function
- Creates `get_mechanic_leads_summary()` RPC function
- Sets up proper RLS policies

### Step 2: Verify Database Deployment

Run these verification queries in Supabase SQL Editor:

```sql
-- 1. Check if columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
  AND column_name IN ('latitude', 'longitude', 'location_address');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('home_latitude', 'home_longitude', 'service_radius_miles');

-- 2. Check if indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('jobs', 'quotes') 
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- 3. Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('get_mechanic_leads', 'get_mechanic_leads_summary')
  AND routine_schema = 'public';
```

### Step 3: Install Required Dependencies

```bash
# Install expo-location if not already installed
npx expo install expo-location

# Verify other dependencies are installed
npm list react-native-safe-area-context
```

### Step 4: Update App Configuration

Add location permissions to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow WrenchGo to use your location to show nearby job leads."
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "WrenchGo needs your location to show nearby job leads.",
        "NSLocationAlwaysUsageDescription": "WrenchGo needs your location to show nearby job leads."
      }
    },
    "android": {
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ]
    }
  }
}
```

### Step 5: Rebuild the App

```bash
# For development
npx expo start --clear

# For production builds
eas build --platform ios
eas build --platform android
```

---

## ✅ TESTING CHECKLIST

### Database Testing

- [ ] **Test RPC Function - All Filter**
  ```sql
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
  ```
  Expected: Returns all open jobs (status: pending, open, ready_for_quotes, awaiting_quotes)

- [ ] **Test RPC Function - Nearby Filter**
  ```sql
  SELECT * FROM get_mechanic_leads(
    'YOUR_MECHANIC_ID'::UUID,
    'nearby',
    37.7749,  -- Replace with test latitude
    -122.4194, -- Replace with test longitude
    25,
    20,
    0,
    'closest'
  );
  ```
  Expected: Returns jobs within 25 miles, sorted by distance

- [ ] **Test RPC Function - Quoted Filter**
  ```sql
  SELECT * FROM get_mechanic_leads(
    'YOUR_MECHANIC_ID'::UUID,
    'quoted',
    NULL,
    NULL,
    25,
    20,
    0,
    'newest'
  );
  ```
  Expected: Returns only jobs where mechanic has submitted quotes

- [ ] **Test Summary Function**
  ```sql
  SELECT * FROM get_mechanic_leads_summary(
    'YOUR_MECHANIC_ID'::UUID,
    37.7749,
    -122.4194,
    25
  );
  ```
  Expected: Returns counts for all_count, nearby_count, quoted_count

- [ ] **Test Distance Calculation**
  - Verify Haversine formula returns accurate distances
  - Check that NULL locations are handled gracefully

- [ ] **Test Performance**
  ```sql
  EXPLAIN ANALYZE
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
  ```
  Expected: Query execution time < 100ms for typical dataset

### Frontend Testing

#### Filter Functionality
- [ ] **All Tab**
  - Shows all open jobs
  - Displays correct count in header
  - No duplicate jobs appear
  - Jobs are sorted by newest first (default)

- [ ] **Nearby Tab**
  - Prompts for location permission if not granted
  - Shows only jobs within service radius
  - Displays distance in miles for each job
  - Sorts by closest first when "Closest" sort is selected
  - Shows empty state if no nearby jobs

- [ ] **Quoted Tab**
  - Shows only jobs mechanic has quoted
  - Displays "Quoted" badge on cards
  - Shows quote amount and status
  - Shows empty state with helpful message if no quotes

#### Sort Functionality
- [ ] **Newest Sort**
  - Jobs appear in reverse chronological order
  - "NEW" badge appears on jobs < 2 hours old

- [ ] **Closest Sort**
  - Jobs sorted by distance (ascending)
  - Distance displayed on each card
  - Jobs without location appear last

- [ ] **Highest Value Sort**
  - Jobs with quotes sorted by amount (descending)
  - Jobs without quotes appear last

#### UI/UX Testing
- [ ] **Header Summary**
  - Displays correct counts for all three filters
  - Updates when data changes
  - Numbers are readable and properly formatted

- [ ] **Lead Cards**
  - Customer photo displays correctly (or default avatar)
  - Customer rating shows if available
  - Vehicle info displays when present
  - Location address shows when available
  - Distance displays for nearby jobs
  - Time ago is accurate and readable
  - "NEW" badge appears for recent jobs
  - "Quoted" badge appears for quoted jobs

- [ ] **Action Buttons**
  - "View Details" navigates to job detail page
  - "Send Quote" navigates to quote creation page
  - Quoted jobs show quote amount instead of "Send Quote"

- [ ] **Empty States**
  - All tab: Shows helpful message when no leads
  - Nearby tab: Prompts to enable location or increase radius
  - Quoted tab: Encourages browsing leads to quote

- [ ] **Loading States**
  - Skeleton loaders appear while fetching
  - Pull-to-refresh works correctly
  - "Load More" button appears when more data available
  - Loading indicator doesn't block interaction

- [ ] **Error Handling**
  - Network errors show user-friendly message
  - Permission denied shows helpful prompt
  - Failed queries don't crash the app

#### Pagination Testing
- [ ] **Initial Load**
  - Loads first 20 leads
  - Shows "Load More" if more available

- [ ] **Load More**
  - Fetches next 20 leads
  - Appends to existing list (no duplicates)
  - Hides button when no more data

- [ ] **Pull to Refresh**
  - Resets pagination to page 1
  - Clears existing data
  - Fetches fresh data

#### Performance Testing
- [ ] **Scroll Performance**
  - List scrolls smoothly with 50+ items
  - No lag when switching filters
  - Images load efficiently

- [ ] **Memory Usage**
  - No memory leaks after multiple refreshes
  - App doesn't crash with large datasets

#### Location Testing
- [ ] **Permission Flow**
  - Prompts for permission on first use
  - Handles "Allow Once" correctly
  - Handles "Don't Allow" gracefully
  - Shows helpful message if denied

- [ ] **Location Accuracy**
  - Gets current location successfully
  - Distance calculations are accurate
  - Handles location errors gracefully

#### Cross-Platform Testing
- [ ] **iOS**
  - All features work correctly
  - Safe area insets respected
  - Location permission flow works

- [ ] **Android**
  - All features work correctly
  - Navigation bar handled properly
  - Location permission flow works

#### Edge Cases
- [ ] **No Jobs Available**
  - Empty state displays correctly
  - No errors in console

- [ ] **No Location Permission**
  - Nearby filter shows helpful message
  - Other filters still work

- [ ] **No Internet Connection**
  - Shows appropriate error message
  - Retry mechanism works

- [ ] **Mechanic Has No Location Set**
  - Nearby filter prompts to set location
  - Other filters still work

- [ ] **Job Has No Location**
  - Distance shows as "N/A" or hidden
  - Job still appears in "All" filter
  - Job excluded from "Nearby" filter

---

## 🐛 TROUBLESHOOTING

### Issue: RPC Function Not Found
**Solution:**
```sql
-- Check if function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'get_mechanic_leads';

-- If not found, re-run DEPLOY_MECHANIC_LEADS_SYSTEM.sql
```

### Issue: Distance Always NULL
**Solution:**
1. Check if jobs have latitude/longitude:
   ```sql
   SELECT id, title, latitude, longitude FROM jobs LIMIT 10;
   ```
2. Check if mechanic profile has home location:
   ```sql
   SELECT id, full_name, home_latitude, home_longitude 
   FROM profiles WHERE id = 'YOUR_MECHANIC_ID';
   ```
3. Update test data if needed:
   ```sql
   UPDATE jobs SET 
     latitude = 37.7749, 
     longitude = -122.4194,
     location_address = 'San Francisco, CA'
   WHERE id = 'TEST_JOB_ID';
   ```

### Issue: No Leads Showing
**Solution:**
1. Check job statuses:
   ```sql
   SELECT status, COUNT(*) FROM jobs GROUP BY status;
   ```
2. Ensure jobs have correct status:
   ```sql
   UPDATE jobs SET status = 'open' 
   WHERE status = 'searching' AND deleted_at IS NULL;
   ```

### Issue: Location Permission Not Working
**Solution:**
1. Check app.json has location permissions
2. Rebuild the app: `npx expo start --clear`
3. On iOS: Reset location permissions in Settings > Privacy > Location Services
4. On Android: Reset app permissions in Settings > Apps > WrenchGo > Permissions

### Issue: Slow Query Performance
**Solution:**
1. Check if indexes exist:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename IN ('jobs', 'quotes');
   ```
2. Analyze query plan:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM get_mechanic_leads(...);
   ```
3. Re-run index creation from DEPLOY_MECHANIC_LEADS_SYSTEM.sql

---

## 📊 MONITORING & ANALYTICS

### Key Metrics to Track
- Average query response time for `get_mechanic_leads()`
- Number of leads viewed per mechanic per day
- Conversion rate: leads viewed → quotes sent
- Filter usage distribution (All vs Nearby vs Quoted)
- Location permission grant rate

### Supabase Dashboard Queries

**Daily Active Mechanics:**
```sql
SELECT DATE(created_at) as date, COUNT(DISTINCT mechanic_id) as active_mechanics
FROM quotes
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Most Popular Filters:**
```sql
-- Add analytics tracking to your app to capture this
-- Track filter changes in your analytics service
```

**Average Leads Per Mechanic:**
```sql
SELECT 
  COUNT(DISTINCT j.id) / COUNT(DISTINCT p.id) as avg_leads_per_mechanic
FROM jobs j
CROSS JOIN profiles p
WHERE p.role = 'mechanic'
  AND j.status IN ('pending', 'open', 'ready_for_quotes', 'awaiting_quotes')
  AND j.deleted_at IS NULL;
```

---

## 🎯 SUCCESS CRITERIA

The deployment is successful when:

✅ All database functions execute without errors  
✅ All three filters (All, Nearby, Quoted) work correctly  
✅ Distance calculations are accurate within 0.1 miles  
✅ Query performance is < 100ms for typical datasets  
✅ Empty states display helpful messages  
✅ Pull-to-refresh and pagination work smoothly  
✅ Location permissions are handled gracefully  
✅ No console errors or warnings  
✅ App doesn't crash under any test scenario  
✅ UI is responsive and feels fast  

---

## 📝 POST-DEPLOYMENT TASKS

1. **Monitor Error Logs**
   - Check Supabase logs for RPC errors
   - Monitor app crash reports

2. **Gather User Feedback**
   - Ask mechanics about filter accuracy
   - Check if distance calculations feel correct
   - Verify empty states are helpful

3. **Optimize Based on Usage**
   - Adjust default service radius if needed
   - Add more sort options if requested
   - Fine-tune pagination limits

4. **Future Enhancements**
   - Add map view for nearby leads
   - Implement push notifications for new leads
   - Add saved searches/filters
   - Implement lead recommendations based on skills

---

## 🔗 RELATED FILES

- **Database:** `DEPLOY_MECHANIC_LEADS_SYSTEM.sql`
- **Types:** `src/types/mechanic-leads.ts`
- **Hook:** `src/hooks/use-mechanic-leads.ts`
- **Components:**
  - `components/mechanic/LeadCard.tsx`
  - `components/mechanic/LeadsEmptyState.tsx`
  - `components/mechanic/LeadsHeader.tsx`
- **Page:** `app/(mechanic)/(tabs)/leads.tsx`

---

## 📞 SUPPORT

If you encounter issues not covered in this guide:
1. Check Supabase logs for database errors
2. Check React Native debugger for frontend errors
3. Review the RLS policies to ensure mechanics can access leads
4. Verify all dependencies are installed correctly

---

**Last Updated:** 2025-01-28  
**Version:** 1.0.0
