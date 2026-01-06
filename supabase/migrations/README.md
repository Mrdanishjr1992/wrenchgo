# WrenchGo Supabase Migrations

Production-ready, consolidated migrations for WrenchGo mobile app.

## Overview

This directory contains 7 migration files that create a complete, production-ready database schema for WrenchGo.

### Identity Model: profiles.id == auth.users.id

All tables reference `profiles.id` which is a foreign key to `auth.users.id`. This ensures consistent ownership checks and simplifies RLS policies.

## Migration Files

1. **20250210000001_extensions_enums.sql** - Extensions (uuid-ossp, pgcrypto, pg_trgm) and enums
2. **20250210000002_core_tables.sql** - Core tables (profiles, jobs, vehicles, reviews, quote_requests)
3. **20250210000003_mechanic_tables.sql** - Mechanic-specific tables
4. **20250210000004_messaging_media.sql** - Messages, notifications, media_assets
5. **20250210000005_payments_stripe.sql** - Payment and Stripe tables
6. **20250210000006_functions_triggers.sql** - Functions, triggers, updated_at automation
7. **20250210000007_rls_grants.sql** - RLS policies and grants

## Key Features

### Security
- ✅ SECURITY DEFINER on `handle_new_user()` - bypasses RLS to auto-create profile
- ✅ Least privilege RLS - users can only access their own data
- ✅ Public profile reads - authenticated users can read other profiles (for names, avatars)
- ✅ Public media assets - assets with NULL uploaded_by/job_id are accessible to all authenticated users

### Schema
- ✅ profiles.id == auth.users.id (direct mapping, no auth_id column)
- ✅ All foreign keys reference profiles.id
- ✅ media_assets has key, public_url, content_type, size_bytes, duration_seconds
- ✅ theme_preference on profiles (per-account theme setting)
- ✅ NO ID verification artifacts (completely removed)

### Automation
- ✅ Auto-create profile on auth.users insert (handle_new_user trigger)
- ✅ Auto-update updated_at on all tables
- ✅ Auto-recalculate mechanic rating on review changes
- ✅ Auto-increment jobs_completed on job completion

## Deployment

### Local Development

```bash
# Reset local database
supabase db reset

# Start Supabase
supabase start

# Verify migrations applied
supabase migration list
```

### Remote Production

```bash
# Push migrations to remote database
supabase db push

# Verify migrations applied
supabase migration list --remote
```

## Verification

Run the verification queries from `../MIGRATION_VERIFICATION_CHECKLIST.md` to ensure:
- All tables exist
- All columns exist
- All foreign keys exist
- NO id_verification artifacts
- RLS enabled and policies correct
- Triggers and functions exist
- Grants correct

## Troubleshooting

See `../DEPLOYMENT_GUIDE.md` for detailed troubleshooting steps.

### Common Issues

**"permission denied for table profiles"**
- Check RLS policies exist
- Verify handle_new_user is SECURITY DEFINER
- Check grants for authenticated role

**"column does not exist"**
- Verify all migrations applied in order
- Check migration files for syntax errors

**"Could not find relationship"**
- Verify foreign keys exist
- Restart Supabase Studio to refresh schema cache

## Schema Overview

### Core Tables
- **profiles** - Main user profile (id == auth.users.id)
- **vehicles** - Customer vehicles
- **jobs** - Job requests from customers
- **quote_requests** - Mechanic quotes for jobs
- **reviews** - Reviews between customers and mechanics

### Mechanic Tables
- **mechanic_profiles** - Extended profile for mechanics
- **mechanic_skills** - Mechanic skills
- **mechanic_tools** - Mechanic tools
- **mechanic_safety** - Mechanic safety measures

### Messaging
- **messages** - Direct messages between users
- **notifications** - Push notifications
- **media_assets** - Media files (images, videos) with key-based lookup

### Payments
- **mechanic_stripe_accounts** - Stripe Connect accounts for mechanics
- **customer_payment_methods** - Customer payment methods
- **payments** - Payment transactions
- **webhook_events** - Stripe webhook events

## Foreign Key Relationships

All ownership columns reference `profiles.id`:
- jobs.customer_id → profiles.id
- jobs.accepted_mechanic_id → profiles.id
- vehicles.customer_id → profiles.id
- quote_requests.mechanic_id → profiles.id
- quote_requests.customer_id → profiles.id
- reviews.reviewer_id → profiles.id
- reviews.reviewee_id → profiles.id
- messages.sender_id → profiles.id
- messages.recipient_id → profiles.id
- notifications.user_id → profiles.id
- media_assets.uploaded_by → profiles.id
- mechanic_profiles.id → profiles.id
- mechanic_skills.mechanic_id → profiles.id
- mechanic_tools.mechanic_id → profiles.id
- mechanic_safety.mechanic_id → profiles.id
- mechanic_stripe_accounts.mechanic_id → profiles.id
- customer_payment_methods.customer_id → profiles.id
- payments.customer_id → profiles.id
- payments.mechanic_id → profiles.id

## RLS Policies

### profiles
- Users can read their own profile
- Authenticated users can read other profiles (public)
- Users can insert their own profile (for Google sign-in fallback)
- Users can update their own profile

### jobs
- Customers can manage their own jobs
- Mechanics can view jobs they're assigned to
- Mechanics can view jobs in "searching" status (to quote)

### messages
- Users can read messages where they are sender or recipient
- Users can insert messages where they are the sender
- Users can update messages they received (mark as read)

### media_assets
- Public assets (NULL uploaded_by/job_id) are readable by all authenticated users
- Job-related assets are readable by job participants
- Uploader can always read their own assets

### payments
- Customers can view their payments
- Mechanics can view their payments
- Only service role can insert/update payments

See `20250210000007_rls_grants.sql` for complete policy definitions.

## Functions

### handle_new_user()
- **Trigger:** AFTER INSERT ON auth.users
- **Purpose:** Auto-creates profile row when user signs up
- **Security:** SECURITY DEFINER (bypasses RLS)

### update_updated_at_column()
- **Trigger:** BEFORE UPDATE ON all tables
- **Purpose:** Auto-updates updated_at timestamp

### update_mechanic_rating()
- **Trigger:** AFTER INSERT/UPDATE/DELETE ON reviews
- **Purpose:** Recalculates mechanic rating_avg and rating_count

### increment_mechanic_job_count()
- **Trigger:** AFTER UPDATE ON jobs
- **Purpose:** Increments jobs_completed when job status changes to 'completed'

## Support

For detailed deployment instructions, see `../DEPLOYMENT_GUIDE.md`.

For verification queries, see `../MIGRATION_VERIFICATION_CHECKLIST.md`.

For a summary of changes, see `../MIGRATION_SUMMARY.md`.
