# Alternative Setup: Apply Migration via Supabase Dashboard

Since the CLI migration system has a sync issue, follow these steps to apply the payments migration manually:

## Option 1: Apply via Supabase Dashboard (Recommended)

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New query**

### Step 2: Copy and Run the Migration

1. Open the file: `supabase/migrations/20250117000000_create_payments_system.sql`
2. Copy the **entire contents** of the file
3. Paste it into the SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify Tables Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'mechanic_stripe_accounts',
  'payments',
  'promotions',
  'promotion_redemptions'
)
ORDER BY table_name;
```

You should see all 4 tables listed.

### Step 4: Mark Migration as Applied (Optional)

To keep your local CLI in sync, run:

```bash
supabase migration repair --status applied 20250117000000
```

## Option 2: Fix CLI Sync Issue First

If you prefer to use the CLI, fix the sync issue:

### Step 1: Identify the Problem

The issue is that remote has a migration `20240101` that doesn't match local `20240101_account_deletion_triggers.sql`.

### Step 2: Rename the Local File

```bash
# Rename to match the expected format
mv supabase/migrations/20240101_account_deletion_triggers.sql supabase/migrations/20240101000001_account_deletion_triggers.sql
```

### Step 3: Try Push Again

```bash
supabase db push
```

### Step 4: If Still Fails, Use Dashboard Method

If the push still fails, use Option 1 (Dashboard method) instead.

## After Migration is Applied

Continue with the rest of the setup from `PAYMENTS_QUICK_SETUP.md`:

1. ✅ Database migration applied
2. ⏭️ Configure Stripe keys
3. ⏭️ Create webhook
4. ⏭️ Deploy Edge Functions
5. ⏭️ Install Stripe SDK
6. ⏭️ Test payment flow

## Verification

After applying the migration, verify it worked:

```sql
-- Check mechanic_stripe_accounts table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mechanic_stripe_accounts';

-- Check payments table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments';

-- Check promotions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'promotions';

-- Check promotion_redemptions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'promotion_redemptions';
```

## Common Issues

### "relation already exists"
- Some tables may already exist from previous attempts
- Safe to ignore if the table structure matches
- Or drop the tables first:
```sql
DROP TABLE IF EXISTS promotion_redemptions CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS mechanic_stripe_accounts CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS promotion_type CASCADE;
DROP TYPE IF EXISTS stripe_account_status CASCADE;
```

Then run the migration again.

### "permission denied"
- Make sure you're using the Supabase Dashboard SQL Editor
- The editor runs with full permissions

### "syntax error"
- Make sure you copied the ENTIRE migration file
- Don't miss the beginning or end

## Next Steps

Once the migration is applied successfully:

1. Continue with Stripe configuration (see `PAYMENTS_QUICK_SETUP.md`)
2. Set Stripe secrets in Supabase
3. Deploy Edge Functions
4. Test the payment flow

## Need Help?

If you encounter issues:
1. Check the Supabase Dashboard logs
2. Verify you're in the correct project
3. Make sure you have admin access
4. Try the Dashboard method (Option 1) - it's the most reliable
