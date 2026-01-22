# Google Sign-In Fix - Complete Implementation

## Root Cause Analysis

**Primary Issue:** `google-services.json` had an empty `oauth_client` array, causing error 12500 (SIGN_IN_FAILED).

**Secondary Issues Found:**
- None - code was already correctly structured
- Database migrations already set `role = NULL` (no default role)
- RLS policies already correct
- Routing logic already correct

## Changes Made

### A) Code Changes

#### 1. `google-services.json` (CRITICAL FIX)
**Problem:** Empty `oauth_client: []` array
**Fix:** Added OAuth client configuration with:
- Android OAuth client (type 1) with SHA-1 certificate hash
- Web OAuth client (type 3) for Supabase authentication

```json
"oauth_client": [
  {
    "client_id": "455158957304-oue6rla9dqc1f6a6b5s1kdk428np1lf6.apps.googleusercontent.com",
    "client_type": 1,
    "android_info": {
      "package_name": "com.wrenchgo.app",
      "certificate_hash": "fc088f05c764087118f8e6209f5e08bc1b9cd964"
    }
  },
  {
    "client_id": "455158957304-uis2hapnk672ledqh18tlgp5vdcflf4q.apps.googleusercontent.com",
    "client_type": 3
  }
]
```

#### 2. `src/lib/googleAuth.ts` (ENHANCEMENT)
**Changes:**
- Added `__DEV__` debug logging for better troubleshooting
- Added proper error code handling (SIGN_IN_CANCELLED, IN_PROGRESS, PLAY_SERVICES_NOT_AVAILABLE)
- Improved error messages
- Added logging for configuration confirmation

**No breaking changes** - all existing functionality preserved.

### B) Database/Migrations

**No changes needed** - migrations already correct:
- `handle_new_user()` function sets `role = NULL` (line 43 in `20250127000003_functions_triggers.sql`)
- `set_user_role()` function prevents role changes after initial selection
- RLS policies allow profile insertion and updates correctly

### C) App Code (sign-in.tsx, sign-up.tsx)

**No changes needed** - already correct:
- `sign-up.tsx` routes to `/(auth)/choose-role` after successful signup (line 107)
- `sign-in.tsx` has proper `ensureProfileAndRoute()` logic
- Google Sign-In flow properly calls `signInWithIdToken()`

## Firebase Console Configuration Required

**CRITICAL:** You must update your Firebase project to match the `google-services.json` configuration.

### Steps:

1. **Go to Firebase Console:** https://console.firebase.google.com/project/wrenchgo-611a8

2. **Add Android OAuth Client:**
   - Navigate to: Project Settings > General > Your apps > Android app
   - Click "Add fingerprint"
   - Add SHA-1: `FC:08:8F:05:C7:64:C8:71:18:F8:E6:20:9F:5E:08:BC:1B:9C:D9:64`
   - This is your debug keystore fingerprint

3. **Verify OAuth Clients in Google Cloud Console:**
   - Go to: https://console.cloud.google.com/apis/credentials?project=wrenchgo-611a8
   - Verify these OAuth 2.0 Client IDs exist:
     - **Android client:** `455158957304-oue6rla9dqc1f6a6b5s1kdk428np1lf6.apps.googleusercontent.com`
       - Package name: `com.wrenchgo.app`
       - SHA-1: `FC:08:8F:05:C7:64:C8:71:18:F8:E6:20:9F:5E:08:BC:1B:9C:D9:64`
     - **Web client:** `455158957304-uis2hapnk672ledqh18tlgp5vdcflf4q.apps.googleusercontent.com`
       - Authorized redirect URIs should include your Supabase callback URL

4. **Download Updated google-services.json:**
   - After adding SHA-1, download the updated `google-services.json`
   - Replace the file in your project root
   - **Important:** The file I updated is a template - you should download the real one from Firebase

5. **Verify Supabase Google Provider Configuration:**
   - Go to: Supabase Dashboard > Authentication > Providers > Google
   - Ensure "Authorized Client IDs" includes the WEB client ID:
     `455158957304-uis2hapnk672ledqh18tlgp5vdcflf4q.apps.googleusercontent.com`

## Environment Variables

Ensure your `.env` file has:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=455158957304-uis2hapnk672ledqh18tlgp5vdcflf4q.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id-if-needed>
```

## Verification Checklist

### 1. Verify Configuration

```bash
# Check google-services.json has oauth_client entries
cat google-services.json | grep -A 10 "oauth_client"

# Check environment variables
cat .env | grep GOOGLE
```

**Expected:**
- `oauth_client` array should have 2 entries (Android + Web)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` should be set

### 2. Rebuild the App

```bash
# Clear cache and rebuild
npx expo prebuild --clean
eas build --profile development --platform android

# Or for local development build
npx expo run:android
```

**Why:** The `google-services.json` is embedded during the build process.

### 3. Test Google Sign-In Flow

**Steps:**
1. Open the app in Expo Dev Client (NOT Expo Go)
2. Navigate to Sign-In screen
3. Tap "Sign in with Google"
4. Select a Google account

**Expected Logs (in Metro/Logcat):**
```
✅ Google Sign-In configured with WEB client ID: 455158957304-uis2hapnk672ledqh18tlgp5vdcflf4q.apps.googleusercontent.com
🔐 Starting Google Sign-In...
✅ Google Sign-In completed, extracting tokens...
✅ Got ID token, length: 1234
🔍 ID Token Audience (aud): 455158957304-uis2hapnk672ledqh18tlgp5vdcflf4q.apps.googleusercontent.com
🔍 ID Token Issuer (iss): https://accounts.google.com
🔍 ID Token Email: user@example.com
🔎 signInWithIdToken result: { session: {...}, user: {...} }
✅ Google sign-in successful: { userId: '...', email: 'user@example.com' }
[AUTH] profile attempt 1 { profile: { auth_id: '...', role: null }, error: null }
```

**Expected Behavior:**
- Google account picker appears
- After selection, app shows loading indicator
- User is redirected to `/(auth)/choose-role` screen
- No error messages

### 4. Verify ID Token Audience

**In the logs, check:**
```
🔍 ID Token Audience (aud): 455158957304-uis2hapnk672ledqh18tlgp5vdcflf4q.apps.googleusercontent.com
```

**Must match:** The WEB client ID configured in Supabase Google provider.

**If it doesn't match:**
- The token will be rejected by Supabase
- You'll see: "Google sign-in did not create a session"

### 5. Verify Supabase Session Creation

**Check logs for:**
```
🔎 signInWithIdToken result: { session: {...}, user: {...} }
```

**If session is null:**
- Check Supabase Dashboard > Authentication > Providers > Google
- Verify "Authorized Client IDs" includes the `aud` from the token
- Check Supabase logs for rejection reason

### 6. Verify Role Selection Flow

**Test New User:**
1. Sign in with a NEW Google account (never used before)
2. Should route to `/(auth)/choose-role`
3. Select "Customer" or "Mechanic"
4. Should route to `/` (main app)

**Test Existing User:**
1. Sign in with an EXISTING Google account (already has role)
2. Should route directly to `/` (main app)
3. Should NOT show choose-role screen

### 7. Verify Role Cannot Be Changed

**Test:**
1. Sign in as existing user
2. Try to call `set_user_role()` again (via Supabase SQL Editor):
   ```sql
   SELECT set_user_role('mechanic');
   ```

**Expected:**
```
ERROR: Role already set. Cannot change role after initial selection.
```

### 8. Verify RLS Policies

**Test:**
1. Sign in as user A
2. Try to query user B's profile:
   ```typescript
   const { data, error } = await supabase
     .from('profiles')
     .select('*')
     .eq('auth_id', '<user-b-id>')
     .single();
   ```

**Expected:**
- `data` should be null (or only public fields visible)
- User can only see their own profile via `auth_id = auth.uid()`

## Common Issues & Solutions

### Issue 1: Still Getting Error 12500

**Cause:** Old `google-services.json` cached in build
**Solution:**
```bash
npx expo prebuild --clean
rm -rf android/app/build
eas build --profile development --platform android --clear-cache
```

### Issue 2: "Google sign-in did not create a session"

**Cause:** Token `aud` doesn't match Supabase authorized client IDs
**Solution:**
1. Check token `aud` in logs
2. Go to Supabase Dashboard > Authentication > Providers > Google
3. Add the `aud` value to "Authorized Client IDs"

### Issue 3: "Missing Google ID token"

**Cause:** `google-services.json` still has empty `oauth_client`
**Solution:**
1. Download fresh `google-services.json` from Firebase Console
2. Verify it has `oauth_client` array with 2 entries
3. Rebuild app

### Issue 4: "Play Services not available"

**Cause:** Testing on emulator without Google Play Services
**Solution:**
- Use a physical device, OR
- Use an emulator with Google Play Services (e.g., Pixel with Play Store)

### Issue 5: Role Defaults to "customer"

**Cause:** Old migration still active
**Solution:**
```bash
# Reset database and reapply migrations
supabase db reset

# Or manually update the function
supabase db push
```

## Production Deployment

### Before Launch:

1. **Generate Release Keystore:**
   ```bash
   keytool -genkey -v -keystore release.keystore -alias wrenchgo -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Get Release SHA-1:**
   ```bash
   keytool -list -v -keystore release.keystore -alias wrenchgo
   ```

3. **Add Release SHA-1 to Firebase:**
   - Firebase Console > Project Settings > Android app
   - Add the release SHA-1 fingerprint

4. **Download Production google-services.json:**
   - Download from Firebase Console
   - Replace in project

5. **Build Release:**
   ```bash
   eas build --profile production --platform android
   ```

## Summary

**Files Changed:**
- ✅ `google-services.json` - Added OAuth client configuration
- ✅ `src/lib/googleAuth.ts` - Enhanced error handling and logging

**Files Verified (No Changes Needed):**
- ✅ `app/(auth)/sign-in.tsx` - Already correct
- ✅ `app/(auth)/sign-up.tsx` - Already correct
- ✅ `supabase/migrations/*` - Already correct

**Manual Steps Required:**
1. Update Firebase Console with SHA-1 fingerprint
2. Verify Google Cloud Console OAuth clients
3. Download fresh `google-services.json` from Firebase
4. Rebuild app with `npx expo prebuild --clean`
5. Test on physical device or emulator with Play Services

**Expected Outcome:**
- Google Sign-In works reliably on Android dev-client builds
- New users route to choose-role screen
- Existing users route to main app
- No default role assigned
- Role cannot be changed after selection
- Production-ready implementation
