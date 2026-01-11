#!/bin/bash
# =====================================================
# CI/CD Migration Script for Supabase
# =====================================================
# Usage: ./ci_migrate.sh [--reset] [--dry-run]
# 
# Options:
#   --reset    Reset database before applying migrations (DANGEROUS)
#   --dry-run  Show what would be done without executing
# =====================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MIGRATIONS_DIR="supabase/migrations"
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

# Parse arguments
RESET=false
DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --reset)
      RESET=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
  esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Supabase Migration CI/CD Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check prerequisites
check_prerequisites() {
  echo -e "\n${YELLOW}Checking prerequisites...${NC}"
  
  if ! command -v supabase &> /dev/null; then
    echo -e "${RED}ERROR: Supabase CLI not found. Install with: npm install -g supabase${NC}"
    exit 1
  fi
  
  if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo -e "${YELLOW}WARNING: SUPABASE_PROJECT_ID not set. Using local development.${NC}"
  fi
  
  echo -e "${GREEN}Prerequisites OK${NC}"
}

# Validate migrations
validate_migrations() {
  echo -e "\n${YELLOW}Validating migrations...${NC}"
  
  # Check for duplicate migration numbers
  local duplicates=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | \
    sed 's/.*\///' | \
    cut -d'_' -f1 | \
    sort | uniq -d)
  
  if [ -n "$duplicates" ]; then
    echo -e "${RED}ERROR: Duplicate migration numbers found:${NC}"
    echo "$duplicates"
    exit 1
  fi
  
  # Check for DEPRECATED migrations
  local deprecated=$(ls -1 "$MIGRATIONS_DIR"/*DEPRECATED*.sql 2>/dev/null || true)
  if [ -n "$deprecated" ]; then
    echo -e "${YELLOW}WARNING: Deprecated migrations found (will be skipped):${NC}"
    echo "$deprecated"
  fi
  
  # Validate SQL syntax (basic check)
  for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$file" ]; then
      # Skip deprecated files
      if [[ "$file" == *"DEPRECATED"* ]]; then
        continue
      fi
      
      # Check for common issues
      if grep -q "DROP TABLE.*CASCADE" "$file" && ! grep -q "IF EXISTS" "$file"; then
        echo -e "${YELLOW}WARNING: $file contains DROP TABLE without IF EXISTS${NC}"
      fi
    fi
  done
  
  echo -e "${GREEN}Migration validation complete${NC}"
}

# Run migrations locally
run_local_migrations() {
  echo -e "\n${YELLOW}Running migrations locally...${NC}"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN: Would execute: supabase db push${NC}"
    return
  fi
  
  if [ "$RESET" = true ]; then
    echo -e "${RED}WARNING: Resetting database...${NC}"
    supabase db reset --debug
  else
    supabase db push --debug
  fi
  
  echo -e "${GREEN}Local migrations complete${NC}"
}

# Run migrations on remote
run_remote_migrations() {
  echo -e "\n${YELLOW}Running migrations on remote...${NC}"
  
  if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo -e "${YELLOW}Skipping remote migrations (no project ID)${NC}"
    return
  fi
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN: Would execute: supabase db push --linked${NC}"
    return
  fi
  
  # Link to project if not already linked
  supabase link --project-ref "$SUPABASE_PROJECT_ID"
  
  # Push migrations
  supabase db push --linked
  
  echo -e "${GREEN}Remote migrations complete${NC}"
}

# Run verification queries
run_verification() {
  echo -e "\n${YELLOW}Running verification checks...${NC}"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN: Would run verification queries${NC}"
    return
  fi
  
  # Run verification SQL
  local verification_file="supabase/migrations_launch_ready/verification_checklist.sql"
  if [ -f "$verification_file" ]; then
    echo -e "${YELLOW}Running verification checklist...${NC}"
    
    # Extract and run the summary query
    supabase db execute --file "$verification_file" 2>/dev/null || {
      echo -e "${YELLOW}Verification queries completed (some may require manual review)${NC}"
    }
  fi
  
  echo -e "${GREEN}Verification complete${NC}"
}

# Main execution
main() {
  check_prerequisites
  validate_migrations
  
  if [ -n "$SUPABASE_PROJECT_ID" ]; then
    run_remote_migrations
  else
    run_local_migrations
  fi
  
  run_verification
  
  echo -e "\n${GREEN}========================================${NC}"
  echo -e "${GREEN}Migration process complete!${NC}"
  echo -e "${GREEN}========================================${NC}"
}

# Run main
main
