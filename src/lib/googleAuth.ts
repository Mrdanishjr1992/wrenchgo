import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID, // must be WEB client id
    offlineAccess: false,
    scopes: ['openid', 'profile', 'email'],
    forceCodeForRefreshToken: false,
  });
};

type GoogleSignInResult = {
  idToken?: string | null;
  data?: { idToken?: string | null };
};

export const signInWithGoogle = async (): Promise<{ idToken: string | null; error?: string }> => {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Force account picker / fresh auth
  try {
    await GoogleSignin.signOut(); // clears current GoogleSignin session
  } catch {}

    // Optional (stronger): clears cached token so it must re-auth
  try {
    await GoogleSignin.revokeAccess();
  } catch {}
    const result: any = await GoogleSignin.signIn();

    // Handles both possible shapes:
    const idToken = result?.idToken ?? result?.data?.idToken ?? null;

    if (!idToken) {
      console.log('Google signIn() result:', JSON.stringify(result, null, 2));
      return { idToken: null, error: 'No ID token received from Google' };
    }

    return { idToken };
  } catch (error: any) {
    console.error('Google Sign-In error:', error);

    if (error.code === statusCodes.SIGN_IN_CANCELLED) return { idToken: null, error: 'Sign-in cancelled' };
    if (error.code === statusCodes.IN_PROGRESS) return { idToken: null, error: 'Sign-in already in progress' };
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { idToken: null, error: 'Google Play Services not available' };

    return { idToken: null, error: error.message || 'Unknown error' };
  }
};

export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Google Sign-Out error:', error);
  }
};

export const isGoogleSignedIn = async (): Promise<boolean> => {
  return GoogleSignin.isSignedIn();
};
