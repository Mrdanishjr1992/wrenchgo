# Quick Reference: Code Changes

## 📝 File: app/(auth)/sign-in.tsx

### Imports (Lines 1-22)
```diff
- import { useState, useEffect } from "react";
+ import React, { useState, useEffect } from "react";
  import {
    View,
    Text,
    TextInput,
    Pressable,
    Alert,
    ActivityIndicator,
    Image,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
  } from "react-native";
  import { useRouter } from "expo-router";
  import AsyncStorage from "@react-native-async-storage/async-storage";
  import { supabase } from "../../src/lib/supabase";
  import { useTheme } from "../../src/ui/theme-context";
  import { LinearGradient } from "expo-linear-gradient";
+ import { useGoogleAuth } from "../../src/lib/googleAuth";
+ import * as WebBrowser from "expo-web-browser";
+ 
+ WebBrowser.maybeCompleteAuthSession();
```

### State & Hooks (Lines 28-44)
```diff
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

+ const { request, response, promptAsync } = useGoogleAuth();

  useEffect(() => {
    loadSavedCredentials();
  }, []);

+ useEffect(() => {
+   if (response?.type === 'success') {
+     handleGoogleSignIn(response.params.id_token);
+   }
+ }, [response]);
```

### loadSavedCredentials (Lines 46-52)
```diff
  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem("@saved_email");
-     const savedPassword = await AsyncStorage.getItem("@saved_password");
      if (savedEmail) setEmail(savedEmail);
-     if (savedPassword) setPassword(savedPassword);
    } catch (e) {
      console.log("Failed to load saved credentials");
    }
  };
```

### New Functions (After loadSavedCredentials)
```typescript
+ const ensureProfile = async (userId: string, userEmail: string, fullName?: string) => {
+   try {
+     const { data: existing } = await supabase
+       .from("profiles")
+       .select("id")
+       .eq("auth_id", userId)

+       .maybeSingle();
+
+     if (!existing) {
+       await supabase.from("profiles").insert({
+         id: userId,
+         full_name: fullName || userEmail.split('@')[0],
+         role: "customer",
+       });
+     }
+   } catch (error) {
+     console.error("Error ensuring profile:", error);
+   }
+ };
+
+ const handleGoogleSignIn = async (idToken: string) => {
+   try {
+     setLoading(true);
+     setErr(null);
+
+     const { data, error } = await supabase.auth.signInWithIdToken({
+       provider: 'google',
+       token: idToken,
+     });
+
+     if (error) {
+       setErr(error.message);
+       return;
+     }
+
+     if (data.user) {
+       await ensureProfile(
+         data.user.id,
+         data.user.email || '',
+         data.user.user_metadata?.full_name || data.user.user_metadata?.name
+       );
+     }
+
+     router.replace("/");
+   } catch (e: any) {
+     Alert.alert("Google sign in failed", e?.message ?? "Try again.");
+   } finally {
+     setLoading(false);
+   }
+ };
+
+ const onGoogleSignIn = async () => {
+   try {
+     await promptAsync();
+   } catch (e: any) {
+     Alert.alert("Error", e?.message ?? "Failed to open Google sign in");
+   }
+ };
```

### onSignIn - Remember Me (Lines ~86-92)
```diff
      if (rememberMe) {
        await AsyncStorage.setItem("@saved_email", emailClean);
-       await AsyncStorage.setItem("@saved_password", password);
      } else {
        await AsyncStorage.removeItem("@saved_email");
-       await AsyncStorage.removeItem("@saved_password");
      }
```

### UI - After Login Button (After line ~301)
```tsx
+         <View style={{ flexDirection: "row", alignItems: "center", marginVertical: spacing.md }}>
+           <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
+           <Text style={{ ...text.muted, marginHorizontal: spacing.md, fontSize: 12 }}>OR</Text>
+           <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
+         </View>
+
+         <Pressable
+           onPress={onGoogleSignIn}
+           disabled={!request || loading}
+           style={({ pressed }) => ({
+             backgroundColor: colors.surface,
+             paddingVertical: 16,
+             borderRadius: 999,
+             alignItems: "center",
+             borderWidth: 1,
+             borderColor: colors.border,
+             flexDirection: "row",
+             justifyContent: "center",
+             gap: 12,
+             opacity: (!request || loading) ? 0.55 : pressed ? 0.85 : 1,
+           })}
+         >
+           <Text style={{ fontSize: 20 }}>🔍</Text>
+           <Text style={{ fontWeight: "900", color: colors.textPrimary, letterSpacing: 0.6 }}>
+             Continue with Google
+           </Text>
+         </Pressable>
```

---

## 📝 File: src/lib/googleAuth.ts (NEW)

```typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

const getGoogleClientId = () => {
  if (Platform.OS === 'ios') {
    return GOOGLE_IOS_CLIENT_ID;
  } else if (Platform.OS === 'android') {
    return GOOGLE_ANDROID_CLIENT_ID;
  }
  return GOOGLE_WEB_CLIENT_ID;
};

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export const useGoogleAuth = () => {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'wrenchgo',
    path: 'auth/callback',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: getGoogleClientId(),
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
    },
    discovery
  );

  return {
    request,
    response,
    promptAsync,
  };
};

export const exchangeCodeForToken = async (code: string): Promise<string | null> => {
  try {
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: getGoogleClientId(),
        code,
        redirectUri: AuthSession.makeRedirectUri({
          scheme: 'wrenchgo',
          path: 'auth/callback',
        }),
      },
      discovery
    );

    return tokenResponse.idToken || null;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return null;
  }
};
```

---

## 📝 File: app.json

```diff
  "ios": {
-   "supportsTablet": true
+   "supportsTablet": true,
+   "bundleIdentifier": "com.wrenchgo.app"
  },
  "android": {
    "adaptiveIcon": {
      "backgroundColor": "#E6F4FE",
      "foregroundImage": "./assets/images/android-icon-foreground.png",
      "backgroundImage": "./assets/images/android-icon-background.png",
      "monochromeImage": "./assets/images/android-icon-monochrome.png"
    },
    "edgeToEdgeEnabled": true,
-   "predictiveBackGestureEnabled": false
+   "predictiveBackGestureEnabled": false,
+   "package": "com.wrenchgo.app"
  },
```

---

## 📝 File: .env

```diff
  EXPO_PUBLIC_SUPABASE_URL=https://kkpkpybqbtmcvriqrmrt.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vxO0iiikifg7EH-rVaNgMQ_xZgb_uwb
+ 
+ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
+ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
+ EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

---

## 📝 File: .env.example (NEW)

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

---

## 📦 Dependencies

```bash
npx expo install expo-auth-session expo-crypto
```

---

## ✅ Testing Checklist

### Setup
- [ ] Create Google OAuth credentials (Web, iOS, Android)
- [ ] Enable Google provider in Supabase
- [ ] Fill in `.env` with Client IDs
- [ ] Restart Expo dev server

### Functionality
- [ ] "Continue with Google" button appears
- [ ] Button opens Google consent screen
- [ ] After selecting account, redirects to app
- [ ] User is logged in
- [ ] Profile created with role="customer"
- [ ] Routes to correct screen (customer/mechanic)
- [ ] Email/password login still works
- [ ] "Remember me" only stores email (not password)
- [ ] Subsequent logins don't duplicate profiles

### Platforms
- [ ] iOS (simulator + device)
- [ ] Android (emulator + device)
- [ ] Web (browser)

---

## 🔧 Configuration Values

| Setting | Value |
|---------|-------|
| **Scheme** | `wrenchgo` |
| **Redirect Path** | `auth/callback` |
| **Full Redirect URI** | `wrenchgo://auth/callback` |
| **iOS Bundle ID** | `com.wrenchgo.app` |
| **Android Package** | `com.wrenchgo.app` |
| **Supabase Callback** | `https://YOUR_PROJECT.supabase.co/auth/v1/callback` |

---

## 🚨 Important Notes

1. **Security**: Passwords are NO LONGER stored in AsyncStorage
2. **Profiles**: New Google users get role="customer" by default
3. **Routing**: Existing routing logic in `app/index.tsx` is unchanged
4. **Email/Password**: Existing sign-in flow is preserved
5. **Deep Linking**: Uses `wrenchgo://` scheme for OAuth redirects

---

## 📚 Documentation Files

- `GOOGLE_SIGNIN_SETUP.md` - Detailed setup instructions
- `IMPLEMENTATION_SUMMARY.md` - Complete implementation overview
- `.env.example` - Environment variable template
