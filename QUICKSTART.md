# 🚀 Quick Start: Video Migration

## ⚠️ Environment Check
**Which Supabase environment are you targeting?**
- [ ] **Production** (hosted Supabase project)
- [ ] **Local** (supabase start)

**If production:** Test locally first, then apply to production.

---

## 📋 Execution Steps (PowerShell)

### 1️⃣ Apply Database Migration

**Production:**
```powershell
npx supabase db push
```

**Local:**
```powershell
supabase start
supabase db reset
```

---

### 2️⃣ Set Environment Variables

```powershell
# Your Supabase project URL (already in .env)
$env:EXPO_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"

# Service role key (get from Supabase Dashboard → Settings → API)
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

⚠️ **NEVER commit the service role key!**

---

### 3️⃣ Upload Videos

```powershell
npx tsx scripts/uploadVideos.ts
```

**Expected output:**
```
🚀 Starting video upload to Supabase Storage...
✅ Bucket "wrenchgo-videos" already exists
📹 Processing: logo_video (assets/logovideo.mp4)
   ✅ Uploaded to: logovideo.mp4
   🔗 Public URL: https://...
   ✅ Database record updated
🎉 All videos uploaded successfully!
```

---

### 4️⃣ Remove MP4s from Git

```powershell
# Remove from git index (keeps local files)
git rm --cached assets/*.mp4

# Verify
git status
```

---

### 5️⃣ Commit & Push

```powershell
# Create branch
git checkout -b feature/migrate-videos-to-supabase

# Stage changes
git add .

# Commit
git commit -m "feat: migrate MP4 videos to Supabase Storage

- Create media_assets table with RLS policies
- Add upload script for video migration
- Update app to use remote video URLs
- Exclude MP4s from git and app bundles"

# Push
git push origin feature/migrate-videos-to-supabase
```

---

## ✅ Verification

- [ ] Visit Supabase Dashboard → Storage → `wrenchgo-videos` (see 4 MP4s)
- [ ] Run SQL: `SELECT * FROM media_assets;` (see 4 rows with public URLs)
- [ ] Test app: `npm start` (videos load from remote URLs)
- [ ] Check git: `git status` (MP4s staged for removal)

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| "SUPABASE_SERVICE_ROLE_KEY required" | Get from Supabase Dashboard → Settings → API |
| "File not found: assets/logovideo.mp4" | Run script from project root |
| Videos not loading in app | Check bucket is **public** in Supabase Dashboard |
| EAS build still includes MP4s | Run `git rm --cached assets/*.mp4` and rebuild |

---

## 📦 What Changed

| File | Change |
|------|--------|
| `supabase/migrations/20250202000000_create_media_assets.sql` | ✨ New migration |
| `scripts/uploadVideos.ts` | ✨ New upload script |
| `src/lib/mediaAssets.ts` | ✨ New helper module |
| `app/infopage.tsx` | 🔄 Uses remote URLs |
| `.gitignore` | 🔄 Excludes `assets/*.mp4` |

---

## 🎯 Benefits

- ✅ **Smaller app bundle** (saves 10-50 MB)
- ✅ **Faster updates** (no rebuild for video changes)
- ✅ **CDN delivery** (global performance)
- ✅ **No EAS build bloat**

---

See **MIGRATION_GUIDE.md** for full documentation.
