-- ============================================================================
-- Migration: 20250213000003_add_payment_method_status.sql
-- ============================================================================
-- Purpose: Add payment_method_status enum and column for customer payment tracking
-- Dependencies: 20250111000001 (profiles table)
-- Risk Level: Low (new enum and additive column)
-- Rollback: ALTER TABLE profiles DROP COLUMN payment_method_status; DROP TYPE payment_method_status;
-- ============================================================================

-- Add payment_method_status column to profiles (for customers)
-- The payout_method_status is for mechanics, payment_method_status is for customers

DO $$ BEGIN
  CREATE TYPE public.payment_method_status AS ENUM ('none', 'pending', 'active', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS payment_method_status public.payment_method_status DEFAULT 'none' NOT NULL;
