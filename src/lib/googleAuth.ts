import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

export const configureGoogleSignIn = () => {
  if (!WEB_CLIENT_ID) throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");

  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
    scopes: ["email", "profile"],
  });

  if (__DEV__) console.log("✅ Google Sign-In configured:", WEB_CLIENT_ID);
};

export async function signInWithGoogle(): Promise<{ idToken: string | null; error?: string }> {
  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // Sign out first to force account selection
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore if not signed in
    }

    // Sign in
    await GoogleSignin.signIn();

    // Get tokens - idToken is needed for Supabase
    const tokens = await GoogleSignin.getTokens();
    const idToken = tokens?.idToken ?? null;

    if (!idToken) {
      return { idToken: null, error: "Failed to get ID token from Google" };
    }

    return { idToken };
  } catch (e: any) {
    const code = e?.code ?? e?.statusCode;
    const msg = e?.message || "";

    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return { idToken: null, error: "Sign-in cancelled" };
    }
    if (code === statusCodes.IN_PROGRESS) {
      return { idToken: null, error: "Sign-in already in progress" };
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { idToken: null, error: "Play Services not available" };
    }

    if (__DEV__) {
      console.error("Google Sign-In error:", { code, msg, full: e });
    }

    return { idToken: null, error: msg || "Google sign-in failed" };
  }
}