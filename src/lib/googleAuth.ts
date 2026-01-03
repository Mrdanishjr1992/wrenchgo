import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

export const configureGoogleSignIn = () => {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in environment variables");
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
    scopes: ["profile", "email"],
    ...(Platform.OS === "ios" && GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
  });

  if (__DEV__) {
    console.log("✅ Google Sign-In configured with WEB client ID:", GOOGLE_WEB_CLIENT_ID);
  }
};

export const signInWithGoogle = async (): Promise<{
  idToken: string | null;
  accessToken?: string;
  error?: string;
}> => {
  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    if (__DEV__) {
      console.log("🔐 Starting Google Sign-In...");
    }

    const userInfo = await GoogleSignin.signIn();

    if (__DEV__) {
      console.log("✅ Google Sign-In completed, extracting tokens...");
    }

    const idToken =
      (userInfo as any)?.idToken ??
      (userInfo as any)?.data?.idToken ??
      null;

    if (!idToken) {
      console.error("❌ No ID token in userInfo:", Object.keys(userInfo || {}));
      return { idToken: null, error: "Missing Google ID token" };
    }

    if (__DEV__) {
      console.log("✅ Got ID token, length:", idToken.length);
    }

    const tokens = await GoogleSignin.getTokens();
    const accessToken = tokens?.accessToken;

    return { idToken, accessToken };
  } catch (e: any) {
    if (__DEV__) {
      console.error("❌ Google Sign-In error:", {
        message: e?.message,
        code: e?.code,
        statusCode: e?.statusCode,
      });
    }

    if (e.code === statusCodes.SIGN_IN_CANCELLED) {
      return { idToken: null, error: "Sign-in cancelled" };
    } else if (e.code === statusCodes.IN_PROGRESS) {
      return { idToken: null, error: "Sign-in already in progress" };
    } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { idToken: null, error: "Play Services not available" };
    }

    return { idToken: null, error: e?.message || "Google sign-in failed" };
  }
};
