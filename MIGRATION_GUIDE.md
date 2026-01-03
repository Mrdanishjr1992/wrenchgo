# Video Migration to Supabase Storage

This document outlines the migration of MP4 video assets from local bundling to Supabase Storage.

## Architecture Decision

**Storage Type:** PUBLIC BUCKET (`wrenchgo-videos`)

**Why Public?**
- Videos are promotional/marketing content (not user-sensitive)
- Simpler app code (direct URLs, no signed URL generation)
- Better CDN caching & performance
- No expiration issues
- Seamless integration with `<Video>` components

## Files Created

1. **Migration:** `supabase/migrations/20250202000000_create_media_assets.sql`
   - Creates `media_assets` table
   - Adds RLS policies (public read, service role write)
   - Tracks video metadata (key, bucket, path, public_url, size, etc.)

2. **Upload Script:** `scripts/uploadVideos.ts`
   - Uploads MP4s to Supabase Storage
   - Creates/updates database records
   - Requires environment variables (see below)

3. **App Helper:** `src/lib/mediaAssets.ts`
   - `getMediaUrl(key)` - Async URL retrieval
   - `getMediaUrlSync(key)` - Sync cached URL retrieval
   - `initializeMediaAssets()` - Preload all URLs
   - In-memory caching for performance

4. **Updated Files:**
   - `app/infopage.tsx` - Now uses remote URLs
   - `.gitignore` - Excludes `assets/*.mp4`

## Environment Variables

### Required for Upload Script

```powershell
# Option 1: Use existing EXPO_PUBLIC_SUPABASE_URL
$env:EXPO_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"

# Option 2: Set SUPABASE_URL directly
$env:SUPABASE_URL = "https://your-project.supabase.co"

# REQUIRED: Service role key (get from Supabase Dashboard → Settings → API)
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

⚠️ **NEVER commit the service role key to git!**

### For CI/EAS Builds

The app only needs the public anon key (already configured):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Video Asset Mapping

| Local File | Key | Remote Path |
|------------|-----|-------------|
| `assets/logovideo.mp4` | `logo_video` | `logovideo.mp4` |
| `assets/wrenchGoAd.mp4` | `wrenchgo_ad_1` | `wrenchGoAd.mp4` |
| `assets/wrenchGoAd2.mp4` | `wrenchgo_ad_2` | `wrenchGoAd2.mp4` |
| `assets/wrenchGoAd3.mp4` | `wrenchgo_ad_3` | `wrenchGoAd3.mp4` |

## PowerShell Commands (Windows)

### Step 1: Apply Migration

**For Production:**
```powershell
# Push migration to production
npx supabase db push

# OR if using Supabase CLI with linked project:
supabase db push
```

**For Local Development:**
```powershell
# Start local Supabase (if not running)
supabase start

# Apply migration locally
supabase db reset
```

### Step 2: Upload Videos

```powershell
# Set environment variables (replace with your actual values)
$env:EXPO_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key-here"

# Run upload script
npx tsx scripts/uploadVideos.ts

# OR if you have ts-node installed:
npx ts-node scripts/uploadVideos.ts
```

**Expected Output:**
```
🚀 Starting video upload to Supabase Storage...

✅ Bucket "wrenchgo-videos" already exists

📹 Processing: logo_video (assets/logovideo.mp4)
   Size: 2.45 MB
   ✅ Uploaded to: logovideo.mp4
   🔗 Public URL: https://your-project.supabase.co/storage/v1/object/public/wrenchgo-videos/logovideo.mp4
   ✅ Database record updated

...

🎉 All videos uploaded successfully!
```

### Step 3: Remove MP4s from Git History

```powershell
# Remove MP4s from git index (keeps local files)
git rm --cached assets/*.mp4

# Verify files are staged for removal
git status
```

### Step 4: Commit and Push

```powershell
# Create a new branch for this migration
git checkout -b feature/migrate-videos-to-supabase

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: migrate MP4 videos to Supabase Storage

- Create media_assets table with RLS policies
- Add upload script for video migration
- Update app to use remote video URLs
- Exclude MP4s from git and app bundles
- Add mediaAssets helper with caching"

# Push to remote
git push origin feature/migrate-videos-to-supabase
```

### Step 5: Verify

```powershell
# Check Supabase Storage
# Visit: https://app.supabase.com/project/YOUR_PROJECT/storage/buckets/wrenchgo-videos

# Check database records
# Visit: https://app.supabase.com/project/YOUR_PROJECT/editor
# Run: SELECT * FROM media_assets;

# Test app locally
npm start
```

## Verification Checklist

- [ ] Migration applied successfully (`media_assets` table exists)
- [ ] Storage bucket `wrenchgo-videos` created and set to public
- [ ] All 4 MP4 files uploaded to Supabase Storage
- [ ] Database records populated with public URLs
- [ ] App loads videos from remote URLs (test on device/simulator)
- [ ] MP4 files removed from git index
- [ ] `.gitignore` updated to exclude `assets/*.mp4`
- [ ] Changes committed and pushed to GitHub

## Troubleshooting

### "Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required"
- Get the service role key from: Supabase Dashboard → Settings → API → service_role
- Set it in PowerShell: `$env:SUPABASE_SERVICE_ROLE_KEY = "your-key"`

### "Error creating bucket: Bucket already exists"
- This is normal if the bucket was created previously
- The script will continue and upload files

### "File not found: assets/logovideo.mp4"
- Ensure you're running the script from the project root
- Verify the MP4 files exist in the `assets/` directory

### Videos not loading in app
- Check that `EXPO_PUBLIC_SUPABASE_URL` is set correctly in `.env`
- Verify the bucket is set to **public** in Supabase Dashboard
- Check browser console/logs for CORS or network errors
- Ensure `initializeMediaAssets()` is called before rendering videos

### EAS Build includes MP4s
- Verify `.gitignore` includes `assets/*.mp4`
- Run `git rm --cached assets/*.mp4` to remove from git
- Rebuild with `eas build`

## Rollback Plan

If you need to revert:

```powershell
# Restore MP4s from git history
git checkout HEAD~1 -- assets/*.mp4

# Revert app code changes
git checkout HEAD~1 -- app/infopage.tsx src/lib/mediaAssets.ts

# Remove migration (if needed)
# In Supabase Dashboard → SQL Editor:
# DROP TABLE IF EXISTS public.media_assets CASCADE;

# Delete storage bucket (if needed)
# In Supabase Dashboard → Storage → wrenchgo-videos → Delete bucket
```

## Security Notes

- ✅ Service role key is only needed for the upload script (run once)
- ✅ App uses public anon key (safe to commit)
- ✅ RLS policies prevent unauthorized writes
- ✅ Public bucket allows direct CDN access (no auth needed)
- ⚠️ Never commit `.env` files with service role keys
- ⚠️ Rotate service role key if accidentally exposed

## Performance Benefits

- **Smaller app bundle:** MP4s no longer bundled (saves ~10-50 MB)
- **Faster updates:** Video changes don't require app rebuild
- **CDN caching:** Supabase Storage uses CDN for global delivery
- **Lazy loading:** Videos load on-demand, not at app startup

## Future Enhancements

- Add video duration metadata (use ffprobe or similar)
- Implement video transcoding for multiple resolutions
- Add video thumbnails/posters
- Track video analytics (views, completion rate)
- Support user-uploaded videos (with private bucket + signed URLs)
