export const USER_FRIENDLY_ERRORS: Record<string, string> = {
  "Failed to fetch": "Unable to connect. Please check your internet connection.",
  "Network request failed": "Unable to connect. Please check your internet connection.",
  "timeout": "Request timed out. Please try again.",
  "Not authenticated": "Please sign in to continue.",
  "Not signed in": "Please sign in to continue.",
  "Invalid login credentials": "Invalid email or password. Please try again.",
  "Email not confirmed": "Please verify your email address before signing in.",
  "User already registered": "An account with this email already exists.",
  "Password should be at least 6 characters": "Password must be at least 6 characters.",
  "JWT expired": "Your session has expired. Please sign in again.",
  "refresh_token_not_found": "Your session has expired. Please sign in again.",
};

export function getFriendlyErrorMessage(error: unknown, fallback?: string): string {
  const defaultMessage = fallback || "Something went wrong. Please try again.";
  
  if (!error) return defaultMessage;
  
  const message = error instanceof Error 
    ? error.message 
    : typeof error === "string" 
      ? error 
      : String(error);
  
  for (const [key, friendly] of Object.entries(USER_FRIENDLY_ERRORS)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return friendly;
    }
  }
  
  if (message.includes("PGRST") || message.includes("violates") || message.includes("constraint")) {
    return defaultMessage;
  }
  
  if (message.includes("Cannot coerce") || message.includes("JSON")) {
    return "Unable to save changes. Please try again.";
  }
  
  return defaultMessage;
}
