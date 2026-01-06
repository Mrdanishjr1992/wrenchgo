-- Create media_assets table to track video files in Supabase Storage
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "key" TEXT UNIQUE NOT NULL,
    bucket TEXT NOT NULL,
    path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    duration_seconds INTEGER,
    size_bytes BIGINT,
    public_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_media_assets_key ON public.media_assets("key");

-- Enable Row Level Security
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous and authenticated users to read media assets
DROP POLICY IF EXISTS "Allow public read access to media assets" ON public.media_assets;
CREATE POLICY "Allow public read access to media assets"
    ON public.media_assets
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Policy: Only service role can insert/update/delete
DROP POLICY IF EXISTS "Service role can manage media assets" ON public.media_assets;
CREATE POLICY "Service role can manage media assets"
    ON public.media_assets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_media_assets_updated_at ON public.media_assets;
CREATE TRIGGER update_media_assets_updated_at
    BEFORE UPDATE ON public.media_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial video records (will be populated by upload script)
-- These are placeholders that the upload script will upsert
INSERT INTO public.media_assets ("key", bucket, path, content_type) VALUES
    ('logo_video', 'wrenchgo-videos', 'logovideo.mp4', 'video/mp4'),
    ('wrenchgo_ad_1', 'wrenchgo-videos', 'wrenchGoAd.mp4', 'video/mp4'),
    ('wrenchgo_ad_2', 'wrenchgo-videos', 'wrenchGoAd2.mp4', 'video/mp4'),
    ('wrenchgo_ad_3', 'wrenchgo-videos', 'wrenchGoAd3.mp4', 'video/mp4')
ON CONFLICT ("key") DO NOTHING;
