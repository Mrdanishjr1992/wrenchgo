# Troubleshooting: Error 400 invalid_request

## Error Message
```
Error 400: invalid_request
request details: flowName=GeneralOAuthFlow
```

## Root Causes & Solutions

### 1. ⚠️ **Missing Google Client ID** (Most Common)

**Problem:** Environment variables not set or not loaded

**Check:**
```bash
# Look at your .env file
cat .env
```

**Solution:**
1. Ensure `.env` has your Google Client IDs:
   ```env
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=987654321.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=456789123.apps.googleusercontent.com
   ```

2. **Restart Expo completely:**
   ```bash
   # Stop the server (Ctrl+C)
   npx expo start --clear
   ```

3. Check console logs for:
   ```
   OAuth Redirect URI: wrenchgo://auth/callback
   ```

---

### 2. 🔧 **Wrong Redirect URI in Google Cloud Console**

**Problem:** Google OAuth credentials don't have the correct redirect URI

**For Supabase + Google Sign-In, you need TWO redirect URIs:**

#### A. Supabase Callback (Required)
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback
```

#### B. App Deep Link (Required for mobile)
```
wrenchgo://auth/callback
```

**How to Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services** → **Credentials**
3. Click your **Web Client ID**
4. Under **Authorized redirect URIs**, add BOTH:
   - `https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback`
   - `wrenchgo://auth/callback`
5. Click **Save**
6. Wait 5 minutes for changes to propagate

---

### 3. 📱 **Platform-Specific Client ID Issues**

**Problem:** Using wrong Client ID for the platform

**Solution:**

#### For iOS:
- Must use **iOS Client ID** (not Web)
- Bundle ID must match: `com.wrenchgo.app`
- Set in `.env`:
  ```env
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
  ```

#### For Android:
- Must use **Android Client ID** (not Web)
- Package name must match: `com.wrenchgo.app`
- SHA-1 fingerprint must be registered
- Set in `.env`:
  ```env
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
  ```

#### For Web:
- Must use **Web Client ID**
- Set in `.env`:
  ```env
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
  ```

---

### 4. 🔐 **Supabase Google Provider Not Configured**

**Problem:** Supabase doesn't have Google provider enabled

**Solution:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: `kkpkpybqbtmcvriqrmrt`
3. Navigate to: **Authentication** → **Providers** → **Google**
4. Toggle **Enable Google provider** ON
5. Enter:
   - **Client ID**: Your Web Client ID from Google
   - **Client Secret**: Your Web Client Secret from Google
6. Verify **Redirect URL** shows:
   ```
   https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback
   ```
7. Click **Save**

---

### 5. 🌐 **Testing on Web vs Mobile**

**Problem:** Different OAuth flows for web vs mobile

**For Web (Expo Web):**
- Uses Web Client ID
- Redirects to Supabase callback
- Then redirects back to app

**For Mobile (iOS/Android):**
- Uses platform-specific Client ID
- Uses deep link: `wrenchgo://auth/callback`
- Direct OAuth flow

**Solution:**
Test on the correct platform with the correct Client ID:

```bash
# Web
npx expo start --web
# Uses EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

# iOS
npx expo run:ios
# Uses EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

# Android
npx expo run:android
# Uses EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
```

---

## 🔍 Debugging Steps

### Step 1: Check Environment Variables
```bash
# In your terminal
echo $EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
```

Or add to `src/lib/googleAuth.ts`:
```typescript
console.log('Google Client IDs:', {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
});
```

### Step 2: Check Redirect URI
Look in console logs for:
```
OAuth Redirect URI: wrenchgo://auth/callback
```

### Step 3: Verify Google Cloud Console
1. Go to your OAuth Client in Google Cloud Console
2. Check **Authorized redirect URIs** includes:
   - `https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback`
   - `wrenchgo://auth/callback` (for mobile)

### Step 4: Check Supabase Logs
1. Go to Supabase Dashboard
2. Navigate to: **Logs** → **Auth Logs**
3. Look for errors related to Google OAuth

---

## ✅ Quick Fix Checklist

- [ ] `.env` file has Google Client IDs filled in (not empty)
- [ ] Restarted Expo dev server: `npx expo start --clear`
- [ ] Google Cloud Console has both redirect URIs:
  - `https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback`
  - `wrenchgo://auth/callback`
- [ ] Supabase Google provider is enabled
- [ ] Using correct Client ID for platform (Web/iOS/Android)
- [ ] Waited 5 minutes after changing Google Cloud Console settings
- [ ] Bundle ID (iOS) and Package (Android) match: `com.wrenchgo.app`

---

## 🆘 Still Not Working?

### Check Console Logs
The app now logs detailed OAuth information:
```
OAuth Redirect URI: wrenchgo://auth/callback
Starting Google OAuth with redirect URI: ...
OAuth result: { type: 'success' | 'error' | 'cancel', ... }
```

### Common Error Messages

**"Configuration Error: Google Client ID not configured"**
→ Fill in `.env` and restart Expo

**"redirect_uri_mismatch"**
→ Add redirect URIs to Google Cloud Console

**"invalid_client"**
→ Wrong Client ID for platform or Client ID doesn't exist

**"access_denied"**
→ User cancelled or Google account not allowed

---

## 📝 Example Working Configuration

### .env
```env
EXPO_PUBLIC_SUPABASE_URL=https://kkpkpybqbtmcvriqrmrt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vxO0iiikifg7EH-rVaNgMQ_xZgb_uwb

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=987654321-xyz789.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=456789123-def456.apps.googleusercontent.com
```

### Google Cloud Console - Web Client
**Authorized redirect URIs:**
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback
wrenchgo://auth/callback
```

### Supabase - Google Provider
- **Enabled:** ✅
- **Client ID:** `123456789-abc123.apps.googleusercontent.com`
- **Client Secret:** `GOCSPX-...`
- **Redirect URL:** `https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback`

---

## 🎯 Next Steps

1. **Fill in `.env`** with your actual Google Client IDs
2. **Restart Expo:** `npx expo start --clear`
3. **Check console logs** for OAuth Redirect URI
4. **Test again** and check for new error messages
5. If still failing, share the console logs for more specific help
