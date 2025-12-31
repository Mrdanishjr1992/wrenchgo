-- ============================================================================
-- Migration: Create Messages Table
-- Created: 2024-01-01
-- Description: Creates messages table for job-related communication
-- ============================================================================

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  
  -- Metadata
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_job_id 
  ON public.messages(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
  ON public.messages(sender_id);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view messages for their jobs" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages for their jobs" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- Create RLS policies
CREATE POLICY "Users can view messages for their jobs"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = messages.job_id
      AND (jobs.customer_id = auth.uid() OR jobs.accepted_mechanic_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages for their jobs"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_id
      AND (jobs.customer_id = auth.uid() OR jobs.accepted_mechanic_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);
