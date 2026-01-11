-- =====================================================
-- MIGRATION 0011: TRUST SYSTEM ENHANCEMENTS
-- =====================================================
-- Purpose: Add job-skill mapping, constraints for data integrity
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE: job_skill_tags (explicit job-to-skill mapping)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.job_skill_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE CASCADE,
  skill_key text NOT NULL REFERENCES public.skills(key) ON DELETE CASCADE,
  tag_role text NOT NULL DEFAULT 'primary' CHECK (tag_role IN ('primary', 'secondary')),
  locked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(job_id, skill_key)
);

CREATE INDEX IF NOT EXISTS idx_job_skill_tags_job ON public.job_skill_tags(job_id);
CREATE INDEX IF NOT EXISTS idx_job_skill_tags_skill ON public.job_skill_tags(skill_key);
CREATE INDEX IF NOT EXISTS idx_job_skill_tags_contract ON public.job_skill_tags(contract_id);

COMMENT ON TABLE public.job_skill_tags IS 'Explicit job-to-skill mapping for skill verification';

-- =====================================================
-- CONSTRAINTS: Ensure data integrity
-- =====================================================

-- Ensure one review per reviewer per job
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'reviews_unique_reviewer_per_job'
  ) THEN
    ALTER TABLE public.reviews 
      ADD CONSTRAINT reviews_unique_reviewer_per_job 
      UNIQUE(job_id, reviewer_id);
  END IF;
END $$;

-- Ensure one active badge per user (dedupe existing if needed)
DO $$ BEGIN
  -- First, dedupe existing user_badges if there are duplicates
  WITH ranked_badges AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, badge_id 
        ORDER BY 
          CASE WHEN revoked_at IS NULL THEN 0 ELSE 1 END,
          awarded_at DESC
      ) as rn
    FROM public.user_badges
  )
  DELETE FROM public.user_badges
  WHERE id IN (
    SELECT id FROM ranked_badges WHERE rn > 1
  );
  
  -- Now add the constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_badges_unique_active'
  ) THEN
    ALTER TABLE public.user_badges 
      ADD CONSTRAINT user_badges_unique_active 
      UNIQUE(user_id, badge_id);
  END IF;
END $$;

COMMIT;
