-- Add messages RLS policy to allow job participants to see messages
-- This fixes the issue where customers can't see messages for their jobs

DROP POLICY IF EXISTS "messages_select_job_participant" ON public.messages;
CREATE POLICY "messages_select_job_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = messages.job_id
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );
