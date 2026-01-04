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
    } catch (signOutError) {
      // Ignore if not signed in
      if (__DEV__) console.log("No previous Google session to sign out");
    }

    // IMPORTANT: ensure clean state if a previous attempt got stuck
    try {
      await GoogleSignin.signInSilently();
      // If silently works, tokens should exist
    } catch {
      // ignore
    }

    await GoogleSignin.signIn();

    // Always get idToken via getTokens in modern versions
    const tokens = await GoogleSignin.getTokens();
    const idToken = tokens?.idToken ?? null;

    if (!idToken) {
      return { idToken: null, error: "Missing Google ID token (getTokens returned none)" };
    }

    return { idToken };
  } catch (e: any) {
    const code = e?.code ?? e?.statusCode;
    if (code === statusCodes.SIGN_IN_CANCELLED) return { idToken: null, error: "Sign-in cancelled" };
    if (code === statusCodes.IN_PROGRESS) return { idToken: null, error: "Sign-in already in progress" };
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { idToken: null, error: "Play Services not available" };
    return { idToken: null, error: e?.message || "Google sign-in failed" };
  }
}
