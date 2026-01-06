# WrenchGo Database Migrations

## Migration Files (Run in order)

| File | Purpose |
|------|---------|
| `0001_baseline_schema.sql` | Extensions, enums, ALL tables |
| `0002_rls_policies.sql` | RLS enablement and all policies |
| `0003_functions_triggers.sql` | Functions, triggers, RPC endpoints |
| `0004_stripe_marketplace.sql` | Stripe Connect payment functions |
| `0005_indexes_performance.sql` | All database indexes |
| `0006_seed_data.sql` | Lookup table seed data |
| `0007_cleanup_and_validation.sql` | Grants, realtime, validation |

## Quick Start

```bash
# Reset and push migrations to linked database
supabase db reset --linked

# Or push to remote
supabase db push
```

## Tables

### Core Tables
- `profiles` - User profiles (auto-created on signup)
- `vehicles` - Customer vehicles
- `jobs` - Service requests
- `quote_requests` - Mechanic quotes
- `reviews` - Job reviews

### Mechanic Tables
- `mechanic_profiles` - Extended mechanic info
- `mechanic_skills` - Skills a mechanic has
- `mechanic_tools` - Tools a mechanic owns
- `mechanic_safety` - Safety measures followed

### Lookup Tables (Read-only)
- `skills` - Master skill list
- `tools` - Master tool list
- `safety_measures` - Master safety list
- `symptoms` - Vehicle symptoms
- `symptom_mappings` - Symptom details
- `education_cards` - Customer education
- `symptom_education` - Symptom guides
- `symptom_questions` - Diagnostic questions

### Communication
- `messages` - Job messages
- `notifications` - User notifications
- `media_assets` - Uploaded files

### Payments
- `mechanic_stripe_accounts` - Stripe Connect accounts
- `customer_payment_methods` - Saved payment methods
- `payments` - Payment records

## RPC Functions

| Function | Purpose |
|----------|---------|
| `set_user_role(role)` | Set user role (one-time) |
| `get_my_role()` | Get current user's role |
| `get_my_profile()` | Get current user's full profile |
| `get_mechanic_leads(...)` | Get job leads for mechanics |
| `get_mechanic_profile_full(id)` | Get complete mechanic profile |
| `save_theme_preference(theme)` | Save user theme preference |
| `create_stripe_connect_account()` | Initialize Stripe Connect |
| `save_stripe_account(id)` | Save Stripe account ID |
| `get_stripe_account_status()` | Get Stripe account status |

## RLS Policy Summary

| Table | Public Read | Owner Only | Role-Based |
|-------|-------------|------------|------------|
| profiles | Yes (with role) | Update | - |
| vehicles | - | Full | - |
| jobs | Yes (searching) | Customer | Mechanic |
| mechanic_profiles | Yes | Full | - |
| mechanic_skills/tools/safety | Yes | Full | - |
| symptoms/mappings/education | Yes | - | - |
| messages | - | - | Participants |
| notifications | - | Full | - |
| media_assets | Public only | Full | Job participants |
| payments | - | - | Participants |

## Storage Bucket Setup

Create a `media` bucket in Supabase Storage with public access:

```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;
```
