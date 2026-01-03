import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

interface GoogleSignInConfig {
  webClientId: string;
  offlineAccess: boolean;
  scopes: string[];
  forceCodeForRefreshToken: boolean;
  iosClientId?: string;
}

export const configureGoogleSignIn = () => {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in environment variables");
  }

  const config: GoogleSignInConfig = {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    scopes: ["profile", "email"],
    forceCodeForRefreshToken: false,
  };

  if (Platform.OS === "ios" && GOOGLE_IOS_CLIENT_ID) {
    config.iosClientId = GOOGLE_IOS_CLIENT_ID;
  }

  GoogleSignin.configure(config);
};

interface GoogleSignInResult {
  data?: { idToken?: string };
  idToken?: string;
}

export const signInWithGoogle = async (): Promise<{ idToken: string | null; error?: string }> => {
  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    try {
      await GoogleSignin.signOut();
    } catch (signOutErr) {
      console.warn("Failed to sign out before new sign-in:", signOutErr);
    }

    const result = await GoogleSignin.signIn();

    const typedResult = result as GoogleSignInResult;
    const idToken = typedResult?.data?.idToken ?? typedResult?.idToken ?? null;

    if (!idToken) {
      console.error("Google signIn() result:", JSON.stringify(result, null, 2));
      return { idToken: null, error: "No ID token received from Google. Check your OAuth client configuration." };
    }

    console.log("Google Sign-In successful, idToken received");
    return { idToken };
  } catch (error: any) {
    console.error("Google Sign-In error:", error);

    if (error?.code === statusCodes.SIGN_IN_CANCELLED) return { idToken: null, error: "Sign-in cancelled" };
    if (error?.code === statusCodes.IN_PROGRESS) return { idToken: null, error: "Sign-in already in progress" };
    if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { idToken: null, error: "Google Play Services not available" };

    return { idToken: null, error: error?.message || "Unknown error" };
  }
};

export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.error("Google Sign-Out error:", error);
  }
};

export const disconnectGoogle = async () => {
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch (error) {
    console.error("Google disconnect error:", error);
  }
};


