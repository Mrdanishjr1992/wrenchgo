#!/bin/bash
# =====================================================
# CI Migration Verification Script
# =====================================================
# Run this in CI to verify migrations apply cleanly
# =====================================================

set -e

echo "=== Supabase Migration CI Check ==="

# Configuration
SUPABASE_DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"
MIGRATIONS_DIR="supabase/migrations_launch_ready"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run SQL and check result
run_sql() {
    psql "$SUPABASE_DB_URL" -t -c "$1" 2>/dev/null
}

# Function to run SQL file
run_sql_file() {
    psql "$SUPABASE_DB_URL" -f "$1" 2>&1
}

echo ""
echo "1. Starting local Supabase..."
supabase start --ignore-health-check || true

echo ""
echo "2. Resetting database..."
supabase db reset --debug 2>&1 | head -50

echo ""
echo "3. Applying migrations..."
for migration in "$MIGRATIONS_DIR"/0000_baseline_*.sql; do
    if [ -f "$migration" ]; then
        echo "   Applying: $(basename "$migration")"
        result=$(run_sql_file "$migration" 2>&1)
        if echo "$result" | grep -qi "error"; then
            echo -e "${RED}   FAILED: $migration${NC}"
            echo "$result"
            exit 1
        fi
        echo -e "${GREEN}   OK${NC}"
    fi
done

echo ""
echo "4. Running verification checks..."

# Check 1: All tables have RLS
echo -n "   RLS enabled on all tables: "
rls_check=$(run_sql "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;")
if [ "$rls_check" -eq 0 ] 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - $rls_check tables without RLS${NC}"
    exit 1
fi

# Check 2: SECURITY DEFINER functions have search_path
echo -n "   SECURITY DEFINER search_path: "
secdef_check=$(run_sql "SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.prosecdef = true AND (p.proconfig IS NULL OR NOT 'search_path=public' = ANY(p.proconfig));")
if [ "$secdef_check" -eq 0 ] 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}WARN - $secdef_check functions without search_path${NC}"
fi

# Check 3: Required enums exist
echo -n "   Required enums exist: "
enum_count=$(run_sql "SELECT COUNT(*) FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e';")
if [ "$enum_count" -ge 10 ] 2>/dev/null; then
    echo -e "${GREEN}PASS ($enum_count enums)${NC}"
else
    echo -e "${RED}FAIL - only $enum_count enums found${NC}"
    exit 1
fi

# Check 4: Core tables exist
echo -n "   Core tables exist: "
table_count=$(run_sql "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';")
if [ "$table_count" -ge 25 ] 2>/dev/null; then
    echo -e "${GREEN}PASS ($table_count tables)${NC}"
else
    echo -e "${RED}FAIL - only $table_count tables found${NC}"
    exit 1
fi

# Check 5: Storage buckets exist
echo -n "   Storage buckets exist: "
bucket_count=$(run_sql "SELECT COUNT(*) FROM storage.buckets;")
if [ "$bucket_count" -ge 5 ] 2>/dev/null; then
    echo -e "${GREEN}PASS ($bucket_count buckets)${NC}"
else
    echo -e "${YELLOW}WARN - only $bucket_count buckets found${NC}"
fi

# Check 6: No duplicate policies
echo -n "   No duplicate policies: "
dup_policies=$(run_sql "SELECT COUNT(*) FROM (SELECT schemaname, tablename, policyname, COUNT(*) FROM pg_policies GROUP BY 1,2,3 HAVING COUNT(*) > 1) x;")
if [ "$dup_policies" -eq 0 ] 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - $dup_policies duplicate policies${NC}"
    exit 1
fi

echo ""
echo "5. Testing idempotency (re-running migrations)..."
for migration in "$MIGRATIONS_DIR"/0000_baseline_*.sql; do
    if [ -f "$migration" ]; then
        echo "   Re-applying: $(basename "$migration")"
        result=$(run_sql_file "$migration" 2>&1)
        if echo "$result" | grep -qi "error"; then
            echo -e "${RED}   IDEMPOTENCY FAILED: $migration${NC}"
            echo "$result"
            exit 1
        fi
        echo -e "${GREEN}   OK (idempotent)${NC}"
    fi
done

echo ""
echo -e "${GREEN}=== All CI checks passed ===${NC}"
exit 0
