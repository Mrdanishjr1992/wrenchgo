-- =====================================================
-- UPDATE MEDIA ASSETS PUBLIC URLS
-- =====================================================
-- Run this AFTER applying migrations to set correct URLs
-- Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- =====================================================

-- Step 1: Get your project URL
-- Go to: Supabase Dashboard > Settings > API
-- Copy the "Project URL" (e.g., https://abcdefghijk.supabase.co)

-- Step 2: Update the URLs below with your project reference
-- Example: If your URL is https://abcdefghijk.supabase.co
-- Then YOUR_PROJECT_REF = abcdefghijk

-- Step 3: Run this SQL in Supabase SQL Editor:

UPDATE public.media_assets 
SET public_url = 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/logovideo.mp4'
WHERE key = 'logo_video';

UPDATE public.media_assets 
SET public_url = 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd.mp4'
WHERE key = 'wrenchgo_ad_1';

UPDATE public.media_assets 
SET public_url = 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd2.mp4'
WHERE key = 'wrenchgo_ad_2';

UPDATE public.media_assets 
SET public_url = 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd3.mp4'
WHERE key = 'wrenchgo_ad_3';

-- Step 4: Verify the URLs are correct
SELECT key, public_url FROM public.media_assets ORDER BY key;

-- Expected output:
-- logo_video    | https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/logovideo.mp4
-- wrenchgo_ad_1 | https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd.mp4
-- wrenchgo_ad_2 | https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd2.mp4
-- wrenchgo_ad_3 | https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd3.mp4
