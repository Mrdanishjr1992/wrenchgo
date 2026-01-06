-- =====================================================
-- MESSAGING AND MEDIA (PRODUCTION-READY)
-- =====================================================
-- Purpose: messages, notifications, media_assets
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE: messages
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  body text NOT NULL,
  read_at timestamptz,
  
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT messages_sender_not_recipient CHECK (sender_id != recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_job ON public.messages(job_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(recipient_id, read_at) WHERE deleted_at IS NULL AND read_at IS NULL;

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  title text NOT NULL,
  body text,
  data jsonb,
  
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read_at) WHERE deleted_at IS NULL AND read_at IS NULL;

-- =====================================================
-- TABLE: media_assets
-- =====================================================
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Lookup key (e.g., "wrenchgo_ad_1")
  key text UNIQUE NOT NULL,
  
  -- Storage details
  bucket text NOT NULL DEFAULT 'media',
  storage_path text NOT NULL,
  public_url text,
  
  -- Metadata
  content_type text,
  size_bytes bigint,
  duration_seconds int,
  
  -- Ownership (nullable for public assets like ads)
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_key ON public.media_assets(key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_job ON public.media_assets(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_uploader ON public.media_assets(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_bucket_path ON public.media_assets(bucket, storage_path) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.media_assets IS 'Media assets with key-based lookup. Public assets have NULL uploaded_by and job_id';
COMMENT ON COLUMN public.media_assets.key IS 'Unique lookup key used by app (e.g., wrenchgo_ad_1)';
COMMENT ON COLUMN public.media_assets.public_url IS 'Full public URL if asset is publicly accessible';

COMMIT;
