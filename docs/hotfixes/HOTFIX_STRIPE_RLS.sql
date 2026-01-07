-- Enable RLS on mechanic_stripe_accounts if not already enabled
ALTER TABLE mechanic_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Allow mechanics to read their own stripe account
CREATE POLICY "Mechanics can view own stripe account"
ON mechanic_stripe_accounts FOR SELECT
USING (auth.uid() = mechanic_id);

-- Allow mechanics to insert their own stripe account
CREATE POLICY "Mechanics can insert own stripe account"
ON mechanic_stripe_accounts FOR INSERT
WITH CHECK (auth.uid() = mechanic_id);

-- Allow mechanics to update their own stripe account
CREATE POLICY "Mechanics can update own stripe account"
ON mechanic_stripe_accounts FOR UPDATE
USING (auth.uid() = mechanic_id)
WITH CHECK (auth.uid() = mechanic_id);
