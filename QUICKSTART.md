# 🚀 Quick Start - Google Sign-In

## ✅ Implementation Complete!

Google Sign-In has been successfully added to your WrenchGo app. Follow these steps to configure and test.

---

## 📋 Step 1: Install Dependencies (Already Done ✓)

```bash
npx expo install expo-auth-session expo-crypto
```

---

## 🔑 Step 2: Get Google OAuth Credentials

### A. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API** (or Google Identity)

### B. Create OAuth 2.0 Credentials

#### **For Web (Required)**
1. Credentials → Create Credentials → OAuth 2.0 Client ID
2. Application type: **Web application**
3. Authorized redirect URIs:
   ```
   https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** → Save for later

#### **For iOS**
1. Create Credentials → OAuth 2.0 Client ID
2. Application type: **iOS**
3. Bundle ID: `com.wrenchgo.app`
4. Copy the **Client ID** → Save for later

#### **For Android**
1. Get SHA-1 fingerprint:
   ```bash
   # Development
   keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey
   # Password: android
   ```
2. Create Credentials → OAuth 2.0 Client ID
3. Application type: **Android**
4. Package name: `com.wrenchgo.app`
5. SHA-1 certificate fingerprint: (paste from above)
6. Copy the **Client ID** → Save for later

---

## 🗄️ Step 3: Configure Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `kkpkpybqbtmcvriqrmrt`
3. Navigate to: **Authentication** → **Providers** → **Google**
4. Toggle **Enable Google provider**
5. Enter:
   - **Client ID**: (Web Client ID from Google)
   - **Client Secret**: (Web Client Secret from Google)
6. Verify Redirect URL:
   ```
   https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback
   ```
7. Click **Save**

---

## 🔐 Step 4: Add Environment Variables

Edit your `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://kkpkpybqbtmcvriqrmrt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vxO0iiikifg7EH-rVaNgMQ_xZgb_uwb

# Add these with your Google Client IDs:
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com
```

**⚠️ Important:** Replace `YOUR_*_CLIENT_ID` with actual values from Google Cloud Console

---

## 🧪 Step 5: Test the Implementation

### Restart Expo Dev Server
```bash
# Stop current server (Ctrl+C)
npx expo start --clear
```

### Test on iOS
```bash
npx expo run:ios
```

### Test on Android
```bash
npx expo run:android
```

### Test on Web
```bash
npx expo start --web
```

---

## ✅ Testing Checklist

On the sign-in screen:

- [ ] "Continue with Google" button appears below email/password form
- [ ] Click the button
- [ ] Google OAuth consent screen opens
- [ ] Select your Google account
- [ ] App redirects back automatically
- [ ] You're logged in and routed to customer or mechanic tabs
- [ ] Check Supabase → Authentication → Users (new user appears)
- [ ] Check Supabase → Table Editor → profiles (profile created with role="customer")
- [ ] Sign out and sign in again with Google (no duplicate profile)
- [ ] Email/password login still works

---

## 🐛 Troubleshooting

### "redirect_uri_mismatch" Error
**Problem:** Google OAuth redirect URI doesn't match

**Solution:**
1. Check Google Cloud Console → Credentials → Your Web Client
2. Ensure redirect URI is exactly:
   ```
   https://kkpkpybqbtmcvriqrmrt.supabase.co/auth/v1/callback
   ```
3. No trailing slash, must use https

### "Invalid client" Error
**Problem:** Wrong Client ID for platform

**Solution:**
1. Verify `.env` has correct Client IDs
2. Restart Expo dev server: `npx expo start --clear`
3. Ensure you're using the right Client ID:
   - iOS device/simulator → iOS Client ID
   - Android device/emulator → Android Client ID
   - Web browser → Web Client ID

### Button is Disabled/Grayed Out
**Problem:** OAuth request not initialized

**Solution:**
1. Check `.env` has Client IDs filled in
2. Restart Expo: `npx expo start --clear`
3. Check console for errors
4. Verify environment variables loaded: Add `console.log(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)` in `googleAuth.ts`

### Profile Not Created
**Problem:** Database insert failed

**Solution:**
1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Verify RLS policies on `profiles` table allow inserts
3. Check that `profiles` table has columns: `id`, `full_name`, `role`

### App Doesn't Redirect Back
**Problem:** Deep linking not configured

**Solution:**
1. Verify `app.json` has:
   ```json
   "scheme": "wrenchgo"
   ```
2. For iOS: Rebuild app with `npx expo run:ios`
3. For Android: Rebuild app with `npx expo run:android`

---

## 📱 Platform-Specific Notes

### iOS
- Requires iOS Client ID from Google Cloud Console
- Bundle ID must match: `com.wrenchgo.app`
- Test on both simulator and physical device

### Android
- Requires Android Client ID from Google Cloud Console
- Package name must match: `com.wrenchgo.app`
- SHA-1 fingerprint must be registered
- Development and production builds need separate SHA-1 fingerprints

### Web
- Uses Web Client ID
- Works in any browser
- No additional configuration needed

---

## 🔒 Security Notes

✅ **Implemented:**
- Passwords are NO LONGER stored in AsyncStorage
- Only email is stored for "Remember me" feature
- Google ID tokens are exchanged securely with Supabase
- Profile creation uses safe defaults (role="customer")
- No duplicate profiles on subsequent logins

---

## 📚 Additional Documentation

- **`GOOGLE_SIGNIN_SETUP.md`** - Detailed setup guide
- **`IMPLEMENTATION_SUMMARY.md`** - Technical overview
- **`PATCH_CHANGES.md`** - Code changes reference

---

## 🎉 You're Ready!

Once you've completed steps 2-4 above, your Google Sign-In will be fully functional!

**Need help?** Check the troubleshooting section or review the detailed setup guide in `GOOGLE_SIGNIN_SETUP.md`.
