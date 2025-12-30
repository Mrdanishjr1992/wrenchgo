-- QUICK FIX: Temporarily disable the login trigger
-- Copy and paste this into Supabase SQL Editor and run it NOW

DROP TRIGGER IF EXISTS prevent_deleted_user_login ON auth.users;
DROP TRIGGER IF EXISTS prevent_blocked_email_registration ON auth.users;
