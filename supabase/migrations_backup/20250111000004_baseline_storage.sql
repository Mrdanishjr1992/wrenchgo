-- ============================================================================
-- Migration: 20250111000004_baseline_storage.sql
-- ============================================================================
-- Purpose: Storage buckets and access policies for file uploads
-- Dependencies: 20250111000001 (profiles table for owner checks)
-- Risk Level: Low (idempotent with ON CONFLICT and DROP POLICY IF EXISTS)
-- Rollback: N/A - baseline migration, requires full DB reset
--
-- BUCKETS CREATED:
--   - avatars (public read, owner write)
--   - vehicle-images (owner access)
--   - job-images (participant access)
--   - review-media (participant access)
--   - chat-attachments (participant access)
--   - support-screenshots (owner access)
--
-- WARNING: Do not modify - this migration is applied in production.
--          Create new migrations for any storage changes.
-- ============================================================================

-- =====================================================
-- CONSOLIDATED BASELINE - PART 4: STORAGE POLICIES
-- =====================================================
-- Apply after 0000_baseline_functions.sql
-- =====================================================

BEGIN;

-- =====================================================
-- CREATE STORAGE BUCKETS (idempotent)
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('vehicle-images', 'vehicle-images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('job-images', 'job-images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('review-media', 'review-media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('chat-attachments', 'chat-attachments', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('support-screenshots', 'support-screenshots', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- AVATARS BUCKET POLICIES (public read)
-- =====================================================

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
CREATE POLICY "avatars_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- VEHICLE-IMAGES BUCKET POLICIES
-- =====================================================

DROP POLICY IF EXISTS "vehicle_images_owner_read" ON storage.objects;
CREATE POLICY "vehicle_images_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "vehicle_images_owner_upload" ON storage.objects;
CREATE POLICY "vehicle_images_owner_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "vehicle_images_owner_delete" ON storage.objects;
CREATE POLICY "vehicle_images_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- JOB-IMAGES BUCKET POLICIES
-- =====================================================

DROP POLICY IF EXISTS "job_images_involved_read" ON storage.objects;
CREATE POLICY "job_images_involved_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-images'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "job_images_customer_upload" ON storage.objects;
CREATE POLICY "job_images_customer_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-images'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND j.customer_id = auth.uid()
    )
  );

-- =====================================================
-- REVIEW-MEDIA BUCKET POLICIES
-- =====================================================

DROP POLICY IF EXISTS "review_media_public_read" ON storage.objects;
CREATE POLICY "review_media_public_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'review-media');

DROP POLICY IF EXISTS "review_media_reviewer_upload" ON storage.objects;
CREATE POLICY "review_media_reviewer_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'review-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- CHAT-ATTACHMENTS BUCKET POLICIES
-- =====================================================

DROP POLICY IF EXISTS "chat_attachments_participant_read" ON storage.objects;
CREATE POLICY "chat_attachments_participant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id::text = (storage.foldername(name))[2]
        AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_attachments_sender_upload" ON storage.objects;
CREATE POLICY "chat_attachments_sender_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- SUPPORT-SCREENSHOTS BUCKET POLICIES
-- =====================================================

DROP POLICY IF EXISTS "support_screenshots_owner_read" ON storage.objects;
CREATE POLICY "support_screenshots_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "support_screenshots_owner_upload" ON storage.objects;
CREATE POLICY "support_screenshots_owner_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "support_screenshots_service_role" ON storage.objects;
CREATE POLICY "support_screenshots_service_role" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'support-screenshots');

COMMIT;
