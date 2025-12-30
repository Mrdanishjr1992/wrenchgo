#!/bin/bash

echo "🚀 Deploying WrenchGo Reviews & Ratings System"
echo "=============================================="
echo ""

echo "📋 Step 1: Running database migrations..."
echo ""

echo "Migration 1: Creating reviews, ratings, skills, and badges tables..."
supabase db push supabase/migrations/20250125000000_create_reviews_ratings_system.sql

if [ $? -eq 0 ]; then
    echo "✅ Main migration completed successfully"
else
    echo "❌ Main migration failed"
    exit 1
fi

echo ""
echo "Migration 2: Seeding skills and badges..."
supabase db push supabase/migrations/20250125000001_seed_skills_badges.sql

if [ $? -eq 0 ]; then
    echo "✅ Seed migration completed successfully"
else
    echo "❌ Seed migration failed"
    exit 1
fi

echo ""
echo "📊 Step 2: Verifying database setup..."
echo ""

echo "Checking tables..."
supabase db execute "SELECT COUNT(*) as skill_count FROM skills;" --output table
supabase db execute "SELECT COUNT(*) as badge_count FROM badges;" --output table

echo ""
echo "Checking RLS policies..."
supabase db execute "
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('skills', 'mechanic_skills', 'badges', 'user_badges', 'reviews', 'review_reports')
ORDER BY tablename;
" --output table

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📚 Next Steps:"
echo "1. Review the REVIEWS_RATINGS_SYSTEM_GUIDE.md for usage examples"
echo "2. Test the profile page: /profile/[userId]"
echo "3. Test review submission: /jobs/[jobId]/review"
echo "4. Configure admin users for skill verification"
echo ""
echo "🔗 Key Routes:"
echo "   - Public Profile: /profile/[userId]"
echo "   - Submit Review: /jobs/[jobId]/review"
echo ""
