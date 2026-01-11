-- =====================================================
-- VERIFICATION CHECKLIST
-- =====================================================
-- Run these queries after migration to verify schema integrity
-- Expected results are noted in comments
-- =====================================================

-- =====================================================
-- 1. EXTENSIONS INSTALLED
-- =====================================================
-- Expected: uuid-ossp, pgcrypto present; postgis optional
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'postgis')
ORDER BY extname;

-- =====================================================
-- 2. ALL CORE TABLES EXIST
-- =====================================================
-- Expected: All tables should exist (count = 1 for each)
SELECT 
  'profiles' AS table_name, 
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') AS exists
UNION ALL SELECT 'vehicles', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles')
UNION ALL SELECT 'jobs', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs')
UNION ALL SELECT 'quotes', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quotes')
UNION ALL SELECT 'quote_requests', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quote_requests')
UNION ALL SELECT 'reviews', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews')
UNION ALL SELECT 'mechanic_profiles', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mechanic_profiles')
UNION ALL SELECT 'messages', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages')
UNION ALL SELECT 'notifications', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications')
UNION ALL SELECT 'payments', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments')
UNION ALL SELECT 'badges', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'badges')
UNION ALL SELECT 'user_badges', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_badges')
UNION ALL SELECT 'support_requests', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_requests')
ORDER BY table_name;

-- =====================================================
-- 3. RLS ENABLED ON ALL TABLES
-- =====================================================
-- Expected: All tables should have rowsecurity = true
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT LIKE 'pg_%'
ORDER BY c.relname;

-- =====================================================
-- 4. POLICIES EXIST FOR CORE TABLES
-- =====================================================
-- Expected: Each table should have at least 1 policy
SELECT 
  schemaname,
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- =====================================================
-- 5. ENUMS EXIST
-- =====================================================
-- Expected: All enums should exist
SELECT 
  t.typname AS enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- =====================================================
-- 6. CRITICAL FUNCTIONS EXIST
-- =====================================================
-- Expected: All functions should exist
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'handle_new_user',
    'set_user_role',
    'get_my_role',
    'get_my_profile',
    'get_mechanic_leads',
    'get_mechanic_leads_summary',
    'get_public_profile_card',
    'update_updated_at_column',
    'update_mechanic_rating',
    'increment_mechanic_job_count'
  )
ORDER BY p.proname;

-- =====================================================
-- 7. TRIGGERS EXIST
-- =====================================================
-- Expected: Critical triggers should exist
SELECT 
  tgname AS trigger_name,
  relname AS table_name,
  CASE tgenabled 
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE tgenabled::text
  END AS status
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY relname, tgname;

-- =====================================================
-- 8. GRANTS VERIFICATION
-- =====================================================
-- Expected: authenticated role should have access to core tables
SELECT 
  grantee,
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('authenticated', 'anon', 'service_role')
  AND table_name IN ('profiles', 'jobs', 'quotes', 'messages', 'notifications')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- =====================================================
-- 9. SECURITY DEFINER FUNCTIONS HAVE search_path SET
-- =====================================================
-- Expected: All SECURITY DEFINER functions should have search_path set
SELECT 
  p.proname AS function_name,
  p.proconfig AS config_settings,
  CASE 
    WHEN p.proconfig IS NULL THEN 'WARNING: No search_path set'
    WHEN 'search_path=public' = ANY(p.proconfig) THEN 'OK'
    WHEN EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%') THEN 'OK'
    ELSE 'WARNING: search_path may not be set'
  END AS status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

-- =====================================================
-- 10. STORAGE BUCKETS EXIST
-- =====================================================
-- Expected: Required buckets should exist
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('avatars', 'media', 'support-screenshots', 'chat-attachments')
ORDER BY id;

-- =====================================================
-- 11. CRITICAL RPC EXECUTION TEST (as authenticated)
-- =====================================================
-- These should be run as an authenticated user to verify access
-- Uncomment and run individually:

-- SELECT get_my_role();
-- SELECT get_my_profile();
-- SELECT * FROM get_mechanic_leads(auth.uid(), 'all', NULL, NULL, 25, 10, 0, 'newest');

-- =====================================================
-- 12. INDEXES EXIST FOR PERFORMANCE
-- =====================================================
-- Expected: Key indexes should exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('jobs', 'quotes', 'messages', 'notifications', 'reviews')
ORDER BY tablename, indexname;

-- =====================================================
-- 13. FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Expected: All FK constraints should be valid
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- =====================================================
-- SUMMARY QUERY
-- =====================================================
-- Quick health check summary
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS total_tables,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS total_policies,
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public') AS total_functions,
  (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS total_triggers,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS total_indexes;
