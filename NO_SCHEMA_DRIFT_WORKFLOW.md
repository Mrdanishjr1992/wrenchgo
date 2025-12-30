# 🚫 No Schema Drift Workflow - WrenchGo

## 🎯 Goal: Prevent Supabase UI Edits from Diverging from Git

**Problem:** Schema changes made in Supabase UI don't get tracked in Git, causing drift.

**Solution:** Enforce "migrations-only" workflow with automated checks.

---

## 📋 The Golden Rules

### Rule #1: NO UI EDITS (Except for Emergency Hotfixes)
- ❌ **NEVER** create tables/columns/policies in Supabase UI
- ❌ **NEVER** modify RLS policies in Supabase UI
- ❌ **NEVER** add indexes in Supabase UI
- ✅ **ALWAYS** create migrations in Git first

### Rule #2: All Schema Changes via Migrations
- ✅ Create timestamped migration files
- ✅ Make migrations idempotent
- ✅ Test locally (if possible) or in staging
- ✅ Review in PR before merging
- ✅ Deploy via `supabase db push`

### Rule #3: Emergency Hotfix Protocol
If you MUST make a UI change in production:
1. Document it immediately in a GitHub issue
2. Create a migration file within 24 hours
3. Add `-- RETROACTIVE: Applied manually on YYYY-MM-DD` comment
4. Get PR review and merge to Git

---

## 🔄 Recommended Dev Workflow (No Docker Required)

### Option A: Direct Remote Development (Your Current Setup)

Since Docker is blocked, you'll work directly against Supabase remote:

```bash
# 1. Create feature branch
git checkout -b feature/add-vehicle-photos

# 2. Create migration file
supabase migration new add_vehicle_photos_column

# 3. Write migration SQL (make it idempotent!)
# Edit: supabase/migrations/YYYYMMDDHHMMSS_add_vehicle_photos_column.sql

# 4. Test migration on remote (STAGING PROJECT ONLY!)
supabase link --project-ref your-staging-project
supabase db push

# 5. Verify schema
supabase db diff  # Should show no diff after push

# 6. Test app functionality in staging

# 7. Create PR with migration file
git add supabase/migrations/
git commit -m "feat: add vehicle photos column"
git push origin feature/add-vehicle-photos

# 8. After PR approval, deploy to production
supabase link --project-ref your-production-project
supabase db push
```

### Option B: Use Supabase Branching (Recommended)

Supabase offers database branching (like Git for your DB):

```bash
# 1. Create database branch
supabase branches create feature/add-vehicle-photos

# 2. Link to branch
supabase link --branch feature/add-vehicle-photos

# 3. Create and test migration
supabase migration new add_vehicle_photos_column
# Edit migration file
supabase db push

# 4. Test app against branch
# Update .env to point to branch URL

# 5. When ready, merge branch to main
supabase branches merge feature/add-vehicle-photos

# 6. Create PR with migration file
git add supabase/migrations/
git commit -m "feat: add vehicle photos column"
git push
```

---

## ✅ Schema Changes Checklist

Use this checklist for EVERY schema change:

### Before Writing Migration:
- [ ] Checked if similar migration already exists
- [ ] Reviewed current schema (`supabase db dump --schema-only`)
- [ ] Planned rollback strategy
- [ ] Considered backward compatibility

### Writing Migration:
- [ ] Used idempotent SQL (`IF NOT EXISTS`, `DROP IF EXISTS`)
- [ ] Added comments explaining WHY (not just WHAT)
- [ ] Included rollback SQL in comments
- [ ] Used descriptive filename (e.g., `add_vehicle_photos_not_rename_column.sql`)
- [ ] Followed naming conventions (snake_case, customer_id not user_id)

### Testing Migration:
- [ ] Tested on staging/branch first
- [ ] Ran `supabase db diff` after push (should be empty)
- [ ] Tested app functionality
- [ ] Verified RLS policies work correctly
- [ ] Checked query performance (EXPLAIN ANALYZE)

### Before Merging PR:
- [ ] Migration file in `supabase/migrations/` directory
- [ ] Migration filename has correct timestamp
- [ ] PR description explains the change
- [ ] Rollback instructions in PR description
- [ ] At least one reviewer approved
- [ ] CI checks passed (see below)

### After Deployment:
- [ ] Ran `supabase db push` on production
- [ ] Verified no errors in Supabase logs
- [ ] Tested app in production
- [ ] Monitored for 24 hours
- [ ] Updated documentation if needed

---

## 🤖 CI Check Concept (GitHub Actions)

Create `.github/workflows/schema-drift-check.yml`:

```yaml
name: Schema Drift Check

on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight

jobs:
  check-schema-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Link to staging project
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_STAGING_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Check for schema drift
        run: |
          # Pull current remote schema
          supabase db pull --schema-only
          
          # Check if there are uncommitted changes
          if ! git diff --quiet supabase/migrations/; then
            echo "❌ SCHEMA DRIFT DETECTED!"
            echo "Remote database has changes not in Git."
            echo ""
            echo "Differences:"
            git diff supabase/migrations/
            exit 1
          else
            echo "✅ No schema drift detected"
          fi
      
      - name: Validate migration files
        run: |
          # Check migration filenames follow convention
          for file in supabase/migrations/*.sql; do
            filename=$(basename "$file")
            if ! [[ $filename =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
              echo "❌ Invalid migration filename: $filename"
              echo "Expected format: YYYYMMDDHHMMSS_description.sql"
              exit 1
            fi
          done
          echo "✅ All migration filenames valid"
      
      - name: Check for idempotent SQL
        run: |
          # Check for non-idempotent patterns
          if grep -r "CREATE TABLE " supabase/migrations/ | grep -v "IF NOT EXISTS"; then
            echo "⚠️  Warning: Found CREATE TABLE without IF NOT EXISTS"
          fi
          if grep -r "CREATE POLICY " supabase/migrations/ | grep -v "DROP POLICY IF EXISTS"; then
            echo "⚠️  Warning: Found CREATE POLICY without DROP POLICY IF EXISTS"
          fi
          if grep -r "ALTER TABLE.*ADD COLUMN " supabase/migrations/ | grep -v "IF NOT EXISTS"; then
            echo "⚠️  Warning: Found ADD COLUMN without IF NOT EXISTS"
          fi
      
      - name: Test migrations on staging
        run: |
          # Apply migrations to staging
          supabase db push
          
          # Verify no diff after push
          supabase db diff
          if [ $? -ne 0 ]; then
            echo "❌ Schema diff detected after push!"
            exit 1
          fi
          echo "✅ Migrations applied successfully"
```

---

## 🔍 Monitoring & Enforcement

### Daily Drift Check (Automated)

Create a script `scripts/check-schema-drift.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Checking for schema drift..."

# Link to production
supabase link --project-ref $SUPABASE_PRODUCTION_PROJECT_REF

# Pull current schema
supabase db pull --schema-only

# Check for uncommitted changes
if ! git diff --quiet supabase/migrations/; then
  echo "❌ SCHEMA DRIFT DETECTED!"
  echo ""
  echo "Someone made changes in Supabase UI that aren't in Git."
  echo "Please create a migration file for these changes:"
  echo ""
  git diff supabase/migrations/
  
  # Send alert (Slack, email, etc.)
  # curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Schema drift detected in WrenchGo!"}'
  
  exit 1
else
  echo "✅ No schema drift detected"
fi
```

Run this daily via cron or GitHub Actions.

### Manual Drift Check (Before Deployments)

```bash
# Before deploying, always check for drift
supabase link --project-ref your-production-project
supabase db pull --schema-only
git status supabase/migrations/

# If you see uncommitted changes, someone made UI edits!
# Create a migration to capture those changes:
supabase migration new capture_manual_changes
# Copy the diff into the new migration file
```

---

## 🚨 What to Do If Drift is Detected

### Step 1: Identify the Changes
```bash
supabase db pull --schema-only
git diff supabase/migrations/
```

### Step 2: Create Retroactive Migration
```bash
supabase migration new retroactive_capture_manual_changes
```

### Step 3: Copy Changes to Migration
```sql
-- ============================================================================
-- RETROACTIVE MIGRATION
-- Applied manually in Supabase UI on 2024-01-15
-- Reason: Emergency hotfix for production issue
-- ============================================================================

-- Copy the diff from git diff output here
-- Make it idempotent!

DROP POLICY IF EXISTS "emergency_policy" ON public.vehicles;
CREATE POLICY "emergency_policy"
ON public.vehicles
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());
```

### Step 4: Commit and Document
```bash
git add supabase/migrations/
git commit -m "chore: retroactive migration for manual UI changes"
git push
```

### Step 5: Prevent Future Drift
- Review who made the change
- Remind team of "no UI edits" policy
- Update team documentation
- Consider restricting Supabase UI access

---

## 👥 Team Workflow & Code Review Rules

### PR Requirements for Schema Changes:

1. **Migration File Required**
   - Must be in `supabase/migrations/` directory
   - Must have correct timestamp format
   - Must be idempotent

2. **PR Description Must Include:**
   - What changed and why
   - Rollback instructions
   - Testing checklist completed
   - Screenshot of `supabase db diff` (should be empty)

3. **Reviewer Checklist:**
   - [ ] Migration is idempotent
   - [ ] Rollback strategy is clear
   - [ ] Naming follows conventions
   - [ ] No breaking changes (or migration plan exists)
   - [ ] RLS policies are secure
   - [ ] Indexes added for new queries

4. **Approval Requirements:**
   - At least 1 reviewer approval
   - CI checks passed
   - Tested on staging/branch

### Branch Protection Rules:

```yaml
# .github/branch-protection.yml
branches:
  main:
    required_reviews: 1
    required_status_checks:
      - schema-drift-check
      - migration-validation
    require_linear_history: true
```

---

## 📚 Commands Reference

### Essential Commands (No Docker Required):

```bash
# Link to project
supabase link --project-ref your-project-ref

# Create new migration
supabase migration new description_of_change

# Apply migrations
supabase db push

# Check for drift
supabase db pull --schema-only
git status supabase/migrations/

# View current schema
supabase db dump --schema-only > schema.sql

# Check differences
supabase db diff

# List migrations
supabase migration list

# Rollback (DANGEROUS - backup first!)
supabase db reset
```

### Staging vs Production:

```bash
# Work on staging
supabase link --project-ref staging-project-ref
supabase db push

# Switch to production
supabase link --project-ref production-project-ref
supabase db push
```

---

## 🎓 Training & Onboarding

### For New Team Members:

1. **Read this document** (you are here!)
2. **Watch schema change demo** (record a Loom video)
3. **Practice on staging:**
   - Create a test migration
   - Apply it with `supabase db push`
   - Verify with `supabase db diff`
   - Rollback if needed
4. **Shadow a senior dev** on first real schema change
5. **Get PR review** on first migration

### Common Mistakes to Avoid:

❌ Creating tables in Supabase UI
❌ Forgetting `IF NOT EXISTS`
❌ Not testing on staging first
❌ Deploying without PR review
❌ Skipping rollback plan
❌ Using `user_id` instead of `customer_id` in vehicles table

---

## 📊 Definition of Done

A schema change is "done" when:

- [x] Migration file created in Git
- [x] Migration is idempotent
- [x] Tested on staging/branch
- [x] PR reviewed and approved
- [x] CI checks passed
- [x] Deployed to production via `supabase db push`
- [x] `supabase db diff` shows no drift
- [x] App tested in production
- [x] Monitored for 24 hours
- [x] Documentation updated (if needed)
- [x] Team notified (if breaking change)

---

## 🆘 Emergency Hotfix Protocol

If you MUST make a UI change in production (e.g., security issue):

1. **Make the change in Supabase UI** (document what you did)
2. **Create GitHub issue immediately** with details
3. **Within 24 hours:**
   - Run `supabase db pull --schema-only`
   - Create retroactive migration
   - Add comment: `-- RETROACTIVE: Applied manually on YYYY-MM-DD due to [reason]`
   - Create PR and get review
   - Merge to Git
4. **Post-mortem:** Why was UI edit necessary? How to prevent next time?

---

## 🎯 Success Metrics

Track these metrics to measure workflow effectiveness:

- **Drift Detection Rate:** How often does daily check find drift? (Goal: 0%)
- **Migration Success Rate:** % of migrations that apply without errors (Goal: 100%)
- **Time to Merge:** How long from migration creation to production? (Goal: < 24 hours)
- **Rollback Frequency:** How often do we need to rollback? (Goal: < 1% of migrations)

---

## 📞 Support & Questions

- **Schema drift detected?** Follow "What to Do If Drift is Detected" section
- **Migration failed?** Check Supabase logs, review rollback plan
- **Not sure if change needs migration?** Ask in #engineering Slack channel
- **Emergency?** Follow Emergency Hotfix Protocol

---

**Remember:** Schema is code. Treat it like code. Version control everything. 🚀
