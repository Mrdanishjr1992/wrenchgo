-- Create mechanic-verification storage bucket
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mechanic-verification',
  'mechanic-verification',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Mechanics can upload own docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mechanic-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Mechanics can view own docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mechanic-verification'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin(auth.uid())
  )
);

CREATE POLICY "Admins can view all verification docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mechanic-verification'
  AND public.is_admin(auth.uid())
);

COMMIT;
