-- =====================================================
-- PHASE 1: CUSTOMER SUPPORT SYSTEM
-- =====================================================

-- Create support_requests table
CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN (
    'payments_refunds',
    'job_issue',
    'account_login',
    'bug_app_problem',
    'other'
  )),
  message text NOT NULL,
  job_id uuid NULL,
  screenshot_url text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_requests_user_id ON public.support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON public.support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON public.support_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_category ON public.support_requests(category);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_support_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_support_requests_updated_at ON public.support_requests;
CREATE TRIGGER trigger_support_requests_updated_at
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_requests_updated_at();

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own support requests
DROP POLICY IF EXISTS "Users can insert own support requests" ON public.support_requests;
CREATE POLICY "Users can insert own support requests"
  ON public.support_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own support requests
DROP POLICY IF EXISTS "Users can view own support requests" ON public.support_requests;
CREATE POLICY "Users can view own support requests"
  ON public.support_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can update/delete (deny normal users)
DROP POLICY IF EXISTS "Service role can update support requests" ON public.support_requests;
CREATE POLICY "Service role can update support requests"
  ON public.support_requests
  FOR UPDATE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role can delete support requests" ON public.support_requests;
CREATE POLICY "Service role can delete support requests"
  ON public.support_requests
  FOR DELETE
  TO service_role
  USING (true);

-- =====================================================
-- STORAGE BUCKET FOR SCREENSHOTS
-- =====================================================

-- Create support-screenshots bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-screenshots',
  'support-screenshots',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for support-screenshots bucket

-- Authenticated users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload own screenshots" ON storage.objects;
CREATE POLICY "Users can upload own screenshots"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-screenshots' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own screenshots
DROP POLICY IF EXISTS "Users can read own screenshots" ON storage.objects;
CREATE POLICY "Users can read own screenshots"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can read all screenshots
DROP POLICY IF EXISTS "Service role can read all screenshots" ON storage.objects;
CREATE POLICY "Service role can read all screenshots"
  ON storage.objects
  FOR SELECT
  TO service_role
  USING (bucket_id = 'support-screenshots');

-- =====================================================
-- HELPER FUNCTION: Get user's recent support requests
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_support_requests(
  p_user_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  category text,
  message text,
  job_id uuid,
  screenshot_url text,
  status text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id,
    sr.category,
    sr.message,
    sr.job_id,
    sr.screenshot_url,
    sr.status,
    sr.created_at
  FROM public.support_requests sr
  WHERE sr.user_id = COALESCE(p_user_id, auth.uid())
  ORDER BY sr.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_support_requests TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.support_requests IS 'Phase 1 customer support requests';
COMMENT ON COLUMN public.support_requests.category IS 'Support request category: payments_refunds, job_issue, account_login, bug_app_problem, other';
COMMENT ON COLUMN public.support_requests.metadata IS 'JSON metadata: platform, app_version, device_model, role, etc.';
COMMENT ON COLUMN public.support_requests.status IS 'Request status: open or resolved';
