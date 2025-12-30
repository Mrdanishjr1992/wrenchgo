-- ============================================================================
-- Migration: Add Performance Indexes (Simplified)
-- Phase: 2 (Performance Optimization)
-- Downtime: NONE
-- Rollback: Drop indexes (see rollback section)
-- ============================================================================

-- PROBLEM: Missing indexes for common query patterns
-- SOLUTION: Add composite indexes for core queries (vehicles, jobs, quote_requests only)

-- ============================================================================
-- VEHICLES TABLE INDEXES
-- ============================================================================

-- Add index for mechanic job lookups (vehicles via jobs)
CREATE INDEX IF NOT EXISTS idx_vehicles_id_customer_id
ON public.vehicles(id, customer_id);

-- ============================================================================
-- JOBS TABLE INDEXES
-- ============================================================================

-- Add composite index for status + created_at (explore/feed queries)
CREATE INDEX IF NOT EXISTS idx_jobs_status_created
ON public.jobs(status, created_at DESC)
WHERE status = 'searching';

-- Add index for mechanic assigned jobs
CREATE INDEX IF NOT EXISTS idx_jobs_accepted_mechanic_created
ON public.jobs(accepted_mechanic_id, created_at DESC)
WHERE accepted_mechanic_id IS NOT NULL;

-- Add index for customer jobs feed
CREATE INDEX IF NOT EXISTS idx_jobs_customer_status_created
ON public.jobs(customer_id, status, created_at DESC);

-- ============================================================================
-- QUOTE_REQUESTS TABLE INDEXES
-- ============================================================================

-- Add index for customer quote lookups
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_created
ON public.quote_requests(customer_id, created_at DESC);

-- Add index for mechanic quote lookups
CREATE INDEX IF NOT EXISTS idx_quote_requests_mechanic_created
ON public.quote_requests(mechanic_id, created_at DESC);

-- Add index for job quote lookups
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_status
ON public.quote_requests(job_id, status);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_quote_requests_status_created
ON public.quote_requests(status, created_at DESC);

-- Add index for accepted quotes (time-protection calculations)
CREATE INDEX IF NOT EXISTS idx_quote_requests_accepted_at
ON public.quote_requests(accepted_at)
WHERE accepted_at IS NOT NULL;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE public.vehicles;
ANALYZE public.jobs;
ANALYZE public.quote_requests;

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback, drop indexes:
-- DROP INDEX IF EXISTS idx_vehicles_id_customer_id;
-- DROP INDEX IF EXISTS idx_jobs_status_created;
-- DROP INDEX IF EXISTS idx_jobs_accepted_mechanic_created;
-- DROP INDEX IF EXISTS idx_jobs_customer_status_created;
-- DROP INDEX IF EXISTS idx_quote_requests_customer_created;
-- DROP INDEX IF EXISTS idx_quote_requests_mechanic_created;
-- DROP INDEX IF EXISTS idx_quote_requests_job_status;
-- DROP INDEX IF EXISTS idx_quote_requests_status_created;
-- DROP INDEX IF EXISTS idx_quote_requests_accepted_at;

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- Expected improvements:
-- - Garage load: 10-50x faster
-- - Explore/matching: 20-100x faster
-- - Quote requests: 10-50x faster
-- - Jobs feed: 10-50x faster
