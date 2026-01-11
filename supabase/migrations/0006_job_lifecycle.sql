-- =====================================================
-- MIGRATION 0006: JOB LIFECYCLE & TRANSACTION SYSTEM
-- =====================================================
-- Purpose: Complete job lifecycle from quote acceptance to payout
-- Includes: Contracts, invoices, approvals, disputes, payouts, audit logs
-- =====================================================

BEGIN;

-- =====================================================
-- NEW ENUMS
-- =====================================================

-- Job contract status
DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM (
    'pending_payment',    -- Awaiting initial payment authorization
    'active',             -- Payment authorized, contract in effect
    'completed',          -- Both parties confirmed completion
    'cancelled',          -- Cancelled (see cancellation_reason)
    'disputed',           -- Under dispute
    'refunded'            -- Fully refunded
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cancellation reason types
DO $$ BEGIN
  CREATE TYPE public.cancellation_reason AS ENUM (
    'customer_before_departure',   -- Full refund
    'customer_after_departure',    -- Travel fee may apply
    'customer_after_arrival',      -- Travel fee applies
    'customer_after_work_started', -- Partial charge
    'mechanic_before_departure',   -- Full refund
    'mechanic_after_departure',    -- Full refund + penalty
    'mechanic_no_show',            -- Full refund + penalty
    'customer_no_show',            -- Travel fee charged
    'mutual_agreement',            -- Negotiated refund
    'platform_intervention'        -- Platform cancelled
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice line item types
DO $$ BEGIN
  CREATE TYPE public.line_item_type AS ENUM (
    'base_labor',         -- Original quoted labor
    'additional_labor',   -- Added labor during job
    'parts',              -- Parts/materials
    'diagnostic',         -- Diagnostic fee
    'travel',             -- Travel/trip fee
    'platform_fee',       -- Platform fee (customer side)
    'discount',           -- Discount applied
    'tax'                 -- Tax if applicable
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Line item approval status
DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM (
    'pending',            -- Awaiting customer approval
    'approved',           -- Customer approved
    'rejected',           -- Customer rejected
    'auto_rejected'       -- Auto-rejected after timeout
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Dispute status
DO $$ BEGIN
  CREATE TYPE public.dispute_status AS ENUM (
    'open',               -- Dispute filed
    'under_review',       -- Platform reviewing
    'evidence_requested', -- Awaiting evidence
    'resolved_customer',  -- Resolved in customer favor
    'resolved_mechanic',  -- Resolved in mechanic favor
    'resolved_split',     -- Split resolution
    'closed'              -- Closed without resolution
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payout status
DO $$ BEGIN
  CREATE TYPE public.payout_status AS ENUM (
    'pending',            -- Awaiting job completion
    'processing',         -- Being processed
    'completed',          -- Sent to mechanic
    'failed',             -- Failed to process
    'held',               -- On hold (dispute/review)
    'cancelled'           -- Cancelled
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job event types for audit log
DO $$ BEGIN
  CREATE TYPE public.job_event_type AS ENUM (
    'quote_accepted',
    'contract_created',
    'payment_authorized',
    'payment_failed',
    'mechanic_departed',
    'mechanic_arrived',
    'customer_confirmed_arrival',
    'work_started',
    'line_item_added',
    'line_item_approved',
    'line_item_rejected',
    'work_completed_mechanic',
    'work_completed_customer',
    'job_finalized',
    'payment_captured',
    'payout_initiated',
    'payout_completed',
    'cancelled',
    'dispute_opened',
    'dispute_resolved',
    'refund_issued',
    'message_sent',
    'system_note'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLE: job_contracts
-- =====================================================
-- Binding agreement created when customer accepts quote
-- Contains immutable snapshot of agreed terms

CREATE TABLE IF NOT EXISTS public.job_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Status
  status public.contract_status DEFAULT 'pending_payment' NOT NULL,
  
  -- Agreed amounts (snapshot at time of acceptance)
  quoted_price_cents int NOT NULL,
  platform_fee_cents int NOT NULL DEFAULT 1500,  -- $15 default
  estimated_hours numeric,
  
  -- Calculated totals (updated as invoice changes)
  subtotal_cents int NOT NULL,           -- Sum of all approved line items
  total_customer_cents int NOT NULL,     -- What customer pays (subtotal + platform fee)
  mechanic_commission_cents int NOT NULL, -- 12% capped at $50
  mechanic_payout_cents int NOT NULL,    -- What mechanic receives
  
  -- Payment info
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  payment_authorized_at timestamptz,
  payment_captured_at timestamptz,
  
  -- Terms snapshot
  terms_version text DEFAULT '2025.01',
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  
  -- Cancellation
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id),
  cancellation_reason public.cancellation_reason,
  cancellation_note text,
  refund_amount_cents int,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(job_id),
  UNIQUE(quote_id),
  CONSTRAINT positive_amounts CHECK (
    quoted_price_cents >= 0 AND 
    platform_fee_cents >= 0 AND 
    subtotal_cents >= 0 AND
    total_customer_cents >= 0 AND
    mechanic_commission_cents >= 0 AND
    mechanic_payout_cents >= 0
  )
);

COMMENT ON TABLE public.job_contracts IS 'Binding contract created when quote is accepted';

-- =====================================================
-- TABLE: invoice_line_items
-- =====================================================
-- Editable invoice items during job

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.job_contracts(id) ON DELETE CASCADE,
  
  -- Item details
  item_type public.line_item_type NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1 NOT NULL,
  unit_price_cents int NOT NULL,
  total_cents int NOT NULL,            -- quantity * unit_price_cents
  
  -- For parts: additional info
  part_number text,
  part_source text,                    -- e.g., "Customer provided", "AutoZone"
  
  -- Approval tracking
  approval_status public.approval_status DEFAULT 'pending' NOT NULL,
  requires_approval boolean DEFAULT true NOT NULL,  -- false for original quote items
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  rejected_at timestamptz,
  rejected_by uuid REFERENCES public.profiles(id),
  rejection_reason text,
  approval_deadline timestamptz,       -- Auto-reject after this time
  
  -- Who added this
  added_by uuid NOT NULL REFERENCES public.profiles(id),
  added_by_role public.user_role NOT NULL,
  
  -- Notes
  notes text,
  
  -- Ordering
  sort_order int DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT positive_line_amounts CHECK (
    quantity > 0 AND 
    unit_price_cents >= 0 AND 
    total_cents >= 0
  )
);

COMMENT ON TABLE public.invoice_line_items IS 'Line items on job invoice, editable during job';

-- =====================================================
-- TABLE: job_events
-- =====================================================
-- Complete audit log of all job activities

CREATE TABLE IF NOT EXISTS public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,
  
  -- Event info
  event_type public.job_event_type NOT NULL,
  actor_id uuid REFERENCES public.profiles(id),   -- NULL for system events
  actor_role public.user_role,
  
  -- Event data
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',         -- Additional event-specific data
  
  -- For financial events
  amount_cents int,
  
  -- Visibility
  visible_to_customer boolean DEFAULT true,
  visible_to_mechanic boolean DEFAULT true,
  is_system_message boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Immutable - no updated_at
  CONSTRAINT job_events_immutable CHECK (true)  -- Placeholder for trigger
);

COMMENT ON TABLE public.job_events IS 'Immutable audit log of all job events';

-- =====================================================
-- TABLE: job_progress
-- =====================================================
-- Tracks job progress milestones

CREATE TABLE IF NOT EXISTS public.job_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,
  
  -- Progress milestones
  mechanic_departed_at timestamptz,
  mechanic_arrived_at timestamptz,
  customer_confirmed_arrival_at timestamptz,
  work_started_at timestamptz,
  
  -- Completion (dual-confirmation)
  mechanic_completed_at timestamptz,
  customer_completed_at timestamptz,
  finalized_at timestamptz,            -- When both confirmed
  
  -- Location tracking (optional)
  mechanic_departure_lat double precision,
  mechanic_departure_lng double precision,
  mechanic_arrival_lat double precision,
  mechanic_arrival_lng double precision,
  
  -- Time tracking
  estimated_arrival_at timestamptz,
  actual_work_duration_minutes int,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.job_progress IS 'Tracks job progress through milestones';

-- =====================================================
-- TABLE: disputes
-- =====================================================

CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,
  
  -- Parties
  filed_by uuid NOT NULL REFERENCES public.profiles(id),
  filed_by_role public.user_role NOT NULL,
  filed_against uuid NOT NULL REFERENCES public.profiles(id),
  
  -- Status
  status public.dispute_status DEFAULT 'open' NOT NULL,
  
  -- Dispute details
  category text NOT NULL,              -- 'quality', 'no_show', 'overcharge', 'damage', 'other'
  description text NOT NULL,
  desired_resolution text,
  
  -- Evidence
  evidence_urls text[],
  
  -- Resolution
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  resolution_type text,                -- 'full_refund', 'partial_refund', 'no_refund', 'split'
  resolution_notes text,
  customer_refund_cents int,
  mechanic_adjustment_cents int,
  
  -- Platform notes (internal)
  internal_notes text,
  assigned_to text,                    -- Support agent email
  priority text DEFAULT 'normal',
  
  -- Deadlines
  response_deadline timestamptz,
  evidence_deadline timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Can only have one open dispute per job
  CONSTRAINT one_open_dispute_per_job UNIQUE (job_id, status) 
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE public.disputes IS 'Dispute records between customers and mechanics';

-- =====================================================
-- TABLE: payouts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.job_contracts(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Amounts
  gross_amount_cents int NOT NULL,     -- Original job amount
  commission_cents int NOT NULL,       -- Platform commission deducted
  adjustments_cents int DEFAULT 0,     -- Any adjustments (disputes, etc.)
  net_amount_cents int NOT NULL,       -- Final payout amount
  
  -- Status
  status public.payout_status DEFAULT 'pending' NOT NULL,
  
  -- Stripe
  stripe_transfer_id text,
  stripe_payout_id text,
  
  -- Processing
  scheduled_for timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  
  -- Hold info
  held_at timestamptz,
  hold_reason text,
  released_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(contract_id)
);

COMMENT ON TABLE public.payouts IS 'Mechanic payout records';

-- =====================================================
-- TABLE: reviews (update for blind reviews)
-- =====================================================

-- Add columns for blind review system
ALTER TABLE public.reviews 
  ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS made_visible_at timestamptz,
  ADD COLUMN IF NOT EXISTS visibility_reason text;

COMMENT ON COLUMN public.reviews.is_visible IS 'Whether review is visible to other party (blind until both submit)';

-- =====================================================
-- TABLE: job_media
-- =====================================================
-- Before/after photos linked to jobs

CREATE TABLE IF NOT EXISTS public.job_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,
  
  -- Uploader
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  uploaded_by_role public.user_role NOT NULL,
  
  -- Media info
  media_type text NOT NULL,            -- 'image', 'video'
  media_category text NOT NULL,        -- 'before', 'during', 'after', 'issue', 'receipt'
  
  -- Storage
  bucket text DEFAULT 'job-media',
  path text NOT NULL,
  public_url text,
  thumbnail_url text,
  
  -- Metadata
  caption text,
  file_size_bytes bigint,
  mime_type text,
  
  -- Timestamps
  taken_at timestamptz,                -- When photo was taken (from EXIF)
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.job_media IS 'Photos and videos for jobs (before/after)';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_job_contracts_job_id ON public.job_contracts(job_id);
CREATE INDEX IF NOT EXISTS idx_job_contracts_customer_id ON public.job_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_job_contracts_mechanic_id ON public.job_contracts(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_job_contracts_status ON public.job_contracts(status);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_contract_id ON public.invoice_line_items(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_approval_status ON public.invoice_line_items(approval_status);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON public.job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_contract_id ON public.job_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_job_events_event_type ON public.job_events(event_type);
CREATE INDEX IF NOT EXISTS idx_job_events_created_at ON public.job_events(created_at);

CREATE INDEX IF NOT EXISTS idx_job_progress_job_id ON public.job_progress(job_id);

CREATE INDEX IF NOT EXISTS idx_disputes_job_id ON public.disputes(job_id);
CREATE INDEX IF NOT EXISTS idx_disputes_filed_by ON public.disputes(filed_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);

CREATE INDEX IF NOT EXISTS idx_payouts_mechanic_id ON public.payouts(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);

CREATE INDEX IF NOT EXISTS idx_job_media_job_id ON public.job_media(job_id);

COMMIT;
