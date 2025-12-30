-- Migration: Performance optimizations for vehicles table
-- Adds composite indexes and optimizes common query patterns

-- Step 1: Add composite index for customer_id + created_at (used in vehicle list queries)
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_created 
ON public.vehicles(customer_id, created_at DESC);

-- Step 2: Add index on id for faster single vehicle lookups (if not exists)
-- Note: Primary key already creates this, but explicit for clarity
-- CREATE INDEX IF NOT EXISTS idx_vehicles_id ON public.vehicles(id);

-- Step 3: Add partial index for active vehicles (if you add a deleted_at column later)
-- CREATE INDEX IF NOT EXISTS idx_vehicles_active 
-- ON public.vehicles(customer_id, created_at DESC) 
-- WHERE deleted_at IS NULL;

-- Step 4: Analyze table to update statistics for query planner
ANALYZE public.vehicles;

-- Performance Notes:
-- 1. idx_vehicles_customer_id: Used for filtering by customer (already exists from previous migration)
-- 2. idx_vehicles_customer_created: Optimizes ORDER BY created_at queries per customer
-- 3. Primary key on id: Optimizes single vehicle lookups by ID
-- 4. Foreign key on customer_id: Already indexed for referential integrity

-- Common Query Patterns Optimized:
-- SELECT * FROM vehicles WHERE customer_id = ? ORDER BY created_at ASC;  ✅ Uses idx_vehicles_customer_created
-- SELECT * FROM vehicles WHERE id = ?;                                    ✅ Uses primary key
-- SELECT * FROM vehicles WHERE customer_id = ?;                           ✅ Uses idx_vehicles_customer_id

-- Verification queries (run manually after migration):
-- EXPLAIN ANALYZE SELECT * FROM vehicles WHERE customer_id = 'some-uuid' ORDER BY created_at ASC;
-- EXPLAIN ANALYZE SELECT * FROM vehicles WHERE id = 'some-uuid';
