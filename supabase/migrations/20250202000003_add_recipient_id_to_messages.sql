-- Migration: Add missing recipient_id column to messages table
-- This column exists in baseline schema but is missing in remote database

-- Add recipient_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'recipient_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN recipient_id uuid;
    COMMENT ON COLUMN public.messages.recipient_id IS 'Recipient user ID for direct messages';
    
    -- Optionally backfill recipient_id based on job relationships
    -- For messages in a job context, the recipient is the other party
    UPDATE public.messages m
    SET recipient_id = CASE
      WHEN m.sender_id = j.customer_id THEN j.accepted_mechanic_id
      WHEN m.sender_id = j.accepted_mechanic_id THEN j.customer_id
      ELSE NULL
    END
    FROM public.jobs j
    WHERE m.job_id = j.id AND m.recipient_id IS NULL;
  END IF;
END $$;
