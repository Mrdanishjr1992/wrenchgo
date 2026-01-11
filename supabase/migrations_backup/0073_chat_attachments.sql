-- Add attachment support to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_type text CHECK (attachment_type IN ('image', 'file'));

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- RLS policies for chat-attachments bucket
CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.attachment_url LIKE '%' || name
      AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMENT ON COLUMN public.messages.attachment_url IS 'URL to attached file in storage';
COMMENT ON COLUMN public.messages.attachment_type IS 'Type of attachment: image or file';
