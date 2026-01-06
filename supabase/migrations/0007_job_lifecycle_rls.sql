-- =====================================================
-- MIGRATION 0007: RLS POLICIES FOR JOB LIFECYCLE
-- =====================================================
-- Purpose: Row Level Security for job lifecycle tables
-- =====================================================

BEGIN;

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE public.job_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_media ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- job_contracts POLICIES
-- =====================================================

-- Customers can view their own contracts
CREATE POLICY "Customers can view own contracts" ON public.job_contracts
  FOR SELECT USING (auth.uid() = customer_id);

-- Mechanics can view contracts they're part of
CREATE POLICY "Mechanics can view own contracts" ON public.job_contracts
  FOR SELECT USING (auth.uid() = mechanic_id);

-- Only system/functions can insert contracts (via accept_quote function)
CREATE POLICY "System can insert contracts" ON public.job_contracts
  FOR INSERT WITH CHECK (true);

-- Only system can update contracts
CREATE POLICY "System can update contracts" ON public.job_contracts
  FOR UPDATE USING (true);

-- =====================================================
-- invoice_line_items POLICIES
-- =====================================================

-- View: both parties can see line items for their contracts
CREATE POLICY "Contract parties can view line items" ON public.invoice_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_contracts c
      WHERE c.id = invoice_line_items.contract_id
      AND (c.customer_id = auth.uid() OR c.mechanic_id = auth.uid())
    )
  );

-- Insert: mechanic can add line items to their contracts
CREATE POLICY "Mechanics can add line items" ON public.invoice_line_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_contracts c
      WHERE c.id = invoice_line_items.contract_id
      AND c.mechanic_id = auth.uid()
      AND c.status = 'active'
    )
    AND added_by = auth.uid()
  );

-- Update: mechanics can update pending items, customers can approve/reject
CREATE POLICY "Mechanics can update pending items" ON public.invoice_line_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.job_contracts c
      WHERE c.id = invoice_line_items.contract_id
      AND c.mechanic_id = auth.uid()
    )
    AND approval_status = 'pending'
  );

CREATE POLICY "Customers can approve/reject items" ON public.invoice_line_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.job_contracts c
      WHERE c.id = invoice_line_items.contract_id
      AND c.customer_id = auth.uid()
    )
  );

-- =====================================================
-- job_events POLICIES
-- =====================================================

-- View: parties can see events visible to them
CREATE POLICY "Customers can view visible events" ON public.job_events
  FOR SELECT USING (
    visible_to_customer = true
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_events.job_id
      AND j.customer_id = auth.uid()
    )
  );

CREATE POLICY "Mechanics can view visible events" ON public.job_events
  FOR SELECT USING (
    visible_to_mechanic = true
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_events.job_id
      AND j.accepted_mechanic_id = auth.uid()
    )
  );

-- Insert: system and participants can add events
CREATE POLICY "Participants can add events" ON public.job_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_events.job_id
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

-- Events are immutable - no update policy

-- =====================================================
-- job_progress POLICIES
-- =====================================================

-- View: both parties can view
CREATE POLICY "Job parties can view progress" ON public.job_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_progress.job_id
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

-- Insert: system creates on contract creation
CREATE POLICY "System can insert progress" ON public.job_progress
  FOR INSERT WITH CHECK (true);

-- Update: both parties can update their relevant fields
CREATE POLICY "Mechanics can update progress" ON public.job_progress
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_progress.job_id
      AND j.accepted_mechanic_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update progress" ON public.job_progress
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_progress.job_id
      AND j.customer_id = auth.uid()
    )
  );

-- =====================================================
-- disputes POLICIES
-- =====================================================

-- View: parties can see disputes they're involved in
CREATE POLICY "Parties can view own disputes" ON public.disputes
  FOR SELECT USING (
    filed_by = auth.uid() OR filed_against = auth.uid()
  );

-- Insert: either party can file dispute
CREATE POLICY "Users can file disputes" ON public.disputes
  FOR INSERT WITH CHECK (
    filed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = disputes.job_id
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

-- Update: only filer can add evidence (platform updates via service role)
CREATE POLICY "Filers can update disputes" ON public.disputes
  FOR UPDATE USING (filed_by = auth.uid());

-- =====================================================
-- payouts POLICIES
-- =====================================================

-- View: mechanics can see their own payouts
CREATE POLICY "Mechanics can view own payouts" ON public.payouts
  FOR SELECT USING (mechanic_id = auth.uid());

-- Insert/Update: only system (handled by functions)
CREATE POLICY "System can manage payouts" ON public.payouts
  FOR ALL USING (true);

-- =====================================================
-- job_media POLICIES
-- =====================================================

-- View: both parties can see job media
CREATE POLICY "Job parties can view media" ON public.job_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_media.job_id
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

-- Insert: participants can upload
CREATE POLICY "Participants can upload media" ON public.job_media
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_media.job_id
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

-- Delete: only uploader can delete
CREATE POLICY "Uploaders can delete own media" ON public.job_media
  FOR DELETE USING (uploaded_by = auth.uid());

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON public.job_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoice_line_items TO authenticated;
GRANT SELECT, INSERT ON public.job_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.job_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT SELECT ON public.payouts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.job_media TO authenticated;

-- Service role gets full access
GRANT ALL ON public.job_contracts TO service_role;
GRANT ALL ON public.invoice_line_items TO service_role;
GRANT ALL ON public.job_events TO service_role;
GRANT ALL ON public.job_progress TO service_role;
GRANT ALL ON public.disputes TO service_role;
GRANT ALL ON public.payouts TO service_role;
GRANT ALL ON public.job_media TO service_role;

COMMIT;
