-- =====================================================
-- CREATE WEBHOOK_EVENTS TABLE
-- =====================================================
-- Purpose: Log all Stripe webhook events for debugging
-- =====================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean DEFAULT false,
  processing_error text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON public.webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Add RLS policies (admin only)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role can manage all webhook events
CREATE POLICY "Service role can manage webhook events"
  ON public.webhook_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.webhook_events IS 'Logs all Stripe webhook events for debugging and audit trail.';
