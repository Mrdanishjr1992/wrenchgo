# Location Privacy Implementation Guide

## Overview
This implementation ensures mechanics NEVER see exact customer addresses until they are the accepted mechanic for a job.

## What Changed

### Database Schema
- Added `public_latitude`, `public_longitude`, `public_area_label` to `jobs` table (approximate location)
- Added `private_location_notes` to `jobs` table (gate codes, parking, etc.)
- Created `jobs_public` view with only safe fields
- Updated RLS policies to protect exact location data
- Created distance calculation functions using public coordinates

### Automatic Location Privacy
- Trigger automatically populates public location fields when job is created/updated
- Public coordinates are rounded to 2 decimals + small jitter (~0.5-1 mile radius)
- Public area label extracts city/state from address

## App Code Changes

### 1. Mechanic Leads Browsing (Already Implemented)
The existing `get_mechanic_leads` RPC has been updated to use public location fields.

**No changes needed** - your existing code in `src/hooks/use-mechanic-leads.ts` will automatically use the safe public coordinates.

```typescript
// This already works correctly - it now uses public coordinates
const { data, error } = await supabase.rpc('get_mechanic_leads', {
  p_mechanic_id: mechanicId,
  p_filter: filter, // 'all', 'nearby', 'quoted'
  p_mechanic_lat: mechanicLat,
  p_mechanic_lng: mechanicLng,
  p_radius_miles: radiusMiles,
  p_limit: LEADS_PER_PAGE,
  p_offset: currentOffset,
  p_sort_by: sortBy,
});
```

### 2. Customer Creating Jobs
When customers create jobs, the trigger automatically handles privacy:

```typescript
// In app/(customer)/request-service.tsx
const { data: job, error } = await supabase
  .from("jobs")
  .insert({
    customer_id: userId,
    title: "Oil Change",
    latitude: 40.7128,  // Exact location
    longitude: -74.0060, // Exact location
    location_address: "123 Main St, New York, NY 10001",
    private_location_notes: "Gate code: #1234, park in visitor spot", // NEW FIELD
    // ... other fields
  })
  .select()
  .single();

// Trigger automatically populates:
// - public_latitude (rounded + jittered)
// - public_longitude (rounded + jittered)  
// - public_area_label ("New York, NY")
```

### 3. Mechanic Viewing Job Details (Before Acceptance)
Use the safe fields from the RPC response:

```typescript
// In app/(mechanic)/job-details/[id].tsx
// The get_mechanic_leads RPC returns safe fields:
const lead = {
  latitude: 40.71,           // Public (approximate)
  longitude: -74.01,         // Public (approximate)
  location_address: "New York, NY", // Public area label
  distance_miles: 5.2,       // Calculated from public coords
  // ... other safe fields
};

// Display on map using public coordinates
<MapView
  initialRegion={{
    latitude: lead.latitude,    // Shows approximate area
    longitude: lead.longitude,  // Shows approximate area
    latitudeDelta: 0.05,       // Wider zoom to show area
    longitudeDelta: 0.05,
  }}
>
  <Circle
    center={{ latitude: lead.latitude, longitude: lead.longitude }}
    radius={800} // ~0.5 mile radius circle
    fillColor="rgba(59, 130, 246, 0.2)"
    strokeColor="rgba(59, 130, 246, 0.5)"
  />
</MapView>
```

### 4. Mechanic Viewing Job Details (After Acceptance)
Query the full job record to get exact location:

```typescript
// In app/(mechanic)/job/[id].tsx
// After mechanic is accepted, they can see exact location
const { data: job, error } = await supabase
  .from("jobs")
  .select(`
    *,
    vehicles(*),
    profiles(*)
  `)
  .eq("id", jobId)
  .eq("accepted_mechanic_id", mechanicId) // RLS ensures only accepted mechanic
  .single();

// Now has access to:
// - latitude (exact)
// - longitude (exact)
// - location_address (exact street address)
// - private_location_notes (gate codes, parking, etc.)

// Display exact location on map
<MapView
  initialRegion={{
    latitude: job.latitude,     // Exact location
    longitude: job.longitude,   // Exact location
    latitudeDelta: 0.01,       // Tight zoom
    longitudeDelta: 0.01,
  }}
>
  <Marker
    coordinate={{ latitude: job.latitude, longitude: job.longitude }}
    title={job.location_address}
    description={job.private_location_notes}
  />
</MapView>

// Show private notes
{job.private_location_notes && (
  <View style={styles.privateNotes}>
    <Text style={styles.label}>Access Instructions</Text>
    <Text>{job.private_location_notes}</Text>
  </View>
)}
```

### 5. Customer Always Sees Exact Location
Customers can always see their own exact location:

```typescript
// In app/(customer)/job/[id].tsx
const { data: job, error } = await supabase
  .from("jobs")
  .select("*")
  .eq("id", jobId)
  .eq("customer_id", customerId) // RLS ensures only customer
  .single();

// Has full access to all location fields
```

## Security Guarantees

### RLS Policies Enforce:
1. **Mechanics browsing** → Can only see public location fields via `get_mechanic_leads` RPC
2. **Accepted mechanic** → Can see exact location via `jobs.accepted_mechanic_id = auth.uid()`
3. **Customer** → Always sees exact location via `jobs.customer_id = auth.uid()`
4. **Direct queries** → Mechanics cannot bypass RPC to query `jobs` table directly for exact location

### What Mechanics See:
- **Before acceptance**: Approximate location (±0.5-1 mile), city/state label
- **After acceptance**: Exact address, coordinates, private notes

## Migration Deployment

Run migrations in order:
```bash
# 1. Add columns and functions
supabase migration up 20250126000000_add_job_location_privacy.sql

# 2. Create safe view
supabase migration up 20250126000001_create_jobs_public_view.sql

# 3. Add RLS policies
supabase migration up 20250126000002_add_location_privacy_rls.sql

# 4. Add distance functions
supabase migration up 20250126000003_add_distance_functions.sql

# 5. Update existing RPC
supabase migration up 20250126000004_update_mechanic_leads_rpc.sql
```

Or deploy all at once:
```bash
supabase db push
```

## Testing Checklist

- [ ] Create job as customer → verify public fields auto-populate
- [ ] Browse jobs as mechanic → verify only approximate location shown
- [ ] View job details as mechanic (not accepted) → verify no exact address
- [ ] Accept job as mechanic → verify exact location now visible
- [ ] View job as customer → verify always see exact location
- [ ] Try direct query as mechanic → verify RLS blocks exact location access
- [ ] Test "Nearby" filter → verify uses public coordinates for distance
- [ ] Verify private_location_notes only visible after acceptance

## Type Updates

Update your TypeScript types to include new fields:

```typescript
// src/types/job.ts
export interface Job {
  id: string;
  customer_id: string;
  title: string;
  description?: string;
  status: JobStatus;
  
  // Exact location (customer + accepted mechanic only)
  latitude?: number;
  longitude?: number;
  location_address?: string;
  private_location_notes?: string; // NEW
  
  // Public location (all mechanics)
  public_latitude?: number;        // NEW
  public_longitude?: number;       // NEW
  public_area_label?: string;      // NEW
  
  // ... other fields
}

export interface MechanicLead {
  job_id: string;
  title: string;
  description?: string;
  
  // Only public location fields
  latitude: number;           // Actually public_latitude
  longitude: number;          // Actually public_longitude
  location_address: string;   // Actually public_area_label
  distance_miles?: number;
  
  // ... other fields
}
```
