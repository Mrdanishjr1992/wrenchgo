# Google Sign-In Setup Guide for WrenchGo

This guide walks you through setting up native Google Sign-In with Supabase authentication for both Android and iOS.

## Prerequisites

- Google Cloud Console account
- Supabase project
- EAS CLI installed (`npm install -g eas-cli`)
- EAS account configured (`eas login`)

---

## Part 1: Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

### Step 2: Enable Google Sign-In API

1. Navigate to **APIs & Services** > **Library**
2. Search for "Google Sign-In API" or "Google+ API"
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (unless you have a Google Workspace)
3. Fill in required fields:
   - **App name**: WrenchGo
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Add scopes:
   - `./auth/userinfo.email`
   - `./auth/userinfo.profile`
   - `openid`
5. Add test users (your email addresses for testing)
6. Click **Save and Continue**

### Step 4: Create OAuth Client IDs

You need to create **THREE** OAuth client IDs:

#### A. Web Client ID (Required for both platforms)

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application**
4. Name it: `WrenchGo Web Client`
5. **Authorized redirect URIs**: Add your Supabase callback URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   Replace `YOUR_PROJECT_REF` with your actual Supabase project reference (found in Supabase dashboard URL)
6. Click **Create**
7. **IMPORTANT**: Copy the **Client ID** - this is your `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

#### B. Android Client ID

**First, get your SHA-1 fingerprint from EAS:**

```bash
eas credentials
```

Select:
- Platform: **Android**
- Build profile: **development** (or **production** for production builds)
- Select **Keystore: Manage everything needed to build your project**
- Choose **Set up a new keystore**
- Copy the **SHA-1 Fingerprint** shown

**Then create the Android OAuth client:**

1. In Google Cloud Console, click **Create Credentials** > **OAuth client ID**
2. Select **Android**
3. Name it: `WrenchGo Android`
4. **Package name**: `com.mrdanmoses.wrenchgo` (from your app.json)
5. **SHA-1 certificate fingerprint**: Paste the SHA-1 from EAS
6. Click **Create**
7. Note: Android client doesn't show a secret - that's normal

#### C. iOS Client ID

1. Click **Create Credentials** > **OAuth client ID**
2. Select **iOS**
3. Name it: `WrenchGo iOS`
4. **Bundle ID**: `com.mrdanmoses.wrenchgo` (from your app.json)
5. Click **Create**
6. Copy the **Client ID** (you may need this for iOS-specific configuration)

---

## Part 2: Supabase Configuration

### Step 1: Enable Google Provider

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Find **Google** and click to expand
5. Toggle **Enable Sign in with Google** to ON

### Step 2: Configure Google Provider

1. **Client ID**: Paste your **Web Client ID** from Google Cloud Console
2. **Client Secret**: Paste the **Client Secret** from your Web OAuth client
3. **Authorized Client IDs**: Add your Web Client ID here as well
4. Click **Save**

### Step 3: Get Supabase Credentials

1. Go to **Settings** > **API**
2. Copy:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public** key

---

## Part 3: App Configuration

### Step 1: Create .env File

Create a `.env` file in your project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

**Replace with your actual values:**
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon public key
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Your Web Client ID from Google Cloud Console

### Step 2: Verify app.json Configuration

Ensure your `app.json` has the correct package identifiers:

```json
{
  "expo": {
    "android": {
      "package": "com.mrdanmoses.wrenchgo"
    },
    "ios": {
      "bundleIdentifier": "com.mrdanmoses.wrenchgo"
    }
  }
}
```

---

## Part 4: Build and Test

### Important: Native Module Requirement

`@react-native-google-signin/google-signin` is a **native module** and requires a custom development build. Expo Go will NOT work.

### Step 1: Create Development Build

**For Android:**
```bash
eas build --profile development --platform android
```

**For iOS:**
```bash
eas build --profile development --platform ios
```

### Step 2: Install the Build

- **Android**: Download the APK and install on your device
- **iOS**: Download via TestFlight or direct installation

### Step 3: Start Development Server

```bash
npx expo start --dev-client
```

### Step 4: Test Google Sign-In

1. Open the app on your device
2. Navigate to the sign-in screen
3. Tap "Continue with Google"
4. You should see the native Google account picker
5. Select an account and authorize
6. You should be signed in and redirected to the home screen

---

## Troubleshooting

### "Sign-in cancelled" or "SIGN_IN_CANCELLED"
- User cancelled the sign-in flow
- This is normal behavior

### "Google Play Services not available"
- Android only: Device doesn't have Google Play Services
- Test on a device with Google Play Services installed

### "Developer Error" or "API not enabled"
- Ensure Google Sign-In API is enabled in Google Cloud Console
- Wait a few minutes for changes to propagate

### "Invalid client ID"
- Verify `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` matches your Web Client ID
- Ensure there are no extra spaces or quotes
- Restart your development server after changing `.env`

### "Unauthorized client"
- Verify your Android SHA-1 fingerprint matches the one in Google Cloud Console
- Ensure package name matches exactly: `com.mrdanmoses.wrenchgo`
- For iOS, verify bundle identifier matches

### "Redirect URI mismatch"
- Ensure Supabase callback URL is added to Web Client authorized redirect URIs
- Format: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

### "No ID token received"
- Check that `offlineAccess: true` is set in `GoogleSignin.configure()`
- Verify Web Client ID is correct

### Profile not created in Supabase
- Check Supabase logs in Dashboard > Logs
- Ensure `profiles` table exists with correct schema
- Verify RLS policies allow inserts

---

## Common Mistakes Checklist

- [ ] Used Web Client ID (not Android or iOS client ID) in `.env`
- [ ] Added Supabase callback URL to Web Client authorized redirect URIs
- [ ] SHA-1 fingerprint from EAS matches Google Cloud Console
- [ ] Package name matches exactly in app.json and Google Cloud Console
- [ ] Google Sign-In API is enabled in Google Cloud Console
- [ ] Supabase Google provider is enabled and configured
- [ ] Built with EAS (not using Expo Go)
- [ ] Restarted development server after changing `.env`
- [ ] Added test users to OAuth consent screen (if app is not published)

---

## Architecture Overview

### Why Web Client ID?

The native Google Sign-In library uses the Web Client ID to:
1. Authenticate with Google's servers
2. Obtain an ID token
3. Exchange the ID token with Supabase for a session

This is the **recommended approach** by both Google and Supabase for native mobile apps.

### Authentication Flow

1. User taps "Continue with Google"
2. Native Google Sign-In SDK shows account picker
3. User selects account and authorizes
4. SDK returns ID token
5. App sends ID token to Supabase via `signInWithIdToken()`
6. Supabase validates token with Google
7. Supabase creates/updates user and returns session
8. App creates profile if needed
9. User is redirected to home screen

### Security Notes

- ID tokens are short-lived (1 hour)
- Tokens are validated server-side by Supabase
- No client secrets are stored in the app
- Supabase manages session refresh tokens
- All communication uses HTTPS

---

## Additional Resources

- [Google Sign-In for Android](https://developers.google.com/identity/sign-in/android/start)
- [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios/start)
- [Supabase Auth with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [@react-native-google-signin/google-signin](https://github.com/react-native-google-signin/google-signin)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

---

## Support

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/react-native-google-signin/google-signin/issues)
2. Review Supabase logs in your dashboard
3. Enable debug logging in the app (see `src/lib/googleAuth.ts`)
4. Verify all credentials are correct and match across platforms

---

**Last Updated**: 2024
**Version**: 1.0.0
