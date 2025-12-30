#!/bin/bash

echo "🚀 Deploying Stripe Connect Implementation"
echo "=========================================="
echo ""

echo "📋 Pre-deployment Checklist:"
echo "  [ ] Stripe Connect enabled in dashboard"
echo "  [ ] Redirect URLs configured in Stripe"
echo "  [ ] API keys copied from Stripe dashboard"
echo "  [ ] .env file created from .env.example"
echo ""
read -p "Have you completed the checklist? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Please complete the checklist first"
    exit 1
fi

echo ""
echo "🔐 Setting Supabase Secrets..."
read -p "Enter your Stripe Secret Key (sk_test_...): " STRIPE_KEY
read -p "Enter your app scheme (default: wrenchgo): " APP_SCHEME
APP_SCHEME=${APP_SCHEME:-wrenchgo}

supabase secrets set STRIPE_SECRET_KEY="$STRIPE_KEY"
supabase secrets set APP_SCHEME="$APP_SCHEME"

if [ $? -ne 0 ]; then
    echo "❌ Failed to set secrets. Make sure you're logged in to Supabase CLI"
    exit 1
fi

echo "✅ Secrets set successfully"
echo ""

echo "📊 Applying Database Migration..."
supabase db push

if [ $? -ne 0 ]; then
    echo "❌ Failed to apply migration"
    exit 1
fi

echo "✅ Migration applied successfully"
echo ""

echo "☁️  Deploying Edge Functions..."
supabase functions deploy stripe-connect-create-account-link
supabase functions deploy stripe-connect-refresh-status

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy functions"
    exit 1
fi

echo "✅ Functions deployed successfully"
echo ""

echo "🎉 Deployment Complete!"
echo ""
echo "📝 Next Steps:"
echo "  1. Rebuild your app: npm run ios (or npm run android)"
echo "  2. Test the onboarding flow with test data"
echo "  3. Verify status updates correctly"
echo "  4. Check STRIPE_CONNECT_TESTING.md for full test cases"
echo ""
echo "📚 Documentation:"
echo "  - Setup Guide: STRIPE_CONNECT_SETUP.md"
echo "  - Testing Guide: STRIPE_CONNECT_TESTING.md"
echo "  - Quick Reference: STRIPE_CONNECT_QUICKREF.md"
echo "  - Summary: STRIPE_CONNECT_SUMMARY.md"
echo ""
echo "✨ Happy coding!"
