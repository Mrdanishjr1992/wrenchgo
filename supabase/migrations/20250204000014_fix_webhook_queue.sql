-- =====================================================
-- FIX WEBHOOK HTTP_REQUEST_QUEUE ISSUE
-- =====================================================
-- Purpose: Clean up any pending webhook requests with null URLs
-- that are causing constraint violations
-- =====================================================

-- Clean up any pending requests with null URLs in the queue
DELETE FROM net.http_request_queue 
WHERE url IS NULL;

-- Optional: View any failed webhook requests for debugging
-- Uncomment to see recent webhook failures:
-- SELECT id, url, error_msg, created 
-- FROM net._http_response 
-- WHERE error_msg IS NOT NULL 
-- ORDER BY created DESC 
-- LIMIT 10;
