#!/bin/bash

# Deployment script for Supabase Edge Functions
# Usage: ./deploy-edge-functions.sh <SUPABASE_ACCESS_TOKEN> <PROJECT_REF>
#
# Get your access token from: https://supabase.com/dashboard/account/tokens
# Get your project ref from: https://supabase.com/dashboard/project/_/settings/general

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./deploy-edge-functions.sh <SUPABASE_ACCESS_TOKEN> <PROJECT_REF>"
  echo ""
  echo "Example: ./deploy-edge-functions.sh sbp_abc123... xyzproject"
  echo ""
  echo "Get your access token from: https://supabase.com/dashboard/account/tokens"
  echo "Get your project ref from: https://supabase.com/dashboard/project/_/settings/general"
  exit 1
fi

export SUPABASE_ACCESS_TOKEN=$1
PROJECT_REF=$2

echo "Deploying edge functions to project: $PROJECT_REF"
echo ""

# Link to project
echo "Linking to project..."
supabase link --project-ref $PROJECT_REF

# Deploy stripe-connect-create-account-link
echo ""
echo "Deploying stripe-connect-create-account-link..."
supabase functions deploy stripe-connect-create-account-link --project-ref $PROJECT_REF

# Deploy stripe-webhook
echo ""
echo "Deploying stripe-webhook..."
supabase functions deploy stripe-webhook --project-ref $PROJECT_REF

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure Stripe webhook in dashboard: https://dashboard.stripe.com/webhooks"
echo "2. Set webhook URL to: https://$PROJECT_REF.supabase.co/functions/v1/stripe-webhook"
echo "3. Add webhook secret to Supabase: https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
