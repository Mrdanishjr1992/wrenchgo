-- ============================================================================
-- Migration: 20260111000004_add_stripe_customer_id.sql
-- ============================================================================
-- Purpose: Add stripe_customer_id column to profiles table
-- ============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id text;
