-- ============================================================================
-- Migration: Create Mechanic Profiles Table
-- Created: 2024-01-01
-- Description: Creates mechanic_profiles table for mechanic-specific data
-- ============================================================================

-- Create mechanic_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.mechanic_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Business info
  business_name TEXT,
  bio TEXT,
  years_experience INTEGER,
  
  -- Service area
  service_radius_km INTEGER DEFAULT 50,
  base_location_lat DECIMAL(10, 8),
  base_location_lng DECIMAL(11, 8),
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  
  -- Stats
  jobs_completed INTEGER DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0.00,
  total_reviews INTEGER DEFAULT 0,
  
  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_is_available 
  ON public.mechanic_profiles(is_available);

CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_is_verified 
  ON public.mechanic_profiles(is_verified);

CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_location 
  ON public.mechanic_profiles(base_location_lat, base_location_lng);

-- Enable RLS
ALTER TABLE public.mechanic_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Anyone can view verified mechanic profiles" ON public.mechanic_profiles;
DROP POLICY IF EXISTS "Mechanics can view all mechanic profiles" ON public.mechanic_profiles;
DROP POLICY IF EXISTS "Mechanics can update their own profile" ON public.mechanic_profiles;
DROP POLICY IF EXISTS "Mechanics can insert their own profile" ON public.mechanic_profiles;
DROP POLICY IF EXISTS "Customers can view verified mechanic profiles" ON public.mechanic_profiles;

-- Create RLS policies
CREATE POLICY "Anyone can view verified mechanic profiles"
  ON public.mechanic_profiles FOR SELECT
  USING (is_verified = true);

CREATE POLICY "Mechanics can view all mechanic profiles"
  ON public.mechanic_profiles FOR SELECT
  USING (true);

CREATE POLICY "Mechanics can insert their own profile"
  ON public.mechanic_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Mechanics can update their own profile"
  ON public.mechanic_profiles FOR UPDATE
  USING (auth.uid() = id);