# Native Google Sign-In - Quick Start

## ✅ What's Been Done

1. ✅ Installed `@react-native-google-signin/google-signin`
2. ✅ Removed old `expo-auth-session` dependencies
3. ✅ Updated `src/lib/googleAuth.ts` with native implementation
4. ✅ Updated `app/(auth)/sign-in.tsx` to use native Google Sign-In
5. ✅ Simplified `.env.example` to only require Web Client ID

## 🚀 Next Steps (Required)

### 1. Configure Google Cloud Console

Follow the detailed guide in `GOOGLE_SIGNIN_SETUP.md` to:
- Create Web, Android, and iOS OAuth client IDs
- Get SHA-1 fingerprint from EAS for Android
- Configure OAuth consent screen
- Enable Google Sign-In API

### 2. Configure Supabase

- Enable Google provider in Supabase Dashboard
- Add your Web Client ID and Client Secret
- Add Web Client ID to "Authorized Client IDs"

### 3. Update Your .env File

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

### 4. Build with EAS (Required!)

**This is a native module - Expo Go will NOT work!**

```bash
# For Android
eas build --profile development --platform android

# For iOS
eas build --profile development --platform ios
```

### 5. Install and Test

- Install the build on your device
- Run `npx expo start --dev-client`
- Test Google Sign-In with the native account picker

## 📚 Full Documentation

See `GOOGLE_SIGNIN_SETUP.md` for:
- Step-by-step Google Cloud Console setup
- Supabase configuration details
- Troubleshooting guide
- Common mistakes checklist
- Architecture overview

## 🔑 Key Changes

### Before (expo-auth-session)
- Used web-based OAuth flow
- Required redirect URIs in app.json
- "Not compliant with secure OAuth policy" errors
- No native account picker

### After (@react-native-google-signin/google-signin)
- Native Google Sign-In SDK
- Native account picker UI
- Compliant with Google's secure OAuth policies
- Better user experience
- More secure

## ⚠️ Important Notes

1. **Web Client ID is required** - Not Android or iOS client ID
2. **EAS build is mandatory** - This is a native module
3. **SHA-1 from EAS** - Must match Google Cloud Console
4. **Package name must match** - `com.mrdanmoses.wrenchgo`
5. **Restart dev server** - After changing `.env`

## 🐛 Quick Troubleshooting

| Error | Solution |
|-------|----------|
| "Developer Error" | Enable Google Sign-In API in Cloud Console |
| "Invalid client ID" | Check Web Client ID in `.env` |
| "Unauthorized client" | Verify SHA-1 and package name |
| "Sign-in cancelled" | User cancelled - normal behavior |
| "Play Services not available" | Test on device with Google Play Services |

## 📞 Need Help?

Check the full troubleshooting section in `GOOGLE_SIGNIN_SETUP.md`
