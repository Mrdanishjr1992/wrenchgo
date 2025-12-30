# 🎯 MECHANIC LEADS FILTER LOGIC

## Filter Definitions

### 1. **All** 
Shows ALL open leads in the marketplace for this mechanic.

**Criteria:**
- Job status = `'searching'`
- Not deleted (`deleted_at IS NULL`)
- Not canceled (`canceled_at IS NULL`)

**Includes:**
- ✅ Leads you haven't quoted yet
- ✅ Leads you already quoted
- ✅ Leads near and far
- ✅ All open jobs regardless of location

**SQL Logic:**
```sql
WHERE j.status = 'searching'
  AND j.deleted_at IS NULL
  AND j.canceled_at IS NULL
```

---

### 2. **Nearby**
Shows ONLY leads within your service radius.

**Criteria:**
- Same as "All" PLUS:
- Lead has valid latitude/longitude
- Mechanic has valid location
- Distance ≤ service radius (default 25 miles)

**Includes:**
- ✅ Leads within radius (quoted or not)
- ❌ Leads outside radius
- ❌ Leads without location data

**SQL Logic:**
```sql
WHERE j.status = 'searching'
  AND j.deleted_at IS NULL
  AND j.canceled_at IS NULL
  AND j.latitude IS NOT NULL
  AND j.longitude IS NOT NULL
  AND v_mechanic_lat IS NOT NULL
  AND v_mechanic_lng IS NOT NULL
  AND (haversine_distance) <= v_radius
```

**Why "Nearby" shows 0:**
1. ❌ Mechanic location not set (`home_latitude`, `home_longitude` in profiles)
2. ❌ Radius too small
3. ❌ No jobs have location data
4. ❌ All jobs are outside radius

---

### 3. **Quoted**
Shows ONLY leads where YOU have already submitted a quote.

**Criteria:**
- Same as "All" PLUS:
- A quote exists with `mechanic_id = YOUR_ID` and `job_id = lead.job_id`

**Includes:**
- ✅ Only jobs you quoted
- ❌ Jobs quoted by other mechanics
- ❌ Jobs you haven't quoted

**SQL Logic:**
```sql
WHERE j.status = 'searching'
  AND j.deleted_at IS NULL
  AND j.canceled_at IS NULL
  AND EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.job_id = j.id
      AND q.mechanic_id = p_mechanic_id
  )
```

---

## Summary Counts

The `get_mechanic_leads_summary` function returns:

```typescript
{
  all_count: 45,      // Total open leads
  nearby_count: 12,   // Leads within radius
  quoted_count: 8     // Leads you quoted
}
```

**Relationship:**
- `quoted_count` ≤ `all_count` (quoted is subset of all)
- `nearby_count` ≤ `all_count` (nearby is subset of all)
- `quoted_count` and `nearby_count` can overlap

---

## Troubleshooting

### "Nearby" shows 0 but "All" has leads

**Check:**
1. Mechanic's `home_latitude` and `home_longitude` in profiles table
2. Mechanic's `service_radius_miles` (default 25)
3. Jobs have valid `location` (PostGIS geometry field)
4. Distance calculation is working

**Fix:**
```sql
-- Check mechanic location
SELECT id, home_latitude, home_longitude, service_radius_miles
FROM profiles
WHERE id = 'YOUR_MECHANIC_ID';

-- Check job locations (PostGIS)
SELECT
  id,
  title,
  ST_Y(location::geometry) AS latitude,
  ST_X(location::geometry) AS longitude,
  location IS NOT NULL AS has_location
FROM jobs
WHERE status = 'searching'
  AND deleted_at IS NULL;

-- Test distance calculation
SELECT
  j.id,
  j.title,
  ST_Y(j.location::geometry) AS job_lat,
  ST_X(j.location::geometry) AS job_lng,
  (
    3959 * acos(
      cos(radians(YOUR_MECHANIC_LAT)) *
      cos(radians(ST_Y(j.location::geometry))) *
      cos(radians(ST_X(j.location::geometry)) - radians(YOUR_MECHANIC_LNG)) +
      sin(radians(YOUR_MECHANIC_LAT)) *
      sin(radians(ST_Y(j.location::geometry)))
    )
  ) AS distance_miles
FROM jobs j
WHERE j.status = 'searching'
  AND j.location IS NOT NULL
ORDER BY distance_miles;
```

### "Quoted" shows leads I didn't quote

**Check:**
```sql
-- Verify quotes table
SELECT q.id, q.job_id, q.mechanic_id, q.price_cents
FROM quotes q
WHERE q.mechanic_id = 'YOUR_MECHANIC_ID';
```

The `job_quotes` CTE should filter by `mechanic_id`:
```sql
WHERE q.mechanic_id = p_mechanic_id
```

---

## PostGIS Location Handling

**Customer Job Creation:**
- Saves `location` as PostGIS geometry (POINT)
- Format: `POINT(longitude latitude)`

**SQL Function Extraction:**
- `ST_X(location::geometry)` → longitude
- `ST_Y(location::geometry)` → latitude
- Used for distance calculations and filtering

**Why PostGIS?**
- Native spatial indexing
- Efficient distance queries
- Standard geospatial format
- Already used in customer job creation

---
- `quoted_count` ≤ `all_count` (quoted is subset of all)
- `nearby_count` ≤ `all_count` (nearby is subset of all)
- `quoted_count` and `nearby_count` can overlap

---

## Visual Representation

```
┌─────────────────────────────────────────┐
│              ALL (45)                   │
│  ┌──────────────────┐  ┌─────────────┐ │
│  │  NEARBY (12)     │  │ QUOTED (8)  │ │
│  │                  │  │             │ │
│  │  • Within radius │  │ • You bid   │ │
│  │  • May overlap   │  │ • Any dist  │ │
│  │    with Quoted   │  │             │ │
│  └──────────────────┘  └─────────────┘ │
│                                         │
│  Rest: Far away, not quoted             │
└─────────────────────────────────────────┘
```

---

## Troubleshooting

### "Nearby" shows 0 but "All" has leads

**Check:**
1. Mechanic's `home_latitude` and `home_longitude` in profiles table
2. Mechanic's `service_radius_miles` (default 25)
3. Jobs have valid `latitude` and `longitude`
4. Distance calculation is working

**Fix:**
```sql
-- Check mechanic location
SELECT id, home_latitude, home_longitude, service_radius_miles
FROM profiles
WHERE id = 'YOUR_MECHANIC_ID';

-- Check job locations
SELECT id, title, latitude, longitude
FROM jobs
WHERE status = 'searching'
  AND deleted_at IS NULL;
```

### "Quoted" shows leads I didn't quote

**Check:**
```sql
-- Verify quotes table
SELECT q.id, q.job_id, q.mechanic_id, q.price_cents
FROM quotes q
WHERE q.mechanic_id = 'YOUR_MECHANIC_ID';
```

The `job_quotes` CTE should filter by `mechanic_id`:
```sql
WHERE q.mechanic_id = p_mechanic_id
```

---

## Implementation Files

1. **SQL Functions:**
   - `get_mechanic_leads()` - Main query with filter logic
   - `get_mechanic_leads_summary()` - Count for each filter

2. **React Hook:**
   - `src/hooks/use-mechanic-leads.ts` - Fetches leads and summary

3. **UI Components:**
   - `app/(mechanic)/(tabs)/leads.tsx` - Main page with filter tabs
   - `components/mechanic/LeadCard.tsx` - Individual lead display
   - `components/mechanic/LeadsHeader.tsx` - Summary counts

---

## Testing Checklist

- [ ] "All" shows all open leads
- [ ] "Nearby" shows only leads within radius
- [ ] "Nearby" shows 0 when mechanic has no location
- [ ] "Quoted" shows only leads you quoted
- [ ] Summary counts match actual results
- [ ] Switching filters updates leads list
- [ ] Distance calculation is accurate
- [ ] Pagination works for all filters

---

## Status: ✅ COMPLETE

All three filters are properly implemented with correct SQL logic and summary counts.
