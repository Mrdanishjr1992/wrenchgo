# 🏗️ MECHANIC LEADS SYSTEM - ARCHITECTURE DIAGRAM

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MECHANIC LEADS SYSTEM                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  app/(mechanic)/(tabs)/leads.tsx                            │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  Header: "Leads"                                      │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  Filter Tabs: [All] [Nearby] [Quoted]               │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  LeadsHeader Component                                │  │   │
│  │  │  • Summary: "24 open • 12 nearby • 8 quoted"         │  │   │
│  │  │  • Sort: [Newest] Closest  Highest Value             │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  FlatList of LeadCard Components                     │  │   │
│  │  │  ┌─────────────────────────────────────────────────┐ │  │   │
│  │  │  │ LeadCard #1                                     │ │  │   │
│  │  │  │ • Customer info + rating                        │ │  │   │
│  │  │  │ • Job title + description                       │ │  │   │
│  │  │  │ • Vehicle + location + distance                 │ │  │   │
│  │  │  │ • [View Details] [Send Quote]                   │ │  │   │
│  │  │  └─────────────────────────────────────────────────┘ │  │   │
│  │  │  ┌─────────────────────────────────────────────────┐ │  │   │
│  │  │  │ LeadCard #2                                     │ │  │   │
│  │  │  └─────────────────────────────────────────────────┘ │  │   │
│  │  │  ...                                                  │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  [Load More]                                          │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Uses:                                                                │
│  • useMechanicLeads() hook                                           │
│  • LeadCard component                                                │
│  • LeadsEmptyState component                                         │
│  • LeadsHeader component                                             │
│  • expo-location for GPS                                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ API Calls
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          HOOK LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  src/hooks/use-mechanic-leads.ts                            │   │
│  │                                                              │   │
│  │  useMechanicLeads(mechanicId, filter, lat, lng, radius)    │   │
│  │                                                              │   │
│  │  State Management:                                           │   │
│  │  • leads: MechanicLead[]                                    │   │
│  │  • summary: LeadsSummary                                    │   │
│  │  • loading: boolean                                         │   │
│  │  • error: string | null                                     │   │
│  │  • hasMore: boolean                                         │   │
│  │  • offset: number (for pagination)                          │   │
│  │                                                              │   │
│  │  Functions:                                                  │   │
│  │  • fetchLeads(reset) - Get leads from RPC                  │   │
│  │  • fetchSummary() - Get counts from RPC                    │   │
│  │  • refetch() - Reset and reload                            │   │
│  │  • loadMore() - Fetch next page                            │   │
│  │  • changeSortBy(sortBy) - Change sort order               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ supabase.rpc()
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  RPC: get_mechanic_leads()                                  │   │
│  │                                                              │   │
│  │  Parameters:                                                 │   │
│  │  • p_mechanic_id: UUID                                      │   │
│  │  • p_filter: 'all' | 'nearby' | 'quoted'                   │   │
│  │  • p_mechanic_lat, p_mechanic_lng: DOUBLE PRECISION        │   │
│  │  • p_radius_miles: INTEGER                                  │   │
│  │  • p_limit, p_offset: INTEGER                              │   │
│  │  • p_sort_by: 'newest' | 'closest' | 'highest_value'      │   │
│  │                                                              │   │
│  │  Logic:                                                      │   │
│  │  1. Get mechanic location (if not provided)                │   │
│  │  2. WITH job_quotes: Get mechanic's quotes                 │   │
│  │  3. WITH customer_ratings: Get customer ratings            │   │
│  │  4. WITH job_data: Join jobs + profiles + vehicles         │   │
│  │     • Calculate distance (Haversine formula)               │   │
│  │     • Filter by status (open jobs only)                    │   │
│  │     • Apply filter (all/nearby/quoted)                     │   │
│  │  5. SELECT and ORDER BY sort preference                    │   │
│  │  6. LIMIT and OFFSET for pagination                        │   │
│  │                                                              │   │
│  │  Returns: TABLE of MechanicLead rows                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  RPC: get_mechanic_leads_summary()                          │   │
│  │                                                              │   │
│  │  Parameters:                                                 │   │
│  │  • p_mechanic_id: UUID                                      │   │
│  │  • p_mechanic_lat, p_mechanic_lng: DOUBLE PRECISION        │   │
│  │  • p_radius_miles: INTEGER                                  │   │
│  │                                                              │   │
│  │  Logic:                                                      │   │
│  │  1. Count all open jobs (all_count)                        │   │
│  │  2. Count jobs within radius (nearby_count)                │   │
│  │  3. Count jobs mechanic quoted (quoted_count)              │   │
│  │                                                              │   │
│  │  Returns: TABLE with counts                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Tables Used:                                                │   │
│  │  • jobs (id, title, description, status, created_at,       │   │
│  │          latitude, longitude, location_address,             │   │
│  │          customer_id, vehicle_id)                           │   │
│  │  • profiles (id, full_name, photo_url,                     │   │
│  │              home_latitude, home_longitude,                 │   │
│  │              service_radius_miles)                          │   │
│  │  • vehicles (id, year, make, model)                        │   │
│  │  • quotes (id, job_id, mechanic_id, amount, status,       │   │
│  │            created_at)                                      │   │
│  │  • reviews (customer_id, rating)                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Indexes for Performance:                                    │   │
│  │  • idx_jobs_status_created_at                              │   │
│  │  • idx_quotes_mechanic_job                                 │   │
│  │  • idx_quotes_status                                       │   │
│  │  • idx_jobs_location                                       │   │
│  │  • idx_jobs_customer_id                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Initial Load
```
User opens Leads page
    ↓
useMechanicLeads() hook initializes
    ↓
fetchLeads() called with filter='all'
    ↓
supabase.rpc('get_mechanic_leads', {...})
    ↓
Database executes RPC function
    ↓
Returns 20 leads with all data
    ↓
Hook updates state: leads, loading=false
    ↓
FlatList renders LeadCard components
```

### 2. Filter Change (e.g., All → Nearby)
```
User taps "Nearby" tab
    ↓
setFilter('nearby')
    ↓
useEffect triggers refetch()
    ↓
fetchLeads(reset=true) with filter='nearby'
    ↓
supabase.rpc('get_mechanic_leads', {
  p_filter: 'nearby',
  p_mechanic_lat: 37.7749,
  p_mechanic_lng: -122.4194,
  p_radius_miles: 25
})
    ↓
Database filters jobs by distance
    ↓
Returns nearby leads sorted by distance
    ↓
Hook updates state: leads (replaced), offset=0
    ↓
FlatList re-renders with new data
```

### 3. Load More (Pagination)
```
User scrolls to bottom
    ↓
onEndReached triggered
    ↓
loadMore() called
    ↓
fetchLeads(reset=false) with offset=20
    ↓
supabase.rpc('get_mechanic_leads', {
  p_offset: 20,
  p_limit: 20
})
    ↓
Database returns next 20 leads
    ↓
Hook updates state: leads (appended), offset=40
    ↓
FlatList appends new items
```

### 4. Pull to Refresh
```
User pulls down
    ↓
onRefresh triggered
    ↓
refetch() called
    ↓
fetchLeads(reset=true) + fetchSummary()
    ↓
Both RPC calls execute in parallel
    ↓
Database returns fresh data
    ↓
Hook updates state: leads (replaced), summary
    ↓
FlatList re-renders with fresh data
```

### 5. Sort Change
```
User taps "Closest" sort button
    ↓
changeSortBy('closest')
    ↓
setSortBy('closest'), setOffset(0)
    ↓
useEffect triggers refetch()
    ↓
fetchLeads(reset=true) with p_sort_by='closest'
    ↓
Database re-orders by distance ASC
    ↓
Returns leads sorted by closest first
    ↓
Hook updates state: leads (replaced)
    ↓
FlatList re-renders with new order
```

## Distance Calculation (Haversine Formula)

```sql
-- Calculates distance in miles between two lat/lng points
distance_miles = 3959 * acos(
  cos(radians(mechanic_lat)) * 
  cos(radians(job_lat)) * 
  cos(radians(job_lng) - radians(mechanic_lng)) + 
  sin(radians(mechanic_lat)) * 
  sin(radians(job_lat))
)

-- Example:
-- Mechanic: 37.7749, -122.4194 (San Francisco)
-- Job: 37.8044, -122.2712 (Oakland)
-- Distance: ~11.2 miles
```

## Filter Logic

### All Filter
```sql
WHERE 
  j.status IN ('pending', 'open', 'ready_for_quotes', 'awaiting_quotes')
  AND j.deleted_at IS NULL
  AND j.canceled_at IS NULL
```

### Nearby Filter
```sql
WHERE 
  j.status IN ('pending', 'open', 'ready_for_quotes', 'awaiting_quotes')
  AND j.deleted_at IS NULL
  AND j.canceled_at IS NULL
  AND j.latitude IS NOT NULL
  AND j.longitude IS NOT NULL
  AND distance_miles <= 25  -- service radius
```

### Quoted Filter
```sql
WHERE 
  j.status IN ('pending', 'open', 'ready_for_quotes', 'awaiting_quotes')
  AND j.deleted_at IS NULL
  AND j.canceled_at IS NULL
  AND EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.job_id = j.id
      AND q.mechanic_id = 'MECHANIC_ID'
      AND q.deleted_at IS NULL
  )
```

## Component Hierarchy

```
MechanicLeadsPage
├── Header (with safe area insets)
├── FilterTabs
│   ├── All Tab
│   ├── Nearby Tab
│   └── Quoted Tab
├── LeadsHeader
│   ├── Summary (counts)
│   └── Sort Controls
│       ├── Newest Button
│       ├── Closest Button
│       └── Highest Value Button
└── FlatList
    ├── LeadCard (item 1)
    │   ├── NEW Badge (conditional)
    │   ├── Quoted Badge (conditional)
    │   ├── Customer Info
    │   │   ├── Avatar
    │   │   ├── Name
    │   │   └── Rating
    │   ├── Meta Info
    │   │   ├── Time Ago
    │   │   └── Distance
    │   ├── Job Info
    │   │   ├── Title
    │   │   ├── Description
    │   │   ├── Vehicle Tag
    │   │   └── Location
    │   └── Actions
    │       ├── View Details Button
    │       └── Send Quote Button / Quote Info
    ├── LeadCard (item 2)
    ├── ...
    ├── Load More Button
    └── Empty State (if no data)
        ├── Icon
        ├── Title
        └── Message
```

## Performance Optimizations

### Database Level
1. **Indexes** - All queries use indexes (no table scans)
2. **Single RPC Call** - All data fetched in one query (no N+1)
3. **Efficient Joins** - LEFT JOIN only when needed
4. **Distance Calculation** - Done in SQL (not client-side)
5. **Pagination** - LIMIT/OFFSET reduces data transfer

### Frontend Level
1. **React Hook Memoization** - useCallback, useMemo
2. **Pagination** - Load 20 items at a time
3. **Skeleton Loaders** - Perceived performance
4. **FlatList** - Virtualized rendering
5. **Image Optimization** - Lazy loading with caching

## Security (RLS)

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Mechanic App)                                     │
│  • Authenticated as mechanic user                            │
│  • Has JWT token with user.id                               │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ supabase.rpc('get_mechanic_leads', {
                        │   p_mechanic_id: user.id
                        │ })
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase RPC Layer                                          │
│  • Validates JWT token                                       │
│  • Checks user is authenticated                              │
│  • Grants EXECUTE permission to authenticated users          │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ SECURITY DEFINER
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  RPC Function (Elevated Privileges)                          │
│  • Runs with function owner's privileges                     │
│  • Filters by p_mechanic_id parameter                       │
│  • Only returns data for specified mechanic                  │
│  • No cross-mechanic data leakage                           │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ SELECT with WHERE clauses
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Database Tables (with RLS)                                  │
│  • jobs: RLS allows mechanics to see open jobs              │
│  • profiles: RLS allows reading public profile data         │
│  • quotes: RLS allows mechanics to see their own quotes     │
│  • reviews: RLS allows reading aggregated ratings           │
│  • Defense-in-depth: RLS + RPC filtering                    │
└─────────────────────────────────────────────────────────────┘
```

---

**This architecture provides:**
- ✅ Clean separation of concerns
- ✅ High performance with proper indexing
- ✅ Secure data access with RLS + RPC
- ✅ Scalable pagination
- ✅ Smooth UX with loading states
- ✅ Maintainable code structure
