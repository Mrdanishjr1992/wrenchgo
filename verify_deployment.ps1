# =====================================================
# SUPABASE DEPLOYMENT VERIFICATION SCRIPT
# =====================================================
# Run this after `supabase db push` to verify everything is aligned
# Usage: .\verify_deployment.ps1

Write-Host "Starting Supabase Deployment Verification..." -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# 1. Check migration status
Write-Host "[1] Checking migration status..." -ForegroundColor Yellow
Write-Host "Expected: 7 migrations`n" -ForegroundColor Gray
supabase migration list
Write-Host "`n"

# 2. Check for drift
Write-Host "[2] Checking for schema drift..." -ForegroundColor Yellow
Write-Host "Expected: 'No schema differences detected.'`n" -ForegroundColor Gray
supabase db diff --schema public
Write-Host "`n"

# 3. Verify remote migrations
Write-Host "[3] Verifying remote migration history..." -ForegroundColor Yellow
Write-Host "Expected: All 7 migrations applied`n" -ForegroundColor Gray
supabase db remote exec "SELECT version, name, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;"
Write-Host "`n"

# 4. Verify critical tables
Write-Host "[4] Verifying critical tables exist..." -ForegroundColor Yellow
Write-Host "Expected: ~20 tables including profiles, messages, jobs, quotes, reviews`n" -ForegroundColor Gray
supabase db remote exec "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
Write-Host "`n"

# 5. Verify RLS enabled
Write-Host "[5] Verifying RLS enabled on core tables..." -ForegroundColor Yellow
Write-Host "Expected: rowsecurity = true for all tables`n" -ForegroundColor Gray
supabase db remote exec "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'messages', 'jobs', 'quotes', 'reviews', 'mechanic_profiles') ORDER BY tablename;"
Write-Host "`n"

# 6. Verify seed data
Write-Host "[6] Verifying seed data loaded..." -ForegroundColor Yellow
Write-Host "Expected: skills=18, tools=19, safety_measures=10, symptoms=100+`n" -ForegroundColor Gray
supabase db remote exec "SELECT 'skills' as table_name, COUNT(*) as count FROM skills UNION ALL SELECT 'symptoms', COUNT(*) FROM symptoms UNION ALL SELECT 'tools', COUNT(*) FROM tools UNION ALL SELECT 'safety_measures', COUNT(*) FROM safety_measures ORDER BY table_name;"
Write-Host "`n"

# 7. Verify critical functions
Write-Host "[7] Verifying critical functions exist..." -ForegroundColor Yellow
Write-Host "Expected: handle_new_user, set_user_role, handle_updated_at, get_public_profile_card`n" -ForegroundColor Gray
supabase db remote exec "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('handle_new_user', 'set_user_role', 'handle_updated_at', 'get_public_profile_card') ORDER BY routine_name;"
Write-Host "`n"

# 8. Verify role selection flow
Write-Host "[8] Verifying role selection flow..." -ForegroundColor Yellow
Write-Host "Expected: is_nullable=YES, column_default=NULL`n" -ForegroundColor Gray
supabase db remote exec "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role';"
Write-Host "`n"

# 9. Verify messages table structure
Write-Host "[9] Verifying messages table (no recipient_id)..." -ForegroundColor Yellow
Write-Host "Expected: Should NOT see recipient_id column`n" -ForegroundColor Gray
supabase db remote exec "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' ORDER BY ordinal_position;"
Write-Host "`n"

# 10. Verify jobs table structure
Write-Host "[10] Verifying jobs table (has accepted_mechanic_id)..." -ForegroundColor Yellow
Write-Host "Expected: Should see accepted_mechanic_id column`n" -ForegroundColor Gray
supabase db remote exec "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'accepted_mechanic_id';"
Write-Host "`n"

# Summary
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Verification complete!" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Review the output above for any issues" -ForegroundColor White
Write-Host "2. If all checks pass, test your app end-to-end" -ForegroundColor White
Write-Host "3. If any checks fail, see SUPABASE_VERIFICATION_GUIDE.md Part 6 (Common Issues)`n" -ForegroundColor White

Write-Host "📚 DOCUMENTATION:" -ForegroundColor Yellow
Write-Host "- Full guide: SUPABASE_VERIFICATION_GUIDE.md" -ForegroundColor White
Write-Host "- Deployment checklist: See Part 4 of verification guide`n" -ForegroundColor White
