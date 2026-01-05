-- =====================================================
-- SIMPLIFY ID VERIFICATION
-- =====================================================
-- Purpose: Remove complex ID verification, replace with simple boolean flag
-- =====================================================

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS id_photo_path,
  DROP COLUMN IF EXISTS id_status,
  DROP COLUMN IF EXISTS id_uploaded_at,
  DROP COLUMN IF EXISTS id_rejected_reason,
  DROP COLUMN IF EXISTS id_verified_by;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_id_verified ON public.profiles(id_verified) WHERE id_verified = true;

COMMENT ON COLUMN public.profiles.id_verified IS 'Simple boolean flag indicating user completed ID verification (currently a 30-second timer)';
COMMENT ON COLUMN public.profiles.id_verified_at IS 'Timestamp when ID verification was completed';
