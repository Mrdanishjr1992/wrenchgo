-- ===================================================================
-- WrenchGo: baseline split (types & enums)
-- Generated: 2026-01-22
-- Source: reset-baseline
-- Run these files in order (0001 -> 0011).
-- ===================================================================

SET search_path TO public, extensions;


-- Why enums exist:
-- 1) They constrain critical state machines (job_status, quote_status, contract_status) so invalid states
--    cannot be written (prevents hard-to-debug app behavior).
-- 2) They stabilize API contracts between mobile app, edge functions, and DB.

DO $$
BEGIN
  -- User roles (who the user is on the platform)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.user_role AS ENUM ('customer', 'mechanic', 'admin');
  END IF;

  -- UI theme preference for the app
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'theme_mode' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.theme_mode AS ENUM ('system', 'light', 'dark');
  END IF;

  -- Jobs: the single source of truth for workflow
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.job_status AS ENUM (
      'draft',          -- customer started but not submitted
      'searching',      -- submitted, looking for mechanics
      'quoted',         -- quotes exist / being negotiated
      'scheduled',      -- time agreed
      'in_progress',    -- mechanic is working
      'completed',      -- finished
      'cancelled'       -- cancelled by either party
    );
  END IF;

  -- Quotes: mechanic's offer for a job
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.quote_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'withdrawn');
  END IF;

  -- Contract: immutable agreement once a quote is accepted (and typically payment is authorized)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.contract_status AS ENUM ('pending_payment', 'active', 'completed', 'cancelled', 'refunded');
  END IF;

  -- Cancellation reasons for a contract (kept small & stable for analytics + support workflows)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cancellation_reason' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.cancellation_reason AS ENUM (
      'customer_changed_mind',
      'mechanic_unavailable',
      'price_disagreement',
      'no_show',
      'safety_concern',
      'other'
    );
  END IF;
END $$;
