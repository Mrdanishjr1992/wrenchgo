# 🚀 MECHANIC LEADS - QUICK START GUIDE

## 5-Minute Deployment

### Step 1: Deploy Database (2 minutes)
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `DEPLOY_MECHANIC_LEADS_SYSTEM.sql`
3. Paste and click "Run"
4. Wait for "Success" message

### Step 2: Install Dependencies (1 minute)
```bash
npx expo install expo-location
```

### Step 3: Update app.json (1 minute)
Add to your `app.json`:
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
    ]
  }
}
```

### Step 4: Restart App (1 minute)
```bash
npx expo start --clear
```

### Step 5: Test (Quick)
1. Open app as mechanic
2. Navigate to Leads tab
3. Try all three filters: All, Nearby, Quoted
4. Pull to refresh
5. Tap "View Details" on a lead

**Done!** ✅

---

## What You Get

### 🎯 Three Smart Filters
- **All** - Every open job opportunity
- **Nearby** - Jobs within your service radius (with distance)
- **Quoted** - Jobs you've already quoted

### 📊 Live Summary
Header shows: "24 open leads • 12 nearby • 8 quoted"

### 🎨 Beautiful Lead Cards
Each card shows:
- Customer name, photo, and rating
- Job title and description
- Vehicle info (year, make, model)
- Location and distance
- Time posted ("2h ago")
- "NEW" badge for recent jobs
- Quick actions: View Details / Send Quote

### ⚡ Performance Features
- Skeleton loaders while fetching
- Pull-to-refresh
- Infinite scroll with "Load More"
- Sort by: Newest / Closest / Highest Value
- Empty states with helpful messages

---

## Quick Test Queries

### Test in Supabase SQL Editor

**Get your mechanic ID:**
```sql
SELECT id, full_name, email FROM profiles WHERE role = 'mechanic' LIMIT 1;
```

**Test All Leads:**
```sql
SELECT * FROM get_mechanic_leads(
  'YOUR_MECHANIC_ID'::UUID,
  'all',
  NULL, NULL, 25, 20, 0, 'newest'
);
```

**Test Nearby Leads:**
```sql
SELECT * FROM get_mechanic_leads(
  'YOUR_MECHANIC_ID'::UUID,
  'nearby',
  37.7749, -122.4194, -- San Francisco coords
  25, 20, 0, 'closest'
);
```

**Test Summary:**
```sql
SELECT * FROM get_mechanic_leads_summary(
  'YOUR_MECHANIC_ID'::UUID,
  37.7749, -122.4194, 25
);
```

---

## Troubleshooting

### "No leads showing"
**Fix:** Update job statuses
```sql
UPDATE jobs 
SET status = 'open' 
WHERE status = 'searching' AND deleted_at IS NULL;
```

### "Distance is always NULL"
**Fix:** Add test location data
```sql
-- Add location to a test job
UPDATE jobs 
SET latitude = 37.7749, 
    longitude = -122.4194,
    location_address = 'San Francisco, CA'
WHERE id = 'YOUR_TEST_JOB_ID';

-- Add home location to mechanic profile
UPDATE profiles 
SET home_latitude = 37.7749,
    home_longitude = -122.4194,
    service_radius_miles = 25
WHERE id = 'YOUR_MECHANIC_ID';
```

### "Function not found"
**Fix:** Re-run deployment SQL
```sql
-- Check if function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'get_mechanic_leads';

-- If not found, re-run DEPLOY_MECHANIC_LEADS_SYSTEM.sql
```

### "Location permission not working"
**Fix:** 
1. Check `app.json` has location config
2. Rebuild: `npx expo start --clear`
3. On device: Settings → WrenchGo → Location → Allow

---

## File Reference

### Core Files
- `DEPLOY_MECHANIC_LEADS_SYSTEM.sql` - Database setup
- `app/(mechanic)/(tabs)/leads.tsx` - Main page
- `src/hooks/use-mechanic-leads.ts` - Data fetching hook
- `src/types/mechanic-leads.ts` - TypeScript types

### Components
- `components/mechanic/LeadCard.tsx` - Lead card UI
- `components/mechanic/LeadsEmptyState.tsx` - Empty states & loaders
- `components/mechanic/LeadsHeader.tsx` - Summary & sort controls

### Documentation
- `MECHANIC_LEADS_SUMMARY.md` - Complete feature overview
- `MECHANIC_LEADS_DEPLOYMENT_GUIDE.md` - Detailed deployment & testing

---

## Next Steps

1. ✅ Deploy and test basic functionality
2. 📊 Monitor performance in Supabase Dashboard
3. 🎨 Customize colors/styling to match your brand
4. 📱 Test on real devices (iOS & Android)
5. 🚀 Deploy to production

---

## Support

- **Detailed Guide:** See `MECHANIC_LEADS_DEPLOYMENT_GUIDE.md`
- **Feature Overview:** See `MECHANIC_LEADS_SUMMARY.md`
- **Database Issues:** Check Supabase logs
- **Frontend Issues:** Check React Native debugger

---

**Ready to go!** Your mechanics will love the new Leads page. 🎉
