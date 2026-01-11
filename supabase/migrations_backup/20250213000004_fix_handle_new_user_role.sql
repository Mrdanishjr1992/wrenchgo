-- ============================================================================
-- Migration: 20250213000004_fix_handle_new_user_role.sql
-- ============================================================================
-- Purpose: Allow NULL role in handle_new_user so users see role selection screen
-- Dependencies: 20250111000003 (handle_new_user function)
-- Risk Level: Low (function replacement, backward compatible)
-- Rollback: Restore previous handle_new_user with COALESCE default
-- ============================================================================

-- Fix handle_new_user to NOT default role to customer
-- Role should be NULL so user sees role selection screen

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    (NEW.raw_user_meta_data->>'role')::public.user_role  -- NULL if not provided
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
